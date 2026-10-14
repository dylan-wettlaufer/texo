import { parseRepository } from "../lib/repository/index.mts";

try {
  if (process.argv.length > 3) throw new Error("Usage: npm run repo:parse -- [checkout-root]");
  const index = await parseRepository({ rootPath: process.argv[2] ?? process.cwd() });
  process.stdout.write(`${JSON.stringify(index, null, 2)}\n`);
  for (const diagnostic of index.diagnostics) process.stderr.write(`[${diagnostic.code}] ${diagnostic.path ?? "repository"}: ${diagnostic.message}\n`);
  process.stderr.write(`Indexed ${index.files.length} files, ${index.declarations.length} declarations, ${index.calls.length} calls; ${index.diagnostics.length} diagnostics.\n`);
} catch (error) {
  process.stderr.write(`Repository parsing failed: ${error instanceof Error ? error.message : "Unknown error"}\n`);
  process.exitCode = 1;
}
