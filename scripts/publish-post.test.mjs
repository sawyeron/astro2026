import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  copyFile,
  writeFile,
  readFile,
  rm,
  symlink,
  access,
} from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import process from "node:process";

for (const mode of [
  "success",
  "invalid-slug",
  "collision",
  "historical",
  "outside",
  "empty",
]) {
  test(`publish command: ${mode}`, async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "astro-publish-"));
    try {
      for (const dir of ["scripts", "src/content/blog", "src/content/drafts"])
        await mkdir(path.join(root, dir), { recursive: true });
      await symlink(
        path.resolve(import.meta.dirname, "../node_modules"),
        path.join(root, "node_modules"),
      );
      for (const file of ["publish-post.mjs", "published-articles.mjs"])
        await copyFile(
          path.join(import.meta.dirname, file),
          path.join(root, "scripts", file),
        );
      const draft = path.join(root, "src/content/drafts/fixture.md");
      const original = `---\ntitle: Fixture\ndate: 2026-09-05\ndraft: true\n${mode === "historical" ? "legacy: {id: old}\n" : ""}---\n\n${mode === "empty" ? "" : "Fixture body\n"}`;
      await writeFile(draft, original);
      if (mode === "outside")
        await writeFile(path.join(root, "outside.md"), original);
      if (mode === "collision")
        await writeFile(
          path.join(root, "src/content/blog/existing.md"),
          "---\ntitle: Existing\ndate: 2026-01-01\nslug: fixture\ndraft: false\n---\nOriginal\n",
        );
      const result = spawnSync(
        process.execPath,
        [
          path.join(root, "scripts/publish-post.mjs"),
          mode === "outside" ? path.join(root, "outside.md") : "fixture.md",
          mode === "invalid-slug" ? "../escape" : "fixture",
          "Fixture description",
        ],
        { encoding: "utf8", timeout: 10000 },
      );
      assert.ifError(result.error);
      assert.equal(result.status === 0, mode === "success", result.stderr);
      if (mode === "success") {
        const published = await readFile(
          path.join(root, "src/content/blog/fixture.md"),
          "utf8",
        );
        assert.match(published, /draft: false/);
        assert.match(published, /slug: fixture/);
        assert.match(published, /Fixture body/);
        await assert.rejects(access(draft));
      } else {
        assert.equal(await readFile(draft, "utf8"), original);
        await assert.rejects(
          access(path.join(root, "src/content/blog/fixture.md")),
        );
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}
