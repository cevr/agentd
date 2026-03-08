import { Effect, Layer, ServiceMap } from "effect";
import { AgentdError } from "../errors/index.js";
import type { Provider } from "./Store.js";

class AgentPlatformService extends ServiceMap.Service<
  AgentPlatformService,
  {
    readonly invoke: (
      provider: Provider,
      prompt: string,
      cwd: string,
    ) => Effect.Effect<void, AgentdError>;
    readonly isExecutable: (provider: Provider) => Effect.Effect<boolean, AgentdError>;
  }
>()("@cvr/agentd/services/AgentPlatform/AgentPlatformService") {
  static layer = Layer.succeed(AgentPlatformService, {
    invoke: (provider, prompt, cwd) =>
      Effect.tryPromise({
        try: async () => {
          const args =
            provider === "claude"
              ? [
                  "claude",
                  "-p",
                  prompt,
                  "--dangerously-skip-permissions",
                  "--model",
                  "sonnet",
                  "--no-session-persistence",
                ]
              : [
                  "codex",
                  "exec",
                  "-C",
                  cwd,
                  "--dangerously-bypass-approvals-and-sandbox",
                  "--skip-git-repo-check",
                  prompt,
                ];

          const proc = Bun.spawn(args, { stdout: "inherit", stderr: "inherit", cwd });
          const code = await proc.exited;
          if (code !== 0) throw new Error(`${provider} exited with code ${code}`);
        },
        catch: (e) =>
          new AgentdError({
            message: `${provider} invocation failed: ${e instanceof Error ? e.message : String(e)}`,
            code: "SPAWN_FAILED",
          }),
      }),

    isExecutable: (provider) => Effect.sync(() => Bun.which(provider) !== null),
  });
}

export { AgentPlatformService };
