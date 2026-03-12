import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import * as Schedule from "../../src/services/Schedule.js";

const run = <A, E>(effect: Effect.Effect<A, E>) => Effect.runSync(Effect.orDie(effect));

describe("Schedule.parse", () => {
  const now = new Date("2024-06-15T10:00:00Z");

  describe("natural language — oneshot", () => {
    test("in N minutes", () => {
      const s = run(Schedule.parse("in 30 minutes", now));
      expect(s._tag).toBe("Oneshot");
      if (s._tag === "Oneshot") {
        const at = new Date(s.at);
        expect(at.getTime() - now.getTime()).toBe(30 * 60 * 1000);
      }
    });

    test("in N hours", () => {
      const s = run(Schedule.parse("in 2 hours", now));
      expect(s._tag).toBe("Oneshot");
      if (s._tag === "Oneshot") {
        const at = new Date(s.at);
        expect(at.getTime() - now.getTime()).toBe(2 * 60 * 60 * 1000);
      }
    });

    test("in N days", () => {
      const s = run(Schedule.parse("in 3 days", now));
      expect(s._tag).toBe("Oneshot");
      if (s._tag === "Oneshot") {
        const at = new Date(s.at);
        expect(at.getTime() - now.getTime()).toBe(3 * 24 * 60 * 60 * 1000);
      }
    });

    test("tomorrow at HH:mm", () => {
      const s = run(Schedule.parse("tomorrow at 9:30", now));
      expect(s._tag).toBe("Oneshot");
      if (s._tag === "Oneshot") {
        const at = new Date(s.at);
        expect(at.getDate()).toBe(now.getDate() + 1);
      }
    });

    test("tomorrow at HHam", () => {
      const s = run(Schedule.parse("tomorrow at 9am", now));
      expect(s._tag).toBe("Oneshot");
    });
  });

  describe("natural language — cron", () => {
    test("every day at HH:mm", () => {
      const s = run(Schedule.parse("every day at 9:00", now));
      expect(s._tag).toBe("Cron");
      if (s._tag === "Cron") {
        expect(s.hour).toBe(9);
        expect(s.minute).toBe(0);
        expect(s.dayOfWeek).toBe("*");
      }
    });

    test("every day at HHpm", () => {
      const s = run(Schedule.parse("every day at 3pm", now));
      expect(s._tag).toBe("Cron");
      if (s._tag === "Cron") {
        expect(s.hour).toBe(15);
        expect(s.minute).toBe(0);
      }
    });

    test("every weekday at HH:mm", () => {
      const s = run(Schedule.parse("every weekday at 9:00", now));
      expect(s._tag).toBe("Cron");
      if (s._tag === "Cron") {
        expect(s.dayOfWeek).toBe("1-5");
        expect(s.hour).toBe(9);
      }
    });

    test("every monday at HH:mm", () => {
      const s = run(Schedule.parse("every monday at 10:30am", now));
      expect(s._tag).toBe("Cron");
      if (s._tag === "Cron") {
        expect(s.dayOfWeek).toBe(1);
        expect(s.hour).toBe(10);
        expect(s.minute).toBe(30);
      }
    });
  });

  describe("5-field cron", () => {
    test("standard cron", () => {
      const s = run(Schedule.parse("0 9 * * 1-5", now));
      expect(s._tag).toBe("Cron");
      if (s._tag === "Cron") {
        expect(s.minute).toBe(0);
        expect(s.hour).toBe(9);
        expect(s.dayOfMonth).toBe("*");
        expect(s.month).toBe("*");
        expect(s.dayOfWeek).toBe("1-5");
      }
    });

    test("every minute", () => {
      const s = run(Schedule.parse("* * * * *", now));
      expect(s._tag).toBe("Cron");
      if (s._tag === "Cron") {
        expect(s.minute).toBe("*");
        expect(s.hour).toBe("*");
      }
    });

    test("*/N minute step expression produces Interval", () => {
      const s = run(Schedule.parse("*/5 * * * *", now));
      expect(s._tag).toBe("Interval");
      if (s._tag === "Interval") {
        expect(s.seconds).toBe(300);
      }
    });

    test("*/1 minute step expression produces Interval", () => {
      const s = run(Schedule.parse("*/1 * * * *", now));
      expect(s._tag).toBe("Interval");
      if (s._tag === "Interval") {
        expect(s.seconds).toBe(60);
      }
    });

    test("step expression in non-minute field stays Cron", () => {
      const s = run(Schedule.parse("0 */2 * * *", now));
      expect(s._tag).toBe("Cron");
      if (s._tag === "Cron") {
        expect(s.minute).toBe(0);
        expect(s.hour).toBe("*");
      }
    });
  });

  test("invalid input fails", () => {
    expect(() => run(Schedule.parse("not a schedule", now))).toThrow();
  });

  test("rejects invalid day-of-week in cron", () => {
    // "abc" is not a valid day-of-week
    expect(() => run(Schedule.parse("0 9 * * abc", now))).toThrow();
  });

  test("rejects out-of-range day-of-week number", () => {
    expect(() => run(Schedule.parse("0 9 * * 8", now))).toThrow();
  });

  test("rejects invalid day-of-week range", () => {
    // 5-1 is backwards
    expect(() => run(Schedule.parse("0 9 * * 5-1", now))).toThrow();
  });
});

