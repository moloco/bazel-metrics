import { useState, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { AIFixMetrics, WorkflowMetrics } from '../types/aiFixMetrics';
import { GaugeCircle } from './GaugeCircle';
import { MetricCard } from './MetricCard';
import { getDataUrl } from '../config';

const STATUS_COLORS: Record<string, string> = {
  success: '#22c55e',
  failure: '#ef4444',
  disabled: '#f59e0b',
};

const WORKFLOW_LABELS: Record<string, string> = {
  'post-merge': 'Post-Merge',
  'pre-merge': 'Pre-Merge',
};

function WorkflowCard({ title, metrics }: { title: string; metrics: WorkflowMetrics }) {
  const successRate = metrics.totalInvocations > 0
    ? (metrics.successfulFixes / metrics.totalInvocations) * 100
    : 0;

  const barSegments = [
    { label: 'Success', count: metrics.successfulFixes, color: STATUS_COLORS.success },
    { label: 'Failed', count: metrics.failedFixes, color: STATUS_COLORS.failure },
    { label: 'Disabled', count: metrics.testsDisabled, color: STATUS_COLORS.disabled },
  ];

  return (
    <div className="metric-card">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>

      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-400">Success Rate</span>
          <span className="text-white font-medium">{successRate.toFixed(1)}%</span>
        </div>
        <div className="h-3 bg-gray-700 rounded-full overflow-hidden flex">
          {barSegments.map((seg, i) => (
            <div
              key={i}
              style={{
                width: `${metrics.totalInvocations > 0 ? (seg.count / metrics.totalInvocations) * 100 : 0}%`,
                backgroundColor: seg.color,
              }}
              className="transition-all duration-500"
              title={`${seg.label}: ${seg.count}`}
            />
          ))}
        </div>
        <div className="flex gap-4 mt-2 text-xs">
          {barSegments.map((seg, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: seg.color }} />
              <span className="text-gray-400">{seg.label}: {seg.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2 text-sm border-t border-bb-accent/30 pt-4">
        <div className="flex justify-between">
          <span className="text-gray-400">Total Invocations</span>
          <span className="text-white">{metrics.totalInvocations}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Successful Fixes</span>
          <span className="text-green-400">{metrics.successfulFixes}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Failed Fixes</span>
          <span className="text-red-400">{metrics.failedFixes}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Tests Disabled</span>
          <span className="text-yellow-400">{metrics.testsDisabled}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">User-Applied Fixes</span>
          <span className="text-blue-400">{metrics.userAppliedFixes}</span>
        </div>
      </div>
    </div>
  );
}

export function AIFixDashboard() {
  const [metrics, setMetrics] = useState<AIFixMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testSearch, setTestSearch] = useState('');
  const [runFilter, setRunFilter] = useState<'all' | 'success' | 'failure' | 'disabled'>('all');
  const [runPage, setRunPage] = useState(0);
  const runsPerPage = 10;

  useEffect(() => {
    fetch(getDataUrl('ai-fix-metrics.json'))
      .then(res => {
        if (!res.ok) throw new Error('Failed to load ai-fix-metrics.json');
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

  const allRuns = useMemo(() => {
    if (!metrics) return [];
    return [...metrics.postMerge.runs, ...metrics.preMerge.runs]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [metrics]);

  const filteredRuns = useMemo(() => {
    return allRuns.filter(run => runFilter === 'all' || run.status === runFilter);
  }, [allRuns, runFilter]);

  const filteredTests = useMemo(() => {
    if (!metrics) return [];
    return metrics.disabledTests.filter(test =>
      !testSearch || test.target.toLowerCase().includes(testSearch.toLowerCase()) ||
      test.reason.toLowerCase().includes(testSearch.toLowerCase())
    );
  }, [metrics, testSearch]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-xl text-gray-400">Loading AI fix metrics...</div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <h1 className="text-2xl text-red-400 mb-4">Error Loading AI Fix Metrics</h1>
          <p className="text-gray-400">{error || 'No AI fix metrics data available'}</p>
          <p className="text-gray-500 mt-4">
            Ensure <code className="bg-bb-accent px-2 py-1 rounded">ai-fix-metrics.json</code> is uploaded to the GCS bucket
          </p>
        </div>
      </div>
    );
  }

  const totalInvocations = metrics.postMerge.totalInvocations + metrics.preMerge.totalInvocations;
  const totalSuccess = metrics.postMerge.successfulFixes + metrics.preMerge.successfulFixes;
  const totalDisabled = metrics.postMerge.testsDisabled + metrics.preMerge.testsDisabled;
  const totalApplied = metrics.postMerge.userAppliedFixes + metrics.preMerge.userAppliedFixes;
  const overallSuccessRate = totalInvocations > 0 ? (totalSuccess / totalInvocations) * 100 : 0;
  const postMergeSuccessRate = metrics.postMerge.totalInvocations > 0
    ? (metrics.postMerge.successfulFixes / metrics.postMerge.totalInvocations) * 100 : 0;
  const preMergeSuccessRate = metrics.preMerge.totalInvocations > 0
    ? (metrics.preMerge.successfulFixes / metrics.preMerge.totalInvocations) * 100 : 0;

  const outcomeData = [
    { name: 'Successful', value: totalSuccess, color: STATUS_COLORS.success },
    { name: 'Failed', value: metrics.postMerge.failedFixes + metrics.preMerge.failedFixes, color: STATUS_COLORS.failure },
    { name: 'Disabled Tests', value: totalDisabled, color: STATUS_COLORS.disabled },
  ];

  const paginatedRuns = filteredRuns.slice(runPage * runsPerPage, (runPage + 1) * runsPerPage);
  const totalRunPages = Math.ceil(filteredRuns.length / runsPerPage);
  const timestamp = new Date(metrics.timestamp).toLocaleString();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-white mb-2">AI-Powered Bazel Fix Metrics</h1>
        <p className="text-sm text-gray-400">Last updated: {timestamp}</p>
      </header>

      {/* Gauges Row */}
      <section className="metric-card">
        <div className="flex flex-wrap justify-around gap-8">
          <GaugeCircle
            percentage={overallSuccessRate}
            label="Overall Success"
            sublabel={`${totalSuccess}/${totalInvocations} fixes`}
            size={140}
          />
          <GaugeCircle
            percentage={postMergeSuccessRate}
            label="Post-Merge"
            sublabel={`${metrics.postMerge.successfulFixes}/${metrics.postMerge.totalInvocations} fixes`}
            size={140}
          />
          <GaugeCircle
            percentage={preMergeSuccessRate}
            label="Pre-Merge"
            sublabel={`${metrics.preMerge.successfulFixes}/${metrics.preMerge.totalInvocations} fixes`}
            size={140}
          />
        </div>
      </section>

      {/* Summary Cards */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Total AI Invocations"
          value={totalInvocations}
          subtitle="across both workflows"
          color="blue"
        />
        <MetricCard
          title="Successful Fixes"
          value={totalSuccess}
          subtitle={`${overallSuccessRate.toFixed(1)}% success rate`}
          color="green"
        />
        <MetricCard
          title="Tests Disabled"
          value={totalDisabled}
          subtitle="could not be fixed by AI"
          color="red"
        />
        <MetricCard
          title="User-Applied Fixes"
          value={totalApplied}
          subtitle="fixes merged by users"
          color="green"
        />
      </section>

      {/* Workflow Breakdown + Pie Chart */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <WorkflowCard title="Post-Merge Workflow" metrics={metrics.postMerge} />
        <WorkflowCard title="Pre-Merge Workflow" metrics={metrics.preMerge} />
        <div className="metric-card">
          <h3 className="text-lg font-semibold mb-4">Fix Outcomes</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={outcomeData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
              >
                {outcomeData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #374151' }}
                labelStyle={{ color: '#fff' }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Disabled Tests Table */}
      <section className="metric-card">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
          <div>
            <h3 className="text-lg font-semibold">Disabled Tests</h3>
            <p className="text-sm text-gray-400 mt-1">
              Tests that AI could not fix and were disabled ({metrics.disabledTests.length} total)
            </p>
          </div>
          <input
            type="text"
            placeholder="Search targets or reasons..."
            value={testSearch}
            onChange={(e) => setTestSearch(e.target.value)}
            className="px-3 py-1.5 bg-bb-accent/50 border border-bb-accent rounded text-sm text-white placeholder-gray-400 w-full sm:w-64"
          />
        </div>

        {filteredTests.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            {metrics.disabledTests.length === 0 ? 'No tests have been disabled' : 'No matching tests found'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-bb-accent">
                  <th className="pb-2 pr-4">Target</th>
                  <th className="pb-2 pr-4">Disabled At</th>
                  <th className="pb-2 pr-4">Workflow</th>
                  <th className="pb-2">Reason</th>
                </tr>
              </thead>
              <tbody>
                {filteredTests.map((test, i) => (
                  <tr key={i} className="table-row border-b border-bb-accent/30">
                    <td className="py-2 pr-4 font-mono text-xs text-red-400">{test.target}</td>
                    <td className="py-2 pr-4 text-gray-400 whitespace-nowrap">
                      {new Date(test.disabledAt).toLocaleDateString()}
                    </td>
                    <td className="py-2 pr-4">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        test.disabledBy === 'post-merge'
                          ? 'bg-purple-900/50 text-purple-300'
                          : 'bg-blue-900/50 text-blue-300'
                      }`}>
                        {WORKFLOW_LABELS[test.disabledBy]}
                      </span>
                    </td>
                    <td className="py-2 text-gray-400 text-xs">{test.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent AI Fix Runs */}
      <section className="metric-card">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
          <h3 className="text-lg font-semibold">Recent AI Fix Runs</h3>
          <select
            value={runFilter}
            onChange={(e) => { setRunFilter(e.target.value as typeof runFilter); setRunPage(0); }}
            className="px-3 py-1.5 bg-bb-accent/50 border border-bb-accent rounded text-sm text-white"
          >
            <option value="all">All Runs</option>
            <option value="success">Successful</option>
            <option value="failure">Failed</option>
            <option value="disabled">Disabled Tests</option>
          </select>
        </div>

        <div className="text-sm text-gray-400 mb-2">
          Showing {paginatedRuns.length} of {filteredRuns.length} runs
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-bb-accent">
                <th className="pb-2 pr-4">Time</th>
                <th className="pb-2 pr-4">Workflow</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Targets</th>
                <th className="pb-2 pr-4 text-center">Attempts</th>
                <th className="pb-2">PR</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRuns.map((run) => (
                <tr key={run.id} className="table-row border-b border-bb-accent/30">
                  <td className="py-2 pr-4 text-gray-400 whitespace-nowrap">
                    {new Date(run.timestamp).toLocaleString()}
                  </td>
                  <td className="py-2 pr-4">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      run.workflow === 'post-merge'
                        ? 'bg-purple-900/50 text-purple-300'
                        : 'bg-blue-900/50 text-blue-300'
                    }`}>
                      {WORKFLOW_LABELS[run.workflow]}
                    </span>
                  </td>
                  <td className="py-2 pr-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      run.status === 'success' ? 'bg-green-900/50 text-green-300' :
                      run.status === 'failure' ? 'bg-red-900/50 text-red-300' :
                      'bg-yellow-900/50 text-yellow-300'
                    }`}>
                      {run.status === 'disabled' ? 'Test Disabled' : run.status.charAt(0).toUpperCase() + run.status.slice(1)}
                    </span>
                  </td>
                  <td className="py-2 pr-4 font-mono text-xs max-w-xs truncate" title={run.targets.join(', ')}>
                    {run.targets.join(', ')}
                  </td>
                  <td className="py-2 pr-4 text-center text-gray-400">{run.attempts}</td>
                  <td className="py-2">
                    {run.prUrl ? (
                      <a
                        href={run.prUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300"
                      >
                        #{run.prNumber}
                      </a>
                    ) : (
                      <span className="text-gray-600">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalRunPages > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            <button
              onClick={() => setRunPage(p => Math.max(0, p - 1))}
              disabled={runPage === 0}
              className="px-3 py-1 bg-bb-accent/50 rounded disabled:opacity-50"
            >
              Prev
            </button>
            <span className="px-3 py-1 text-gray-400">
              Page {runPage + 1} of {totalRunPages}
            </span>
            <button
              onClick={() => setRunPage(p => Math.min(totalRunPages - 1, p + 1))}
              disabled={runPage >= totalRunPages - 1}
              className="px-3 py-1 bg-bb-accent/50 rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
