import { Worker, Job } from "bullmq";
import { config } from "../config";
import { DockerExecutor } from "../executor/dockerExecutor";
import { analyzeCode } from "../analysis/analyzer";
import { JobResult, JobStatus, SubmissionJob } from "../types";

const executor = new DockerExecutor();

async function processJob(job: Job<SubmissionJob>): Promise<JobResult> {
  console.log(`[Worker] Processing job ${job.id} (${job.data.language})`);

  await job.updateProgress(10);

  const execution = await executor.execute(job.data);
  await job.updateProgress(80);

  const analysis = analyzeCode(job.data.code, job.data.language, execution);
  await job.updateProgress(100);

  const result: JobResult = {
    jobId: job.id ?? job.data.id,
    status: execution.exitCode === 0 ? JobStatus.COMPLETED : JobStatus.FAILED,
    submission: job.data,
    execution,
    analysis,
    completedAt: new Date().toISOString(),
  };

  console.log(
    `[Worker] Job ${job.id} completed in ${execution.executionTimeMs}ms ` +
      `(exit=${execution.exitCode}, timedOut=${execution.timedOut})`
  );

  return result;
}

export function createWorker(): Worker<SubmissionJob, JobResult> {
  const worker = new Worker<SubmissionJob, JobResult>(
    "code-submissions",
    processJob,
    {
      connection: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
      },
      concurrency: config.queue.concurrency,
    }
  );

  worker.on("completed", (job) => {
    console.log(`[Worker] Job ${job.id} completed successfully`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
  });

  worker.on("error", (err) => {
    console.error("[Worker] Worker error:", err);
  });

  return worker;
}

// Allow running as standalone process
if (require.main === module) {
  const worker = createWorker();
  console.log(
    `[Worker] Started with concurrency=${config.queue.concurrency}, ` +
      `queue=code-submissions`
  );

  process.on("SIGTERM", async () => {
    console.log("[Worker] SIGTERM received, closing worker...");
    await worker.close();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    console.log("[Worker] SIGINT received, closing worker...");
    await worker.close();
    process.exit(0);
  });
}
