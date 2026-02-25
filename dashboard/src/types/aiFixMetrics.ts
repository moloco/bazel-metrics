export interface AIFixMetrics {
  timestamp: string;
  postMerge: WorkflowMetrics;
  preMerge: WorkflowMetrics;
  disabledTests: DisabledTest[];
}

export interface WorkflowMetrics {
  totalInvocations: number;
  successfulFixes: number;
  failedFixes: number;
  testsDisabled: number;
  userAppliedFixes: number;
  runs: AIFixRun[];
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
  errorSummary?: string;
}

export interface DisabledTest {
  target: string;
  disabledAt: string;
  disabledBy: 'post-merge' | 'pre-merge';
  runId: string;
  reason: string;
}
