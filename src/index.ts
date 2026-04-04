import { createApp } from "./api/server";
import { createWorker } from "./queue/worker";
import { config } from "./config";

async function main(): Promise<void> {
  const app = createApp();

  // Start the BullMQ worker in the same process (single-process mode).
  // For production scale-out, run workers in separate processes via `npm run worker`.
  const worker = createWorker();

  const server = app.listen(config.port, () => {
    console.log(
      `[Server] CodeInsight Engine running on http://localhost:${config.port}`
    );
    console.log(`[Server] Environment: ${config.nodeEnv}`);
    console.log(
      `[Server] Redis: ${config.redis.host}:${config.redis.port}`
    );
  });

  async function shutdown(signal: string): Promise<void> {
    console.log(`[Server] ${signal} received, shutting down...`);
    await worker.close();
    server.close(() => {
      console.log("[Server] HTTP server closed");
      process.exit(0);
    });
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("[Server] Fatal startup error:", err);
  process.exit(1);
});
