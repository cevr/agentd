/** @effect-diagnostics effect/strictEffectProvide:skip-file */
import { describe, expect, it } from "effect-bun-test";
import { Effect, Layer } from "effect";
import { BunServices } from "@effect/platform-bun";
import { StoreService, type TaskInput } from "../../src/services/Store.js";
import { withTempDir } from "../helpers/index.js";

const TestLayer = StoreService.layer.pipe(Layer.provideMerge(BunServices.layer));

const makeInput = (id: string): TaskInput => ({
  id,
  prompt: "test prompt",
  provider: "claude",
  schedule: { _tag: "Oneshot" as const, at: new Date().toISOString(), raw: "in 5 minutes" },
  cwd: "/tmp",
});

describe("StoreService", () => {
  it.live("add + get round-trips a task", () =>
    withTempDir((dir) =>
      Effect.gen(function* () {
        process.env["HOME"] = dir;
        const store = yield* StoreService;
        const task = yield* store.add(makeInput("abc123"));
        expect(task.id).toBe("abc123");
        expect(task.status).toBe("active");
        expect(task.runCount).toBe(0);

        const retrieved = yield* store.get("abc123");
        expect(retrieved.id).toBe("abc123");
        expect(retrieved.prompt).toBe("test prompt");
      }),
    ).pipe(Effect.provide(TestLayer)),
  );

  it.live("list returns all tasks", () =>
    withTempDir((dir) =>
      Effect.gen(function* () {
        process.env["HOME"] = dir;
        const store = yield* StoreService;
        yield* store.add(makeInput("task1"));
        yield* store.add(makeInput("task2"));
        const tasks = yield* store.list();
        expect(tasks).toHaveLength(2);
      }),
    ).pipe(Effect.provide(TestLayer)),
  );

  it.live("update patches task fields", () =>
    withTempDir((dir) =>
      Effect.gen(function* () {
        process.env["HOME"] = dir;
        const store = yield* StoreService;
        yield* store.add(makeInput("upd1"));
        const updated = yield* store.update("upd1", { status: "completed", runCount: 1 });
        expect(updated.status).toBe("completed");
        expect(updated.runCount).toBe(1);
      }),
    ).pipe(Effect.provide(TestLayer)),
  );

  it.live("remove deletes task", () =>
    withTempDir((dir) =>
      Effect.gen(function* () {
        process.env["HOME"] = dir;
        const store = yield* StoreService;
        yield* store.add(makeInput("rem1"));
        yield* store.remove("rem1");
        const tasks = yield* store.list();
        expect(tasks).toHaveLength(0);
      }),
    ).pipe(Effect.provide(TestLayer)),
  );

  it.live("get nonexistent task fails", () =>
    withTempDir((dir) =>
      Effect.gen(function* () {
        process.env["HOME"] = dir;
        const store = yield* StoreService;
        const exit = yield* store.get("nope").pipe(Effect.exit);
        expect(exit._tag).toBe("Failure");
      }),
    ).pipe(Effect.provide(TestLayer)),
  );
});
