# agentd

Schedule AI agent tasks via macOS launchd.

## Install

```bash
bun run build
```

## Usage

```
agentd <prompt> -s <schedule> [-p claude|codex]   # create task
agentd ls                                          # list tasks
agentd rm <id>                                     # remove task
agentd run <id>                                    # execute (called by launchd)
agentd logs [id] [-f]                              # view logs
```

### Examples

```bash
agentd "babysit this pr" -p claude -s "every weekday at 9am"
agentd "run tests and fix failures" -s "0 9 * * 1-5"
agentd "review open issues" -p codex -s "in 30 minutes"
```

## Development

```bash
bun run gate    # typecheck + lint + fmt + test + build
bun run test    # tests only
bun run dev     # run from source
```
