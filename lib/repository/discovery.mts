import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { realpath } from "node:fs/promises";
import type { RepositoryDiscovery } from "./types.mts";

const execFileAsync = promisify(execFile);
async function git(root: string, args: string[]) {
  // Disable configured filesystem-monitor helpers: discovery must not run checkout scripts.
  return (await execFileAsync("git", ["-c", "core.fsmonitor=false", "-C", root, ...args], {
    encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
  })).stdout;
}
export const gitDiscovery: RepositoryDiscovery = {
  async discover(rootPath) {
    const top = (await git(rootPath, ["rev-parse", "--show-toplevel"])).trim();
    if (await realpath(top) !== rootPath) throw new Error("rootPath must be the Git checkout root");
    const paths = (await git(rootPath, ["ls-files", "--cached", "--others", "--exclude-standard", "-z"]))
      .split("\0").filter(Boolean);
    // An unborn checkout has no HEAD. Other Git failures must remain fatal.
    const headExists = await git(rootPath, ["rev-parse", "--verify", "--quiet", "HEAD"]).catch((error: unknown) => {
      if (typeof error === "object" && error !== null && "code" in error && error.code === 1) return "";
      throw error;
    });
    return { metadata: { kind: "git", head: headExists.trim() || null }, paths };
  },
};
