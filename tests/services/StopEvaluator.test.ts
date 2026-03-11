import { describe, expect, it } from "effect-bun-test";
import { Effect, Option } from "effect";
import { Task, type StopCondition } from "../../src/services/Store.js";
import * as StopEvaluator from "../../src/services/StopEvaluator.js";

const makeTask = (overrides: Partial<ConstructorParameters<typeof Task>[0]> = {}): Task =>
  new Task({
    id: "test-1",
    prompt: "test prompt",
    provider: "claude",
    schedule: {
      _tag: "Cron",
      minute: 0,
      hour: 9,
      dayOfMonth: "*",
      month: "*",
      dayOfWeek: "*",
      raw: "every day at 9am",
    },
    cwd: "/tmp",
    createdAt: new Date().toISOString(),
    status: "active",
    runCount: 0,
    ...overrides,
  });

describe("StopEvaluator", () => {
  describe("MaxRuns", () => {
    it.live("returns none when runCount < maxRuns", () =>
      Effect.sync(() => {
        const task = makeTask({
          runCount: 2,
          stopConditions: [{ _tag: "MaxRuns", count: 5 }],
        });
        const result = StopEvaluator.evaluate(task);
        expect(Option.isNone(result)).toBe(true);
      }),
    );

    it.live("returns reason when runCount >= maxRuns", () =>
      Effect.sync(() => {
        const task = makeTask({
          runCount: 5,
          stopConditions: [{ _tag: "MaxRuns", count: 5 }],
        });
        const result = StopEvaluator.evaluate(task);
        expect(Option.isSome(result)).toBe(true);
        if (Option.isSome(result)) {
          expect(result.value.condition._tag).toBe("MaxRuns");
          expect(result.value.description).toContain("5/5");
        }
      }),
    );

    it.live("returns reason when runCount exceeds maxRuns", () =>
      Effect.sync(() => {
        const task = makeTask({
          runCount: 7,
          stopConditions: [{ _tag: "MaxRuns", count: 5 }],
        });
        const result = StopEvaluator.evaluate(task);
        expect(Option.isSome(result)).toBe(true);
      }),
    );
  });

  describe("AfterDate", () => {
    it.live("returns none when date is in the future", () =>
      Effect.sync(() => {
        const future = new Date(Date.now() + 86_400_000).toISOString();
        const task = makeTask({
          stopConditions: [{ _tag: "AfterDate", date: future }],
        });
        const result = StopEvaluator.evaluate(task);
        expect(Option.isNone(result)).toBe(true);
      }),
    );

    it.live("returns reason when date is in the past", () =>
      Effect.sync(() => {
        const past = new Date(Date.now() - 86_400_000).toISOString();
        const task = makeTask({
          stopConditions: [{ _tag: "AfterDate", date: past }],
        });
        const result = StopEvaluator.evaluate(task);
        expect(Option.isSome(result)).toBe(true);
        if (Option.isSome(result)) {
          expect(result.value.condition._tag).toBe("AfterDate");
        }
      }),
    );
  });

  describe("multiple conditions (OR semantics)", () => {
    it.live("returns first matching condition", () =>
      Effect.sync(() => {
        const task = makeTask({
          runCount: 10,
          stopConditions: [
            { _tag: "MaxRuns", count: 5 },
            { _tag: "AfterDate", date: new Date(Date.now() + 86_400_000).toISOString() },
          ],
        });
        const result = StopEvaluator.evaluate(task);
        expect(Option.isSome(result)).toBe(true);
        if (Option.isSome(result)) {
          expect(result.value.condition._tag).toBe("MaxRuns");
        }
      }),
    );

    it.live("returns none when no conditions match", () =>
      Effect.sync(() => {
        const task = makeTask({
          runCount: 2,
          stopConditions: [
            { _tag: "MaxRuns", count: 5 },
            { _tag: "AfterDate", date: new Date(Date.now() + 86_400_000).toISOString() },
          ],
        });
        const result = StopEvaluator.evaluate(task);
        expect(Option.isNone(result)).toBe(true);
      }),
    );
  });

  describe("no stop conditions", () => {
    it.live("returns none when stopConditions is undefined", () =>
      Effect.sync(() => {
        const task = makeTask();
        const result = StopEvaluator.evaluate(task);
        expect(Option.isNone(result)).toBe(true);
      }),
    );

    it.live("returns none when stopConditions is empty", () =>
      Effect.sync(() => {
        const task = makeTask({ stopConditions: [] });
        const result = StopEvaluator.evaluate(task);
        expect(Option.isNone(result)).toBe(true);
      }),
    );
  });

  describe("describe", () => {
    it.live("formats MaxRuns", () =>
      Effect.sync(() => {
        const task = makeTask({ runCount: 3 });
        const conditions: ReadonlyArray<StopCondition> = [{ _tag: "MaxRuns", count: 5 }];
        expect(StopEvaluator.describe(conditions, task)).toBe("3/5 runs");
      }),
    );

    it.live("formats AfterDate", () =>
      Effect.sync(() => {
        const task = makeTask();
        const conditions: ReadonlyArray<StopCondition> = [
          { _tag: "AfterDate", date: "2026-03-20T23:59:59.999Z" },
        ];
        const result = StopEvaluator.describe(conditions, task);
        expect(result).toContain("until");
        expect(result).toContain("3/20/2026");
      }),
    );

    it.live("formats multiple conditions", () =>
      Effect.sync(() => {
        const task = makeTask({ runCount: 1 });
        const conditions: ReadonlyArray<StopCondition> = [
          { _tag: "MaxRuns", count: 10 },
          { _tag: "AfterDate", date: "2026-12-31T23:59:59.999Z" },
        ];
        expect(StopEvaluator.describe(conditions, task)).toBe("1/10 runs, until 12/31/2026");
      }),
    );
  });
});
