import { Console, Effect } from "effect";
import { Argument, Command, Flag } from "effect/unstable/cli";
import { StoreService } from "../services/Store.js";
import { LaunchdService } from "../services/Launchd.js";
import * as Schedule from "../services/Schedule.js";
import { list } from "./list.js";
import { remove } from "./remove.js";
import { run } from "./run.js";
import { logs } from "./logs.js";

const root = Command.make(
  "agentd",
  {
    prompt: Argument.string("prompt").pipe(Argument.optional),
    schedule: Flag.string("schedule").pipe(Flag.withAlias("s"), Flag.optional),
    provider: Flag.choice("provider", ["claude", "codex"]).pipe(
      Flag.withAlias("p"),
      Flag.withDefault("claude" as const),
    ),
  },
  (config) =>
    Effect.gen(function* () {
      if (config.prompt._tag === "None") {
        // No prompt = show help (handled by CLI framework when no subcommand matches)
        return;
      }

      if (config.schedule._tag === "None") {
        yield* Console.error("Error: --schedule (-s) is required");
        return;
      }

      const prompt = config.prompt.value;
      const scheduleStr = config.schedule.value;
      const provider = config.provider;

      const schedule = yield* Schedule.parse(scheduleStr);
      const id = yield* Effect.sync(() => crypto.randomUUID().slice(0, 8));
      const cwd = yield* Effect.sync(() => process.cwd());

      const store = yield* StoreService;
      const launchd = yield* LaunchdService;

      const task = yield* store.add({ id, prompt, provider, schedule, cwd });
      yield* launchd.install(task);

      yield* Console.log(`Scheduled task ${id}`);
      yield* Console.log(`  Prompt:   ${prompt}`);
      yield* Console.log(`  Provider: ${provider}`);
      yield* Console.log(`  Schedule: ${Schedule.describe(schedule)}`);
      yield* Console.log(`  CWD:      ${cwd}`);
    }),
).pipe(
  Command.withDescription("Schedule AI agent tasks via macOS launchd"),
  Command.withExamples([
    {
      command: 'agentd "babysit this pr" -p claude -s "every weekday at 9am"',
      description: "Schedule a recurring task",
    },
    { command: 'agentd "run tests" -s "in 30 minutes"', description: "Schedule a one-shot task" },
    { command: "agentd ls", description: "List scheduled tasks" },
    { command: "agentd rm <id>", description: "Remove a task" },
  ]),
);

export const command = root.pipe(Command.withSubcommands([list, remove, run, logs]));
