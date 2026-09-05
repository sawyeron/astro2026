#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const home = await readFile(path.join(root, "dist/index.html"), "utf8");
for (const name of [
  "favicon-16x16.png",
  "favicon-32x32.png",
  "apple-touch-icon.png",
  "logo-icon.png",
  "favicon.ico",
]) {
  const source = await readFile(path.join(root, "public", name));
  assert.deepEqual(
    await readFile(path.join(root, "dist", name)),
    source,
    `${name}: published bytes differ`,
  );
  assert.ok(home.includes(`/${name}`), `${name}: homepage reference missing`);
  if (name.endsWith(".png"))
    assert.equal(source.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  else assert.equal(source.subarray(0, 4).toString("hex"), "00000100");
}
console.log(
  "Brand assets valid: approved raster seal assets published and referenced.",
);
