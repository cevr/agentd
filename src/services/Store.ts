import { Effect, Layer, Option, Schema, ServiceMap } from "effect";
import { FileSystem } from "effect/FileSystem";
import { Path } from "effect/Path";
import type { PlatformError } from "effect/PlatformError";
import { AgentdError } from "../errors/index.js";
import { ScheduleSchema, type Schedule } from "./Schedule.js";

export type Provider = "claude" | "codex";

export class Task extends Schema.Class<Task>("@cvr/agentd/Task")({
  id: Schema.String,
  prompt: Schema.String,
  provider: Schema.Literals(["claude", "codex"]),
  schedule: ScheduleSchema,
  cwd: Schema.String,
  createdAt: Schema.String,
  status: Schema.Literals(["active", "completed", "failed"]),
  lastRun: Schema.optional(Schema.String),
  runCount: Schema.Number,
}) {}

export type TaskInput = {
  readonly id: string;
  readonly prompt: string;
  readonly provider: Provider;
  readonly schedule: Schedule;
  readonly cwd: string;
};

const VALID_ID = /^[a-zA-Z0-9_-]+$/;

const validateId = Effect.fn("StoreService.validateId")(function* (id: string) {
  if (!VALID_ID.test(id)) {
    return yield* new AgentdError({
      message: `Invalid task ID: "${id}". Only alphanumeric, hyphens, and underscores allowed.`,
      code: "INVALID_ID",
    });
  }
  return id;
});

const TaskJson = Schema.fromJsonString(Task);
const decodeTask = Schema.decodeUnknownEffect(TaskJson);
const encodeTask = Schema.encodeEffect(TaskJson);

class StoreService extends ServiceMap.Service<
  StoreService,
  {
    readonly add: (input: TaskInput) => Effect.Effect<Task, AgentdError>;
    readonly get: (id: string) => Effect.Effect<Task, AgentdError>;
    readonly list: () => Effect.Effect<ReadonlyArray<Task>, AgentdError>;
    readonly update: (
      id: string,
      patch: Partial<Pick<Task, "status" | "lastRun" | "runCount">>,
    ) => Effect.Effect<Task, AgentdError>;
    readonly remove: (id: string) => Effect.Effect<void, AgentdError>;
  }
>()("@cvr/agentd/services/Store/StoreService") {
  static layer = Layer.effect(
    StoreService,
    Effect.gen(function* () {
      const fs = yield* FileSystem;
      const path = yield* Path;
      const home = process.env["HOME"] ?? process.env["USERPROFILE"] ?? "";
      const tasksDir = path.join(home, ".agentd", "tasks");

      yield* fs.makeDirectory(tasksDir, { recursive: true }).pipe(
        Effect.mapError(
          (e: PlatformError) =>
            new AgentdError({
              message: `Cannot create tasks dir: ${e.message}`,
              code: "WRITE_FAILED",
            }),
        ),
      );

      const taskPath = (id: string) => path.join(tasksDir, `${id}.json`);

      const add = Effect.fn("StoreService.add")(function* (input: TaskInput) {
        yield* validateId(input.id);
        const task = new Task({
          ...input,
          createdAt: new Date().toISOString(),
          status: "active",
          runCount: 0,
        });
        const json = yield* encodeTask(task).pipe(
          Effect.mapError(
            (e) =>
              new AgentdError({ message: `Encode failed: ${e.message}`, code: "ENCODE_FAILED" }),
          ),
        );
        yield* fs
          .writeFileString(taskPath(input.id), json)
          .pipe(
            Effect.mapError(
              (e: PlatformError) =>
                new AgentdError({ message: `Write failed: ${e.message}`, code: "WRITE_FAILED" }),
            ),
          );
        return task;
      });

      const get = Effect.fn("StoreService.get")(function* (id: string) {
        yield* validateId(id);
        const content = yield* fs.readFileString(taskPath(id)).pipe(
          Effect.mapError(
            (e: PlatformError) =>
              new AgentdError({
                message: `Task not found: ${id} (${e.message})`,
                code: "NOT_FOUND",
              }),
          ),
        );
        return yield* decodeTask(content).pipe(
          Effect.mapError(
            (e) =>
              new AgentdError({ message: `Decode failed: ${e.message}`, code: "DECODE_FAILED" }),
          ),
        );
      });

      const list = Effect.fn("StoreService.list")(function* () {
        const exists = yield* fs.exists(tasksDir).pipe(Effect.catch(() => Effect.succeed(false)));
        if (!exists) return [] as ReadonlyArray<Task>;

        const files = yield* fs
          .readDirectory(tasksDir)
          .pipe(
            Effect.mapError(
              (e: PlatformError) =>
                new AgentdError({ message: `Read dir failed: ${e.message}`, code: "READ_FAILED" }),
            ),
          );

        const jsonFiles = files.filter((f) => f.endsWith(".json"));
        const results = yield* Effect.forEach(
          jsonFiles,
          (file) =>
            fs
              .readFileString(path.join(tasksDir, file))
              .pipe(Effect.flatMap(decodeTask), Effect.option),
          { concurrency: "unbounded" },
        );
        return results.filter(Option.isSome).map((o) => o.value);
      });

      const update = Effect.fn("StoreService.update")(function* (
        id: string,
        patch: Partial<Pick<Task, "status" | "lastRun" | "runCount">>,
      ) {
        yield* validateId(id);
        const existing = yield* get(id);
        const updated = new Task({ ...existing, ...patch });
        const json = yield* encodeTask(updated).pipe(
          Effect.mapError(
            (e) =>
              new AgentdError({ message: `Encode failed: ${e.message}`, code: "ENCODE_FAILED" }),
          ),
        );
        yield* fs
          .writeFileString(taskPath(id), json)
          .pipe(
            Effect.mapError(
              (e: PlatformError) =>
                new AgentdError({ message: `Write failed: ${e.message}`, code: "WRITE_FAILED" }),
            ),
          );
        return updated;
      });

      const remove = Effect.fn("StoreService.remove")(function* (id: string) {
        yield* validateId(id);
        yield* fs
          .remove(taskPath(id))
          .pipe(
            Effect.mapError(
              (e: PlatformError) =>
                new AgentdError({ message: `Remove failed: ${e.message}`, code: "REMOVE_FAILED" }),
            ),
          );
      });

      return { add, get, list, update, remove };
    }),
  );
}

export { StoreService };
