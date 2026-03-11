import { Console, Effect, Option } from "effect";
import { Argument, Command } from "effect/unstable/cli";
import { StoreService } from "../services/Store.js";
import { LaunchdService } from "../services/Launchd.js";
import { AgentPlatformService } from "../services/AgentPlatform.js";
import { buildPromptWithContext } from "../context.js";
import * as StopEvaluator from "../services/StopEvaluator.js";

const complete = Effect.fn("run.complete")(function* (id: string, reason: string) {
  const store = yield* StoreService;
  const launchd = yield* LaunchdService;
  yield* store.update(id, { status: "completed" });
  yield* launchd.uninstall(id);
  yield* Console.error(`[agentd] Task ${id} completed: ${reason}`);
});

export const run = Command.make("run", { id: Argument.string("id") }, (config) =>
  Effect.gen(function* () {
    const store = yield* StoreService;
    const agent = yield* AgentPlatformService;
    const task = yield* store.get(config.id);

    // Pre-run: check stop conditions before invoking agent
    const preStop = StopEvaluator.evaluate(task);
    if (Option.isSome(preStop)) {
      yield* complete(task.id, preStop.value.description);
      return;
    }

    const prompt = buildPromptWithContext(task.prompt, task.cwd, task.context);
    yield* Console.error(`[agentd] Running task ${task.id}: ${task.prompt}`);

    // Run agent — update lifecycle state regardless of outcome
    const runResult = yield* agent.invoke(task.provider, prompt, task.cwd).pipe(Effect.exit);

    const newRunCount = task.runCount + 1;
    const isOneshot = task.schedule._tag === "Oneshot";

    if (runResult._tag === "Failure") {
      yield* store.update(task.id, {
        lastRun: new Date().toISOString(),
        runCount: newRunCount,
      });
      yield* Console.error(`[agentd] Task ${task.id} failed on run #${String(newRunCount)}`);
      // Re-raise the original failure
      yield* runResult;
      return;
    }

    yield* store.update(task.id, {
      lastRun: new Date().toISOString(),
      runCount: newRunCount,
      status: isOneshot ? "completed" : task.status,
    });

    if (isOneshot) {
      yield* complete(task.id, "oneshot");
      return;
    }

    // Post-run: re-evaluate with updated runCount
    const updated = yield* store.get(task.id);
    const postStop = StopEvaluator.evaluate(updated);
    if (Option.isSome(postStop)) {
      yield* complete(task.id, postStop.value.description);
      return;
    }

    yield* Console.error(`[agentd] Task ${task.id} completed (run #${String(newRunCount)})`);
  }),
).pipe(Command.withDescription("Execute a scheduled task (called by launchd)"));
