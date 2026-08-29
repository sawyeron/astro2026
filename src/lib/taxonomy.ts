export function legacyTaxonomyPath(kind: "tags" | "categories", value: string) {
  return `/${kind}/${encodeURIComponent(value)}/`;
}

export function displayTaxonomyValue(value: string) {
  return value === "null" ? "未分类" : value;
}
