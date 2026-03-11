/** @effect-diagnostics effect/strictEffectProvide:skip-file */
import { describe, expect, it } from "effect-bun-test";
import { Effect } from "effect";
import { BunServices } from "@effect/platform-bun";
import { StoreService, type TaskInput } from "../../src/services/Store.js";
import { testStoreLayer, withTempDir } from "../helpers/index.js";

const makeInput = (id: string, extra: Partial<TaskInput> = {}): TaskInput => ({
  id,
  prompt: "test prompt",
  provider: "claude",
  schedule: { _tag: "Oneshot" as const, at: new Date().toISOString(), raw: "in 5 minutes" },
  cwd: "/tmp",
  ...extra,
});

describe("StoreService", () => {
  it.live("add + get round-trips a task", () =>
    withTempDir((dir) =>
      Effect.gen(function* () {
        const store = yield* StoreService;
        const task = yield* store.add(makeInput("abc123"));
        expect(task.id).toBe("abc123");
        expect(task.status).toBe("active");
        expect(task.runCount).toBe(0);

        const retrieved = yield* store.get("abc123");
        expect(retrieved.id).toBe("abc123");
        expect(retrieved.prompt).toBe("test prompt");
      }).pipe(Effect.provide(testStoreLayer(dir))),
    ).pipe(Effect.provide(BunServices.layer)),
  );

  it.live("list returns all tasks", () =>
    withTempDir((dir) =>
      Effect.gen(function* () {
        const store = yield* StoreService;
        yield* store.add(makeInput("task1"));
        yield* store.add(makeInput("task2"));
        const tasks = yield* store.list();
        expect(tasks).toHaveLength(2);
      }).pipe(Effect.provide(testStoreLayer(dir))),
    ).pipe(Effect.provide(BunServices.layer)),
  );

  it.live("update patches task fields", () =>
    withTempDir((dir) =>
      Effect.gen(function* () {
        const store = yield* StoreService;
        yield* store.add(makeInput("upd1"));
        const updated = yield* store.update("upd1", { status: "completed", runCount: 1 });
        expect(updated.status).toBe("completed");
        expect(updated.runCount).toBe(1);
      }).pipe(Effect.provide(testStoreLayer(dir))),
    ).pipe(Effect.provide(BunServices.layer)),
  );

  it.live("remove deletes task", () =>
    withTempDir((dir) =>
      Effect.gen(function* () {
        const store = yield* StoreService;
        yield* store.add(makeInput("rem1"));
        yield* store.remove("rem1");
        const tasks = yield* store.list();
        expect(tasks).toHaveLength(0);
      }).pipe(Effect.provide(testStoreLayer(dir))),
    ).pipe(Effect.provide(BunServices.layer)),
  );

  it.live("get nonexistent task fails", () =>
    withTempDir((dir) =>
      Effect.gen(function* () {
        const store = yield* StoreService;
        const exit = yield* store.get("nope").pipe(Effect.exit);
        expect(exit._tag).toBe("Failure");
      }).pipe(Effect.provide(testStoreLayer(dir))),
    ).pipe(Effect.provide(BunServices.layer)),
  );

  it.live("rejects path traversal in task ID", () =>
    withTempDir((dir) =>
      Effect.gen(function* () {
        const store = yield* StoreService;
        const exit = yield* store.get("../../etc/passwd").pipe(Effect.exit);
        expect(exit._tag).toBe("Failure");
      }).pipe(Effect.provide(testStoreLayer(dir))),
    ).pipe(Effect.provide(BunServices.layer)),
  );

  it.live("rejects task ID with special characters", () =>
    withTempDir((dir) =>
      Effect.gen(function* () {
        const store = yield* StoreService;
        const exit = yield* store.add({ ...makeInput("bad/id"), id: "bad/id" }).pipe(Effect.exit);
        expect(exit._tag).toBe("Failure");
      }).pipe(Effect.provide(testStoreLayer(dir))),
    ).pipe(Effect.provide(BunServices.layer)),
  );

  it.live("round-trips task with stop conditions", () =>
    withTempDir((dir) =>
      Effect.gen(function* () {
        const store = yield* StoreService;
        const task = yield* store.add(
          makeInput("stop-test", {
            stopConditions: [
              { _tag: "MaxRuns", count: 5 },
              { _tag: "AfterDate", date: "2026-03-20T23:59:59.999Z" },
            ],
          }),
        );
        expect(task.stopConditions).toHaveLength(2);

        const retrieved = yield* store.get("stop-test");
        expect(retrieved.stopConditions).toHaveLength(2);
        expect(retrieved.stopConditions![0]!._tag).toBe("MaxRuns");
        expect(retrieved.stopConditions![1]!._tag).toBe("AfterDate");
      }).pipe(Effect.provide(testStoreLayer(dir))),
    ).pipe(Effect.provide(BunServices.layer)),
  );

  it.live("round-trips task without stop conditions", () =>
    withTempDir((dir) =>
      Effect.gen(function* () {
        const store = yield* StoreService;
        yield* store.add(makeInput("no-stop"));
        const retrieved = yield* store.get("no-stop");
        expect(retrieved.stopConditions).toBeUndefined();
      }).pipe(Effect.provide(testStoreLayer(dir))),
    ).pipe(Effect.provide(BunServices.layer)),
  );

  it.live("round-trips task with conditionalStop", () =>
    withTempDir((dir) =>
      Effect.gen(function* () {
        const store = yield* StoreService;
        const task = yield* store.add(
          makeInput("cond-stop", {
            stopConditions: [{ _tag: "MaxRuns", count: 20 }],
            conditionalStop: { condition: "the PR is merged" },
          }),
        );
        expect(task.conditionalStop).toEqual({ condition: "the PR is merged" });

        const retrieved = yield* store.get("cond-stop");
        expect(retrieved.conditionalStop).toEqual({ condition: "the PR is merged" });
        expect(retrieved.stopConditions).toHaveLength(1);
      }).pipe(Effect.provide(testStoreLayer(dir))),
    ).pipe(Effect.provide(BunServices.layer)),
  );

  it.live("round-trips task without conditionalStop", () =>
    withTempDir((dir) =>
      Effect.gen(function* () {
        const store = yield* StoreService;
        yield* store.add(makeInput("no-cond"));
        const retrieved = yield* store.get("no-cond");
        expect(retrieved.conditionalStop).toBeUndefined();
      }).pipe(Effect.provide(testStoreLayer(dir))),
    ).pipe(Effect.provide(BunServices.layer)),
  );
});
