import { useState, useEffect } from 'react';
import type { MetricsReport } from './types/metrics';
import { MetricCard } from './components/MetricCard';
import { GaugeCircle } from './components/GaugeCircle';
import { DirectoryBreakdown } from './components/DirectoryBreakdown';
import { PackageExplorer } from './components/PackageExplorer';
import { SpeedComparison } from './components/SpeedComparison';

function App() {
  const [metrics, setMetrics] = useState<MetricsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/metrics.json')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load metrics.json');
        return res.json();
      })
      .then(data => {
        setMetrics(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-400">Loading metrics...</div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl text-red-400 mb-4">Error Loading Metrics</h1>
          <p className="text-gray-400">{error || 'No metrics data available'}</p>
          <p className="text-gray-500 mt-4">
            Run the analyzer first: <code className="bg-bb-accent px-2 py-1 rounded">npm run analyze</code>
          </p>
        </div>
      </div>
    );
  }

  const repoName = metrics.repoPath.split('/').pop() || 'Repository';
  const timestamp = new Date(metrics.timestamp).toLocaleString();

  return (
    <div className="min-h-screen p-6">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Bazel Metrics Dashboard</h1>
        <div className="flex flex-wrap gap-4 text-sm text-gray-400">
          <span>Repository: <code className="text-blue-400">{repoName}</code></span>
          <span>Last scan: {timestamp}</span>
        </div>
      </header>

      {/* Gauges Row */}
      <section className="metric-card mb-6">
        <div className="flex flex-wrap justify-around gap-8">
          <div className="relative">
            <GaugeCircle
              percentage={metrics.summary.bazelizationPct}
              label="Bazelization"
              sublabel={`${metrics.summary.packagesWithBuild}/${metrics.summary.totalPackages} packages`}
              size={140}
            />
          </div>
          <div className="relative">
            <GaugeCircle
              percentage={metrics.summary.testCoveragePct}
              label="Test Coverage"
              sublabel={`${metrics.summary.packagesWithTests}/${metrics.summary.totalPackages} packages`}
              size={140}
            />
          </div>
          <div className="relative">
            <GaugeCircle
              percentage={metrics.summary.bazelizedTestsPct}
              label="Bazelized Tests"
              sublabel="packages with go_test targets"
              size={140}
            />
          </div>
        </div>
      </section>

      {/* Summary Cards */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Total Packages"
          value={metrics.summary.totalPackages.toLocaleString()}
          subtitle="Go packages found"
          color="blue"
        />
        <MetricCard
          title="BUILD Files"
          value={metrics.summary.totalBuildFiles.toLocaleString()}
          subtitle="Bazel build files"
          color="green"
        />
        <MetricCard
          title="Test Files"
          value={metrics.summary.totalTestFiles.toLocaleString()}
          subtitle="_test.go files"
          color="yellow"
        />
        <MetricCard
          title="go_test Targets"
          value={metrics.summary.totalGoTestTargets.toLocaleString()}
          subtitle="Bazel test targets"
          color="green"
        />
      </section>

      {/* Directory Breakdown and Speed Comparison */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <DirectoryBreakdown data={metrics.directoryBreakdown} />
        <SpeedComparison data={metrics.speedComparison} />
      </section>

      {/* Package Explorer */}
      <section>
        <PackageExplorer packages={metrics.packages} />
      </section>

      {/* Footer */}
      <footer className="mt-8 text-center text-sm text-gray-500">
        <p>Inspired by <a href="https://buildbuddy.io" className="text-blue-400 hover:underline">BuildBuddy</a></p>
      </footer>
    </div>
  );
}

export default App;
