import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NotFound() {
  return <div className="not-found"><span className="eyebrow">404 · NOT FOUND</span><h1>This part of the map is missing.</h1><p>We couldn’t find that project or diagram.</p><Button asChild className="mt-6"><Link href="/projects">Back to projects →</Link></Button></div>;
}
