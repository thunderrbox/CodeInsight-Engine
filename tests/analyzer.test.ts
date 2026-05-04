import { analyzeCode } from "../src/analysis/analyzer";
import { Language, ExecutionResult } from "../src/types";

function makeExecution(overrides: Partial<ExecutionResult> = {}): ExecutionResult {
  return {
    stdout: "Hello, World!\n",
    stderr: "",
    exitCode: 0,
    executionTimeMs: 200,
    timedOut: false,
    ...overrides,
  };
}

describe("analyzeCode", () => {
  const pythonCode = `
# This is a comment
def greet(name):
    if name:
        print(f"Hello, {name}")
    else:
        print("Hello, World")

greet("Alice")
`;

  it("returns an AnalysisResult with expected shape", () => {
    const result = analyzeCode(pythonCode, Language.PYTHON, makeExecution());
    expect(result).toHaveProperty("complexity");
    expect(result).toHaveProperty("qualityScore");
    expect(result).toHaveProperty("performanceScore");
    expect(result).toHaveProperty("suggestions");
    expect(Array.isArray(result.suggestions)).toBe(true);
  });

  it("computes complexity metrics correctly", () => {
    const { complexity } = analyzeCode(pythonCode, Language.PYTHON, makeExecution());
    expect(complexity.linesOfCode).toBeGreaterThan(0);
    expect(complexity.commentLines).toBeGreaterThanOrEqual(1);
    expect(complexity.cyclomaticComplexity).toBeGreaterThanOrEqual(1);
    expect(complexity.commentRatio).toBeGreaterThan(0);
  });

  it("assigns full performance score for fast successful execution", () => {
    const result = analyzeCode(pythonCode, Language.PYTHON, makeExecution({ executionTimeMs: 50 }));
    expect(result.performanceScore).toBe(100);
  });

  it("returns performance score of 0 on timeout", () => {
    const result = analyzeCode(
      pythonCode,
      Language.PYTHON,
      makeExecution({ timedOut: true, exitCode: 1 })
    );
    expect(result.performanceScore).toBe(0);
    expect(result.suggestions.some((s) => /timed out/i.test(s))).toBe(true);
  });

  it("returns performance score of 0 on non-zero exit code", () => {
    const result = analyzeCode(
      pythonCode,
      Language.PYTHON,
      makeExecution({ exitCode: 1 })
    );
    expect(result.performanceScore).toBe(0);
  });

  it("penalises slow execution in performance score", () => {
    const fastResult = analyzeCode(pythonCode, Language.PYTHON, makeExecution({ executionTimeMs: 100 }));
    const slowResult = analyzeCode(pythonCode, Language.PYTHON, makeExecution({ executionTimeMs: 3000 }));
    expect(fastResult.performanceScore).toBeGreaterThan(slowResult.performanceScore);
  });

  it("handles empty code gracefully", () => {
    const result = analyzeCode("", Language.PYTHON, makeExecution());
    expect(result.complexity.linesOfCode).toBe(0);
    expect(result.complexity.cyclomaticComplexity).toBeGreaterThanOrEqual(1);
  });

  it("works for JavaScript code", () => {
    const jsCode = `
// JavaScript example
function add(a, b) {
  if (a > 0 && b > 0) {
    return a + b;
  }
  return 0;
}
console.log(add(1, 2));
`;
    const result = analyzeCode(jsCode, Language.JAVASCRIPT, makeExecution());
    expect(result.complexity.cyclomaticComplexity).toBeGreaterThan(1);
  });

  it("generates at least one suggestion", () => {
    const result = analyzeCode(pythonCode, Language.PYTHON, makeExecution());
    expect(result.suggestions.length).toBeGreaterThanOrEqual(1);
  });

  it("quality score is between 0 and 100", () => {
    const result = analyzeCode(pythonCode, Language.PYTHON, makeExecution());
    expect(result.qualityScore).toBeGreaterThanOrEqual(0);
    expect(result.qualityScore).toBeLessThanOrEqual(100);
  });

  it("performance score is between 0 and 100", () => {
    const result = analyzeCode(pythonCode, Language.PYTHON, makeExecution());
    expect(result.performanceScore).toBeGreaterThanOrEqual(0);
    expect(result.performanceScore).toBeLessThanOrEqual(100);
  });
});
