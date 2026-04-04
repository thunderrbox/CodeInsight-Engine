import { Language } from "../src/types";
import { getLanguageConfig, LANGUAGE_CONFIGS } from "../src/executor/languages";

describe("Language Configuration", () => {
  it("returns config for all supported languages", () => {
    const languages = Object.values(Language);
    for (const lang of languages) {
      const cfg = getLanguageConfig(lang);
      expect(cfg).toBeDefined();
      expect(cfg.image).toBeTruthy();
      expect(cfg.fileName).toBeTruthy();
      expect(cfg.fileExtension).toBeTruthy();
      expect(typeof cfg.runCommand).toBe("function");
    }
  });

  it("throws for unsupported language", () => {
    expect(() => getLanguageConfig("rust" as Language)).toThrow("Unsupported language");
  });

  it("python config uses python3 runner", () => {
    const cfg = getLanguageConfig(Language.PYTHON);
    expect(cfg.image).toContain("python");
    const cmd = cfg.runCommand("/workspace/solution.py");
    expect(cmd).toContain("python3");
    expect(cmd).toContain("/workspace/solution.py");
  });

  it("javascript config uses node runner", () => {
    const cfg = getLanguageConfig(Language.JAVASCRIPT);
    expect(cfg.image).toContain("node");
    const cmd = cfg.runCommand("/workspace/solution.js");
    expect(cmd).toContain("node");
    expect(cmd).toContain("/workspace/solution.js");
  });

  it("java config has compile command", () => {
    const cfg = getLanguageConfig(Language.JAVA);
    expect(cfg.compileCommand).toBeDefined();
    const compile = cfg.compileCommand!("/workspace/Solution.java", "/workspace/Solution");
    expect(compile).toContain("javac");
  });

  it("cpp config has compile command", () => {
    const cfg = getLanguageConfig(Language.CPP);
    expect(cfg.compileCommand).toBeDefined();
    const compile = cfg.compileCommand!("/workspace/solution.cpp", "/workspace/solution_bin");
    expect(compile).toContain("g++");
    expect(compile).toContain("/workspace/solution_bin");
  });

  it("go config uses go runner", () => {
    const cfg = getLanguageConfig(Language.GO);
    expect(cfg.image).toContain("golang");
    const cmd = cfg.runCommand("/workspace/solution.go");
    expect(cmd).toContain("go");
  });

  it("all language images are referenced", () => {
    const configs = Object.values(LANGUAGE_CONFIGS);
    for (const cfg of configs) {
      expect(cfg.image).toMatch(/:.+/); // has a tag
    }
  });
});
