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
- Shared path resolution in `src/paths.ts` — Config-based HOME reading, all `.agentd` paths derived from one place
- Commands are `Command.make` from `effect/unstable/cli`, composed in `src/commands/index.ts`
- Errors use structured `code` fields (required) — match with `e.code`, not string parsing
- `main.ts` wraps CLI in custom error handler: app errors → stderr with recovery hints
- `agentd ls --json` / `-j` outputs machine-readable JSON

## Gotchas

- `Schedule` is a pure module, not a service — no `ServiceMap.Service`, just exported functions
- `Task.schedule` is typed via `Schema.TaggedUnion` — no casts needed, access `._tag` directly
- `LaunchdService.install` auto-unloads existing plist before reinstalling
- Oneshot tasks auto-unload plist after first run and get status `completed`
- Binary resolves via `Bun.which("agentd")` then falls back to `~/.bun/bin/agentd`
- Plist labels: `com.cvr.agentd-{id}`, logs at `~/.agentd/logs/{id}.log`
- Task IDs validated: alphanumeric, hyphens, underscores only (path traversal prevention)
- All plist interpolated values are XML-escaped

## For Related Docs

| Topic                | Location                              |
| -------------------- | ------------------------------------- |
| CLI usage, skill     | `skills/agentd/SKILL.md`              |
| Effect v4 patterns   | `~/.claude/skills/effect-v4/SKILL.md` |
