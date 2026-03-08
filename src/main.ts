#!/usr/bin/env bun
import { Console, Effect, Layer, Schema } from "effect";
import { Command } from "effect/unstable/cli";
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { command } from "./commands/index.js";
import { AgentdError } from "./errors/index.js";

const isAgentdError = Schema.is(AgentdError);
import { StoreService } from "./services/Store.js";
import { LaunchdService } from "./services/Launchd.js";
import { AgentPlatformService } from "./services/AgentPlatform.js";

const RECOVERY_HINTS: Record<string, string> = {
  NOT_FOUND: "Run 'agentd ls' to see available tasks.",
  INVALID_SCHEDULE: "See 'agentd --help' for schedule formats.",
};

const cli = Command.run(command, {
  version: typeof APP_VERSION !== "undefined" ? APP_VERSION : "0.0.0-dev",
});

const ServiceLayer = Layer.mergeAll(
  StoreService.layer,
  LaunchdService.layer,
  AgentPlatformService.layer,
).pipe(Layer.provideMerge(BunServices.layer));

const program = cli.pipe(
  Effect.tapDefect((defect) => Console.error(`Internal error: ${String(defect)}`)),
  Effect.tapCause((cause) =>
    Effect.gen(function* () {
      for (const reason of cause.reasons) {
        if (reason._tag !== "Fail") continue;
        const err = reason.error;
        if (!isAgentdError(err)) continue;
        yield* Console.error(err.message);
        const hint = RECOVERY_HINTS[err.code];
        if (hint !== undefined) {
          yield* Console.error(hint);
        }
      }
    }),
  ),
);

// @effect-diagnostics-next-line effect/strictEffectProvide:off
BunRuntime.runMain(program.pipe(Effect.provide(ServiceLayer)), { disableErrorReporting: true });
