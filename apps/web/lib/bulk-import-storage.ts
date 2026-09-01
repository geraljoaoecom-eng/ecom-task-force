export interface BulkResult {
  url: string;
  status: 'success' | 'error' | 'skipped';
  name?: string;
  message?: string;
}

export interface PersistedBulkImportJob {
  urls: string[];
  results: BulkResult[];
  nextIndex: number;
  running: boolean;
  visible: boolean;
  expanded: boolean;
  startedAt: number;
}

const STORAGE_KEY = 'ecom-bulk-import-job';

export function loadBulkImportJob(): PersistedBulkImportJob | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const job = JSON.parse(raw) as PersistedBulkImportJob;
    if (!Array.isArray(job.urls) || !Array.isArray(job.results)) return null;
    return job;
  } catch {
    return null;
  }
}

export function saveBulkImportJob(job: PersistedBulkImportJob): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(job));
  } catch {
    // quota exceeded — ignore
  }
}

export function clearBulkImportJob(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}
