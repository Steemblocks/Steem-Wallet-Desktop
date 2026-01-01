
// Centralized API configuration
export const API_CONFIG = {
  // Primary Steem API endpoints (in order of preference) - api.steemit.com is most reliable
  STEEM_ENDPOINTS: [
    'https://api.steemit.com',
    'https://api.steemitdev.com',
    'https://steemd.steemworld.org/',
    'https://api.moecki.online/'
  ],
  
  // Default endpoint index
  DEFAULT_ENDPOINT_INDEX: 0,
  
  // Request timeout (in milliseconds)
  REQUEST_TIMEOUT: 10000,
  
  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000
};

// Extended node list with metadata for user selection
export interface SteemNode {
  url: string;
  name: string;
  location: string;
  description: string;
  isRecommended: boolean;
}

export const STEEM_NODES: SteemNode[] = [
  {
    url: 'https://api.steemit.com',
    name: 'Steemit (Official)',
    location: 'Global',
    description: 'Official Steemit API node - Most reliable and widely used',
    isRecommended: true
  },
  {
    url: 'https://api.steemitdev.com',
    name: 'Steemit Dev',
    location: 'Global',
    description: 'Steemit development node - Good for testing',
    isRecommended: false
  },
  {
    url: 'https://steemd.steemworld.org',
    name: 'SteemWorld',
    location: 'Europe',
    description: 'SteemWorld API node - Fast and reliable for European users',
    isRecommended: true
  },
  {
    url: 'https://api.moecki.online',
    name: 'Moecki',
    location: 'Europe',
    description: 'Community node maintained by @moecki',
    isRecommended: false
  }
];

// Custom node identifier
export const CUSTOM_NODE_ID = 'custom';

// Storage keys
const SELECTED_NODE_KEY = 'steem_selected_node';
const CUSTOM_NODE_KEY = 'steem_custom_node';
const CUSTOM_NODES_LIST_KEY = 'steem_custom_nodes_list';

// Custom node interface
export interface CustomNode {
  url: string;
  name: string;
  addedAt: number;
}

// Current selected node URL (runtime cache)
let currentNodeUrl: string | null = null;

// Initialize node from storage on module load
const initializeNode = (): void => {
  try {
    const saved = localStorage.getItem(SELECTED_NODE_KEY);
    if (saved) {
      currentNodeUrl = saved;
    }
  } catch (error) {
    console.error('Error initializing node:', error);
  }
};

// Initialize on module load
initializeNode();

// Get the current primary endpoint
export const getPrimaryEndpoint = (): string => {
  if (currentNodeUrl) {
    return currentNodeUrl;
  }
  return API_CONFIG.STEEM_ENDPOINTS[API_CONFIG.DEFAULT_ENDPOINT_INDEX];
};

// Set the current node (runtime only - call saveSelectedNode for persistence)
export const setCurrentNode = (url: string): void => {
  currentNodeUrl = url;
};

// Get all endpoints
export const getAllEndpoints = (): string[] => {
  return [...API_CONFIG.STEEM_ENDPOINTS];
};

// Get all available nodes with metadata
export const getAllNodes = (): SteemNode[] => {
  return [...STEEM_NODES];
};

// Get recommended nodes only
export const getRecommendedNodes = (): SteemNode[] => {
  return STEEM_NODES.filter(node => node.isRecommended);
};

// Save selected node to storage
export const saveSelectedNode = async (url: string): Promise<void> => {
  try {
    localStorage.setItem(SELECTED_NODE_KEY, url);
    currentNodeUrl = url;
  } catch (error) {
    console.error('Error saving selected node:', error);
  }
};

// Load selected node from storage
export const loadSelectedNode = (): string => {
  try {
    const saved = localStorage.getItem(SELECTED_NODE_KEY);
    if (saved) {
      currentNodeUrl = saved;
      return saved;
    }
  } catch (error) {
    console.error('Error loading selected node:', error);
  }
  return API_CONFIG.STEEM_ENDPOINTS[API_CONFIG.DEFAULT_ENDPOINT_INDEX];
};

// Get node info by URL
export const getNodeByUrl = (url: string): SteemNode | undefined => {
  return STEEM_NODES.find(node => node.url === url);
};

// Save custom node URL
export const saveCustomNode = async (url: string): Promise<void> => {
  try {
    localStorage.setItem(CUSTOM_NODE_KEY, url);
  } catch (error) {
    console.error('Error saving custom node:', error);
  }
};

// Load custom node URL
export const loadCustomNode = (): string => {
  try {
    const saved = localStorage.getItem(CUSTOM_NODE_KEY);
    return saved || '';
  } catch (error) {
    console.error('Error loading custom node:', error);
    return '';
  }
};

// Check if current node is a custom node (not in predefined list)
export const isCustomNode = (url: string): boolean => {
  return !STEEM_NODES.some(node => node.url === url) && url !== '';
};

// Save custom nodes list to storage
export const saveCustomNodesList = async (nodes: CustomNode[]): Promise<void> => {
  try {
    localStorage.setItem(CUSTOM_NODES_LIST_KEY, JSON.stringify(nodes));
  } catch (error) {
    console.error('Error saving custom nodes list:', error);
  }
};

// Load custom nodes list from storage
export const loadCustomNodesList = (): CustomNode[] => {
  try {
    const saved = localStorage.getItem(CUSTOM_NODES_LIST_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('Error loading custom nodes list:', error);
  }
  return [];
};

// Add a custom node to the list
export const addCustomNode = async (url: string, name: string): Promise<CustomNode[]> => {
  const nodes = loadCustomNodesList();
  // Check if already exists
  if (!nodes.some(n => n.url === url)) {
    const newNode: CustomNode = {
      url,
      name: name || `Custom Node ${nodes.length + 1}`,
      addedAt: Date.now()
    };
    nodes.push(newNode);
    await saveCustomNodesList(nodes);
  }
  return nodes;
};

// Remove a custom node from the list
export const removeCustomNode = async (url: string): Promise<CustomNode[]> => {
  let nodes = loadCustomNodesList();
  nodes = nodes.filter(n => n.url !== url);
  await saveCustomNodesList(nodes);
  return nodes;
};

// Get custom node by URL
export const getCustomNodeByUrl = (url: string): CustomNode | undefined => {
  const nodes = loadCustomNodesList();
  return nodes.find(n => n.url === url);
};

