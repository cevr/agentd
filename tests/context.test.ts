import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { buildPromptWithContext, captureContext } from "../src/context.js";
import type { TaskContext } from "../src/services/Store.js";

const emptyContext: TaskContext = {};

describe("buildPromptWithContext", () => {
  test("returns prompt unchanged when no context", () => {
    expect(buildPromptWithContext("do stuff", "/tmp", undefined)).toBe("do stuff");
  });

  test("includes repo with remote URL", () => {
    const ctx: TaskContext = {
      gitRepo: "agentd",
      gitRemoteUrl: "git@github.com:cevr/agentd.git",
    };
    const result = buildPromptWithContext("babysit pr", "/tmp/project", ctx);
    expect(result).toContain("Repository: agentd (git@github.com:cevr/agentd.git)");
    expect(result).toContain("Working directory: /tmp/project");
    expect(result).toContain("babysit pr");
  });

  test("includes branch", () => {
    const ctx: TaskContext = { gitBranch: "feat/cool-thing" };
    const result = buildPromptWithContext("test", "/tmp", ctx);
    expect(result).toContain("Branch: feat/cool-thing");
  });

  test("includes default branch", () => {
    const ctx: TaskContext = { gitDefaultBranch: "main" };
    const result = buildPromptWithContext("test", "/tmp", ctx);
    expect(result).toContain("Default branch: main");
  });

  test("includes commit", () => {
    const ctx: TaskContext = { gitCommit: "abc1234" };
    const result = buildPromptWithContext("test", "/tmp", ctx);
    expect(result).toContain("HEAD: abc1234");
  });

  test("includes PR with URL", () => {
    const ctx: TaskContext = {
      prNumber: 42,
      prUrl: "https://github.com/cevr/agentd/pull/42",
    };
    const result = buildPromptWithContext("babysit", "/tmp", ctx);
    expect(result).toContain("PR: #42 (https://github.com/cevr/agentd/pull/42)");
  });

  test("includes PR without URL", () => {
    const ctx: TaskContext = { prNumber: 42 };
    const result = buildPromptWithContext("babysit", "/tmp", ctx);
    expect(result).toContain("PR: #42");
    expect(result).not.toContain("(");
  });

  test("includes issue number", () => {
    const ctx: TaskContext = { issueNumber: 123 };
    const result = buildPromptWithContext("fix it", "/tmp", ctx);
    expect(result).toContain("Issue: #123");
  });

  test("wraps in context tags", () => {
    const ctx: TaskContext = { gitBranch: "main" };
    const result = buildPromptWithContext("prompt", "/tmp", ctx);
    expect(result).toMatch(/^<context>\n/);
    expect(result).toMatch(/<\/context>\n\nprompt$/);
  });

  test("full context includes all fields in order", () => {
    const ctx: TaskContext = {
      gitBranch: "feat/issue-42",
      gitRemoteUrl: "git@github.com:cevr/agentd.git",
      gitRepo: "agentd",
      gitCommit: "abc1234",
      gitDefaultBranch: "main",
      prNumber: 42,
      prUrl: "https://github.com/cevr/agentd/pull/42",
      issueNumber: 42,
    };
    const result = buildPromptWithContext("babysit this pr", "/Users/cvr/project", ctx);
    const lines = result.split("\n");
    expect(lines[0]).toBe("<context>");
    expect(lines[1]).toContain("Repository:");
    expect(lines[2]).toContain("Branch:");
    expect(lines[3]).toContain("Default branch:");
    expect(lines[4]).toContain("HEAD:");
    expect(lines[5]).toContain("PR:");
    expect(lines[6]).toContain("Issue:");
    expect(lines[7]).toContain("Working directory:");
    expect(lines[8]).toBe("</context>");
    expect(lines[10]).toBe("babysit this pr");
  });

  test("empty context object still produces output with just cwd", () => {
    const result = buildPromptWithContext("test", "/tmp", emptyContext);
    expect(result).toContain("Working directory: /tmp");
    expect(result).toContain("<context>");
  });
});

describe("captureContext", () => {
  test("captures git info from current repo", async () => {
    const result = await Effect.runPromise(captureContext(process.cwd()));
    expect(result).toBeDefined();
    if (result !== undefined) {
      expect(result.gitBranch).toBeDefined();
      expect(result.gitRemoteUrl).toBeDefined();
      expect(result.gitRepo).toBeDefined();
      expect(result.gitCommit).toBeDefined();
    }
  });

  test("returns undefined for non-git directory", async () => {
    const result = await Effect.runPromise(captureContext("/tmp"));
    expect(result).toBeUndefined();
  });
});
