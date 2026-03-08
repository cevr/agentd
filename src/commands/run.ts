import { Console, Effect } from "effect";
import { Argument, Command } from "effect/unstable/cli";
import { StoreService } from "../services/Store.js";
import { AgentPlatformService } from "../services/AgentPlatform.js";
import type { Schedule } from "../services/Schedule.js";

export const run = Command.make("run", { id: Argument.string("id") }, (config) =>
  Effect.gen(function* () {
    const store = yield* StoreService;
    const agent = yield* AgentPlatformService;
    const task = yield* store.get(config.id);

    yield* Console.error(`[agentd] Running task ${task.id}: ${task.prompt}`);
    yield* agent.invoke(task.provider, task.prompt, task.cwd);

    const schedule = task.schedule as Schedule;
    const status = schedule._tag === "Oneshot" ? "completed" : task.status;
    yield* store.update(task.id, {
      lastRun: new Date().toISOString(),
      runCount: task.runCount + 1,
      status,
    });

    yield* Console.error(`[agentd] Task ${task.id} completed (run #${String(task.runCount + 1)})`);
  }),
).pipe(Command.withDescription("Execute a scheduled task (called by launchd)"));
