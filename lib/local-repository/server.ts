import "server-only";
import { createRepositoryCache } from "../repository/cache.mts";
import { createLocalRepositoryStore } from "./store.mts";

// Survive development hot reloads; one bounded snapshot for this server process.
const localGlobal = globalThis as typeof globalThis & { texoRepository?: { version: number; store: ReturnType<typeof createLocalRepositoryStore> } };
// Root selection and environment policy belong to this server adapter, not the index.
if (localGlobal.texoRepository?.version !== 3) {
  const cache = createRepositoryCache({ rootPath: process.cwd() });
  localGlobal.texoRepository = { version: 3, store: createLocalRepositoryStore(() => cache.read(), () => process.env.NODE_ENV === "development") };
}
export const localRepository = localGlobal.texoRepository.store;
