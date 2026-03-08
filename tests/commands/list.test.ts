/** @effect-diagnostics effect/strictEffectProvide:skip-file */
import { describe, expect, it } from "effect-bun-test";
import { Effect, Layer } from "effect";
import { BunServices } from "@effect/platform-bun";
import { StoreService } from "../../src/services/Store.js";
import * as Schedule from "../../src/services/Schedule.js";
import { withTempDir } from "../helpers/index.js";

const TestLayer = StoreService.layer.pipe(Layer.provideMerge(BunServices.layer));

describe("list behavior", () => {
  it.live("empty store returns no tasks", () =>
    withTempDir((dir) =>
      Effect.gen(function* () {
        process.env["HOME"] = dir;
        const store = yield* StoreService;
        const tasks = yield* store.list();
        expect(tasks).toHaveLength(0);
      }),
    ).pipe(Effect.provide(TestLayer)),
  );

  it.live("lists tasks with correct fields", () =>
    withTempDir((dir) =>
      Effect.gen(function* () {
        process.env["HOME"] = dir;
        const store = yield* StoreService;
        const schedule = yield* Schedule.parse("every day at 10:00");

        yield* store.add({
          id: "list-1",
          prompt: "check deployments",
          provider: "claude",
          schedule,
          cwd: "/tmp",
        });
        yield* store.add({
          id: "list-2",
          prompt: "review prs",
          provider: "codex",
          schedule,
          cwd: "/tmp",
        });

        const tasks = yield* store.list();
        expect(tasks).toHaveLength(2);

        const ids = tasks.map((t) => t.id);
        expect(ids).toContain("list-1");
        expect(ids).toContain("list-2");

        const codexTask = tasks.find((t) => t.id === "list-2");
        expect(codexTask?.provider).toBe("codex");
        expect(codexTask?.prompt).toBe("review prs");
      }),
    ).pipe(Effect.provide(TestLayer)),
  );

  it.live("describe formats schedule descriptions", () =>
    Effect.gen(function* () {
      const daily = yield* Schedule.parse("every day at 9:00");
      expect(Schedule.describe(daily)).toBe("daily at 09:00");

      const weekday = yield* Schedule.parse("every weekday at 9am");
      expect(Schedule.describe(weekday)).toBe("weekdays at 09:00");

      const monday = yield* Schedule.parse("every monday at 10:30am");
      expect(Schedule.describe(monday)).toContain("Mon");
    }),
  );
});
