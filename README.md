# Bazel Metrics Dashboard

A React + TypeScript dashboard to visualize Bazel adoption metrics for Go monorepos.

## Features

- **Bazelization Percentage** - % of Go packages with BUILD files
- **Test Coverage** - % of packages with test files
- **Bazelized Tests** - % of test packages with `go_test` targets
- **Speed Comparison** - Benchmark `go test` vs `bazel test` (cold/warm cache)
- **Directory Breakdown** - Metrics grouped by top-level directories
- **Package Explorer** - Searchable/filterable table of all packages

## Quick Start

### 1. Run the Analyzer

```bash
cd analyzer
go build -o bazel-metrics ./cmd/main.go
./bazel-metrics --repo=/path/to/your/repo --output=../dashboard/public/metrics.json
```

**Options:**
- `--repo` - Path to repository to analyze (default: `.`)
- `--output` - Output JSON file path (default: `metrics.json`)
- `--benchmark` - Run speed comparison benchmarks
- `--max-benchmarks` - Max packages to benchmark (default: 5)

### 2. Start the Dashboard

```bash
cd dashboard
npm install
npm run dev
```

Open http://localhost:3000

Data source behavior:
- `npm run dev` loads local files from `dashboard/public/` (for example `metrics.json`).
- Production builds default to `https://storage.googleapis.com/bazel-metrics-data/`.
- Override either mode with `VITE_DATA_BASE_URL`, for example:
  `VITE_DATA_BASE_URL=/ npm run preview`

### 3. Deploy to Cloud Run (Optional)

```bash
cd dashboard

# Build and push to Artifact Registry
gcloud builds submit --tag us-central1-docker.pkg.dev/PROJECT_ID/cloud-run-source-deploy/bazel-metrics-dashboard:latest .

# Deploy to Cloud Run
gcloud run deploy bazel-metrics-dashboard \
  --image us-central1-docker.pkg.dev/PROJECT_ID/cloud-run-source-deploy/bazel-metrics-dashboard:latest \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080
```

**Prerequisites:**
- GCP project with Cloud Run, Cloud Build, and Artifact Registry APIs enabled
- `gcloud` CLI authenticated

## Project Structure

```
bazel-metrics/
├── analyzer/                 # Go CLI tool
│   ├── cmd/main.go          # Entry point
│   └── pkg/
│       ├── scanner/         # Scans for BUILD files, Go packages
│       ├── metrics/         # Calculates percentages
│       └── benchmark/       # Speed comparison runner
├── dashboard/               # React + TypeScript frontend
│   ├── src/
│   │   ├── components/      # UI components
│   │   ├── types/           # TypeScript definitions
│   │   └── App.tsx          # Main dashboard
│   ├── Dockerfile           # Cloud Run container build
│   └── nginx.conf           # Nginx config for serving SPA
└── README.md
```

## Sample Output

```
=== Summary ===
Bazelization:    22.7% (690/3041 packages have BUILD files)
Test Coverage:   62.8% (1910/3041 packages have tests)
Bazelized Tests: 27.9% (packages with tests that have go_test targets)
Total go_test targets: 644
```

## Tech Stack

- **Analyzer**: Go
- **Dashboard**: React, TypeScript, Vite, Tailwind CSS, Recharts

## License

MIT
