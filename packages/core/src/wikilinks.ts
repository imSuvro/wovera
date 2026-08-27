/** Extracts [[wikilink]] targets from a markdown body. */
export function extractWikilinks(bodyMd: string): string[] {
  const links: string[] = [];
  const pattern = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g;
  for (const match of bodyMd.matchAll(pattern)) {
    const target = match[1]?.trim();
    if (target) links.push(target);
  }
  return links;
}
