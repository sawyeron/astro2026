import type { CollectionEntry } from "astro:content";
/** Historical addresses remain immutable; new posts use Astro's explicit slug. */
export function articlePath(article: CollectionEntry<"blog">): string {
  return article.data.legacyPath ?? `/posts/${article.slug}/`;
}
