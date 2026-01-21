package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"bazel-metrics/analyzer/pkg/benchmark"
	"bazel-metrics/analyzer/pkg/metrics"
	"bazel-metrics/analyzer/pkg/scanner"
)

func main() {
	var (
		repoPath      string
		outputPath    string
		runBenchmarks bool
		maxBenchmarks int
		prettyPrint   bool
	)

	flag.StringVar(&repoPath, "repo", ".", "Path to the repository to analyze")
	flag.StringVar(&outputPath, "output", "metrics.json", "Output file path for metrics JSON")
	flag.BoolVar(&runBenchmarks, "benchmark", false, "Run speed benchmarks (go test vs bazel test)")
	flag.IntVar(&maxBenchmarks, "max-benchmarks", 5, "Maximum number of packages to benchmark")
	flag.BoolVar(&prettyPrint, "pretty", true, "Pretty print JSON output")
	flag.Parse()

	// Resolve absolute path
	absRepoPath, err := filepath.Abs(repoPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error resolving path: %v\n", err)
		os.Exit(1)
	}

	// Verify path exists
	if _, err := os.Stat(absRepoPath); os.IsNotExist(err) {
		fmt.Fprintf(os.Stderr, "Repository path does not exist: %s\n", absRepoPath)
		os.Exit(1)
	}

	fmt.Printf("Analyzing repository: %s\n", absRepoPath)

	// Scan repository
	fmt.Println("Scanning for Go packages and BUILD files...")
	s := scanner.NewScanner(absRepoPath)
	scanResult, err := s.Scan()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Scan error: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Found %d Go packages, %d BUILD files, %d test files\n",
		len(scanResult.Packages), scanResult.TotalBUILDs, scanResult.TotalTests)

	// Calculate metrics
	fmt.Println("Calculating metrics...")
	calc := metrics.NewCalculator(scanResult)
	report := calc.Calculate()

	// Print summary
	fmt.Println("\n=== Summary ===")
	fmt.Printf("Bazelization:    %.1f%% (%d/%d packages have BUILD files)\n",
		report.Summary.BazelizationPct,
		report.Summary.PackagesWithBuild,
		report.Summary.TotalPackages)
	fmt.Printf("Test Coverage:   %.1f%% (%d/%d packages have tests)\n",
		report.Summary.TestCoveragePct,
		report.Summary.PackagesWithTests,
		report.Summary.TotalPackages)
	fmt.Printf("Bazelized Tests: %.1f%% (packages with tests that have go_test targets)\n",
		report.Summary.BazelizedTestsPct)
	fmt.Printf("Total go_test targets: %d\n", report.Summary.TotalGoTestTargets)

	fmt.Println("\n=== Top Directories ===")
	for i, dir := range report.DirectoryBreakdown {
		if i >= 10 {
			break
		}
		fmt.Printf("  %-20s %4d pkgs, %.1f%% bazelized, %.1f%% with tests\n",
			dir.Name, dir.TotalPackages, dir.BazelizationPct, dir.TestCoveragePct)
	}

	// Run benchmarks if requested
	if runBenchmarks {
		fmt.Println("\n=== Running Speed Benchmarks ===")
		fmt.Printf("This may take several minutes...\n")

		runner := benchmark.NewRunner(absRepoPath, scanResult, maxBenchmarks)
		speedReport, err := runner.Run()
		if err != nil {
			fmt.Fprintf(os.Stderr, "Benchmark error: %v\n", err)
		} else {
			report.SetSpeedComparison(speedReport)

			fmt.Println("\nBenchmark Results:")
			for _, pkg := range speedReport.Packages {
				fmt.Printf("  %s:\n", pkg.Path)
				fmt.Printf("    go test:          %dms\n", pkg.GoTestMs)
				fmt.Printf("    bazel test (cold): %dms\n", pkg.BazelTestColdMs)
				fmt.Printf("    bazel test (warm): %dms\n", pkg.BazelTestWarmMs)
			}
		}
	}

	// Write output
	fmt.Printf("\nWriting metrics to %s...\n", outputPath)

	var jsonBytes []byte
	if prettyPrint {
		jsonBytes, err = json.MarshalIndent(report, "", "  ")
	} else {
		jsonBytes, err = json.Marshal(report)
	}
	if err != nil {
		fmt.Fprintf(os.Stderr, "JSON marshal error: %v\n", err)
		os.Exit(1)
	}

	if err := os.WriteFile(outputPath, jsonBytes, 0644); err != nil {
		fmt.Fprintf(os.Stderr, "Write error: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("Done!")
}
