/** @effect-diagnostics effect/strictEffectProvide:skip-file */
import { describe, expect, it } from "effect-bun-test";
import { Effect } from "effect";
import { BunServices } from "@effect/platform-bun";
import { StoreService } from "../../src/services/Store.js";
import * as Schedule from "../../src/services/Schedule.js";
import { testStoreLayer, withTempDir } from "../helpers/index.js";

describe("remove workflow", () => {
  it.live("removes task from store", () =>
    withTempDir((dir) =>
      Effect.gen(function* () {
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
      }).pipe(Effect.provide(testStoreLayer(dir))),
    ).pipe(Effect.provide(BunServices.layer)),
  );

  it.live("remove nonexistent task fails", () =>
    withTempDir((dir) =>
      Effect.gen(function* () {
        const store = yield* StoreService;
        const exit = yield* store.remove("nonexistent").pipe(Effect.exit);
        expect(exit._tag).toBe("Failure");
      }).pipe(Effect.provide(testStoreLayer(dir))),
    ).pipe(Effect.provide(BunServices.layer)),
  );
});
