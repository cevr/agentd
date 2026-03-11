# agentd

Effect v4 CLI for scheduling AI agent tasks via macOS launchd. Bun runtime, single-binary build.

## Commands

```bash
bun run gate          # typecheck + lint + fmt + test + build (pre-commit hook)
bun run typecheck     # tsc --noEmit
bun run build         # compile to bin/agentd, symlink to ~/.bun/bin/agentd
bun run test          # bun test
```

## Architecture

- Effect v4 (effect-smol): `ServiceMap.Service`, `Effect.fn`, `Schema.TaggedErrorClass`
- Four services: `StoreService` (task CRUD at `~/.agentd/tasks/`), `LaunchdService` (plist gen + launchctl), `AgentPlatformService` (agent invocation), `Schedule` (pure parsing module)
- Context capture in `src/context.ts` — `captureContext(cwd)` grabs git/gh metadata at creation; `buildPromptWithContext` injects `<context>` block into prompt at invocation
- Shared path resolution in `src/paths.ts` — Config-based HOME reading, all `.agentd` paths derived from one place
- Commands are `Command.make` from `effect/unstable/cli`, composed in `src/commands/index.ts`
- Errors use structured `code` fields (required) — match with `e.code`, not string parsing
- `main.ts` wraps CLI in custom error handler: app errors → stderr with recovery hints
- `agentd ls --json` / `-j` outputs machine-readable JSON (includes `context` and `stopConditions` fields)
- Stop conditions on `Task` via `StopCondition` tagged union (`MaxRuns`, `AfterDate`) — OR semantics, evaluated pre/post-run in `run.ts`
- `StopEvaluator` in `src/services/StopEvaluator.ts` — pure evaluation module (not a service), `evaluate()` returns first matching reason

## Gotchas

- `Schedule` is a pure module, not a service — no `ServiceMap.Service`, just exported functions
- `Task.schedule` is typed via `Schema.TaggedUnion` — no casts needed, access `._tag` directly
- `LaunchdService.install` is atomic: reads old plist before overwriting, rolls back if `launchctl load` fails
- `LaunchdService.uninstall` checks unload exit code — refuses to remove plist if job still running
- Oneshot tasks auto-unload plist after first run and get status `completed`
- Binary resolves via `Bun.which("agentd")` then falls back to `~/.bun/bin/agentd`
- Plist labels: `com.cvr.agentd-{id}`, logs at `~/.agentd/logs/{id}.log`
- `rm` cleans up both task file and log file
- Task IDs validated: alphanumeric, hyphens, underscores only (path traversal prevention)
- All plist interpolated values are XML-escaped
- `store.list` warns on corrupt task files to stderr — doesn't silently drop
- `PathEnv` inherits `process.env.PATH` at build time; `NO_COLOR` env var respected via `src/output.ts`
- `Bun.spawn` needs mutable `Array<string>`, not `ReadonlyArray` — watch for type errors
- `generatePlist` and `escapeXml` are `@internal` exports for testability
- Provider args extracted into `claudeArgs`/`codexArgs` — add new providers in `src/services/AgentPlatform.ts`
- `TaskContext` uses `Schema.optional` fields — absent keys in JSON decode fine, no migration needed
- `Schema.OptionFromUndefinedOr` fails when JSON key is absent (not just `undefined`) — use `Schema.optional` for JSON-persisted optional fields instead
- Context capture runs git/gh in parallel; all commands fail silently (non-git dirs → `undefined`)
- Issue number parsed from branch name pattern `fix/123-thing` — requires 2+ digit number
- Stop conditions live on `Task`, not `Schedule` — schedule = "when does it fire?", stop = "should it still be active?"
- `run.ts` updates lifecycle state (`lastRun`, `runCount`) even on failed agent invocations — stop policies depend on accurate counts
- `--until` date-only input (YYYY-MM-DD) normalizes to end of day local time (23:59:59.999)

## For Related Docs

| Topic                | Location                              |
| -------------------- | ------------------------------------- |
| CLI usage, skill     | `skills/agentd/SKILL.md`              |
| Effect v4 patterns   | `~/.claude/skills/effect-v4/SKILL.md` |
