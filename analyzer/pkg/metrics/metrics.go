package metrics

import (
	"path/filepath"
	"sort"
	"strings"
	"time"

	"bazel-metrics/analyzer/pkg/scanner"
)

// Summary contains high-level metrics
type Summary struct {
	BazelizationPct   float64 `json:"bazelizationPct"`
	TestCoveragePct   float64 `json:"testCoveragePct"`
	BazelizedTestsPct float64 `json:"bazelizedTestsPct"`
	TotalPackages     int     `json:"totalPackages"`
	TotalBuildFiles   int     `json:"totalBuildFiles"`
	TotalTestFiles    int     `json:"totalTestFiles"`
	TotalGoFiles      int     `json:"totalGoFiles"`
	PackagesWithBuild int     `json:"packagesWithBuild"`
	PackagesWithTests int     `json:"packagesWithTests"`
	TotalGoTestTargets int    `json:"totalGoTestTargets"`
}

// DirectoryMetrics contains metrics grouped by top-level directory
type DirectoryMetrics struct {
	Name              string  `json:"name"`
	TotalPackages     int     `json:"totalPackages"`
	BazelizedPackages int     `json:"bazelizedPackages"`
	PackagesWithTests int     `json:"packagesWithTests"`
	BazelizationPct   float64 `json:"bazelizationPct"`
	TestCoveragePct   float64 `json:"testCoveragePct"`
}

// PackageInfo is the simplified package info for output
type PackageInfo struct {
	Path              string `json:"path"`
	HasBuildFile      bool   `json:"hasBuildFile"`
	HasTestFiles      bool   `json:"hasTestFiles"`
	TestFileCount     int    `json:"testFileCount"`
	GoTestTargetCount int    `json:"goTestTargetCount"`
	GoFileCount       int    `json:"goFileCount"`
}

// Report is the complete metrics report
type Report struct {
	Timestamp          string              `json:"timestamp"`
	RepoPath           string              `json:"repoPath"`
	Summary            Summary             `json:"summary"`
	DirectoryBreakdown []*DirectoryMetrics `json:"directoryBreakdown"`
	Packages           []*PackageInfo      `json:"packages"`
	SpeedComparison    *SpeedReport        `json:"speedComparison,omitempty"`
}

// SpeedReport contains benchmark comparison data
type SpeedReport struct {
	Packages []PackageBenchmark `json:"packages"`
}

// PackageBenchmark contains timing for a single package
type PackageBenchmark struct {
	Path             string `json:"path"`
	GoTestMs         int64  `json:"goTestMs"`
	BazelTestColdMs  int64  `json:"bazelTestColdMs"`
	BazelTestWarmMs  int64  `json:"bazelTestWarmMs"`
}

// Calculator computes metrics from scan results
type Calculator struct {
	scanResult *scanner.ScanResult
}

// NewCalculator creates a new metrics calculator
func NewCalculator(result *scanner.ScanResult) *Calculator {
	return &Calculator{scanResult: result}
}

// Calculate computes all metrics and returns a report
func (c *Calculator) Calculate() *Report {
	report := &Report{
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		RepoPath:  c.scanResult.RepoPath,
		Packages:  make([]*PackageInfo, 0, len(c.scanResult.Packages)),
	}

	// Calculate summary metrics
	var packagesWithBuild, packagesWithTests, totalGoTestTargets int

	for _, pkg := range c.scanResult.Packages {
		if pkg.HasBuildFile {
			packagesWithBuild++
		}
		if pkg.HasTestFiles {
			packagesWithTests++
		}
		totalGoTestTargets += pkg.GoTestTargets

		report.Packages = append(report.Packages, &PackageInfo{
			Path:              pkg.RelPath,
			HasBuildFile:      pkg.HasBuildFile,
			HasTestFiles:      pkg.HasTestFiles,
			TestFileCount:     pkg.TestFileCount,
			GoTestTargetCount: pkg.GoTestTargets,
			GoFileCount:       pkg.GoFileCount,
		})
	}

	totalPackages := len(c.scanResult.Packages)
	report.Summary = Summary{
		TotalPackages:      totalPackages,
		TotalBuildFiles:    c.scanResult.TotalBUILDs,
		TotalTestFiles:     c.scanResult.TotalTests,
		TotalGoFiles:       c.scanResult.TotalGoFiles,
		PackagesWithBuild:  packagesWithBuild,
		PackagesWithTests:  packagesWithTests,
		TotalGoTestTargets: totalGoTestTargets,
	}

	// Calculate percentages
	if totalPackages > 0 {
		report.Summary.BazelizationPct = float64(packagesWithBuild) / float64(totalPackages) * 100
		report.Summary.TestCoveragePct = float64(packagesWithTests) / float64(totalPackages) * 100
	}

	// Bazelized tests: packages with tests that also have go_test targets
	packagesWithBazelizedTests := 0
	for _, pkg := range c.scanResult.Packages {
		if pkg.HasTestFiles && pkg.GoTestTargets > 0 {
			packagesWithBazelizedTests++
		}
	}
	if packagesWithTests > 0 {
		report.Summary.BazelizedTestsPct = float64(packagesWithBazelizedTests) / float64(packagesWithTests) * 100
	}

	// Calculate directory breakdown
	report.DirectoryBreakdown = c.calculateDirectoryBreakdown()

	return report
}

func (c *Calculator) calculateDirectoryBreakdown() []*DirectoryMetrics {
	dirMap := make(map[string]*DirectoryMetrics)

	for _, pkg := range c.scanResult.Packages {
		// Get top-level directory (first component of path)
		topDir := getTopLevelDir(pkg.RelPath)
		if topDir == "" || topDir == "." {
			topDir = "(root)"
		}

		dm, exists := dirMap[topDir]
		if !exists {
			dm = &DirectoryMetrics{Name: topDir}
			dirMap[topDir] = dm
		}

		dm.TotalPackages++
		if pkg.HasBuildFile {
			dm.BazelizedPackages++
		}
		if pkg.HasTestFiles {
			dm.PackagesWithTests++
		}
	}

	// Calculate percentages and convert to slice
	result := make([]*DirectoryMetrics, 0, len(dirMap))
	for _, dm := range dirMap {
		if dm.TotalPackages > 0 {
			dm.BazelizationPct = float64(dm.BazelizedPackages) / float64(dm.TotalPackages) * 100
			dm.TestCoveragePct = float64(dm.PackagesWithTests) / float64(dm.TotalPackages) * 100
		}
		result = append(result, dm)
	}

	// Sort by total packages descending
	sort.Slice(result, func(i, j int) bool {
		return result[i].TotalPackages > result[j].TotalPackages
	})

	return result
}

func getTopLevelDir(path string) string {
	// Clean the path and get the first component
	path = filepath.Clean(path)
	parts := strings.Split(path, string(filepath.Separator))
	if len(parts) > 0 {
		return parts[0]
	}
	return ""
}

// SetSpeedComparison adds speed comparison data to the report
func (r *Report) SetSpeedComparison(speed *SpeedReport) {
	r.SpeedComparison = speed
}
