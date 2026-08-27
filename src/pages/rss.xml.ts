import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { site } from "../config/site";

export async function GET(context: { site?: URL }) {
  const articles = (
    await getCollection("blog", ({ data }) => !data.draft)
  ).sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  return rss({
    title: site.name,
    description: "法律、技术与个人知识档案。",
    site: context.site ?? new URL(site.origin),
    customData: `<language>${site.locale}</language>`,
    items: articles.map((article) => ({
      title: article.data.title,
      description: article.data.description,
      pubDate: article.data.date,
      link: article.data.legacyPath ?? "/",
      categories: [...article.data.categories, ...article.data.tags],
    })),
  });
}
