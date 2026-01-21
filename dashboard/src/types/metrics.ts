export interface Summary {
  bazelizationPct: number;
  testCoveragePct: number;
  bazelizedTestsPct: number;
  totalPackages: number;
  totalBuildFiles: number;
  totalTestFiles: number;
  totalGoFiles: number;
  packagesWithBuild: number;
  packagesWithTests: number;
  totalGoTestTargets: number;
}

export interface DirectoryMetrics {
  name: string;
  totalPackages: number;
  bazelizedPackages: number;
  packagesWithTests: number;
  bazelizationPct: number;
  testCoveragePct: number;
}

export interface PackageInfo {
  path: string;
  hasBuildFile: boolean;
  hasTestFiles: boolean;
  testFileCount: number;
  goTestTargetCount: number;
  goFileCount: number;
}

export interface PackageBenchmark {
  path: string;
  goTestMs: number;
  bazelTestColdMs: number;
  bazelTestWarmMs: number;
}

export interface SpeedReport {
  packages: PackageBenchmark[];
}

export interface MetricsReport {
  timestamp: string;
  repoPath: string;
  summary: Summary;
  directoryBreakdown: DirectoryMetrics[];
  packages: PackageInfo[];
  speedComparison?: SpeedReport;
}
