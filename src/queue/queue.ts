import { Queue } from "bullmq";
import { config } from "../config";
import { SubmissionJob } from "../types";

export const submissionQueue = new Queue<SubmissionJob>("code-submissions", {
  connection: {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
  },
  defaultJobOptions: {
    attempts: config.queue.jobAttempts,
    backoff: {
      type: "exponential",
      delay: config.queue.jobBackoffDelayMs,
    },
    removeOnComplete: {
      count: 500,
      age: 3600,
    },
    removeOnFail: {
      count: 100,
      age: 86400,
    },
  },
});
