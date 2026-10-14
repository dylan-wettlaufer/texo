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

## Query the checkout

Queries return a small result from a fresh scan rather than printing the full index. From Texo's root:

```sh
npm run --silent repo:query
npm run --silent repo:query -- search parseRepository
npm run --silent repo:query -- declaration parseRepository
npm run --silent repo:query -- callers parseRepository
npm run --silent repo:query -- callees parseRepository --limit 10
npm run --silent repo:query -- files lib/repository --limit 5
npm run --silent repo:query -- file lib/repository/query.mts
npm run --silent repo:query -- modules lib/repository/index.mts --incoming
npm run --silent repo:query -- search parseRepository --json
npm run --silent repo:query -- --help
```

Default output is readable text with paths, names, locations and resolution status. Source appears only for `file` and `declaration` details. Add `--json` for the targeted result alone on stdout. Diagnostics stay on stderr; use `npm run --silent` to suppress npm's own banner when piping.

Every query command scans the current checkout once. `--root` selects another checkout root. `--help` does not scan. Declaration commands accept an exact ID (quote it in your shell), a unique exact name, or a unique exact qualified name. Names are case-sensitive for selection. Ambiguity prints matching IDs and locations and exits nonzero; add `--file lib/repository/index.mts` or use an exact ID to disambiguate. `--file` also filters `search`.

List commands (`files`, `search`, `callers`, `callees`, `modules`) accept `--offset` and `--limit`. The defaults are 0 and 50; limits must be 1–200 and offsets nonnegative safe integers. Lists show the total match count and preserve deterministic file/source order. Empty lists succeed. Missing detail records, unknown relationship IDs, invalid arguments, ambiguous selectors and failed scans exit nonzero without result output.

`modules` shows outgoing imports, exports/re-exports and literal module loads. `--incoming` shows local references targeting the selected file; it retains type-only and re-export records. `callers` includes only resolved incoming call sites, including recursion and calls outside indexed callable bodies. `callees` includes direct outgoing call sites, with unresolved reasons; calls belonging to nested functions are queried using the nested function's own ID. Repeated calls remain separate records. Static-analysis limitations still apply: no unresolved call is guessed into an incoming relationship.

### Reuse an index in memory

```ts
import { createRepositoryQuery, parseRepository } from './lib/repository/index.mts';

const index = await parseRepository({ rootPath: process.cwd() });
const query = createRepositoryQuery(index);
const matches = query.searchDeclarations({ text: 'parseRepository', kind: 'function' });
const match = matches.items.find(item => item.name === 'parseRepository');
if (match) {
  const detail = query.getDeclaration(match.id);
  const callers = query.getCallers(match.id);
  const callees = query.getCallees(match.id);
}
```

The query library has no framework or filesystem dependencies. It takes a private snapshot and builds lookup maps once. Queries neither reread source nor mutate the supplied index; returned objects are detached. Reuse one query instance for multiple requests. To see working-tree edits, parse again and create a new instance.

Public methods are `getSummary`, `listFiles`, `searchDeclarations`, `getFile`, `getDeclaration`, `getCallers`, `getCallees`, and `getModules`, with query result types exported from the repository entry point. Lists return `{ items, total, offset, limit }`. File lists omit source; declaration lists omit source and signature detail. Relationship results attach compact caller/target metadata without full source. `getModules` defaults to `direction: 'outgoing'`, with `'incoming'` selecting references targeting the file. Searches match names/qualified names case-insensitively; file substring filtering is also case-insensitive. Library detail lookups use exact IDs and return `undefined` when missing; relationship queries reject unknown IDs.

Declaration detail includes `source` and `sourceRange` for the implementation when available, otherwise the declaration, plus individual `signatures` containing ranges and captured source. File detail includes the captured file content and its declaration summaries. Summary includes repository metadata, file/declaration counts, resolved/unresolved call counts, module-resolution counts and diagnostic counts by code.

The query layer leaves index schema version 1 and `repo:parse` behavior unchanged. It bounds result output, not scan time or the full index's memory footprint. Saved-index loading, persistent storage, HTTP services, UI and MCP integration are outside this milestone.
