import { useState, useMemo } from 'react';
import type { PackageInfo } from '../types/metrics';

interface PackageExplorerProps {
  packages: PackageInfo[];
}

type FilterOption = 'all' | 'bazelized' | 'not-bazelized' | 'with-tests' | 'without-tests';

export function PackageExplorer({ packages }: PackageExplorerProps) {
  const [filter, setFilter] = useState<FilterOption>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const filteredPackages = useMemo(() => {
    const filtered = packages.filter(pkg => {
      // Search filter
      if (search && !pkg.path.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }

      // Category filter
      switch (filter) {
        case 'bazelized':
          return pkg.hasBuildFile;
        case 'not-bazelized':
          return !pkg.hasBuildFile;
        case 'with-tests':
          return pkg.hasTestFiles;
        case 'without-tests':
          return !pkg.hasTestFiles;
        default:
          return true;
      }
    });

    // Sort priority:
    // 1. BUILD + bazelized tests (fully bazelized)
    // 2. BUILD + test files but not bazelized
    // 3. BUILD only (no tests)
    // 4. Alphabetically
    return filtered.sort((a, b) => {
      const getSortPriority = (pkg: typeof a) => {
        if (pkg.hasBuildFile && pkg.goTestTargetCount > 0) return 0; // Fully bazelized
        if (pkg.hasBuildFile && pkg.hasTestFiles) return 1; // BUILD + unbazelized tests
        if (pkg.hasBuildFile) return 2; // BUILD only
        return 3; // No BUILD
      };

      const aPriority = getSortPriority(a);
      const bPriority = getSortPriority(b);

      if (aPriority !== bPriority) return aPriority - bPriority;

      // Within same priority, sort alphabetically
      return a.path.localeCompare(b.path);
    });
  }, [packages, filter, search]);

  const paginatedPackages = filteredPackages.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filteredPackages.length / pageSize);

  return (
    <div className="metric-card">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
        <h3 className="text-lg font-semibold">Package Explorer</h3>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Search packages..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="px-3 py-1.5 bg-bb-accent/50 border border-bb-accent rounded text-sm text-white placeholder-gray-400"
          />
          <select
            value={filter}
            onChange={(e) => { setFilter(e.target.value as FilterOption); setPage(0); }}
            className="px-3 py-1.5 bg-bb-accent/50 border border-bb-accent rounded text-sm text-white"
          >
            <option value="all">All Packages</option>
            <option value="bazelized">Bazelized Only</option>
            <option value="not-bazelized">Not Bazelized</option>
            <option value="with-tests">With Tests</option>
            <option value="without-tests">Without Tests</option>
          </select>
        </div>
      </div>

      <div className="text-sm text-gray-400 mb-2">
        Showing {paginatedPackages.length} of {filteredPackages.length} packages
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-bb-accent">
              <th className="pb-2 pr-4">Path</th>
              <th className="pb-2 pr-4 text-center">BUILD</th>
              <th className="pb-2 pr-4 text-center" title="Number of _test.go files">Test Files</th>
              <th className="pb-2 pr-4 text-center" title="Number of go_test targets in BUILD file">Bazel Tests</th>
              <th className="pb-2 text-center" title="Non-test .go files">Source Go Files</th>
            </tr>
          </thead>
          <tbody>
            {paginatedPackages.map((pkg) => (
              <tr key={pkg.path} className="table-row border-b border-bb-accent/30">
                <td className="py-2 pr-4 font-mono text-xs">{pkg.path}</td>
                <td className="py-2 pr-4 text-center">
                  {pkg.hasBuildFile ? (
                    <span className="text-green-400">✓</span>
                  ) : (
                    <span className="text-gray-600">-</span>
                  )}
                </td>
                <td className="py-2 pr-4 text-center">
                  {pkg.hasTestFiles ? (
                    <span className="text-blue-400">{pkg.testFileCount}</span>
                  ) : (
                    <span className="text-gray-600">-</span>
                  )}
                </td>
                <td className="py-2 pr-4 text-center">
                  {pkg.goTestTargetCount > 0 ? (
                    <span className="text-green-400">{pkg.goTestTargetCount}</span>
                  ) : (
                    <span className="text-gray-600">-</span>
                  )}
                </td>
                <td className="py-2 text-center text-gray-400">{pkg.goFileCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1 bg-bb-accent/50 rounded disabled:opacity-50"
          >
            Prev
          </button>
          <span className="px-3 py-1 text-gray-400">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1 bg-bb-accent/50 rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
