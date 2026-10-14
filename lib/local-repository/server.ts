import "server-only";
import { createLocalRepositoryStore, defaultScan } from "./store.mts";

// Survive development hot reloads; one bounded snapshot for this server process.
const localGlobal = globalThis as typeof globalThis & { texoRepository?: ReturnType<typeof createLocalRepositoryStore> };
export const localRepository = localGlobal.texoRepository ??= createLocalRepositoryStore(defaultScan, () => process.env.NODE_ENV === "development");
