import { Language } from "../types";

interface LanguageConfig {
  image: string;
  fileExtension: string;
  fileName: string;
  runCommand: (filePath: string) => string[];
  compileCommand?: (filePath: string, outputPath: string) => string[];
}

const LANGUAGE_CONFIGS: Record<Language, LanguageConfig> = {
  [Language.PYTHON]: {
    image: "python:3.12-alpine",
    fileExtension: "py",
    fileName: "solution.py",
    runCommand: (filePath) => ["python3", filePath],
  },
  [Language.JAVASCRIPT]: {
    image: "node:20-alpine",
    fileExtension: "js",
    fileName: "solution.js",
    runCommand: (filePath) => ["node", filePath],
  },
  [Language.TYPESCRIPT]: {
    image: "node:20-alpine",
    fileExtension: "ts",
    fileName: "solution.ts",
    runCommand: (filePath) => [
      "sh",
      "-c",
      `npx --yes ts-node ${filePath}`,
    ],
  },
  [Language.JAVA]: {
    image: "eclipse-temurin:21-jdk-alpine",
    fileExtension: "java",
    fileName: "Solution.java",
    runCommand: (filePath) => ["sh", "-c", `cd $(dirname ${filePath}) && java $(basename ${filePath} .java)`],
    compileCommand: (filePath) => ["javac", filePath],
  },
  [Language.CPP]: {
    image: "gcc:13-bookworm",
    fileExtension: "cpp",
    fileName: "solution.cpp",
    runCommand: (_unused: string) => ["/workspace/solution_bin"],
    compileCommand: (filePath, outputPath) => [
      "g++",
      "-O2",
      "-o",
      outputPath,
      filePath,
    ],
  },
  [Language.GO]: {
    image: "golang:1.22-alpine",
    fileExtension: "go",
    fileName: "solution.go",
    runCommand: (filePath) => ["go", "run", filePath],
  },
};

export function getLanguageConfig(language: Language): LanguageConfig {
  const cfg = LANGUAGE_CONFIGS[language];
  if (!cfg) {
    throw new Error(`Unsupported language: ${language}`);
  }
  return cfg;
}

export { LANGUAGE_CONFIGS };
export type { LanguageConfig };
