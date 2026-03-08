import { mkdirSync, lstatSync, unlinkSync, symlinkSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import * as os from "node:os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

const pkg = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf-8"));

console.log("Building agentd...");

const binDir = join(rootDir, "bin");
mkdirSync(binDir, { recursive: true });

const platform =
  process.platform === "darwin" ? "darwin" : process.platform === "win32" ? "windows" : "linux";
const arch = process.arch === "arm64" ? "arm64" : "x64";

const buildResult = await Bun.build({
  entrypoints: [join(rootDir, "src/main.ts")],
  target: "bun",
  minify: false,
  define: {
    APP_VERSION: JSON.stringify(pkg.version),
  },
  compile: {
    target: `bun-${platform}-${arch}`,
    outfile: join(binDir, "agentd"),
    autoloadBunfig: false,
  },
});

if (!buildResult.success) {
  console.error("Build failed:");
  for (const log of buildResult.logs) {
    console.error(log);
  }
  process.exit(1);
}

console.log(`Binary built: ${join(binDir, "agentd")}`);

const home = process.env["HOME"] ?? os.homedir();
const bunBin = join(home, ".bun", "bin", "agentd");
try {
  try {
    lstatSync(bunBin);
    unlinkSync(bunBin);
  } catch {
    // doesn't exist
  }
  symlinkSync(join(binDir, "agentd"), bunBin);
  console.log(`Symlinked to: ${bunBin}`);
} catch (e) {
  console.log(`Could not symlink to ${bunBin}: ${e}`);
}
