import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { DirectoryMetrics } from '../types/metrics';

interface DirectoryBreakdownProps {
  data: DirectoryMetrics[];
}

export function DirectoryBreakdown({ data }: DirectoryBreakdownProps) {
  // Take top 10 directories
  const chartData = data.slice(0, 10).map(d => ({
    name: d.name.length > 15 ? d.name.slice(0, 15) + '...' : d.name,
    fullName: d.name,
    'Bazelization %': d.bazelizationPct,
    'Test Coverage %': d.testCoveragePct,
    packages: d.totalPackages,
  }));

  return (
    <div className="metric-card">
      <h3 className="text-lg font-semibold mb-4">Directory Breakdown</h3>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis type="number" domain={[0, 100]} stroke="#9ca3af" />
          <YAxis dataKey="name" type="category" width={100} stroke="#9ca3af" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #374151' }}
            labelStyle={{ color: '#fff' }}
            formatter={(value: number) => [`${value.toFixed(1)}%`]}
          />
          <Legend />
          <Bar dataKey="Bazelization %" fill="#3b82f6" radius={[0, 4, 4, 0]} />
          <Bar dataKey="Test Coverage %" fill="#22c55e" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
