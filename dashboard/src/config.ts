const GCS_BUCKET_URL = 'https://storage.googleapis.com/bazel-metrics-data';

export function getDataUrl(filename: string): string {
  if (import.meta.env.VITE_DATA_BASE_URL) {
    return `${import.meta.env.VITE_DATA_BASE_URL}/${filename}`;
  }
  if (import.meta.env.DEV) {
    return `/${filename}`;
  }
  return `${GCS_BUCKET_URL}/${filename}`;
}
