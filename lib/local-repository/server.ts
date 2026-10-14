import "server-only";
import { createLocalRepositoryStore, defaultScan } from "./store.mts";

// Survive development hot reloads; one bounded snapshot for this server process.
const localGlobal = globalThis as typeof globalThis & { texoRepository?: { version: number; store: ReturnType<typeof createLocalRepositoryStore> } };
// Replace the pre-cache store on hot reload so it cannot keep the old scanner closure.
if (localGlobal.texoRepository?.version !== 2) localGlobal.texoRepository = { version: 2, store: createLocalRepositoryStore(defaultScan, () => process.env.NODE_ENV === "development") };
export const localRepository = localGlobal.texoRepository.store;
