import { useState, useEffect } from 'react';
import type { MetricsReport } from './types/metrics';
import { MetricCard } from './components/MetricCard';
import { GaugeCircle } from './components/GaugeCircle';
import { DirectoryBreakdown } from './components/DirectoryBreakdown';
import { PackageExplorer } from './components/PackageExplorer';
import { SpeedComparison } from './components/SpeedComparison';
import { AIFixDashboard } from './components/AIFixDashboard';

type Page = 'metrics' | 'ai-fix';

function App() {
  const [page, setPage] = useState<Page>(() => {
    return window.location.hash === '#/ai-fix' ? 'ai-fix' : 'metrics';
  });
  const [metrics, setMetrics] = useState<MetricsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleHash = () => {
      setPage(window.location.hash === '#/ai-fix' ? 'ai-fix' : 'metrics');
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

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

  const navigateTo = (target: Page) => {
    window.location.hash = target === 'ai-fix' ? '#/ai-fix' : '#/';
    setPage(target);
  };

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="bg-bb-card border-b border-bb-accent/30 sticky top-0 z-10">
        <div className="flex items-center gap-6 px-6 py-3">
          <span className="text-lg font-bold text-white mr-2">Bazel Metrics</span>
          <div className="flex gap-1">
            <button
              onClick={() => navigateTo('metrics')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                page === 'metrics'
                  ? 'bg-bb-accent text-white'
                  : 'text-gray-400 hover:text-white hover:bg-bb-accent/50'
              }`}
            >
              Build Metrics
            </button>
            <button
              onClick={() => navigateTo('ai-fix')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                page === 'ai-fix'
                  ? 'bg-bb-accent text-white'
                  : 'text-gray-400 hover:text-white hover:bg-bb-accent/50'
              }`}
            >
              AI Fix Metrics
            </button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="p-6">
        {page === 'ai-fix' ? (
          <AIFixDashboard />
        ) : (
          <BuildMetricsPage metrics={metrics} loading={loading} error={error} />
        )}
      </main>
    </div>
  );
}

function BuildMetricsPage({ metrics, loading, error }: {
  metrics: MetricsReport | null;
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-xl text-gray-400">Loading metrics...</div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="flex items-center justify-center py-20">
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
    <>
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Bazel Build Metrics</h1>
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
        <PackageExplorer packages={metrics.packages} benchmarks={metrics.speedComparison?.packages} />
      </section>
    </>
  );
}

export default App;
