import { site } from "../config/site";

export function GET() {
  const body = `User-agent: *
Allow: /

Sitemap: ${site.origin}/sitemap-index.xml
`;
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
