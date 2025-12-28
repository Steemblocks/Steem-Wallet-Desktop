import { Wallet, Shield, Zap, Globe, ArrowRight, Users, TrendingUp } from "lucide-react";
import LoginDialog from "./LoginDialog";

interface WelcomePageProps {
  onLoginSuccess: (username: string, method: 'privatekey' | 'masterpassword') => void;
}

const WelcomePage = ({ onLoginSuccess }: WelcomePageProps) => {
  const features = [
    {
      icon: Shield,
      title: "Bank-Grade Security",
      description: "Your keys never leave your device. Encrypted locally with military-grade protection.",
      color: "from-emerald-500 to-green-600",
      iconBg: "bg-emerald-500/15",
      iconColor: "text-emerald-400"
    },
    {
      icon: Zap,
      title: "Lightning Fast",
      description: "Instant transactions on the Steem blockchain. No delays, no waiting.",
      color: "from-blue-500 to-cyan-500",
      iconBg: "bg-blue-500/15",
      iconColor: "text-blue-400"
    },
    {
      icon: TrendingUp,
      title: "Full Control",
      description: "Power up, delegate, trade on the DEX - all your Steem operations in one place.",
      color: "from-purple-500 to-pink-500",
      iconBg: "bg-purple-500/15",
      iconColor: "text-purple-400"
    },
    {
      icon: Globe,
      title: "Decentralized",
      description: "Connect directly to the Steem blockchain. No middlemen, no restrictions.",
      color: "from-orange-500 to-amber-500",
      iconBg: "bg-orange-500/15",
      iconColor: "text-orange-400"
    }
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-steemit-500/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/3 rounded-full blur-3xl" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 max-w-4xl w-full text-center">
        {/* Logo & Title */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center mb-6">
            <img src="/steem-logo.png" alt="Steem" className="w-20 h-20" />
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            Welcome to{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-steemit-400 to-emerald-400">
              Steem Wallet
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Your secure gateway to the Steem blockchain. Manage your assets, stake your power, and explore the decentralized web.
          </p>
        </div>

        {/* CTA Button */}
        <div className="mb-12">
          <LoginDialog onLoginSuccess={onLoginSuccess}>
            <button
              className="group relative px-8 py-4 text-base font-medium bg-slate-800/80 hover:bg-slate-700/80 text-white rounded-xl border border-slate-600/50 hover:border-steemit-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-steemit-500/10"
            >
              <span className="flex items-center gap-3">
                <Wallet className="w-5 h-5 text-steemit-400" />
                Connect Your Account
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-steemit-400 group-hover:translate-x-1 transition-all" />
              </span>
            </button>
          </LoginDialog>
          
          <p className="mt-4 text-sm text-slate-500">
            Login with your Steem private key or master password
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group relative p-5 rounded-xl bg-slate-800/40 border border-slate-700/50 backdrop-blur-sm hover:bg-slate-800/60 hover:border-slate-600/50 transition-all duration-300"
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${feature.iconBg} ring-1 ring-white/5 group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className={`w-6 h-6 ${feature.iconColor}`} />
                </div>
                <div className="text-left">
                  <h3 className="text-base font-semibold text-white mb-1">{feature.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{feature.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Stats or Trust Indicators */}
        <div className="flex items-center justify-center gap-8 text-slate-500 text-sm">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-steemit-400" />
            <span>Millions of users</span>
          </div>
          <div className="w-px h-4 bg-slate-700" />
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>Open source</span>
          </div>
          <div className="w-px h-4 bg-slate-700" />
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-400" />
            <span>100% Decentralized</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomePage;
