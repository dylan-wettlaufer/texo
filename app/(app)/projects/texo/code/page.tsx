import { notFound } from "next/navigation";
import { connection } from "next/server";
import { RepositoryWorkspace } from "@/components/workspace/repository-workspace";

export const metadata = { title: "Texo · Local Code Explorer" };

export default async function LocalCodePage() {
  if (process.env.NODE_ENV !== "development") notFound();
  await connection();
  return <RepositoryWorkspace />;
}
