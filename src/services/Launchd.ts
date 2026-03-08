import { Effect, Layer, ServiceMap } from "effect";
import { FileSystem } from "effect/FileSystem";
import { Path } from "effect/Path";
import type { PlatformError } from "effect/PlatformError";
import { AgentdError } from "../errors/index.js";
import type { Task } from "./Store.js";
import { toCalendarIntervals, type Schedule } from "./Schedule.js";

const LABEL_PREFIX = "com.cvr.agentd";
const label = (id: string) => `${LABEL_PREFIX}-${id}`;

/** @internal */
export const escapeXml = (s: string): string =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const calendarIntervalXml = (intervals: ReadonlyArray<Record<string, number>>): string => {
  if (intervals.length === 1) {
    const entry = intervals[0]!;
    const inner = Object.entries(entry)
      .map(([k, v]) => `    <key>${k}</key>\n    <integer>${String(v)}</integer>`)
      .join("\n");
    return `  <key>StartCalendarInterval</key>\n  <dict>\n${inner}\n  </dict>`;
  }

  const items = intervals
    .map((entry) => {
      const inner = Object.entries(entry)
        .map(([k, v]) => `      <key>${k}</key>\n      <integer>${String(v)}</integer>`)
        .join("\n");
      return `    <dict>\n${inner}\n    </dict>`;
    })
    .join("\n");
  return `  <key>StartCalendarInterval</key>\n  <array>\n${items}\n  </array>`;
};

const generatePlist = (task: Task, binPath: string, home: string, logPath: string): string => {
  const pathEnv = process.env["PATH"] ?? "/usr/local/bin:/usr/bin:/bin";
  const schedule = task.schedule as Schedule;
  const intervalXml = calendarIntervalXml(toCalendarIntervals(schedule));

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${escapeXml(label(task.id))}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${escapeXml(binPath)}</string>
    <string>run</string>
    <string>${escapeXml(task.id)}</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key>
    <string>${escapeXml(home)}</string>
    <key>PATH</key>
    <string>${escapeXml(pathEnv)}</string>
  </dict>
  <key>WorkingDirectory</key>
  <string>${escapeXml(task.cwd)}</string>
${intervalXml}
  <key>StandardOutPath</key>
  <string>${escapeXml(logPath)}</string>
  <key>StandardErrorPath</key>
  <string>${escapeXml(logPath)}</string>
  <key>KeepAlive</key>
  <false/>
</dict>
</plist>
`;
};

class LaunchdService extends ServiceMap.Service<
  LaunchdService,
  {
    readonly install: (task: Task) => Effect.Effect<void, AgentdError>;
    readonly uninstall: (id: string) => Effect.Effect<void, AgentdError>;
    readonly isLoaded: (id: string) => Effect.Effect<boolean, AgentdError>;
  }
>()("@cvr/agentd/services/Launchd/LaunchdService") {
  static layer = Layer.effect(
    LaunchdService,
    Effect.gen(function* () {
      const fs = yield* FileSystem;
      const path = yield* Path;
      const home = process.env["HOME"] ?? process.env["USERPROFILE"] ?? "";
      const logsDir = path.join(home, ".agentd", "logs");
      const agentsDir = path.join(home, "Library", "LaunchAgents");

      yield* fs.makeDirectory(logsDir, { recursive: true }).pipe(
        Effect.mapError(
          (e: PlatformError) =>
            new AgentdError({
              message: `Cannot create logs dir: ${e.message}`,
              code: "WRITE_FAILED",
            }),
        ),
      );

      const resolveBinPath = () =>
        Effect.try({
          try: () => {
            const proc = Bun.spawnSync(["which", "agentd"], { stderr: "ignore" });
            if (proc.success) {
              const result = new TextDecoder().decode(proc.stdout).trim();
              if (result.length > 0) return result;
            }
            return path.join(home, ".bun", "bin", "agentd");
          },
          catch: () =>
            new AgentdError({ message: "Cannot resolve agentd binary", code: "READ_FAILED" }),
        });

      const plistPath = (id: string) => path.join(agentsDir, `${label(id)}.plist`);
      const logPath = (id: string) => path.join(logsDir, `${id}.log`);

      const isLoaded = Effect.fn("LaunchdService.isLoaded")(function* (id: string) {
        return yield* Effect.tryPromise({
          try: async () => {
            const proc = Bun.spawn(["launchctl", "list", label(id)], {
              stdout: "ignore",
              stderr: "ignore",
            });
            return (await proc.exited) === 0;
          },
          catch: () =>
            new AgentdError({ message: "Cannot check launchctl", code: "LAUNCHD_FAILED" }),
        });
      });

      const install = Effect.fn("LaunchdService.install")(function* (task: Task) {
        const binPath = yield* resolveBinPath();
        const plist = plistPath(task.id);
        const content = generatePlist(task, binPath, home, logPath(task.id));

        yield* fs.makeDirectory(agentsDir, { recursive: true }).pipe(
          Effect.mapError(
            (e: PlatformError) =>
              new AgentdError({
                message: `Cannot create LaunchAgents dir: ${e.message}`,
                code: "WRITE_FAILED",
              }),
          ),
        );

        const loaded = yield* isLoaded(task.id);
        if (loaded) {
          yield* Effect.tryPromise({
            try: async () => {
              const proc = Bun.spawn(["launchctl", "unload", plist], {
                stdout: "ignore",
                stderr: "ignore",
              });
              await proc.exited;
            },
            catch: () =>
              new AgentdError({
                message: `Cannot unload ${label(task.id)}`,
                code: "LAUNCHD_FAILED",
              }),
          });
        }

        yield* fs.writeFileString(plist, content).pipe(
          Effect.mapError(
            (e: PlatformError) =>
              new AgentdError({
                message: `Cannot write plist: ${e.message}`,
                code: "WRITE_FAILED",
              }),
          ),
        );

        yield* Effect.tryPromise({
          try: async () => {
            const proc = Bun.spawn(["launchctl", "load", plist], {
              stdout: "ignore",
              stderr: "pipe",
            });
            const code = await proc.exited;
            if (code !== 0) {
              const stderr = await new Response(proc.stderr).text();
              throw new Error(stderr.trim() || `exit code ${code}`);
            }
          },
          catch: (e) =>
            new AgentdError({
              message: `Cannot load ${label(task.id)}: ${e instanceof Error ? e.message : String(e)}`,
              code: "LAUNCHD_FAILED",
            }),
        });
      });

      const uninstall = Effect.fn("LaunchdService.uninstall")(function* (id: string) {
        const plist = plistPath(id);
        const loaded = yield* isLoaded(id);
        if (loaded) {
          yield* Effect.tryPromise({
            try: async () => {
              const proc = Bun.spawn(["launchctl", "unload", plist], {
                stdout: "ignore",
                stderr: "ignore",
              });
              await proc.exited;
            },
            catch: () =>
              new AgentdError({ message: `Cannot unload ${label(id)}`, code: "LAUNCHD_FAILED" }),
          });
        }
        yield* fs.remove(plist).pipe(Effect.catch(() => Effect.void));
      });

      return { install, uninstall, isLoaded };
    }),
  );
}

export { LaunchdService };
