import { Console, Effect } from "effect";
import { Argument, Command, Flag } from "effect/unstable/cli";
import { FileSystem } from "effect/FileSystem";
import { Path } from "effect/Path";
import { AgentdError } from "../errors/index.js";

export const logs = Command.make(
  "logs",
  {
    id: Argument.string("id").pipe(Argument.optional),
    follow: Flag.boolean("follow").pipe(Flag.withAlias("f"), Flag.withDefault(false)),
  },
  (config) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem;
      const path = yield* Path;
      const home = process.env["HOME"] ?? "";
      const logsDir = path.join(home, ".agentd", "logs");

      const id = config.id;
      if (id._tag === "None") {
        // List available logs
        const exists = yield* fs.exists(logsDir).pipe(Effect.catch(() => Effect.succeed(false)));
        if (!exists) {
          yield* Console.log("No logs found.");
          return;
        }
        const files = yield* fs
          .readDirectory(logsDir)
          .pipe(Effect.catch(() => Effect.succeed([] as string[])));
        if (files.length === 0) {
          yield* Console.log("No logs found.");
          return;
        }
        yield* Console.log("Available logs:");
        for (const file of files) {
          if (file.endsWith(".log")) yield* Console.log(`  ${file.replace(".log", "")}`);
        }
        return;
      }

      const logFile = path.join(logsDir, `${id.value}.log`);
      const exists = yield* fs.exists(logFile).pipe(Effect.catch(() => Effect.succeed(false)));
      if (!exists) {
        return yield* new AgentdError({
          message: `No logs found for task ${id.value}`,
          code: "NOT_FOUND",
        });
      }

      if (config.follow) {
        // Follow mode: use tail -f
        yield* Effect.tryPromise({
          try: async () => {
            const proc = Bun.spawn(["tail", "-f", logFile], {
              stdout: "inherit",
              stderr: "inherit",
            });
            await proc.exited;
          },
          catch: (e) =>
            new AgentdError({
              message: `Failed to tail log: ${e instanceof Error ? e.message : String(e)}`,
              code: "READ_FAILED",
            }),
        });
      } else {
        const content = yield* fs.readFileString(logFile).pipe(
          Effect.mapError(
            () =>
              new AgentdError({
                message: `Cannot read log for ${id.value}`,
                code: "READ_FAILED",
              }),
          ),
        );
        yield* Console.log(content);
      }
    }),
).pipe(Command.withDescription("View task logs"));
