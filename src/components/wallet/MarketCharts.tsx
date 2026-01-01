
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface MarketChartsProps {
  hourlyHistory: Array<{
    time: string;
    price: number;
    volume: number;
    high: number;
    low: number;
    open: number;
    timestamp: number;
  }>;
  ticker: {
    latest: string;
    lowest_ask: string;
    highest_bid: string;
    percent_change: string;
    steem_volume: { amount: string; precision: number; nai: string };
    sbd_volume: { amount: string; precision: number; nai: string };
  } | null;
}

const MarketCharts = ({ hourlyHistory, ticker }: MarketChartsProps) => {
  const chartData = useMemo(() => {
    if (!hourlyHistory || hourlyHistory.length === 0) {
      return { priceData: [], volumeData: [] };
    }

    // Sort by timestamp to ensure proper order
    const sortedData = [...hourlyHistory].sort((a, b) => a.timestamp - b.timestamp);
    
    const priceData = sortedData.map(entry => ({
      time: entry.time,
      price: entry.price,
      high: entry.high,
      low: entry.low,
      open: entry.open
    }));

    const volumeData = sortedData.map(entry => ({
      time: entry.time,
      volume: entry.volume
    }));

    return { priceData, volumeData };
  }, [hourlyHistory]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 p-3 border border-slate-700 rounded-lg shadow-lg">
          <p className="font-medium text-white">Time: {label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {entry.value.toFixed(entry.name.includes('Price') || entry.name.includes('High') || entry.name.includes('Low') || entry.name.includes('Open') ? 6 : 0)}
              {entry.name.includes('Price') || entry.name.includes('High') || entry.name.includes('Low') || entry.name.includes('Open') ? ' SBD' : ' STEEM'}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const currentPrice = ticker ? parseFloat(ticker.latest) : 0;
  const percentChange = ticker ? parseFloat(ticker.percent_change) : 0;

  if (chartData.priceData.length === 0) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-slate-800/50 border border-slate-700 shadow-sm">
          <CardHeader>
            <CardTitle className="text-white text-lg">24H Price Chart</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center text-slate-400 py-8">
              Loading 24-hour price data...
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border border-slate-700 shadow-sm">
          <CardHeader>
            <CardTitle className="text-white text-lg">24H Volume Chart</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center text-slate-400 py-8">
              Loading volume data...
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* 24H Price Chart */}
      <Card className="bg-slate-800/50 border border-slate-700 shadow-sm">
        <CardHeader>
          <CardTitle className="text-white text-lg">24H Price Chart</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold" style={{ color: '#07d7a9' }}>
              {currentPrice.toFixed(6)} SBD
            </span>
            <span className={`text-sm ${percentChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {percentChange >= 0 ? '+' : ''}{percentChange.toFixed(2)}%
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData.priceData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis 
                  dataKey="time" 
                  className="text-xs"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                />
                <YAxis 
                  tickFormatter={(value) => value.toFixed(6)}
                  className="text-xs"
                  tick={{ fill: '#94a3b8' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="#07d7a9"
                  strokeWidth={2}
                  dot={false}
                  name="Price"
                />
                <Line
                  type="monotone"
                  dataKey="high"
                  stroke="#10b981"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  dot={false}
                  name="High"
                />
                <Line
                  type="monotone"
                  dataKey="low"
                  stroke="#ef4444"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  dot={false}
                  name="Low"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 24H Volume Chart */}
      <Card className="bg-slate-800/50 border border-slate-700 shadow-sm">
        <CardHeader>
          <CardTitle className="text-white text-lg">24H Volume Chart</CardTitle>
          <div className="text-sm text-slate-400">
            Hourly trading volume from market history
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData.volumeData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis 
                  dataKey="time" 
                  className="text-xs"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                />
                <YAxis 
                  tickFormatter={(value) => `${value.toFixed(0)}`}
                  className="text-xs"
                  tick={{ fill: '#94a3b8' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="volume"
                  fill="#07d7a9"
                  fillOpacity={0.8}
                  name="Volume"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MarketCharts;
