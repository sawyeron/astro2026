import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  copyFile,
  writeFile,
  readFile,
  rm,
  readdir,
} from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import process from "node:process";

async function scenario(mode, success = false) {
  const root = await mkdtemp(path.join(os.tmpdir(), "astro-trakt-test-"));
  try {
    for (const directory of ["scripts", "src/data", "node_modules/playwright"])
      await mkdir(path.join(root, directory), { recursive: true });
    for (const name of ["sync-trakt-public.mjs", "movie-snapshot-utils.mjs"])
      await copyFile(
        path.join(import.meta.dirname, name),
        path.join(root, "scripts", name),
      );
    const original =
      JSON.stringify({
        counts: { history: 2 },
        history: [],
        movies: [],
        shows: [],
      }) + "\n";
    const output = path.join(root, "src/data/trakt-public-history.json");
    await writeFile(output, original);
    await writeFile(
      path.join(root, "node_modules/playwright/package.json"),
      JSON.stringify({ type: "module", exports: "./index.js" }),
    );
    await writeFile(
      path.join(root, "node_modules/playwright/index.js"),
      `
import { writeFileSync } from 'node:fs';
const mode = ${JSON.stringify(mode)};
let clock = 0;
Date.now = () => clock;
const item = id => ({id, watched_at: '2026-09-05T00:00:00Z', type: 'movie', movie: {title: 'Fixture', ids: {trakt: id, tmdb: id}}});
let listener;
const page = {
 on(event, callback) { if(event === 'response') listener = callback; },
 async goto() {
  if(mode === 'navigation') throw new Error('Simulated navigation failure');
  const pages = mode === 'missing' ? [[1,3,[item(1)]],[3,3,[item(3)]]] :
    mode === 'no-terminal' ? [[1,3,[item(1)]]] :
    mode === 'duplicate' ? [[1,2,[item(1)]],[2,2,[item(1)]]] :
    mode === 'shrink' ? [[1,1,[item(1)]]] :
    mode === 'empty' ? [[1,1,[]]] :
    [[1,51,[item(1)]],[2,2,[item(2)]]];
  for(const [number, advertised, body] of pages) await listener({
   url: () => 'https://apiz.trakt.tv/users/Otis4TK/history/?page=' + number,
   status: () => mode === 'http-error' ? 503 : 200,
   headers: () => ({'x-pagination-page-count': String(advertised)}),
   json: async () => {if(mode === 'invalid-json') throw new Error('Malformed JSON'); return body;}
  });
 },
 async evaluate() {},
 async waitForTimeout() {clock += 21 * 60_000;}
};
export const chromium = {async launch() { return {
 async newContext() {return {async newPage() {return page;}};},
 async close() {writeFileSync(${JSON.stringify(path.join(root, "browser-closed"))}, 'closed');}
};}};
`,
    );
    const result = spawnSync(
      process.execPath,
      [path.join(root, "scripts/sync-trakt-public.mjs")],
      {
        encoding: "utf8",
        timeout: 10000,
        env: { PATH: process.env.PATH },
      },
    );
    assert.ifError(result.error);
    assert.equal(result.signal, null);
    assert.equal(result.status === 0, success, result.stderr);
    assert.equal(
      await readFile(path.join(root, "browser-closed"), "utf8"),
      "closed",
    );
    const actual = await readFile(output, "utf8");
    if (success) {
      const snapshot = JSON.parse(actual);
      assert.equal(snapshot.counts.history, 2);
      assert.equal(snapshot.pageCount, 2);
      assert.deepEqual(
        snapshot.history.map((entry) => entry.id),
        [2, 1],
      );
    } else {
      assert.equal(actual, original);
      const reasons = {
        missing: "missing page(s) 2",
        "no-terminal": "terminal pagination",
        duplicate: "Duplicate history IDs",
        shrink: "smaller",
        empty: "no entries",
        navigation: "Simulated navigation failure",
        "http-error": "terminal pagination",
        "invalid-json": "terminal pagination",
      };
      assert.ok(result.stderr.includes(reasons[mode]), result.stderr);
    }
    assert.deepEqual(await readdir(path.dirname(output)), [
      "trakt-public-history.json",
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
for (const mode of [
  "missing",
  "no-terminal",
  "duplicate",
  "shrink",
  "empty",
  "navigation",
  "http-error",
  "invalid-json",
])
  test(`real Trakt entrypoint preserves snapshot on ${mode}`, () =>
    scenario(mode));
test("complete public pagination accepts corrected terminal count and writes snapshot", () =>
  scenario("success", true));
