import db, { ensureWaypointCronsTable } from '@/lib/db';
import { waypointCrons } from '@/lib/db/schema';
import { and, eq, lte, or, isNull, not } from 'drizzle-orm';
import { executeCronJob } from './executor';
import { computeNextRun } from './parser';

class CronScheduler {
  private interval: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private isStarted = false;

  public start(tickIntervalMs: number = 30000) {
    if (this.isStarted) {
      return;
    }
    this.isStarted = true;
    console.log('[CronScheduler] Starting background cron worker...');

    // Run first check after a brief startup delay
    setTimeout(() => {
      this.checkAndRunJobs();
    }, 5000);

    this.interval = setInterval(() => {
      this.checkAndRunJobs();
    }, tickIntervalMs);
  }

  public stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isStarted = false;
    console.log('[CronScheduler] Stopped background cron worker.');
  }

  public async checkAndRunJobs() {
    if (this.isProcessing) {
      return;
    }
    this.isProcessing = true;

    try {
      ensureWaypointCronsTable();
      const now = new Date();
      const nowIso = now.toISOString();

      // Find all enabled jobs that are ready to run and not currently running
      const dueJobs = await db.query.waypointCrons.findMany({
        where: and(
          eq(waypointCrons.enabled, true),
          or(
            isNull(waypointCrons.nextRunAt),
            lte(waypointCrons.nextRunAt, nowIso),
          ),
          or(
            isNull(waypointCrons.lastStatus),
            not(eq(waypointCrons.lastStatus, 'running')),
          ),
        ),
      });

      if (dueJobs && dueJobs.length > 0) {
        console.log(`[CronScheduler] Found ${dueJobs.length} due cron job(s) to execute.`);

        for (const job of dueJobs) {
          // If nextRunAt is null, populate it or run it if newly created
          if (!job.nextRunAt) {
            const calculatedNext = computeNextRun(job.schedule, now, job.timezone || 'UTC');
            if (calculatedNext) {
              await db
                .update(waypointCrons)
                .set({
                  nextRunAt: calculatedNext.toISOString(),
                  updatedAt: now.toISOString(),
                })
                .where(eq(waypointCrons.id, job.id));
            }
            continue;
          }

          // Execute due job asynchronously
          console.log(`[CronScheduler] Executing cron job: "${job.name}" (${job.id})...`);
          executeCronJob(job.id).catch((err) => {
            console.error(`[CronScheduler] Error in executeCronJob for ${job.id}:`, err);
          });
        }
      }
    } catch (err) {
      console.error('[CronScheduler] Error during checkAndRunJobs:', err);
    } finally {
      this.isProcessing = false;
    }
  }
}

// Global singleton instance across module reloads
const globalForScheduler = globalThis as unknown as {
  cronScheduler?: CronScheduler;
};

export const scheduler = globalForScheduler.cronScheduler || new CronScheduler();

if (process.env.NODE_ENV !== 'production') {
  globalForScheduler.cronScheduler = scheduler;
}

export function startCronScheduler() {
  scheduler.start();
}
