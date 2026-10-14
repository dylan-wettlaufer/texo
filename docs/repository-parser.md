# Local repository parser

The repository parser is a framework-independent TypeScript library with a one-shot CLI. It indexes a local JS/TS checkout without running its code. It does not update the architecture fixtures, connect MCP, or write an index/cache into the checkout.

## Run

Use the project's installed Node runtime (verified with Node **v26.9.0**) and existing dependencies:

```sh
npm run repo:parse -- /absolute/path/to/checkout
```

Omit the path to scan the current directory. Git discovery requires the checkout root; ordinary directories and checkout subdirectories are rejected. Unborn repositories are supported (`head: null`). Source comes from the working tree, including uncommitted edits and untracked files allowed by Git's ignore rules.

The runner emits JSON on stdout and diagnostics plus counts on stderr. For piping, suppress npm's own script banner:

```sh
npm run --silent repo:parse -- /absolute/path/to/checkout > /tmp/repository-index.json
```

Completed scans exit zero even with file-level diagnostics. Invalid roots, Git failures, and unexpected parser failures exit nonzero with no JSON output. Runs are full scans; there is no watcher or incremental cache.

## Library and discovery boundary

```ts
import { parseRepository } from './lib/repository/index.mts';

const index = await parseRepository({ rootPath: '/absolute/path/to/checkout' });
```

`RepositoryDiscovery.discover(rootPath)` returns repository metadata and relative paths. Git is the only supplied implementation. Callers can inject `discovery` without changing source reading or analysis, allowing a future non-Git implementation. The parser validates enumerated paths and owns exclusion rules and reads.

Analysis runs in two internal phases: (A) capture files and index declarations; (B) resolve module references and extract limited static calls using those captured ASTs. No React/Next.js imports, executable configuration, repository scripts, or dependency installation are involved.

## Index contract

`schemaVersion: 1` includes:

- `repository`: discovery kind, HEAD or null, and a SHA-256 hash of the sorted captured source paths/hashes. This identifies source content, not an atomic checkout snapshot or configuration fingerprint.
- `files`: relative paths/IDs, captured source, byte hashes, declaration-file flags, and parsed/partial status.
- `declarations`: names, kinds, lexical qualified names, parent IDs, source ranges, overload signatures, optional implementation ranges, and duplicate flags.
- `modules`: imports/exports/re-exports, literal dynamic imports and unshadowed `require()` references, bindings/type-only distinctions, source ranges, local target file IDs, and explicit external/unresolved outcomes.
- `calls`: every call expression, callee text/range, optional caller ID, and either a unique target declaration ID or an unresolved reason. Calls outside indexed callable bodies have no caller ID. Constructor relationships are not extracted.
- `diagnostics`: syntax, duplicate, configuration, discovery-path, skipped/unreadable-source, and unresolved-module issues. Unresolved calls carry reasons on the call record.

Records are sorted deterministically with no timestamps. Source ranges use one-based lines/columns and UTF-16 character offsets with an exclusive end. Slice `file.content.slice(range.start, range.end)` to retrieve a range. This preserves captured line endings; offsets are not byte positions.

Declaration IDs derive from path, declaration kind, and lexical name, never line numbers. Recognized adjacent function/method overload signatures share a callable ID and retain individual signature/implementation ranges. Other duplicates remain separate, with occurrence suffixes and diagnostics. Anonymous callbacks, anonymous objects, and block/loop scopes use lexical occurrence names. Unrelated line shifts preserve IDs; renames, moves, changed nesting, and reordered/inserted duplicates or anonymous scopes can change them. IDs do not promise permanent identity.

## Resolution limits

TypeScript module resolution uses the closest in-repository `tsconfig.json` or `jsconfig.json`, including readable in-repository JSON inheritance. Without a config, it uses ESNext/bundler defaults. Files outside the captured index cannot become local targets. Configuration is read as JSON; no plugins or code are executed. Compiler programs use captured source only and omit external source/default-library loading.

Resolved calls are static references to indexed implementations, not proof of runtime dispatch. Supported targets include named functions/function-valued bindings, imported functions through aliases/re-exports, class static methods, concrete instance methods, and uniquely identified object methods. Overload calls target their shared callable group.

Interface-only functions, signature-only declarations, unions/intersections, ambiguous duplicates, dynamic property access, arbitrary callback values, higher-order return values, and external functions remain unresolved. Mutable bindings, overrides, and runtime monkey-patching are not modeled. Literal module loads are also preserved as unresolved call expressions, separately from their module records.

Discovery supports `.ts`, `.tsx`, `.js`, `.jsx`, `.mts`, `.cts`, `.mjs`, and `.cjs`. Dependency, Git, build, coverage, and Texo cache directories are excluded even when tracked. Symlinked files/ancestors and submodule contents are skipped. Files over 2 MiB are skipped with a diagnostic. Recoverable syntax errors produce partial files; unreadable or deleted files are reported. CSS and other non-source imports remain unresolved module references.

## Verify

```sh
npm run test:repository
node --test lib/architecture/*.test.mjs lib/exploration/*.test.mjs
npx tsc --noEmit
npm run lint
npm run build
```

The CLI/parser use explicit `.mts` imports and native Node TypeScript stripping; the package module type is unchanged. `allowImportingTsExtensions` works with the project's existing `noEmit` configuration. No transpiler dependency is required.
