import { Config, Effect } from "effect";
import { Path } from "effect/Path";
import { AgentdError } from "./errors/index.js";

export const PathEnv = Config.withDefault(Config.string("PATH"), "/usr/local/bin:/usr/bin:/bin");

const Home = Config.string("HOME")
  .asEffect()
  .pipe(
    Effect.mapError(
      () => new AgentdError({ message: "HOME environment variable not set", code: "CONFIG_ERROR" }),
    ),
  );

export const resolvePaths = Effect.gen(function* () {
  const path = yield* Path;
  const home = yield* Home;
  return {
    baseDir: path.join(home, ".agentd"),
    tasksDir: path.join(home, ".agentd", "tasks"),
    logsDir: path.join(home, ".agentd", "logs"),
    agentsDir: path.join(home, "Library", "LaunchAgents"),
    home,
  } as const;
});
