---
"@cvr/agentd": patch
---

Fix `*/N * * * *` cron schedules by using launchd's `StartInterval` instead of `StartCalendarInterval`, which has no step syntax support. Previously, step expressions like `*/5` caused `NaN` in plists (silent hourly fallback) and `null` in task JSON (corrupt files).
