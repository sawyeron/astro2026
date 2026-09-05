import { articlePath } from "../lib/article-path";
import { getCollection } from "astro:content";
import { site } from "../config/site";

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export async function GET() {
  const articles = (
    await getCollection("blog", ({ data }) => !data.draft)
  ).sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
  const updated =
    articles
      .map((article) => article.data.updated ?? article.data.date)
      .sort((a, b) => b.valueOf() - a.valueOf())[0] ?? new Date(0);
  const entries = articles
    .map((article) => {
      const url = new URL(articlePath(article), site.origin).href;
      const articleUpdated = article.data.updated ?? article.data.date;
      return `  <entry>
    <title>${escapeXml(article.data.title)}</title>
    <id>${escapeXml(url)}</id>
    <link href="${escapeXml(url)}" />
    <published>${article.data.date.toISOString()}</published>
    <updated>${articleUpdated.toISOString()}</updated>
    <summary>${escapeXml(article.data.description ?? "")}</summary>
  </entry>`;
    })
    .join("\n");

  const body = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${site.locale}">
  <title>${site.name}</title>
  <subtitle>法律、技术与个人知识档案。</subtitle>
  <id>${site.origin}/</id>
  <link href="${site.origin}/" />
  <link href="${site.origin}/atom.xml" rel="self" type="application/atom+xml" />
  <updated>${updated.toISOString()}</updated>
${entries}
</feed>\n`;

  return new Response(body, {
    headers: { "Content-Type": "application/atom+xml; charset=utf-8" },
  });
}
