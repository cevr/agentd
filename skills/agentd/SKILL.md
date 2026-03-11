---
name: agentd
description: AI agent task scheduler via macOS launchd. Use when scheduling agent tasks, managing scheduled jobs, viewing task logs, or any interaction with the `~/.agentd/` directory. Triggers on "agentd", "schedule agent", "schedule task", "agent scheduler", "launchd agent".
---

# agentd

Schedule AI agent tasks (Claude, Codex) via macOS launchd plist files. Each task becomes a plist that fires `agentd run <id>`, which invokes the agent in the original working directory.

## Navigation

```
What do you need?
├─ Schedule a task           → §Scheduling
├─ Manage existing tasks     → §Management
├─ View logs                 → §Logs
├─ Understand internals      → §Architecture
└─ Troubleshooting           → §Gotchas
```

## Quick Reference

| Command | What it does |
| ------- | ------------ |
| `agentd "<prompt>" -s "<schedule>"` | Schedule task (default: claude) |
| `agentd "<prompt>" -s "<schedule>" -p codex` | Schedule with specific provider |
| `agentd "<prompt>" -s "<schedule>" --stop-when "<condition>" --max-runs N` | Conditional stop with fallback |
| `agentd ls` | List all tasks |
| `agentd ls --json` / `agentd ls -j` | List tasks as JSON |
| `agentd rm <id>` | Remove task + unload plist |
| `agentd run <id>` | Execute task (called by launchd) |
| `agentd logs` | List available logs |
| `agentd logs <id>` | View task log |
| `agentd logs <id> -f` | Tail task log |

## Scheduling

### Schedule Formats

Natural language (preferred):

| Pattern | Type | Example |
| ------- | ---- | ------- |
| `in N minutes/hours/days` | Oneshot | `in 30 minutes` |
| `tomorrow at HH:mm[am\|pm]` | Oneshot | `tomorrow at 9am` |
| `every day at HH:mm[am\|pm]` | Recurring | `every day at 9:00` |
| `every weekday at HH:mm` | Recurring | `every weekday at 9am` |
| `every {day} at HH:mm` | Recurring | `every monday at 10:30am` |

5-field cron fallback: `min hour dom month dow`

| Cron | Meaning |
| ---- | ------- |
| `0 9 * * 1-5` | Weekdays at 9am |
| `*/30 * * * *` | Every 30 min |
| `0 0 1 * *` | First of month midnight |

### Providers

| Flag | CLI invoked |
| ---- | ----------- |
| `-p claude` (default) | `claude -p <prompt> --dangerously-skip-permissions --model sonnet` |
| `-p codex` | `codex exec -C <cwd> --dangerously-bypass-approvals-and-sandbox` |

## Context Metadata

At creation time, agentd captures environmental context (best-effort, all optional):

| Field | Source |
| ----- | ------ |
| `gitBranch` | `git rev-parse --abbrev-ref HEAD` |
| `gitRemoteUrl` | `git remote get-url origin` |
| `gitRepo` | Parsed from remote URL |
| `gitCommit` | `git rev-parse --short HEAD` |
| `gitDefaultBranch` | `git rev-parse --abbrev-ref origin/HEAD` |
| `prNumber` / `prUrl` | `gh pr view --json number,url` |
| `issueNumber` | Parsed from branch name (e.g. `fix/123-thing`) |

At invocation, context is injected as a `<context>` block prepended to the prompt. Enables natural prompts like `"babysit this pr"`.

## Conditional Stops

`--stop-when` lets the agent signal "I'm done" based on a natural language condition. Requires a deterministic fallback (`--max-runs` or `--until`).

```bash
agentd "babysit pr" -s "every day at 9am" --stop-when "the PR is merged" --max-runs 20
```

**How it works:**

1. Each run generates a random nonce (`AGENTD_STOP_<8-char-hex>`) injected into the prompt via `<stop-signal>` block
2. Agent outputs the nonce when it determines the condition is met
3. `run.ts` detects nonce in captured output (`output.includes(nonce)`)
4. Verification call: second agent invocation confirms the signal was intentional (not accidental match)
5. If verified: task completes. If rejected: continues to next scheduled run

**Three-layer defense:**
- Signal: per-run nonce (not guessable, not a static marker)
- Verification: lightweight YES/NO check (heuristic, not security boundary)
- Fallback: deterministic `--max-runs`/`--until` always enforced

## Management

- Tasks stored at `~/.agentd/tasks/{id}.json` (includes `context` and `conditionalStop` fields)
- Plists at `~/Library/LaunchAgents/com.cvr.agentd-{id}.plist`
- `agentd rm <id>` unloads plist, deletes task file, and cleans up log file
- Oneshot tasks auto-complete after first run
- `install` is atomic: rolls back to previous plist if `launchctl load` fails
- `uninstall` verifies unload succeeded before removing plist — won't orphan running jobs

## Logs

- Log files at `~/.agentd/logs/{id}.log`
- Both stdout and stderr go to the same log file
- `agentd logs` lists all available log files
- `agentd logs <id> -f` tails in real-time

## Architecture

```
src/
  main.ts                    # CLI entry + layer wiring
  paths.ts                   # shared path resolution (HOME, dirs)
  errors/index.ts            # AgentdError (tagged)
  context.ts                 # git/gh context capture + prompt injection
  output.ts                  # NO_COLOR + TTY detection
  commands/
    index.ts                 # root (= add) + subcommands
    list.ts                  # ls
    remove.ts                # rm (+ log cleanup)
    run.ts                   # run (internal, fired by plist) + conditional stop protocol
    logs.ts                  # logs
  services/
    Schedule.ts              # pure NL/cron parser
    Store.ts                 # task CRUD (~/.agentd/tasks/)
    StopEvaluator.ts         # pure deterministic stop evaluation
    Launchd.ts               # plist gen + launchctl (atomic install/uninstall)
    AgentPlatform.ts         # agent invocation (capture+tee stdout)
    Verification.ts          # conditional stop verification (invokeCapture)
```

## Gotchas

- `agentd` binary conflicts with nothing, but ensure `~/.bun/bin` is in PATH for launchd
- Plist `EnvironmentVariables` includes HOME and PATH — `PathEnv` inherits `process.env.PATH` at build time
- `Schedule` is a pure module, not a `ServiceMap.Service`
- Task IDs must be alphanumeric, hyphens, or underscores only
- Oneshot tasks auto-unload their plist after first run
- Weekday range `1-5` expands to 5 separate `StartCalendarInterval` entries
- `store.list` warns on corrupt task files to stderr — doesn't silently drop
- `NO_COLOR=1` suppresses decorative output (separator lines in `ls`)
- `generatePlist` and `escapeXml` are `@internal` exports for testability
- Provider args are extracted into `claudeArgs`/`codexArgs` — extend in `AgentPlatform.ts`
- `invoke` returns `{ exitCode, output }` — stdout is piped+tee'd (captured and forwarded to parent)
- `invokeCapture` captures stdout only (no tee) — used for verification calls
- `--stop-when` requires `--max-runs` or `--until` — error code `MISSING_FALLBACK`
- Conditional stop nonce: `AGENTD_STOP_<8-char-hex>` — per-run, injected in `<stop-signal>` block
- Verification is heuristic (same agent), not a trust boundary — guards against accidental matches only
