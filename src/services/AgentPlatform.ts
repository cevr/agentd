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

export type InvokeResult = {
  readonly exitCode: number;
  readonly output: string;
};

class AgentPlatformService extends ServiceMap.Service<
  AgentPlatformService,
  {
    readonly invoke: (
      provider: Provider,
      prompt: string,
      cwd: string,
    ) => Effect.Effect<InvokeResult, AgentdError>;
    readonly invokeCapture: (
      provider: Provider,
      prompt: string,
      cwd: string,
    ) => Effect.Effect<string, AgentdError>;
  }
>()("@cvr/agentd/services/AgentPlatform/AgentPlatformService") {
  static layer = Layer.succeed(AgentPlatformService, {
    invoke: (provider, prompt, cwd) =>
      Effect.tryPromise({
        try: async () => {
          const args = providerArgs[provider](prompt, cwd);
          const proc = Bun.spawn(args, { stdout: "pipe", stderr: "inherit", cwd });

          const chunks: Array<Uint8Array> = [];
          const reader = proc.stdout.getReader();

          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value !== undefined) {
              chunks.push(value);
              process.stdout.write(value);
            }
          }

          const exitCode = await proc.exited;
          const output = Buffer.concat(chunks).toString("utf-8");
          return { exitCode, output };
        },
        catch: (e) =>
          new AgentdError({
            message: `${provider} invocation failed: ${e instanceof Error ? e.message : String(e)}`,
            code: "SPAWN_FAILED",
          }),
      }),

    invokeCapture: (provider, prompt, cwd) =>
      Effect.tryPromise({
        try: async () => {
          const args = providerArgs[provider](prompt, cwd);
          const proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe", cwd });
          const output = await new Response(proc.stdout).text();
          await proc.exited;
          return output;
        },
        catch: (e) =>
          new AgentdError({
            message: `${provider} capture failed: ${e instanceof Error ? e.message : String(e)}`,
            code: "SPAWN_FAILED",
          }),
      }),
  });
}

export { AgentPlatformService };
