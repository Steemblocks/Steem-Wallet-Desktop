import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Settings,
  Server,
  Gift,
  Lock,
  Info,
  Check,
  ChevronDown,
  ChevronUp,
  Globe,
  Zap,
  Star,
  Loader2,
  Link,
  Plus,
  Shuffle,
  Trash2,
  Clock,
  Wifi,
  WifiOff,
  RefreshCw,
  Download,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SecureStorageFactory } from "@/services/secureStorage";
import { refreshClient } from "@/services/steemOperations";
import { steemWebSocket } from "@/services/steemWebSocket";
import { openExternalUrl } from "@/utils/utility";
import { getVersion } from "@tauri-apps/api/app";

// GitHub repository URLs
const GITHUB_REPO_URL = 'https://github.com/Steemblocks/Steem-Wallet-Desktop';
const GITHUB_RELEASES_URL = `${GITHUB_REPO_URL}/releases`;

import {
  STEEM_NODES,
  SteemNode,
  loadSelectedNode,
  saveSelectedNode,
  setCurrentNode,
  saveCustomNode,
  loadCustomNode,
  isCustomNode,
  CustomNode,
  loadCustomNodesList,
  addCustomNode,
  removeCustomNode,
} from "@/config/api";

interface AppSettingsOperationsProps {
  loggedInUser?: string | null;
}

interface AppSettings {
  autoRewardClaiming: boolean;
  autoAppLock: boolean;
  autoLockTimeout: number; // in minutes
  autoNodeSwitch: boolean;
}

const defaultSettings: AppSettings = {
  autoRewardClaiming: false,
  autoAppLock: false,
  autoLockTimeout: 15, // default 15 minutes
  autoNodeSwitch: false,
};

