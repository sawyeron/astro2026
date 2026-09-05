import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const dist = path.resolve(import.meta.dirname, "../dist");
await assert.rejects(access(path.join(dist, "draft-preview")), {
  code: "ENOENT",
});
for (const name of await readdir(dist)) {
  if (/^(rss|atom|sitemap.*)\.xml$/.test(name)) {
    const text = await readFile(path.join(dist, name), "utf8");
    assert.ok(!text.includes("/draft-preview/"), `${name}: draft route leaked`);
  }
}
console.log(
  "Draft isolation valid: no production preview directory or feed/sitemap preview links.",
);
