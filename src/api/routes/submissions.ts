import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { submissionQueue } from "../../queue/queue";
import {
  JobStatus,
  Language,
  SubmissionRequest,
  SubmissionResponse,
  JobResult,
} from "../../types";

const router = Router();

const SUPPORTED_LANGUAGES = Object.values(Language);

/**
 * POST /api/submissions
 * Enqueue a new code submission job.
 */
router.post("/", async (req: Request, res: Response): Promise<void> => {
  const { language, code, stdin } = req.body as SubmissionRequest;

  if (!language || !code) {
    res.status(400).json({ error: "language and code are required" });
    return;
  }

  if (!SUPPORTED_LANGUAGES.includes(language)) {
    res.status(400).json({
      error: `Unsupported language. Supported: ${SUPPORTED_LANGUAGES.join(", ")}`,
    });
    return;
  }

  if (typeof code !== "string" || code.length === 0) {
    res.status(400).json({ error: "code must be a non-empty string" });
    return;
  }

  if (code.length > 100_000) {
    res.status(400).json({ error: "code must be under 100,000 characters" });
    return;
  }

  const submissionId = uuidv4();
  const submission = {
    id: submissionId,
    language,
    code,
    stdin: typeof stdin === "string" ? stdin : "",
    submittedAt: new Date().toISOString(),
  };

  const job = await submissionQueue.add(submissionId, submission, {
    jobId: submissionId,
  });

  const response: SubmissionResponse = {
    jobId: job.id ?? submissionId,
    status: JobStatus.WAITING,
    message: "Job enqueued successfully",
  };

  res.status(202).json(response);
});

/**
 * GET /api/submissions/:id
 * Get the status and result of a submission job.
 */
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!id) {
    res.status(400).json({ error: "Job ID is required" });
    return;
  }

  const job = await submissionQueue.getJob(id);

  if (!job) {
    res.status(404).json({ error: `Job ${id} not found` });
    return;
  }

  const state = await job.getState();
  const progress = job.progress;

  // Map BullMQ states to our JobStatus enum
  const statusMap: Record<string, JobStatus> = {
    waiting: JobStatus.WAITING,
    "waiting-children": JobStatus.WAITING,
    prioritized: JobStatus.WAITING,
    active: JobStatus.ACTIVE,
    completed: JobStatus.COMPLETED,
    failed: JobStatus.FAILED,
    delayed: JobStatus.WAITING,
    unknown: JobStatus.WAITING,
  };

  const status = statusMap[state] ?? JobStatus.WAITING;

  if (state === "completed" && job.returnvalue) {
    const result = job.returnvalue as JobResult;
    res.json({ ...result, status, progress });
    return;
  }

  if (state === "failed") {
    res.json({
      jobId: id,
      status,
      progress,
      error: job.failedReason ?? "Job failed",
      submission: job.data,
    });
    return;
  }

  res.json({
    jobId: id,
    status,
    progress,
    submission: job.data,
  });
});

export default router;
