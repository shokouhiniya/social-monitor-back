import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PageService } from './page.service';
import { AnalyticsService } from '../analytics/analytics.service';

// ----------------------------------------------------------------------
// Batch Refresh — server-side job runner with concurrency pool (20 workers)
// State is kept in memory so any client can poll status.
// Only ONE job can run at a time (singleton guard).
// ----------------------------------------------------------------------

export interface BatchLog {
  time: string;
  msg: string;
  type: 'info' | 'success' | 'error';
}

export interface BatchJobStatus {
  id: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  // Config
  scope: string;
  steps: { fetch: boolean; process: boolean; dashboards: boolean };
  totalPages: number;
  // Progress
  currentStep: 'fetch' | 'process' | 'dashboards' | null;
  completed: number;
  failed: number;
  // Timing
  startedAt: string | null;
  finishedAt: string | null;
  // Logs (last 200)
  logs: BatchLog[];
}

const CONCURRENCY = 20;

@Injectable()
export class BatchRefreshService {
  private readonly logger = new Logger(BatchRefreshService.name);
  private job: BatchJobStatus = this.idleJob();
  private cancelled = false;

  constructor(
    private readonly pageService: PageService,
    @Inject(forwardRef(() => AnalyticsService))
    private readonly analyticsService: AnalyticsService,
  ) {}

  private idleJob(): BatchJobStatus {
    return {
      id: '',
      status: 'idle',
      scope: '',
      steps: { fetch: false, process: false, dashboards: false },
      totalPages: 0,
      currentStep: null,
      completed: 0,
      failed: 0,
      startedAt: null,
      finishedAt: null,
      logs: [],
    };
  }

  getStatus(): BatchJobStatus {
    return { ...this.job, logs: this.job.logs.slice(-200) };
  }

  isRunning(): boolean {
    return this.job.status === 'running';
  }

  cancel(): { success: boolean; message: string } {
    if (!this.isRunning()) {
      return { success: false, message: 'هیچ پردازشی در حال اجرا نیست.' };
    }
    this.job.status = 'error';
    this.job.finishedAt = new Date().toISOString();
    this.job.currentStep = null;
    this.addLog('🛑 پردازش توسط کاربر لغو شد.', 'error');
    this.cancelled = true;
    return { success: true, message: 'پردازش لغو شد.' };
  }

  async start(pageIds: number[], steps: { fetch?: boolean; process?: boolean; dashboards?: boolean }, scope: string) {
    if (this.isRunning()) {
      return { error: 'یک پردازش دسته‌ای در حال اجراست. لطفاً صبر کنید.', job: this.getStatus() };
    }

    const jobId = `batch-${Date.now()}`;
    this.job = {
      id: jobId,
      status: 'running',
      scope,
      steps: {
        fetch: !!steps.fetch,
        process: !!steps.process,
        dashboards: !!steps.dashboards,
      },
      totalPages: pageIds.length,
      currentStep: null,
      completed: 0,
      failed: 0,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      logs: [],
    };

    this.addLog(`🎯 شروع پردازش دسته‌ای — ${pageIds.length} پیج، دامنه: ${scope}`, 'info');
    this.cancelled = false;

    // Run in background (don't await)
    this.runJob(pageIds).catch((err) => {
      this.addLog(`💥 خطای غیرمنتظره: ${err.message}`, 'error');
      this.job.status = 'error';
      this.job.finishedAt = new Date().toISOString();
    });

    return { jobId, status: 'started', job: this.getStatus() };
  }

  private async runJob(pageIds: number[]) {
    try {
      // Step 1: Fetch
      if (this.job.steps.fetch) {
        await this.runStep('fetch', pageIds, async (id) => {
          await this.pageService.fetchPageData(id);
        });
      }

      if (this.cancelled) throw new Error('لغو شد');

      // Step 2: Process
      if (this.job.steps.process) {
        await this.runStep('process', pageIds, async (id) => {
          await this.pageService.processWithLLM(id, '1w');
        });
      }

      if (this.cancelled) throw new Error('لغو شد');

      // Step 3: Dashboards
      if (this.job.steps.dashboards) {
        this.job.currentStep = 'dashboards';
        this.addLog('📈 بروزرسانی داشبوردها...', 'info');

        try {
          await this.analyticsService.refreshDashboard();
          this.addLog('✅ داشبوردها بروز شدند', 'success');
        } catch (err) {
          this.addLog(`❌ خطا در بروزرسانی داشبوردها: ${err.message}`, 'error');
        }
      }

      this.job.status = 'completed';
      this.addLog(`🎉 پردازش دسته‌ای تمام شد! (${this.job.completed} موفق، ${this.job.failed} ناموفق)`, 'success');
    } catch (err) {
      this.job.status = 'error';
      this.addLog(`💥 ${err.message}`, 'error');
    }

    this.job.finishedAt = new Date().toISOString();
    this.job.currentStep = null;
  }

  /**
   * Run a step with concurrency pool (20 parallel workers).
   * As soon as one finishes, the next one starts — like 20 parallel lanes.
   */
  private async runStep(
    step: 'fetch' | 'process',
    pageIds: number[],
    worker: (id: number) => Promise<void>,
  ) {
    this.job.currentStep = step;
    this.job.completed = 0;
    this.job.failed = 0;
    const stepLabel = step === 'fetch' ? 'واکشی' : 'تحلیل';
    this.addLog(`🚀 شروع ${stepLabel} ${pageIds.length} پیج (${CONCURRENCY} موازی)...`, 'info');

    let index = 0;
    const total = pageIds.length;

    const runNext = async (): Promise<void> => {
      while (index < total) {
        if (this.cancelled) return; // ← Check cancellation

        const currentIndex = index;
        index += 1;
        const id = pageIds[currentIndex];

        try {
          await worker(id);
          this.job.completed += 1;
        } catch (err) {
          this.job.failed += 1;
          this.addLog(`❌ پیج #${id}: ${err.message}`, 'error');
        }

        // Log every 10 or at the end
        const done = this.job.completed + this.job.failed;
        if (done % 10 === 0 || done === total) {
          this.addLog(`📊 ${stepLabel}: ${done}/${total} (${this.job.completed} ✅ ${this.job.failed} ❌)`, 'info');
        }
      }
    };

    // Start CONCURRENCY workers in parallel
    const workers = Array.from({ length: Math.min(CONCURRENCY, total) }, () => runNext());
    await Promise.all(workers);

    this.addLog(`✅ ${stepLabel} تمام شد: ${this.job.completed} موفق، ${this.job.failed} ناموفق`, 'success');
  }

  private addLog(msg: string, type: BatchLog['type']) {
    const time = new Date().toLocaleTimeString('fa-IR');
    this.job.logs.push({ time, msg, type });
    // Keep max 500 logs
    if (this.job.logs.length > 500) {
      this.job.logs = this.job.logs.slice(-300);
    }
    this.logger.log(`[BatchRefresh] ${msg}`);
  }
}
