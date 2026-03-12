# @cvr/agentd

## 0.3.1

### Patch Changes

- [#3](https://github.com/cevr/agentd/pull/3) [`6c13a11`](https://github.com/cevr/agentd/commit/6c13a11c16c96339d2b60015eb37ddba35dd1bfb) Thanks [@nuynait](https://github.com/nuynait)! - Fix `*/N * * * *` cron schedules by using launchd's `StartInterval` instead of `StartCalendarInterval`, which has no step syntax support. Previously, step expressions like `*/5` caused `NaN` in plists (silent hourly fallback) and `null` in task JSON (corrupt files).

## 0.3.0

### Minor Changes

- [`44ef603`](https://github.com/cevr/agentd/commit/44ef6036d3ec565050aea002d73f54440a78adb0) Thanks [@cevr](https://github.com/cevr)! - Conditional stops: `--stop-when` flag lets agents signal task completion based on natural language conditions. Per-run nonce signal, verification via second agent call, requires deterministic fallback (`--max-runs`/`--until`). Also refactors `AgentPlatformService.invoke` to capture+tee stdout.

- [`9ca642d`](https://github.com/cevr/agentd/commit/9ca642d4cbc04c02b11c6faad4907d9838ded5df) Thanks [@cevr](https://github.com/cevr)! - Task context metadata: captures git branch, remote, commit, default branch, PR number/URL, and issue number at creation time. Injected into agent prompt as `<context>` block at invocation.

- [`7e87148`](https://github.com/cevr/agentd/commit/7e87148e074f65cace8922341f675c53d4702e2b) Thanks [@cevr](https://github.com/cevr)! - Stop conditions for scheduled tasks: `--max-runs` and `--until`. Tasks auto-complete and uninstall when any condition is met (OR semantics). Also fixes lifecycle state not updating on failed agent runs.

## 0.2.0

### Minor Changes

- [`e257e50`](https://github.com/cevr/agentd/commit/e257e50614c9f37f62bfe082cb3a667e4a76359f) Thanks [@cevr](https://github.com/cevr)! - CLI audit: security fixes (ID validation, XML escaping), typed Schedule schema, `--json` output, improved error handling (recovery hints, defect logging), perf (Bun.which, parallel reads), dead code removal.

### Patch Changes

- [`50089db`](https://github.com/cevr/agentd/commit/50089db89b221854d45f7293b50f2b2a28d4fea9) Thanks [@cevr](https://github.com/cevr)! - Audit fixes: rm cleans up orphaned logs, install rolls back on load failure, uninstall verifies unload before removing plist, store.list warns on corrupt task files, PathEnv inherits process.env.PATH, NO_COLOR support, provider arg builders extracted.
