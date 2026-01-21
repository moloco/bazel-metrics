package benchmark

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"bazel-metrics/analyzer/pkg/metrics"
	"bazel-metrics/analyzer/pkg/scanner"
)

// Runner executes benchmarks comparing go test vs bazel test
type Runner struct {
	repoPath   string
	scanResult *scanner.ScanResult
	maxTests   int
}

// NewRunner creates a new benchmark runner
func NewRunner(repoPath string, result *scanner.ScanResult, maxTests int) *Runner {
	if maxTests <= 0 {
		maxTests = 5
	}
	return &Runner{
		repoPath:   repoPath,
		scanResult: result,
		maxTests:   maxTests,
	}
}

// Run executes benchmarks and returns speed comparison data
func (r *Runner) Run() (*metrics.SpeedReport, error) {
	report := &metrics.SpeedReport{
		Packages: make([]metrics.PackageBenchmark, 0),
	}

	// Select packages to benchmark (ones with both tests and bazel targets)
	candidates := r.selectCandidates()
	if len(candidates) == 0 {
		return report, nil
	}

	// Limit to maxTests packages
	if len(candidates) > r.maxTests {
		candidates = candidates[:r.maxTests]
	}

	for _, pkg := range candidates {
		benchmark, err := r.benchmarkPackage(pkg)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Warning: failed to benchmark %s: %v\n", pkg.RelPath, err)
			continue
		}
		report.Packages = append(report.Packages, *benchmark)
	}

	return report, nil
}

func (r *Runner) selectCandidates() []*scanner.Package {
	var candidates []*scanner.Package

	for _, pkg := range r.scanResult.Packages {
		// Package must have test files and go_test targets
		if pkg.HasTestFiles && pkg.GoTestTargets > 0 && pkg.TestFileCount > 0 && pkg.TestFileCount <= 20 {
			candidates = append(candidates, pkg)
		}
	}

	// Sort by test file count (prefer smaller packages for faster benchmarks)
	// Simple selection sort since we only need a few
	for i := 0; i < len(candidates)-1 && i < r.maxTests; i++ {
		minIdx := i
		for j := i + 1; j < len(candidates); j++ {
			if candidates[j].TestFileCount < candidates[minIdx].TestFileCount {
				minIdx = j
			}
		}
		candidates[i], candidates[minIdx] = candidates[minIdx], candidates[i]
	}

	return candidates
}

func (r *Runner) benchmarkPackage(pkg *scanner.Package) (*metrics.PackageBenchmark, error) {
	benchmark := &metrics.PackageBenchmark{
		Path: pkg.RelPath,
	}

	// Benchmark go test
	goTestTime, err := r.runGoTest(pkg)
	if err != nil {
		return nil, fmt.Errorf("go test failed: %w", err)
	}
	benchmark.GoTestMs = goTestTime

	// Clean bazel cache for cold run
	r.cleanBazelCache()

	// Benchmark bazel test (cold)
	bazelColdTime, err := r.runBazelTest(pkg)
	if err != nil {
		// Bazel test may fail, but we still want timing
		fmt.Fprintf(os.Stderr, "Warning: bazel test had issues for %s: %v\n", pkg.RelPath, err)
	}
	benchmark.BazelTestColdMs = bazelColdTime

	// Benchmark bazel test (warm - second run)
	bazelWarmTime, err := r.runBazelTest(pkg)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Warning: bazel test warm run had issues for %s: %v\n", pkg.RelPath, err)
	}
	benchmark.BazelTestWarmMs = bazelWarmTime

	return benchmark, nil
}

func (r *Runner) runGoTest(pkg *scanner.Package) (int64, error) {
	pkgDir := pkg.Path

	// Determine Go import path
	importPath := "./" + pkg.RelPath
	if strings.HasPrefix(pkg.RelPath, "go/") {
		// If under go/ directory, adjust path
		importPath = "./" + strings.TrimPrefix(pkg.RelPath, "go/")
		pkgDir = filepath.Join(r.repoPath, "go")
	}

	cmd := exec.Command("go", "test", "-count=1", importPath)
	cmd.Dir = pkgDir
	cmd.Env = append(os.Environ(), "CGO_ENABLED=0")

	start := time.Now()
	err := cmd.Run()
	elapsed := time.Since(start).Milliseconds()

	if err != nil {
		// Tests may fail but we still want timing
		return elapsed, nil
	}

	return elapsed, nil
}

func (r *Runner) runBazelTest(pkg *scanner.Package) (int64, error) {
	// Convert path to bazel target
	target := "//" + pkg.RelPath + ":all"

	cmd := exec.Command("bazel", "test", target, "--test_output=errors")
	cmd.Dir = r.repoPath

	start := time.Now()
	err := cmd.Run()
	elapsed := time.Since(start).Milliseconds()

	// Return elapsed time even if test fails
	return elapsed, err
}

func (r *Runner) cleanBazelCache() {
	cmd := exec.Command("bazel", "clean", "--expunge_async")
	cmd.Dir = r.repoPath
	cmd.Run() // Ignore errors

	// Give some time for async clean
	time.Sleep(2 * time.Second)
}
