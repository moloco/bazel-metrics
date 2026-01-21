package scanner

import (
	"bufio"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// Package represents a Go package directory with its metadata
type Package struct {
	Path             string   `json:"path"`
	RelPath          string   `json:"relPath"`
	HasBuildFile     bool     `json:"hasBuildFile"`
	HasTestFiles     bool     `json:"hasTestFiles"`
	GoFileCount      int      `json:"goFileCount"`
	TestFileCount    int      `json:"testFileCount"`
	GoTestTargets    int      `json:"goTestTargetCount"`
	GoLibraryTargets int      `json:"goLibraryTargetCount"`
	GoBinaryTargets  int      `json:"goBinaryTargetCount"`
}

// ScanResult contains the complete scan results
type ScanResult struct {
	RepoPath     string     `json:"repoPath"`
	Packages     []*Package `json:"packages"`
	TotalBUILDs  int        `json:"totalBuildFiles"`
	TotalGoFiles int        `json:"totalGoFiles"`
	TotalTests   int        `json:"totalTestFiles"`
}

// Scanner scans a repository for Bazel and Go metrics
type Scanner struct {
	repoPath    string
	skipDirs    map[string]bool
	goTestRegex *regexp.Regexp
	goLibRegex  *regexp.Regexp
	goBinRegex  *regexp.Regexp
}

// NewScanner creates a new scanner for the given repository path
func NewScanner(repoPath string) *Scanner {
	return &Scanner{
		repoPath: repoPath,
		skipDirs: map[string]bool{
			".git":         true,
			"bazel-bin":    true,
			"bazel-out":    true,
			"bazel-testlogs": true,
			"node_modules": true,
			".cache":       true,
			"vendor":       true,
		},
		goTestRegex: regexp.MustCompile(`(?m)^\s*go_test\s*\(`),
		goLibRegex:  regexp.MustCompile(`(?m)^\s*go_library\s*\(`),
		goBinRegex:  regexp.MustCompile(`(?m)^\s*go_binary\s*\(`),
	}
}

// Scan performs a full scan of the repository
func (s *Scanner) Scan() (*ScanResult, error) {
	result := &ScanResult{
		RepoPath: s.repoPath,
		Packages: make([]*Package, 0),
	}

	packageMap := make(map[string]*Package)

	err := filepath.Walk(s.repoPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // Skip files we can't access
		}

		// Skip hidden and excluded directories
		if info.IsDir() {
			base := filepath.Base(path)
			if strings.HasPrefix(base, ".") || s.skipDirs[base] || strings.HasPrefix(base, "bazel-") {
				return filepath.SkipDir
			}
			return nil
		}

		dir := filepath.Dir(path)
		relDir, _ := filepath.Rel(s.repoPath, dir)
		if relDir == "" {
			relDir = "."
		}

		// Get or create package entry
		pkg, exists := packageMap[dir]
		if !exists {
			pkg = &Package{
				Path:    dir,
				RelPath: relDir,
			}
			packageMap[dir] = pkg
		}

		filename := filepath.Base(path)

		// Check for BUILD files
		if filename == "BUILD" || filename == "BUILD.bazel" {
			pkg.HasBuildFile = true
			result.TotalBUILDs++

			// Parse BUILD file for targets
			targets, err := s.parseBuildFile(path)
			if err == nil {
				pkg.GoTestTargets = targets.goTests
				pkg.GoLibraryTargets = targets.goLibs
				pkg.GoBinaryTargets = targets.goBins
			}
		}

		// Check for Go files
		if strings.HasSuffix(filename, ".go") && !strings.HasSuffix(filename, "_test.go") {
			pkg.GoFileCount++
			result.TotalGoFiles++
		}

		// Check for test files
		if strings.HasSuffix(filename, "_test.go") {
			pkg.HasTestFiles = true
			pkg.TestFileCount++
			result.TotalTests++
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	// Convert map to slice, only include Go packages
	for _, pkg := range packageMap {
		if pkg.GoFileCount > 0 || pkg.TestFileCount > 0 {
			result.Packages = append(result.Packages, pkg)
		}
	}

	return result, nil
}

type buildTargets struct {
	goTests int
	goLibs  int
	goBins  int
}

func (s *Scanner) parseBuildFile(path string) (*buildTargets, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	targets := &buildTargets{}
	scanner := bufio.NewScanner(file)
	var content strings.Builder

	for scanner.Scan() {
		content.WriteString(scanner.Text())
		content.WriteString("\n")
	}

	text := content.String()
	targets.goTests = len(s.goTestRegex.FindAllString(text, -1))
	targets.goLibs = len(s.goLibRegex.FindAllString(text, -1))
	targets.goBins = len(s.goBinRegex.FindAllString(text, -1))

	return targets, scanner.Err()
}
