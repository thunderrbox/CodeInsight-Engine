import request from "supertest";
import { createApp } from "../src/api/server";

// Mock the BullMQ queue so tests don't need a live Redis instance
jest.mock("../src/queue/queue", () => ({
  submissionQueue: {
    add: jest.fn().mockResolvedValue({ id: "test-job-id-123" }),
    getJob: jest.fn(),
  },
}));

import { submissionQueue } from "../src/queue/queue";

const mockQueue = submissionQueue as jest.Mocked<typeof submissionQueue>;

describe("API Server", () => {
  const app = createApp();

  describe("GET /health", () => {
    it("returns 200 with status ok", async () => {
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe("POST /api/submissions", () => {
    it("enqueues a job and returns 202 with jobId", async () => {
      const res = await request(app)
        .post("/api/submissions")
        .send({ language: "python", code: 'print("hello")' });

      expect(res.status).toBe(202);
      expect(res.body.jobId).toBe("test-job-id-123");
      expect(res.body.status).toBe("waiting");
      expect(mockQueue.add).toHaveBeenCalled();
    });

    it("returns 400 when language is missing", async () => {
      const res = await request(app)
        .post("/api/submissions")
        .send({ code: 'print("hello")' });
      expect(res.status).toBe(400);
    });

    it("returns 400 when code is missing", async () => {
      const res = await request(app)
        .post("/api/submissions")
        .send({ language: "python" });
      expect(res.status).toBe(400);
    });

    it("returns 400 for unsupported language", async () => {
      const res = await request(app)
        .post("/api/submissions")
        .send({ language: "ruby", code: 'puts "hello"' });
      expect(res.status).toBe(400);
    });

    it("returns 400 when code exceeds 100k characters", async () => {
      const res = await request(app)
        .post("/api/submissions")
        .send({ language: "python", code: "x".repeat(100_001) });
      expect(res.status).toBe(400);
    });

    it("accepts stdin as optional field", async () => {
      const res = await request(app)
        .post("/api/submissions")
        .send({ language: "python", code: "print(input())", stdin: "hello" });
      expect(res.status).toBe(202);
    });

    it("accepts all supported languages", async () => {
      const languages = ["python", "javascript", "typescript", "java", "cpp", "go"];
      for (const lang of languages) {
        const res = await request(app)
          .post("/api/submissions")
          .send({ language: lang, code: `// ${lang}` });
        expect(res.status).toBe(202);
      }
    });
  });

  describe("GET /api/submissions/:id", () => {
    it("returns 404 when job not found", async () => {
      mockQueue.getJob = jest.fn().mockResolvedValue(null);
      const res = await request(app).get("/api/submissions/nonexistent-id");
      expect(res.status).toBe(404);
    });

    it("returns job status for a waiting job", async () => {
      mockQueue.getJob = jest.fn().mockResolvedValue({
        id: "waiting-job",
        data: { id: "waiting-job", language: "python", code: "x=1", submittedAt: new Date().toISOString() },
        progress: 0,
        getState: jest.fn().mockResolvedValue("waiting"),
        returnvalue: null,
        failedReason: null,
      });

      const res = await request(app).get("/api/submissions/waiting-job");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("waiting");
    });

    it("returns full result for a completed job", async () => {
      const mockResult = {
        jobId: "done-job",
        status: "completed",
        submission: { id: "done-job", language: "python", code: "x=1", submittedAt: new Date().toISOString() },
        execution: { stdout: "1\n", stderr: "", exitCode: 0, executionTimeMs: 120, timedOut: false },
        analysis: {
          complexity: { linesOfCode: 1, commentLines: 0, blankLines: 0, commentRatio: 0, cyclomaticComplexity: 1 },
          performanceScore: 100,
          qualityScore: 90,
          suggestions: ["No major issues detected. Code looks good!"],
        },
        completedAt: new Date().toISOString(),
      };

      mockQueue.getJob = jest.fn().mockResolvedValue({
        id: "done-job",
        data: mockResult.submission,
        progress: 100,
        getState: jest.fn().mockResolvedValue("completed"),
        returnvalue: mockResult,
        failedReason: null,
      });

      const res = await request(app).get("/api/submissions/done-job");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("completed");
      expect(res.body.execution).toBeDefined();
      expect(res.body.analysis).toBeDefined();
    });

    it("returns error info for a failed job", async () => {
      mockQueue.getJob = jest.fn().mockResolvedValue({
        id: "failed-job",
        data: { id: "failed-job", language: "python", code: "x=1", submittedAt: new Date().toISOString() },
        progress: 10,
        getState: jest.fn().mockResolvedValue("failed"),
        returnvalue: null,
        failedReason: "Container failed to start",
      });

      const res = await request(app).get("/api/submissions/failed-job");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("failed");
      expect(res.body.error).toBeDefined();
    });
  });

  describe("404 handler", () => {
    it("returns 404 for unknown routes", async () => {
      const res = await request(app).get("/unknown-path");
      expect(res.status).toBe(404);
    });
  });
});