describe("Schedule.describe", () => {
  test("oneshot", () => {
    const desc = Schedule.describe({
      _tag: "Oneshot",
      at: new Date("2024-06-15T10:30:00Z").toISOString(),
      raw: "in 30 minutes",
    });
    expect(desc).toContain("once at");
  });

  test("daily cron", () => {
    const desc = Schedule.describe({
      _tag: "Cron",
      minute: 0,
      hour: 9,
      dayOfMonth: "*",
      month: "*",
      dayOfWeek: "*",
      raw: "every day at 9:00",
    });
    expect(desc).toBe("daily at 09:00");
  });

  test("interval every minute", () => {
    const desc = Schedule.describe({
      _tag: "Interval",
      seconds: 60,
      raw: "*/1 * * * *",
    });
    expect(desc).toBe("every minute");
  });

  test("interval every N minutes", () => {
    const desc = Schedule.describe({
      _tag: "Interval",
      seconds: 300,
      raw: "*/5 * * * *",
    });
    expect(desc).toBe("every 5 minutes");
  });

  test("weekday cron", () => {
    const desc = Schedule.describe({
      _tag: "Cron",
      minute: 0,
      hour: 9,
      dayOfMonth: "*",
      month: "*",
      dayOfWeek: "1-5",
      raw: "every weekday at 9am",
    });
    expect(desc).toBe("weekdays at 09:00");
  });
});

describe("Schedule.toCalendarIntervals", () => {
  test("oneshot generates single interval", () => {
    const intervals = Schedule.toCalendarIntervals({
      _tag: "Oneshot",
      at: new Date("2024-06-15T10:30:00Z").toISOString(),
      raw: "in 30 minutes",
    });
    expect(intervals).toHaveLength(1);
    expect(intervals[0]).toHaveProperty("Month");
    expect(intervals[0]).toHaveProperty("Day");
    expect(intervals[0]).toHaveProperty("Hour");
    expect(intervals[0]).toHaveProperty("Minute");
  });

  test("weekday range generates 5 intervals", () => {
    const intervals = Schedule.toCalendarIntervals({
      _tag: "Cron",
      minute: 0,
      hour: 9,
      dayOfMonth: "*",
      month: "*",
      dayOfWeek: "1-5",
      raw: "0 9 * * 1-5",
    });
    expect(intervals).toHaveLength(5);
    for (const interval of intervals) {
      expect(interval).toHaveProperty("Weekday");
      expect(interval["Hour"]).toBe(9);
      expect(interval["Minute"]).toBe(0);
    }
  });

  test("daily generates single interval", () => {
    const intervals = Schedule.toCalendarIntervals({
      _tag: "Cron",
      minute: 30,
      hour: 14,
      dayOfMonth: "*",
      month: "*",
      dayOfWeek: "*",
      raw: "30 14 * * *",
    });
    expect(intervals).toHaveLength(1);
    expect(intervals[0]!["Hour"]).toBe(14);
    expect(intervals[0]!["Minute"]).toBe(30);
  });
});
