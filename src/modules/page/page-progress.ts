/**
 * In-memory progress tracker for page fetch/process operations.
 * Tracks step-by-step progress so the frontend can poll and show progress bars.
 */

export interface PageProgress {
  pageId: number;
  operation: 'fetch' | 'process';
  status: 'running' | 'completed' | 'error';
  step: string;       // Current step description
  percent: number;    // 0-100
  detail?: string;    // Optional detail (e.g. "3/12 posts downloaded")
  startedAt: Date;
  updatedAt: Date;
  error?: string;
}

// Store progress per page+operation
const progressMap = new Map<string, PageProgress>();

function key(pageId: number, operation: 'fetch' | 'process'): string {
  return `${pageId}:${operation}`;
}

export function startProgress(pageId: number, operation: 'fetch' | 'process', step: string): void {
  progressMap.set(key(pageId, operation), {
    pageId,
    operation,
    status: 'running',
    step,
    percent: 0,
    startedAt: new Date(),
    updatedAt: new Date(),
  });
}

export function updateProgress(pageId: number, operation: 'fetch' | 'process', step: string, percent: number, detail?: string): void {
  const k = key(pageId, operation);
  const existing = progressMap.get(k);
  if (existing) {
    existing.step = step;
    existing.percent = Math.min(100, Math.max(0, percent));
    existing.detail = detail;
    existing.updatedAt = new Date();
  }
}

export function completeProgress(pageId: number, operation: 'fetch' | 'process'): void {
  const k = key(pageId, operation);
  const existing = progressMap.get(k);
  if (existing) {
    existing.status = 'completed';
    existing.step = 'تکمیل شد';
    existing.percent = 100;
    existing.updatedAt = new Date();
  }
  // Auto-cleanup after 30 seconds
  setTimeout(() => progressMap.delete(k), 30000);
}

export function failProgress(pageId: number, operation: 'fetch' | 'process', error: string): void {
  const k = key(pageId, operation);
  const existing = progressMap.get(k);
  if (existing) {
    existing.status = 'error';
    existing.error = error;
    existing.updatedAt = new Date();
  }
  // Auto-cleanup after 60 seconds
  setTimeout(() => progressMap.delete(k), 60000);
}

export function getProgress(pageId: number, operation?: 'fetch' | 'process'): PageProgress | PageProgress[] | null {
  if (operation) {
    return progressMap.get(key(pageId, operation)) || null;
  }
  // Return both if no operation specified
  const results: PageProgress[] = [];
  const f = progressMap.get(key(pageId, 'fetch'));
  const p = progressMap.get(key(pageId, 'process'));
  if (f) results.push(f);
  if (p) results.push(p);
  return results.length > 0 ? results : null;
}
