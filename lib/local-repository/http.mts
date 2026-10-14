import { RepositoryRequestError } from "./store.mts";
import type { createLocalRepositoryStore } from "./store.mts";

export async function handleRepositoryRequest(request: Request, store: ReturnType<typeof createLocalRepositoryStore>, enabled: boolean) {
  const headers = { "Cache-Control": "no-store" };
  try {
    if (!enabled) throw new RepositoryRequestError(404, "disabled", "Local repository browsing is unavailable");
    const url = new URL(request.url);
    let result;
    if (request.method === "GET") result = await store.read(url.searchParams);
    else if (request.method === "POST") {
      if (url.search || (await request.text()).trim()) throw new RepositoryRequestError(400, "invalid-request", "Refresh accepts no parameters");
      const origin = request.headers.get("origin");
      if (origin && origin !== url.origin) throw new RepositoryRequestError(403, "invalid-origin", "Refresh must originate from this app");
      result = await store.refresh();
    } else throw new RepositoryRequestError(405, "invalid-method", "Unsupported method");
    return Response.json(result, { headers });
  } catch (error) {
    if (error instanceof RepositoryRequestError) return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status, headers });
    // Do not expose machine paths or Git command output in browser errors.
    return Response.json({ error: { code: "scan-failed", message: "Could not scan the local checkout. Retry or check the server terminal." } }, { status: 500, headers });
  }
}
