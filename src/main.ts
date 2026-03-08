#!/usr/bin/env bun
import { Console, Effect, Layer } from "effect";
import { Command } from "effect/unstable/cli";
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { command } from "./commands/index.js";
import { StoreService } from "./services/Store.js";
import { LaunchdService } from "./services/Launchd.js";
import { AgentPlatformService } from "./services/AgentPlatform.js";

const APP_ERROR_TAG = "@cvr/agentd/AgentdError";

const isAppError = (e: unknown): e is { _tag: string; code?: string; message: string } =>
  typeof e === "object" &&
  e !== null &&
  "_tag" in e &&
  (e as { _tag: string })._tag === APP_ERROR_TAG;

const cli = Command.run(command, {
  version: typeof APP_VERSION !== "undefined" ? APP_VERSION : "0.0.0-dev",
});

const ServiceLayer = Layer.mergeAll(
  StoreService.layer,
  LaunchdService.layer,
  AgentPlatformService.layer,
).pipe(Layer.provideMerge(BunServices.layer));

const program = cli.pipe(
  Effect.tapCause((cause) =>
    Effect.gen(function* () {
      for (const reason of cause.reasons) {
        if (reason._tag !== "Fail") continue;
        const err = reason.error;
        if (!isAppError(err)) continue;
        yield* Console.error(err.message);
      }
    }),
  ),
);

// @effect-diagnostics-next-line effect/strictEffectProvide:off
BunRuntime.runMain(program.pipe(Effect.provide(ServiceLayer)), { disableErrorReporting: true });
