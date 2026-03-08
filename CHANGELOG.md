# @cvr/agentd

## 0.2.0

### Minor Changes

- [`e257e50`](https://github.com/cevr/agentd/commit/e257e50614c9f37f62bfe082cb3a667e4a76359f) Thanks [@cevr](https://github.com/cevr)! - CLI audit: security fixes (ID validation, XML escaping), typed Schedule schema, `--json` output, improved error handling (recovery hints, defect logging), perf (Bun.which, parallel reads), dead code removal.

### Patch Changes

- [`50089db`](https://github.com/cevr/agentd/commit/50089db89b221854d45f7293b50f2b2a28d4fea9) Thanks [@cevr](https://github.com/cevr)! - Audit fixes: rm cleans up orphaned logs, install rolls back on load failure, uninstall verifies unload before removing plist, store.list warns on corrupt task files, PathEnv inherits process.env.PATH, NO_COLOR support, provider arg builders extracted.