// Auto-lock timeout options (in minutes)
const AUTO_LOCK_OPTIONS = [
  { value: 1, label: '1 minute' },
  { value: 5, label: '5 minutes' },
  { value: 10, label: '10 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
];

const AppSettingsOperations = ({
  loggedInUser,
}: AppSettingsOperationsProps) => {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<string>("");
  const [isNodeSectionExpanded, setIsNodeSectionExpanded] = useState(false);
  const [isTestingNode, setIsTestingNode] = useState<string | null>(null);
  const [nodeLatencies, setNodeLatencies] = useState<
    Record<string, number | null>
  >({});
  const [customNodeUrl, setCustomNodeUrl] = useState<string>("");
  const [customNodeName, setCustomNodeName] = useState<string>("");
  const [customNodesList, setCustomNodesList] = useState<CustomNode[]>([]);
  const [isCustomNodeSelected, setIsCustomNodeSelected] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsReconnecting, setWsReconnecting] = useState(false);
  const [appVersion, setAppVersion] = useState<string>('');
  const { toast } = useToast();

  // WebSocket connection status monitoring
  useEffect(() => {
    // Check initial state
    setWsConnected(steemWebSocket.isConnected());

    const unsubConnect = steemWebSocket.onConnect(() => {
      setWsConnected(true);
      setWsReconnecting(false);
    });

    const unsubDisconnect = steemWebSocket.onDisconnect(() => {
      setWsConnected(false);
    });

    return () => {
      unsubConnect();
      unsubDisconnect();
    };
  }, []);

  // Load app version on mount
  useEffect(() => {
    const loadVersion = async () => {
      try {
        if (typeof window !== 'undefined' && '__TAURI__' in window) {
          const version = await getVersion();
          setAppVersion(version);
        } else {
          setAppVersion('dev');
        }
      } catch (error) {
        console.error('Failed to get app version:', error);
        setAppVersion('unknown');
      }
    };
    loadVersion();
  }, []);

  // Load settings and selected node from storage on mount
  useEffect(() => {
    const loadSettingsAndNode = async () => {
      try {
        const storage = SecureStorageFactory.getInstance();
        const savedSettings = await storage.getItem("app_settings");
        if (savedSettings) {
          setSettings(JSON.parse(savedSettings));
        }

        // Load selected node
        const savedNode = loadSelectedNode();
        setSelectedNode(savedNode);

        // Load custom node URL
        const savedCustomNode = loadCustomNode();
        setCustomNodeUrl(savedCustomNode);

        // Load custom nodes list
        const savedCustomNodes = loadCustomNodesList();
        setCustomNodesList(savedCustomNodes);

        // Check if custom node is selected
        if (isCustomNode(savedNode)) {
          setIsCustomNodeSelected(true);
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadSettingsAndNode();
  }, []);

  // Test current node latency on mount
  useEffect(() => {
    const testCurrentNodeLatency = async () => {
      if (selectedNode && !nodeLatencies[selectedNode]) {
        const latency = await testNodeLatency(selectedNode);
        setNodeLatencies((prev) => ({ ...prev, [selectedNode]: latency }));
      }
    };
    
    if (selectedNode) {
      testCurrentNodeLatency();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNode]);

  // Auto node switching - find and switch to best node based on latency
  const findAndSwitchToBestNode = async (showToast: boolean = true) => {
    if (showToast) {
      toast({
        title: "Finding Best Node",
        description: "Testing all nodes to find the fastest connection...",
      });
    }

    const latencyResults: { node: SteemNode; latency: number }[] = [];

    // Test all nodes in parallel for speed
    const testPromises = STEEM_NODES.map(async (node) => {
      const latency = await testNodeLatency(node.url);
      return { node, latency };
    });

    const results = await Promise.all(testPromises);

    // Filter out failed nodes and sort by latency
    for (const result of results) {
      if (result.latency !== null) {
        latencyResults.push({ node: result.node, latency: result.latency });
      }
      // Update latencies state
      setNodeLatencies((prev) => ({ ...prev, [result.node.url]: result.latency }));
    }

    // Sort by latency (fastest first)
    latencyResults.sort((a, b) => a.latency - b.latency);

    if (latencyResults.length > 0) {
      const bestNode = latencyResults[0];
      
      // Only switch if it's different from current node
      if (bestNode.node.url !== selectedNode) {
        await saveSelectedNode(bestNode.node.url);
        setCurrentNode(bestNode.node.url);
        refreshClient();
        setSelectedNode(bestNode.node.url);
        setIsCustomNodeSelected(false);

        if (showToast) {
          toast({
            title: "Switched to Best Node",
            description: `Now using ${bestNode.node.name} (${bestNode.latency}ms) - the fastest available node.`,
            variant: "success",
          });
        }
      } else if (showToast) {
        toast({
          title: "Already on Best Node",
          description: `${bestNode.node.name} (${bestNode.latency}ms) is already the fastest node.`,
          variant: "success",
        });
      }
    } else if (showToast) {
      toast({
        title: "No Nodes Available",
        description: "Could not connect to any API nodes. Please try again later.",
        variant: "destructive",
      });
    }
  };

  // Run auto node switch on mount if enabled
  useEffect(() => {
    if (!isLoading && settings.autoNodeSwitch && !isCustomNodeSelected) {
      // Small delay to let the UI settle
      const timer = setTimeout(() => {
        findAndSwitchToBestNode(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, settings.autoNodeSwitch]);

  // Save settings to storage when changed
  const updateSetting = async (key: keyof AppSettings, value: boolean) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    try {
      const storage = SecureStorageFactory.getInstance();
      await storage.setItem("app_settings", JSON.stringify(newSettings));

      // Dispatch custom event for immediate sync across components
      window.dispatchEvent(new CustomEvent('app-settings-changed', { detail: newSettings }));

      // If enabling auto node switch, immediately find and switch to best node
      if (key === "autoNodeSwitch" && value && !isCustomNodeSelected) {
        findAndSwitchToBestNode(true);
      }

      toast({
        title: "Setting Updated",
        description: `${getSettingLabel(key)} has been ${
          value ? "enabled" : "disabled"
        }.`,
        variant: "success",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Save Failed",
        description: "Could not save your settings. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Update auto-lock timeout
  const updateAutoLockTimeout = async (minutes: number) => {
    const newSettings = { ...settings, autoLockTimeout: minutes };
    setSettings(newSettings);

    try {
      const storage = SecureStorageFactory.getInstance();
      await storage.setItem("app_settings", JSON.stringify(newSettings));

      // Dispatch custom event for immediate sync across components
      window.dispatchEvent(new CustomEvent('app-settings-changed', { detail: newSettings }));

      const option = AUTO_LOCK_OPTIONS.find(o => o.value === minutes);
      toast({
        title: "Auto-Lock Time Updated",
        description: `Wallet will lock after ${option?.label || minutes + ' minutes'} of inactivity.`,
        variant: "success",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Save Failed",
        description: "Could not save your settings. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getSettingLabel = (key: keyof AppSettings): string => {
    const labels: Record<keyof AppSettings, string> = {
      autoRewardClaiming: "Auto reward claiming",
      autoAppLock: "Auto app lock",
      autoLockTimeout: "Auto-lock timeout",
      autoNodeSwitch: "Auto node switching",
    };
    return labels[key];
  };

  // Check if running in Tauri - check multiple ways to be sure
  const isTauri = (): boolean => {
    if (typeof window === 'undefined') return false;
    // Check for __TAURI__ global
    if ('__TAURI__' in window) return true;
    // Check for __TAURI_INTERNALS__ (Tauri v2)
    if ('__TAURI_INTERNALS__' in window) return true;
    return false;
  };

  // Test node latency using Tauri's HTTP client (bypasses CORS)
  const testNodeLatencyTauri = async (nodeUrl: string): Promise<number | null> => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const normalizedUrl = nodeUrl.replace(/\/+$/, "");
      
      console.log("Testing node (Tauri HTTP):", normalizedUrl);
      
      const result = await invoke<{
        success: boolean;
        status: number;
        body: string | null;
        error: string | null;
        latency_ms: number;
      }>('http_post', {
        url: normalizedUrl,
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "condenser_api.get_dynamic_global_properties",
          params: [],
          id: 1,
        }),
      });
      
      if (result.success && result.body) {
        const data = JSON.parse(result.body);
        if (data.result) {
          return result.latency_ms;
        } else if (data.error) {
          console.error("API error:", data.error);
        }
      }
      return null;
    } catch (error) {
      console.error("Node test failed (Tauri):", nodeUrl, error);
      return null;
    }
  };

  // Test node latency using browser fetch (may fail due to CORS in dev mode)
  const testNodeLatencyBrowser = async (nodeUrl: string): Promise<number | null> => {
    try {
      const normalizedUrl = nodeUrl.replace(/\/+$/, "");

      // In dev mode, warn that CORS may cause issues
      if (import.meta.env.DEV) {
        console.log("Testing node (Browser - CORS may cause issues):", normalizedUrl);
      } else {
        console.log("Testing node (Browser):", normalizedUrl);
      }
      const startTime = Date.now();

      const response = await fetch(normalizedUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "condenser_api.get_dynamic_global_properties",
          params: [],
          id: 1,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.result) {
          const endTime = Date.now();
          return endTime - startTime;
        } else if (data.error) {
          console.error("API error:", data.error);
        }
      }
      return null;
    } catch (error) {
      // In dev mode, CORS errors are expected - don't log as errors
      if (import.meta.env.DEV && error instanceof TypeError && error.message === 'Failed to fetch') {
        // Silently return null in dev mode for CORS errors
        return null;
      }
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        console.warn("Node test failed (CORS blocked):", nodeUrl);
      } else {
        console.error("Node test failed:", nodeUrl, error);
      }
      return null;
    }
  };

  // Test node latency - uses Tauri HTTP when available, falls back to browser fetch
  const testNodeLatency = async (nodeUrl: string): Promise<number | null> => {
    if (isTauri()) {
      return testNodeLatencyTauri(nodeUrl);
    }
    return testNodeLatencyBrowser(nodeUrl);
  };

  // Handle node selection
  const handleNodeSelect = async (node: SteemNode) => {
    setIsTestingNode(node.url);

    // Test the node first
    const latency = await testNodeLatency(node.url);

    if (latency !== null) {
      // Node is responsive, save it
      await saveSelectedNode(node.url);
      setCurrentNode(node.url);
      refreshClient(); // Refresh the Steem client with the new node
      setSelectedNode(node.url);
      setIsCustomNodeSelected(false);
      setNodeLatencies((prev) => ({ ...prev, [node.url]: latency }));

      toast({
        title: "Node Changed",
        description: `Switched to ${node.name} (${latency}ms). Node is now active.`,
        variant: "success",
      });
    } else {
      toast({
        title: "Node Unreachable",
        description: `Could not connect to ${node.name}. Please try another node.`,
        variant: "destructive",
      });
    }

    setIsTestingNode(null);
  };

  // Handle custom node connection
  const handleConnectCustomNode = async () => {
    if (!customNodeUrl.trim()) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid API node URL.",
        variant: "destructive",
      });
      return;
    }

    // Validate URL format and normalize
    let formattedUrl = customNodeUrl.trim();

    // Add https:// if no protocol specified
    if (
      !formattedUrl.startsWith("http://") &&
      !formattedUrl.startsWith("https://")
    ) {
      formattedUrl = "https://" + formattedUrl;
    }

    // Remove trailing slashes for consistency
    formattedUrl = formattedUrl.replace(/\/+$/, "");

    // Validate URL structure
    try {
      new URL(formattedUrl);
    } catch {
      toast({
        title: "Invalid URL Format",
        description: "Please enter a valid URL (e.g., https://api.example.com)",
        variant: "destructive",
      });
      return;
    }

    // Update the input field with formatted URL
    setCustomNodeUrl(formattedUrl);
    setIsTestingNode("custom");

    console.log("Attempting to connect to custom node:", formattedUrl);

    // Test the node first
    const latency = await testNodeLatency(formattedUrl);

    if (latency !== null) {
      // Node is responsive, save it to list and select it
      const nodeName = customNodeName.trim() || `Custom Node`;
      const updatedList = await addCustomNode(formattedUrl, nodeName);
      setCustomNodesList(updatedList);
      
      await saveCustomNode(formattedUrl);
      await saveSelectedNode(formattedUrl);
      setCurrentNode(formattedUrl);
      refreshClient(); // Refresh the Steem client with the new node
      setSelectedNode(formattedUrl);
      setIsCustomNodeSelected(true);
      setNodeLatencies((prev) => ({ ...prev, [formattedUrl]: latency }));

      // Clear input fields
      setCustomNodeUrl("");
      setCustomNodeName("");

      toast({
        title: "Custom Node Added & Connected",
        description: `${nodeName} (${latency}ms) has been saved and is now active.`,
        variant: "success",
      });
    } else {
      toast({
        title: "Node Unreachable",
        description:
          "Could not connect to the custom node. Check the browser console for details.",
        variant: "destructive",
      });
    }

    setIsTestingNode(null);
  };

  // Handle selecting a saved custom node
  const handleSelectCustomNode = async (node: CustomNode) => {
    setIsTestingNode(node.url);

    const latency = await testNodeLatency(node.url);

    if (latency !== null) {
      await saveSelectedNode(node.url);
      setCurrentNode(node.url);
      refreshClient();
      setSelectedNode(node.url);
      setIsCustomNodeSelected(true);
      setNodeLatencies((prev) => ({ ...prev, [node.url]: latency }));

      toast({
        title: "Node Changed",
        description: `Switched to ${node.name} (${latency}ms). Node is now active.`,
        variant: "success",
      });
    } else {
      toast({
        title: "Node Unreachable",
        description: `Could not connect to ${node.name}. Please try another node.`,
        variant: "destructive",
      });
    }

    setIsTestingNode(null);
  };

  // Handle deleting a custom node
  const handleDeleteCustomNode = async (node: CustomNode, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering node selection

    const updatedList = await removeCustomNode(node.url);
    setCustomNodesList(updatedList);

    // If the deleted node was selected, switch to default
    if (selectedNode === node.url) {
      const defaultNode = STEEM_NODES[0];
      await saveSelectedNode(defaultNode.url);
      setCurrentNode(defaultNode.url);
      refreshClient();
      setSelectedNode(defaultNode.url);
      setIsCustomNodeSelected(false);
    }

    toast({
      title: "Custom Node Removed",
      description: `${node.name} has been removed from your saved nodes.`,
      variant: "success",
    });
  };

  // Test all nodes
  const testAllNodes = async () => {
    const newLatencies: Record<string, number | null> = {};

    for (const node of STEEM_NODES) {
      setIsTestingNode(node.url);
      const latency = await testNodeLatency(node.url);
      newLatencies[node.url] = latency;
    }

    setNodeLatencies(newLatencies);
    setIsTestingNode(null);

    toast({
      title: "Node Test Complete",
      description:
        "All nodes have been tested. Green badges show response times.",
      variant: "success",
    });
  };

  const getLatencyColor = (latency: number | null): string => {
    if (latency === null) return "bg-red-500/20 text-red-400 border-red-500/30";
    if (latency < 500)
      return "bg-green-500/20 text-green-400 border-green-500/30";
    if (latency < 1000)
      return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    return "bg-orange-500/20 text-orange-400 border-orange-500/30";
  };

  const settingsItems = [
    {
      id: "autoRewardClaiming" as keyof AppSettings,
      label: "Auto reward claiming",
      icon: Gift,
      description:
        "Automatically claim your pending author and curation rewards when they become available",
      value: settings.autoRewardClaiming,
    },
  ];

  const currentNode = STEEM_NODES.find((n) => n.url === selectedNode);
  const displayNodeName = isCustomNodeSelected
    ? "Custom Node"
    : currentNode?.name || "Default";

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Settings className="w-6 h-6 text-steemit-500" />
          <h2 className="text-2xl font-bold text-white">App Settings</h2>
        </div>
        <p className="text-slate-400 text-sm">
          Customize your wallet experience with these application settings
        </p>
      </div>

      {/* Node Switch Card - Expanded Section */}
      <Card className="shadow-md border-0 bg-slate-800/50">
        <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 pb-4 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-steemit-500" />
              <div>
                <CardTitle className="text-lg text-white">
                  API Node Selection
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Choose your preferred Steem API node for the best performance
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Auto Node Switch Toggle */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700/50 border border-slate-600">
                <Shuffle className="w-4 h-4 text-purple-400" />
                <span className="text-sm text-slate-300">Auto</span>
                <Switch
                  checked={settings.autoNodeSwitch}
                  onCheckedChange={(checked) => updateSetting("autoNodeSwitch", checked)}
                  className="data-[state=checked]:bg-purple-500"
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsNodeSectionExpanded(!isNodeSectionExpanded)}
                className="text-slate-400 hover:text-white"
              >
                {isNodeSectionExpanded ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          {/* Current Node Display */}
          <div className="p-4 rounded-lg bg-steemit-500/10 border border-steemit-500/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-steemit-500/20 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-steemit-500" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">
                    Currently Active Node
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-white">{displayNodeName}</p>
                    {nodeLatencies[selectedNode] !== undefined && (
                      <Badge
                        variant="outline"
                        className={`text-xs ${getLatencyColor(nodeLatencies[selectedNode])}`}
                      >
                        {nodeLatencies[selectedNode] !== null
                          ? `${nodeLatencies[selectedNode]}ms`
                          : "Offline"}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {settings.autoNodeSwitch && (
                  <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                    <Shuffle className="w-3 h-3 mr-1" />
                    Auto
                  </Badge>
                )}
                <Badge className="bg-steemit-500/20 text-steemit-400 border-steemit-500/30">
                  <Globe className="w-3 h-3 mr-1" />
                  {isCustomNodeSelected
                    ? "Custom"
                    : currentNode?.location || "Global"}
                </Badge>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-2 ml-13">{selectedNode}</p>
          </div>

          {/* Expandable Node List */}
          {isNodeSectionExpanded && (
            <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
              {/* Test All Button */}
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => findAndSwitchToBestNode(true)}
                  disabled={isTestingNode !== null}
                  className="text-purple-300 border-purple-600 hover:bg-purple-700/30"
                >
                  <Shuffle className="w-4 h-4 mr-2" />
                  Find Best Node
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={testAllNodes}
                  disabled={isTestingNode !== null}
                  className="text-slate-300 border-slate-600 hover:bg-slate-700"
                >
                  {isTestingNode !== null && isTestingNode !== "custom" ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      Test All Nodes
                    </>
                  )}
                </Button>
              </div>

              {/* Recommended Nodes */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-500" />
                  Recommended Nodes
                </p>
                <div className="space-y-2">
                  {STEEM_NODES.filter((n) => n.isRecommended).map((node) => (
                    <div
                      key={node.url}
                      onClick={() => !isTestingNode && handleNodeSelect(node)}
                      className={`border rounded-lg p-4 cursor-pointer transition-all ${
                        selectedNode === node.url && !isCustomNodeSelected
                          ? "border-steemit-500 bg-steemit-500/10"
                          : "border-slate-700 bg-slate-800/30 hover:border-slate-600 hover:bg-slate-800/50"
                      } ${isTestingNode === node.url ? "opacity-70" : ""}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              selectedNode === node.url && !isCustomNodeSelected
                                ? "bg-steemit-500/20"
                                : "bg-slate-700/50"
                            }`}
                          >
                            {isTestingNode === node.url ? (
                              <Loader2 className="w-5 h-5 text-steemit-500 animate-spin" />
                            ) : selectedNode === node.url &&
                              !isCustomNodeSelected ? (
                              <Check className="w-5 h-5 text-steemit-500" />
                            ) : (
                              <Server className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-white">
                                {node.name}
                              </p>
                              <Badge
                                variant="outline"
                                className="text-xs border-yellow-500/30 text-yellow-400 bg-yellow-500/10"
                              >
                                <Star className="w-3 h-3 mr-1" />
                                Recommended
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-400">
                              {node.description}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="text-xs text-slate-400 border-slate-600"
                          >
                            <Globe className="w-3 h-3 mr-1" />
                            {node.location}
                          </Badge>
                          {nodeLatencies[node.url] !== undefined && (
                            <Badge
                              variant="outline"
                              className={`text-xs ${getLatencyColor(
                                nodeLatencies[node.url]
                              )}`}
                            >
                              {nodeLatencies[node.url] !== null
                                ? `${nodeLatencies[node.url]}ms`
                                : "Offline"}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Other Nodes */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <Server className="w-4 h-4 text-slate-400" />
                  Other Available Nodes
                </p>
                <div className="space-y-2">
                  {STEEM_NODES.filter((n) => !n.isRecommended).map((node) => (
                    <div
                      key={node.url}
                      onClick={() => !isTestingNode && handleNodeSelect(node)}
                      className={`border rounded-lg p-4 cursor-pointer transition-all ${
                        selectedNode === node.url && !isCustomNodeSelected
                          ? "border-steemit-500 bg-steemit-500/10"
                          : "border-slate-700 bg-slate-800/30 hover:border-slate-600 hover:bg-slate-800/50"
                      } ${isTestingNode === node.url ? "opacity-70" : ""}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              selectedNode === node.url && !isCustomNodeSelected
                                ? "bg-steemit-500/20"
                                : "bg-slate-700/50"
                            }`}
                          >
                            {isTestingNode === node.url ? (
                              <Loader2 className="w-5 h-5 text-steemit-500 animate-spin" />
                            ) : selectedNode === node.url &&
                              !isCustomNodeSelected ? (
                              <Check className="w-5 h-5 text-steemit-500" />
                            ) : (
                              <Server className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-white">
                              {node.name}
                            </p>
                            <p className="text-xs text-slate-400">
                              {node.description}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="text-xs text-slate-400 border-slate-600"
                          >
                            <Globe className="w-3 h-3 mr-1" />
                            {node.location}
                          </Badge>
                          {nodeLatencies[node.url] !== undefined && (
                            <Badge
                              variant="outline"
                              className={`text-xs ${getLatencyColor(
                                nodeLatencies[node.url]
                              )}`}
                            >
                              {nodeLatencies[node.url] !== null
                                ? `${nodeLatencies[node.url]}ms`
                                : "Offline"}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom Node Input */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <Link className="w-4 h-4 text-purple-400" />
                  Custom Nodes
                </p>

                {/* Saved Custom Nodes List */}
                {customNodesList.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {customNodesList.map((node) => (
                      <div
                        key={node.url}
                        onClick={() => !isTestingNode && handleSelectCustomNode(node)}
                        className={`border rounded-lg p-3 cursor-pointer transition-all ${
                          selectedNode === node.url
                            ? "border-purple-500 bg-purple-500/10"
                            : "border-slate-700 bg-slate-800/30 hover:border-slate-600 hover:bg-slate-800/50"
                        } ${isTestingNode === node.url ? "opacity-70" : ""}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                selectedNode === node.url
                                  ? "bg-purple-500/20"
                                  : "bg-slate-700/50"
                              }`}
                            >
                              {isTestingNode === node.url ? (
                                <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                              ) : selectedNode === node.url ? (
                                <Check className="w-4 h-4 text-purple-400" />
                              ) : (
                                <Server className="w-4 h-4 text-slate-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-white text-sm truncate">
                                {node.name}
                              </p>
                              <p className="text-xs text-slate-500 truncate">
                                {node.url}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {nodeLatencies[node.url] !== undefined && (
                              <Badge
                                variant="outline"
                                className={`text-xs ${getLatencyColor(
                                  nodeLatencies[node.url]
                                )}`}
                              >
                                {nodeLatencies[node.url] !== null
                                  ? `${nodeLatencies[node.url]}ms`
                                  : "Offline"}
                              </Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => handleDeleteCustomNode(node, e)}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add New Custom Node */}
                <div className="border rounded-lg p-4 border-slate-700 bg-slate-800/30">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-purple-500/20">
                      {isTestingNode === "custom" ? (
                        <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                      ) : (
                        <Plus className="w-5 h-5 text-purple-400" />
                      )}
                    </div>
                    <div className="flex-1 space-y-3">
                      <div>
                        <p className="font-medium text-white mb-1">
                          Add Custom API Node
                        </p>
                        <p className="text-xs text-slate-400">
                          Enter any Steem-compatible API endpoint URL to save and connect
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Input
                          placeholder="Node name (e.g., My Private Node)"
                          value={customNodeName}
                          onChange={(e) => setCustomNodeName(e.target.value)}
                          className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500"
                          disabled={isTestingNode === "custom"}
                        />
                        <div className="flex gap-2">
                          <Input
                            placeholder="https://your-node.example.com"
                            value={customNodeUrl}
                            onChange={(e) => setCustomNodeUrl(e.target.value)}
                            className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500"
                            disabled={isTestingNode === "custom"}
                          />
                          <Button
                            onClick={handleConnectCustomNode}
                            disabled={
                              isTestingNode === "custom" || !customNodeUrl.trim()
                            }
                            className="bg-purple-600 hover:bg-purple-700 text-white px-4"
                          >
                            {isTestingNode === "custom" ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Plus className="w-4 h-4 mr-1" />
                                Add
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!isNodeSectionExpanded && (
            <p className="text-sm text-slate-400 text-center py-2">
              Click the arrow above to view and switch between available nodes
            </p>
          )}
        </CardContent>
      </Card>

      {/* WebSocket Connection Status Card */}
      <Card className="shadow-md border-0 bg-slate-800/50">
        <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 pb-4 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wifi className="w-5 h-5 text-steemit-500" />
              <div>
                <CardTitle className="text-lg text-white">
                  WebSocket Connection
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Real-time data streaming for live updates
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className={`p-4 rounded-lg border ${
            wsConnected 
              ? "bg-green-500/10 border-green-500/30" 
              : "bg-red-500/10 border-red-500/30"
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  wsConnected ? "bg-green-500/20" : "bg-red-500/20"
                }`}>
                  {wsReconnecting ? (
                    <RefreshCw className="w-5 h-5 text-yellow-400 animate-spin" />
                  ) : wsConnected ? (
                    <Wifi className="w-5 h-5 text-green-400" />
                  ) : (
                    <WifiOff className="w-5 h-5 text-red-400" />
                  )}
                </div>
                <div>
                  <p className="text-sm text-slate-400">Connection Status</p>
                  <div className="flex items-center gap-2">
                    <p className={`font-medium ${wsConnected ? "text-green-400" : "text-red-400"}`}>
                      {wsReconnecting ? "Reconnecting..." : wsConnected ? "Connected" : "Disconnected"}
                    </p>
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        wsConnected
                          ? "bg-green-500/20 text-green-400 border-green-500/30"
                          : "bg-red-500/20 text-red-400 border-red-500/30"
                      }`}
                    >
                      {wsConnected ? "Live" : "Offline"}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!wsConnected && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setWsReconnecting(true);
                      steemWebSocket.connect().catch(() => {
                        setWsReconnecting(false);
                      });
                    }}
                    disabled={wsReconnecting}
                    className="text-slate-300 border-slate-600 hover:bg-slate-700"
                  >
                    {wsReconnecting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Reconnect
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-2 ml-13">
              wss://dhakawitness.com
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Other Settings Card */}
      <Card className="shadow-md border-0 bg-slate-800/50">
        <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 pb-4 rounded-t-lg">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-steemit-500" />
            <div>
              <CardTitle className="text-lg text-white">
                Application Preferences
              </CardTitle>
              <CardDescription className="text-slate-400">
                Configure how the wallet app behaves
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-2">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="border border-slate-700 rounded-lg p-4 animate-pulse bg-slate-800/30"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-700 rounded-lg"></div>
                      <div>
                        <div className="h-4 bg-slate-700 rounded w-32 mb-2"></div>
                        <div className="h-3 bg-slate-700 rounded w-48"></div>
                      </div>
                    </div>
                    <div className="h-6 w-11 bg-slate-700 rounded-full"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {settingsItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    className="border border-slate-700 rounded-lg p-4 bg-slate-800/30 hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start sm:items-center gap-3 flex-1">
                        <div className="w-10 h-10 rounded-lg bg-steemit-500/10 flex items-center justify-center flex-shrink-0">
                          <Icon className="w-5 h-5 text-steemit-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <Label
                            htmlFor={item.id}
                            className="text-sm sm:text-base font-medium text-white cursor-pointer block"
                          >
                            {item.label}
                          </Label>
                          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                            {item.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 self-end sm:self-center">
                        <Switch
                          id={item.id}
                          checked={item.value}
                          onCheckedChange={(checked) =>
                            updateSetting(item.id, checked)
                          }
                          className="data-[state=checked]:bg-steemit-500"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {/* Auto App Lock with Time Selector */}
              <div className="bg-slate-800/30 rounded-xl border border-slate-700/40 overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 gap-3 sm:gap-4">
                  <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center flex-shrink-0">
                      <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Label
                        htmlFor="autoAppLock"
                        className="text-sm sm:text-base font-medium text-white cursor-pointer"
                      >
                        Auto App Lock
                      </Label>
                      <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                        Automatically lock the app after inactivity
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 self-end sm:self-center">
                    {settings.autoAppLock && (
                      <Select
                        value={(settings.autoLockTimeout || 15).toString()}
                        onValueChange={(value) => updateAutoLockTimeout(parseInt(value))}
                      >
                        <SelectTrigger className="w-[120px] bg-slate-700/50 border-slate-600 text-white text-sm">
                          <SelectValue placeholder="Select time" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          {AUTO_LOCK_OPTIONS.map((option) => (
                            <SelectItem
                              key={option.value}
                              value={option.value.toString()}
                              className="text-white hover:bg-slate-700 focus:bg-slate-700"
                            >
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Switch
                      id="autoAppLock"
                      checked={settings.autoAppLock}
                      onCheckedChange={(checked) =>
                        updateSetting("autoAppLock", checked)
                      }
                      className="data-[state=checked]:bg-steemit-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* App Update Card */}
      <Card className="shadow-md border-0 bg-slate-800/50">
        <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 pb-4 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-400" />
              <div>
                <CardTitle className="text-lg text-white">
                  App Updates
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Check for new releases and view the source code
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="border-blue-500/50 text-blue-400 bg-blue-500/10">
              v{appVersion || 'Loading...'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={() => openExternalUrl(GITHUB_REPO_URL)}
              className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View Source Code
            </Button>
            <Button
              variant="outline"
              onClick={() => openExternalUrl(GITHUB_RELEASES_URL)}
              className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              <Download className="w-4 h-4 mr-2" />
              All Releases
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-900/20 border border-blue-800/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <Info className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h4 className="font-medium text-blue-300 mb-1">
                About App Settings
              </h4>
              <p className="text-sm text-blue-200/80">
                These settings are stored locally on your device and will
                persist across app sessions. Changing the API node may require
                restarting the application for changes to take full effect.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AppSettingsOperations;
