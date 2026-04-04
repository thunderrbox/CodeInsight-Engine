import {
  AnalysisResult,
  ComplexityMetrics,
  ExecutionResult,
  Language,
} from "../types";

const COMMENT_PATTERNS: Record<Language, RegExp[]> = {
  [Language.PYTHON]: [/^\s*#/],
  [Language.JAVASCRIPT]: [/^\s*\/\//, /^\s*\/\*/, /^\s*\*/, /^\s*\*\//],
  [Language.TYPESCRIPT]: [/^\s*\/\//, /^\s*\/\*/, /^\s*\*/, /^\s*\*\//],
  [Language.JAVA]: [/^\s*\/\//, /^\s*\/\*/, /^\s*\*/, /^\s*\*\//],
  [Language.CPP]: [/^\s*\/\//, /^\s*\/\*/, /^\s*\*/, /^\s*\*\//],
  [Language.GO]: [/^\s*\/\//, /^\s*\/\*/, /^\s*\*/, /^\s*\*\//],
};

const DECISION_KEYWORDS: Record<Language, RegExp> = {
  [Language.PYTHON]: /\b(if|elif|else|for|while|except|with|and|or)\b/g,
  [Language.JAVASCRIPT]:
    /\b(if|else|for|while|do|switch|case|catch|&&|\|\||\?)\b/g,
  [Language.TYPESCRIPT]:
    /\b(if|else|for|while|do|switch|case|catch|&&|\|\||\?)\b/g,
  [Language.JAVA]: /\b(if|else|for|while|do|switch|case|catch|&&|\|\|)\b/g,
  [Language.CPP]: /\b(if|else|for|while|do|switch|case|catch|&&|\|\|)\b/g,
  [Language.GO]: /\b(if|else|for|switch|case|select|&&|\|\|)\b/g,
};

export function analyzeCode(
  code: string,
  language: Language,
  execution: ExecutionResult
): AnalysisResult {
  const complexity = computeComplexity(code, language);
  const qualityScore = computeQualityScore(complexity);
  const performanceScore = computePerformanceScore(execution, complexity);
  const suggestions = generateSuggestions(complexity, execution);

  return { complexity, qualityScore, performanceScore, suggestions };
}

function computeComplexity(code: string, language: Language): ComplexityMetrics {
  const lines = code.split("\n");
  const commentPatterns = COMMENT_PATTERNS[language] ?? [];
  const decisionPattern = DECISION_KEYWORDS[language];

  let commentLines = 0;
  let blankLines = 0;

  for (const line of lines) {
    if (line.trim() === "") {
      blankLines++;
    } else if (commentPatterns.some((p) => p.test(line))) {
      commentLines++;
    }
  }

  const linesOfCode = lines.length - commentLines - blankLines;

  // Cyclomatic complexity = 1 + number of decision points
  const decisionMatches = decisionPattern
    ? [...code.matchAll(new RegExp(decisionPattern.source, "g"))]
    : [];
  const cyclomaticComplexity = 1 + decisionMatches.length;

  const commentRatio =
    lines.length > 0
      ? parseFloat((commentLines / lines.length).toFixed(2))
      : 0;

  return {
    linesOfCode: Math.max(0, linesOfCode),
    commentLines,
    blankLines,
    commentRatio,
    cyclomaticComplexity,
  };
}

function computeQualityScore(complexity: ComplexityMetrics): number {
  let score = 100;

  // Penalise very high cyclomatic complexity
  if (complexity.cyclomaticComplexity > 20) score -= 30;
  else if (complexity.cyclomaticComplexity > 10) score -= 15;
  else if (complexity.cyclomaticComplexity > 5) score -= 5;

  // Reward documentation
  if (complexity.commentRatio >= 0.2) score += 5;
  else if (complexity.commentRatio < 0.05 && complexity.linesOfCode > 20)
    score -= 10;

  return Math.max(0, Math.min(100, score));
}

function computePerformanceScore(
  execution: ExecutionResult,
  complexity: ComplexityMetrics
): number {
  if (execution.timedOut) return 0;
  if (execution.exitCode !== 0) return 0;

  let score = 100;

  // Penalise slow execution
  const ms = execution.executionTimeMs;
  if (ms > 5000) score -= 40;
  else if (ms > 2000) score -= 20;
  else if (ms > 1000) score -= 10;
  else if (ms > 500) score -= 5;

  // Minor penalty for very large code
  if (complexity.linesOfCode > 500) score -= 10;

  return Math.max(0, Math.min(100, score));
}

function generateSuggestions(
  complexity: ComplexityMetrics,
  execution: ExecutionResult
): string[] {
  const suggestions: string[] = [];

  if (execution.timedOut) {
    suggestions.push(
      "Execution timed out. Consider optimizing algorithmic complexity or reducing input size."
    );
  }

  if (execution.exitCode !== 0 && !execution.timedOut) {
    suggestions.push(
      "The program exited with a non-zero status. Review stderr for error details."
    );
  }

  if (complexity.cyclomaticComplexity > 20) {
    suggestions.push(
      "Very high cyclomatic complexity detected. Consider refactoring into smaller functions."
    );
  } else if (complexity.cyclomaticComplexity > 10) {
    suggestions.push(
      "High cyclomatic complexity. Breaking this into smaller functions may improve readability."
    );
  }

  if (complexity.commentRatio < 0.05 && complexity.linesOfCode > 20) {
    suggestions.push(
      "Low comment ratio. Adding documentation improves long-term maintainability."
    );
  }

  if (execution.executionTimeMs > 2000 && !execution.timedOut) {
    suggestions.push(
      "Execution took more than 2 seconds. Profile the code to identify bottlenecks."
    );
  }

  if (suggestions.length === 0) {
    suggestions.push("No major issues detected. Code looks good!");
  }

  return suggestions;
}
