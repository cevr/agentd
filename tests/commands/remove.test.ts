/** @effect-diagnostics effect/strictEffectProvide:skip-file */
import { describe, expect, it } from "effect-bun-test";
import { Effect, Layer } from "effect";
import { BunServices } from "@effect/platform-bun";
import { StoreService } from "../../src/services/Store.js";
import * as Schedule from "../../src/services/Schedule.js";
import { withTempDir } from "../helpers/index.js";

const TestLayer = StoreService.layer.pipe(Layer.provideMerge(BunServices.layer));

describe("remove workflow", () => {
  it.live("removes task from store", () =>
    withTempDir((dir) =>
      Effect.gen(function* () {
        process.env["HOME"] = dir;
        const store = yield* StoreService;
        const schedule = yield* Schedule.parse("every day at 9:00");

        yield* store.add({
          id: "rm-1",
          prompt: "test task",
          provider: "claude",
          schedule,
          cwd: "/tmp",
        });

        const before = yield* store.list();
        expect(before).toHaveLength(1);

        yield* store.remove("rm-1");

        const after = yield* store.list();
        expect(after).toHaveLength(0);
      }),
    ).pipe(Effect.provide(TestLayer)),
  );

  it.live("remove nonexistent task fails", () =>
    withTempDir((dir) =>
      Effect.gen(function* () {
        process.env["HOME"] = dir;
        const store = yield* StoreService;
        const exit = yield* store.remove("nonexistent").pipe(Effect.exit);
        expect(exit._tag).toBe("Failure");
      }),
    ).pipe(Effect.provide(TestLayer)),
  );
});
