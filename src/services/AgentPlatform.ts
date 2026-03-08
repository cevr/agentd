import { Effect, Layer, ServiceMap } from "effect";
import { AgentdError } from "../errors/index.js";
import type { Provider } from "./Store.js";

const claudeArgs = (prompt: string): Array<string> => [
  "claude",
  "-p",
  prompt,
  "--dangerously-skip-permissions",
  "--model",
  "sonnet",
  "--no-session-persistence",
];

const codexArgs = (prompt: string, cwd: string): Array<string> => [
  "codex",
  "exec",
  "-C",
  cwd,
  "--dangerously-bypass-approvals-and-sandbox",
  "--skip-git-repo-check",
  prompt,
];

const providerArgs: Record<Provider, (prompt: string, cwd: string) => Array<string>> = {
  claude: (prompt) => claudeArgs(prompt),
  codex: (prompt, cwd) => codexArgs(prompt, cwd),
};

class AgentPlatformService extends ServiceMap.Service<
  AgentPlatformService,
  {
    readonly invoke: (
      provider: Provider,
      prompt: string,
      cwd: string,
    ) => Effect.Effect<void, AgentdError>;
  }
>()("@cvr/agentd/services/AgentPlatform/AgentPlatformService") {
  static layer = Layer.succeed(AgentPlatformService, {
    invoke: (provider, prompt, cwd) =>
      Effect.tryPromise({
        try: async () => {
          const args = providerArgs[provider](prompt, cwd);
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
  });
}

export { AgentPlatformService };
