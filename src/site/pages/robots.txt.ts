import { launchMode } from "../../domain/launch";

export function GET(): Response {
  const rule = launchMode(process.env.PUBLIC_LAUNCH) === "preview" ? "Disallow: /" : "Allow: /";
  return new Response(`User-agent: *\n${rule}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
