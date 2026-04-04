export enum Language {
  PYTHON = "python",
  JAVASCRIPT = "javascript",
  TYPESCRIPT = "typescript",
  JAVA = "java",
  CPP = "cpp",
  GO = "go",
}

export enum JobStatus {
  WAITING = "waiting",
  ACTIVE = "active",
  COMPLETED = "completed",
  FAILED = "failed",
}

export interface SubmissionJob {
  id: string;
  language: Language;
  code: string;
  stdin?: string;
  submittedAt: string;
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTimeMs: number;
  timedOut: boolean;
  memoryUsedMB?: number;
}

export interface ComplexityMetrics {
  linesOfCode: number;
  commentLines: number;
  blankLines: number;
  commentRatio: number;
  cyclomaticComplexity: number;
}

export interface AnalysisResult {
  complexity: ComplexityMetrics;
  performanceScore: number;
  qualityScore: number;
  suggestions: string[];
}

export interface JobResult {
  jobId: string;
  status: JobStatus;
  submission: SubmissionJob;
  execution?: ExecutionResult;
  analysis?: AnalysisResult;
  completedAt?: string;
  error?: string;
}

export interface SubmissionRequest {
  language: Language;
  code: string;
  stdin?: string;
}

export interface SubmissionResponse {
  jobId: string;
  status: JobStatus;
  message: string;
}
