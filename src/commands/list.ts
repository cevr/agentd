import { Console, Effect } from "effect";
import { Command } from "effect/unstable/cli";
import { StoreService } from "../services/Store.js";
import { describe } from "../services/Schedule.js";

export const list = Command.make("ls", {}, () =>
  Effect.gen(function* () {
    const store = yield* StoreService;
    const tasks = yield* store.list();

    if (tasks.length === 0) {
      yield* Console.log("No scheduled tasks.");
      return;
    }

    yield* Console.log(
      `${"ID".padEnd(10)} ${"Provider".padEnd(10)} ${"Schedule".padEnd(30)} ${"Status".padEnd(10)} Prompt`,
    );
    yield* Console.log("─".repeat(90));

    for (const task of tasks) {
      const scheduleDesc = describe(task.schedule);
      const prompt = task.prompt.length > 40 ? `${task.prompt.slice(0, 37)}...` : task.prompt;
      yield* Console.log(
        `${task.id.padEnd(10)} ${task.provider.padEnd(10)} ${scheduleDesc.padEnd(30)} ${task.status.padEnd(10)} ${prompt}`,
      );
    }
  }),
).pipe(Command.withDescription("List active schedules"));
