import { Console, Effect } from "effect";
import { Argument, Command } from "effect/unstable/cli";
import { StoreService } from "../services/Store.js";
import { LaunchdService } from "../services/Launchd.js";

export const remove = Command.make("rm", { id: Argument.string("id") }, (config) =>
  Effect.gen(function* () {
    const store = yield* StoreService;
    const launchd = yield* LaunchdService;

    yield* launchd.uninstall(config.id);
    yield* store.remove(config.id);
    yield* Console.log(`Removed task ${config.id}`);
  }),
).pipe(Command.withDescription("Remove a scheduled task"));
