import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { SpeedReport } from '../types/metrics';

interface SpeedComparisonProps {
  data: SpeedReport | undefined;
}

export function SpeedComparison({ data }: SpeedComparisonProps) {
  if (!data || data.packages.length === 0) {
    return (
      <div className="metric-card">
        <h3 className="text-lg font-semibold mb-4">Speed Comparison</h3>
        <p className="text-gray-400">
          No benchmark data available. Run the analyzer with <code className="bg-bb-accent px-1 rounded">--benchmark</code> flag.
        </p>
      </div>
    );
  }

  const chartData = data.packages.map(pkg => ({
    name: pkg.path.split('/').slice(-2).join('/'),
    fullPath: pkg.path,
    'go test': pkg.goTestMs,
    'bazel (cold)': pkg.bazelTestColdMs,
    'bazel (warm)': pkg.bazelTestWarmMs,
  }));

  return (
    <div className="metric-card">
      <h3 className="text-lg font-semibold mb-4">Speed Comparison: go test vs bazel test</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ left: 20, right: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="name"
            stroke="#9ca3af"
            angle={-45}
            textAnchor="end"
            height={80}
            interval={0}
          />
          <YAxis stroke="#9ca3af" label={{ value: 'ms', angle: -90, position: 'insideLeft' }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #374151' }}
            labelStyle={{ color: '#fff' }}
            formatter={(value: number) => [`${value}ms`]}
          />
          <Legend />
          <Bar dataKey="go test" fill="#22c55e" radius={[4, 4, 0, 0]} />
          <Bar dataKey="bazel (cold)" fill="#ef4444" radius={[4, 4, 0, 0]} />
          <Bar dataKey="bazel (warm)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-gray-500 mt-2">
        Note: Cold runs include cache startup time. Warm runs benefit from Bazel's incremental caching.
      </p>
    </div>
  );
}
