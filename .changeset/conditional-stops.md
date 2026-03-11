---
"@cvr/agentd": minor
---

Conditional stops: `--stop-when` flag lets agents signal task completion based on natural language conditions. Per-run nonce signal, verification via second agent call, requires deterministic fallback (`--max-runs`/`--until`). Also refactors `AgentPlatformService.invoke` to capture+tee stdout.
