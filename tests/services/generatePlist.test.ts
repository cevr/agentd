import { describe, expect, test } from "bun:test";
import { generatePlist } from "../../src/services/Launchd.js";
import { Task } from "../../src/services/Store.js";

const makeTask = (overrides: Partial<Task> = {}): Task =>
  new Task({
    id: "test-1",
    prompt: "run tests",
    provider: "claude",
    schedule: {
      _tag: "Cron",
      minute: 0,
      hour: 9,
      dayOfMonth: "*",
      month: "*",
      dayOfWeek: "*",
      raw: "every day at 9:00",
    },
    cwd: "/Users/test/project",
    createdAt: "2024-06-15T10:00:00Z",
    status: "active",
    runCount: 0,
    ...overrides,
  });

describe("generatePlist", () => {
  test("generates valid plist XML structure", () => {
    const plist = generatePlist(
      makeTask(),
      "/usr/local/bin/agentd",
      "/Users/test",
      "/Users/test/.agentd/logs/test-1.log",
      "/usr/local/bin:/usr/bin:/bin",
    );

    expect(plist).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(plist).toContain('<plist version="1.0">');
    expect(plist).toContain("<key>Label</key>");
    expect(plist).toContain("<string>com.cvr.agentd-test-1</string>");
    expect(plist).toContain("<key>ProgramArguments</key>");
    expect(plist).toContain("<string>/usr/local/bin/agentd</string>");
    expect(plist).toContain("<string>run</string>");
    expect(plist).toContain("<string>test-1</string>");
  });

  test("includes environment variables", () => {
    const plist = generatePlist(
      makeTask(),
      "/usr/local/bin/agentd",
      "/Users/test",
      "/Users/test/.agentd/logs/test-1.log",
      "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin",
    );

    expect(plist).toContain("<key>HOME</key>");
    expect(plist).toContain("<string>/Users/test</string>");
    expect(plist).toContain("<key>PATH</key>");
    expect(plist).toContain("<string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>");
  });

  test("sets working directory", () => {
    const plist = generatePlist(
      makeTask({ cwd: "/my/project" }),
      "/usr/local/bin/agentd",
      "/Users/test",
      "/tmp/log",
      "/usr/bin",
    );

    expect(plist).toContain("<key>WorkingDirectory</key>");
    expect(plist).toContain("<string>/my/project</string>");
  });

  test("sets log paths for stdout and stderr", () => {
    const logPath = "/Users/test/.agentd/logs/test-1.log";
    const plist = generatePlist(
      makeTask(),
      "/usr/local/bin/agentd",
      "/Users/test",
      logPath,
      "/usr/bin",
    );

    expect(plist).toContain("<key>StandardOutPath</key>");
    expect(plist).toContain("<key>StandardErrorPath</key>");
    expect(plist).toContain(`<string>${logPath}</string>`);
  });

  test("escapes XML special characters in all fields", () => {
    const plist = generatePlist(
      makeTask({ id: "a&b", prompt: "check <things>", cwd: '/path/with "quotes"' }),
      "/bin/agent&d",
      "/Users/te'st",
      "/logs/a&b.log",
      "/usr/bin",
    );

    expect(plist).toContain("com.cvr.agentd-a&amp;b");
    expect(plist).toContain("/bin/agent&amp;d");
    expect(plist).toContain("/Users/te&apos;st");
    expect(plist).toContain("/logs/a&amp;b.log");
    expect(plist).toContain("/path/with &quot;quotes&quot;");
  });

  test("generates StartCalendarInterval for daily cron", () => {
    const plist = generatePlist(
      makeTask({
        schedule: {
          _tag: "Cron",
          minute: 30,
          hour: 14,
          dayOfMonth: "*",
          month: "*",
          dayOfWeek: "*",
          raw: "30 14 * * *",
        },
      }),
      "/bin/agentd",
      "/Users/test",
      "/tmp/log",
      "/usr/bin",
    );

    expect(plist).toContain("<key>StartCalendarInterval</key>");
    expect(plist).toContain("<key>Minute</key>");
    expect(plist).toContain("<integer>30</integer>");
    expect(plist).toContain("<key>Hour</key>");
    expect(plist).toContain("<integer>14</integer>");
  });

  test("generates array of StartCalendarInterval for weekday range", () => {
    const plist = generatePlist(
      makeTask({
        schedule: {
          _tag: "Cron",
          minute: 0,
          hour: 9,
          dayOfMonth: "*",
          month: "*",
          dayOfWeek: "1-5",
          raw: "0 9 * * 1-5",
        },
      }),
      "/bin/agentd",
      "/Users/test",
      "/tmp/log",
      "/usr/bin",
    );

    expect(plist).toContain("<key>StartCalendarInterval</key>");
    expect(plist).toContain("<array>");
    // Should have 5 dict entries (Mon-Fri)
    const dictCount = (plist.match(/<dict>/g) ?? []).length;
    // Main dict + 5 calendar interval dicts = 6
    expect(dictCount).toBe(7); // 1 root + 1 env + 5 intervals
  });

  test("generates oneshot calendar interval with Month/Day/Hour/Minute", () => {
    const at = new Date("2024-06-15T10:30:00Z");
    const plist = generatePlist(
      makeTask({
        schedule: { _tag: "Oneshot", at: at.toISOString(), raw: "in 30 minutes" },
      }),
      "/bin/agentd",
      "/Users/test",
      "/tmp/log",
      "/usr/bin",
    );

    expect(plist).toContain("<key>StartCalendarInterval</key>");
    expect(plist).toContain("<key>Month</key>");
    expect(plist).toContain("<key>Day</key>");
    expect(plist).toContain("<key>Hour</key>");
    expect(plist).toContain("<key>Minute</key>");
  });

  test("sets KeepAlive to false", () => {
    const plist = generatePlist(makeTask(), "/bin/agentd", "/Users/test", "/tmp/log", "/usr/bin");

    expect(plist).toContain("<key>KeepAlive</key>");
    expect(plist).toContain("<false/>");
  });
});
