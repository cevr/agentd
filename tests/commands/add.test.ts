/** @effect-diagnostics effect/strictEffectProvide:skip-file */
import { describe, expect, it } from "effect-bun-test";
import { Effect, Layer } from "effect";
import { BunServices } from "@effect/platform-bun";
import { StoreService } from "../../src/services/Store.js";
import * as Schedule from "../../src/services/Schedule.js";
import { withTempDir } from "../helpers/index.js";

describe("add workflow", () => {
  it.live("creates task and installs plist", () =>
    withTempDir((dir) =>
      Effect.gen(function* () {
        process.env["HOME"] = dir;
        const store = yield* StoreService;

        const schedule = yield* Schedule.parse("every day at 9:00");
        const task = yield* store.add({
          id: "test-add",
          prompt: "babysit pr",
          provider: "claude",
          schedule,
          cwd: "/tmp",
        });

        expect(task.id).toBe("test-add");
        expect(task.status).toBe("active");
        expect(task.provider).toBe("claude");

        const retrieved = yield* store.get("test-add");
        expect(retrieved.prompt).toBe("babysit pr");
      }),
    ).pipe(Effect.provide(StoreService.layer.pipe(Layer.provideMerge(BunServices.layer)))),
  );

  it.live("parses natural language schedule", () =>
    Effect.gen(function* () {
      const schedule = yield* Schedule.parse("every weekday at 9am");
      expect(schedule._tag).toBe("Cron");
      if (schedule._tag === "Cron") {
        expect(schedule.hour).toBe(9);
        expect(schedule.dayOfWeek).toBe("1-5");
      }
    }),
  );

  it.live("rejects missing schedule input", () =>
    Effect.gen(function* () {
      const exit = yield* Schedule.parse("not a schedule").pipe(Effect.exit);
      expect(exit._tag).toBe("Failure");
    }),
  );
});
