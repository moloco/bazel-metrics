export interface AIFixMetrics {
  timestamp: string;
  summary: AIFixSummary;
  dailyTrend: DailyTrendEntry[];
  disabledTests: DisabledTest[];
  recentRuns: AIFixRun[];
}

export interface AIFixSummary {
  totalInvocations: number;
  successfulFixes: number;
  failedFixes: number;
  testsDisabled: number;
  autoAppliedFixes: number;
  userAppliedFixes: number;
  postMerge: WorkflowSummary;
  preMerge: WorkflowSummary;
}

export interface WorkflowSummary {
  totalInvocations: number;
  successfulFixes: number;
  failedFixes: number;
  testsDisabled: number;
}

export interface DailyTrendEntry {
  date: string;
  invocations: number;
  successful: number;
  failed: number;
  disabled: number;
  applied: number;
}

export interface AIFixRun {
  id: string;
  timestamp: string;
  workflow: 'post-merge' | 'pre-merge';
  status: 'success' | 'failure' | 'disabled';
  targets: string[];
  prUrl?: string;
  prNumber?: number;
  attempts: number;
  applied?: string;
}

export interface DisabledTest {
  target: string;
  disabledAt: string;
  workflow: string;
  reason: string | null;
  runId: string;
}
