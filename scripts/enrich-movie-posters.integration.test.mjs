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

// Run the real entrypoint in a disposable project. No production network or secrets.
const scripts = import.meta.dirname;
async function scenario(mode, expectedSuccess = false) {
  const root = await mkdtemp(path.join(os.tmpdir(), "astro-enrichment-test-"));
  try {
    await mkdir(path.join(root, "scripts"));
    await mkdir(path.join(root, "src/data"), { recursive: true });
    for (const name of [
      "enrich-movie-posters.mjs",
      "movie-enrichment-plan.mjs",
      "movie-snapshot-utils.mjs",
    ])
      await copyFile(
        path.join(scripts, name),
        path.join(root, "scripts", name),
      );
    const output = path.join(root, "src/data/trakt-public-history.json");
    const original =
      JSON.stringify(
        {
          movies: [
            { traktId: 1, tmdbId: 10, title: "Fixture" },
            ...(mode.startsWith("mixed-")
              ? [{ traktId: 2, tmdbId: 20, title: "Second fixture" }]
              : []),
          ],
          shows: [],
          history: [],
        },
        null,
        2,
      ) + "\n";
    await writeFile(output, original);
    await writeFile(
      path.join(root, "previous.json"),
      JSON.stringify({ movies: [], shows: [], history: [] }),
    );
    await writeFile(
      path.join(root, "mock.mjs"),
      `
import { writeFileSync } from 'node:fs';
import timers from 'node:timers';
import { syncBuiltinESMExports } from 'node:module';
const trace = {attempts: {}, delays: []};
const tracePath = ${JSON.stringify(path.join(root, "trace.json"))};
const save = () => writeFileSync(tracePath, JSON.stringify(trace));
// Record requested backoff without sleeping; production retry logic is unchanged.
timers.setTimeout = (callback, delay) => { trace.delays.push(delay); save(); queueMicrotask(callback); };
syncBuiltinESMExports();
const mode = ${JSON.stringify(mode)};
const output = ${JSON.stringify(output)};
globalThis.fetch = async (url, options) => {
  if (options.redirect !== 'error') throw new Error('Redirect policy missing');
  const pathname = new URL(url).pathname;
  trace.attempts[pathname] = (trace.attempts[pathname] ?? 0) + 1; save();
  if (mode.startsWith('retry-') && pathname.includes('/3/')) {
    const status = mode.includes('429') ? 429 : 503;
    if (mode.endsWith('exhausted') || trace.attempts[pathname] < 3) return new Response('', {status});
  }
  if (mode.startsWith('mixed-') && pathname.endsWith('/20')) {
    if (mode === 'mixed-network') throw new Error('simulated network failure');
    return new Response('', {status: mode === 'mixed-auth' ? 401 : 404});
  }
  if (mode === 'network') throw new Error('simulated network failure');
  if (mode === '401' || mode === '403' || mode === '404') return new Response('', {status: Number(mode)});
  if (String(url).includes('/3/')) return Response.json({id: mode === 'mismatch' ? 99 : 10, title: 'Verified fixture', poster_path: '/fixture.jpg'});
  if (mode === 'concurrent') writeFileSync(output, 'concurrent writer\\n');
  const bytes = new Uint8Array(128); bytes.set([255,216,255]);
  return new Response(mode === 'invalid-image' ? '<html>not an image</html>' : bytes, {headers: {'content-type': 'image/jpeg'}});
};
`,
    );
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        path.join(root, "mock.mjs"),
        path.join(root, "scripts/enrich-movie-posters.mjs"),
        "--previous",
        path.join(root, "previous.json"),
      ],
      {
        encoding: "utf8",
        timeout: 15000,
        env: {
          PATH: process.env.PATH,
          TMPDIR: root,
          TMP: root,
          TEMP: root,
          TMDB_PROXY_BASE: "https://fzzapi.imouyang.com",
          TMDB_PROXY_API_KEY: "test-only-not-a-secret",
        },
      },
    );
    assert.ifError(result.error);
    assert.equal(result.signal, null);
    assert.equal(result.status === 0, expectedSuccess, result.stderr);
    assert.ok(
      !(result.stdout + result.stderr).includes("test-only-not-a-secret"),
    );
    const actual = await readFile(output, "utf8");
    if (mode === "concurrent") assert.equal(actual, "concurrent writer\n");
    else if (
      mode === "success" ||
      (mode.startsWith("retry-") && expectedSuccess) ||
      (mode.startsWith("mixed-") && expectedSuccess)
    )
      assert.equal(
        JSON.parse(actual).movies[0].posterRemote,
        "https://fzzapi.imouyang.com/t/p/w342/fixture.jpg",
      );
    else assert.equal(actual, original);
    assert.ok(
      !(await readdir(path.dirname(output))).some((name) =>
        name.endsWith(".tmp"),
      ),
    );
    const report = JSON.parse(
      await readFile(path.join(root, "astro2026-tmdb-coverage.json"), "utf8"),
    );
    const trace = JSON.parse(
      await readFile(path.join(root, "trace.json"), "utf8"),
    );
    if (mode.startsWith("retry-")) {
      assert.equal(trace.attempts["/3/movie/10"], 3);
      assert.deepEqual(trace.delays, [1000, 2000]);
      assert.equal(report.verified, expectedSuccess ? 1 : 0);
    }
    if (mode.startsWith("mixed-")) {
      assert.equal(report.total, 2);
      assert.equal(report.verified, 1);
      assert.equal(report.failed.length, 1);
      assert.equal(report.failed[0].traktId, 2);
      assert.equal(
        trace.attempts["/3/movie/20"],
        mode === "mixed-network" ? 3 : 1,
      );
      if (expectedSuccess) {
        assert.deepEqual(
          JSON.parse(actual).movies[1],
          JSON.parse(original).movies[1],
        );
        assert.equal(report.fatal, false);
      }
    }
    if (["401", "403", "mixed-auth"].includes(mode))
      assert.equal(report.fatal, true);
    if (mode === "404")
      assert.equal(report.failed[0].reason, "Metadata HTTP 404");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
for (const mode of [
  "401",
  "403",
  "network",
  "invalid-image",
  "mismatch",
  "concurrent",
])
  test(`real enrichment script preserves data on ${mode}`, () =>
    scenario(mode));
test("incremental metadata 404 is nonfatal and retains snapshot", () =>
  scenario("404", true));
test("verified image is committed by the real entrypoint", () =>
  scenario("success", true));
for (const status of [429, 503]) {
  test(`${status} retries twice with increasing backoff then succeeds`, () =>
    scenario(`retry-${status}`, true));
  test(`${status} exhaustion retains original snapshot`, () =>
    scenario(`retry-${status}-exhausted`));
}
for (const mode of ["mixed-404", "mixed-network"])
  test(`${mode} preserves failed item while committing verified artwork`, () =>
    scenario(mode, true));
test("mixed authentication failure aborts even when another item succeeds", () =>
  scenario("mixed-auth"));
