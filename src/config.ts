import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: parseInt(process.env["PORT"] ?? "3000", 10),
  nodeEnv: process.env["NODE_ENV"] ?? "development",

  redis: {
    host: process.env["REDIS_HOST"] ?? "localhost",
    port: parseInt(process.env["REDIS_PORT"] ?? "6379", 10),
    password: process.env["REDIS_PASSWORD"] || undefined,
  },

  docker: {
    socketPath: process.env["DOCKER_SOCKET"] ?? "/var/run/docker.sock",
    executionTimeoutMs: parseInt(
      process.env["EXECUTION_TIMEOUT_MS"] ?? "10000",
      10
    ),
    memoryLimitMB: parseInt(process.env["MEMORY_LIMIT_MB"] ?? "128", 10),
    cpuQuota: parseInt(process.env["CPU_QUOTA"] ?? "50000", 10),
  },

  queue: {
    name: process.env["QUEUE_NAME"] ?? "code-submissions",
    jobAttempts: parseInt(process.env["JOB_ATTEMPTS"] ?? "3", 10),
    jobBackoffDelayMs: parseInt(
      process.env["JOB_BACKOFF_DELAY_MS"] ?? "5000",
      10
    ),
    concurrency: parseInt(process.env["CONCURRENCY"] ?? "5", 10),
  },
} as const;
