import { localRepository } from "@/lib/local-repository/server";
import { handleRepositoryRequest } from "@/lib/local-repository/http.mts";

export const runtime = "nodejs";
export function GET(request: Request) { return handleRepositoryRequest(request, localRepository, process.env.NODE_ENV === "development"); }
export function POST(request: Request) { return handleRepositoryRequest(request, localRepository, process.env.NODE_ENV === "development"); }
