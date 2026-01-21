interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: 'green' | 'yellow' | 'red' | 'blue';
}

export function MetricCard({ title, value, subtitle, color = 'blue' }: MetricCardProps) {
  const colorClasses = {
    green: 'text-green-400',
    yellow: 'text-yellow-400',
    red: 'text-red-400',
    blue: 'text-blue-400',
  };

  return (
    <div className="metric-card">
      <h3 className="text-gray-400 text-sm font-medium mb-2">{title}</h3>
      <p className={`text-3xl font-bold ${colorClasses[color]}`}>{value}</p>
      {subtitle && <p className="text-gray-500 text-sm mt-1">{subtitle}</p>}
    </div>
  );
}
