#!/usr/bin/env node
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const projectRoot = path.resolve(import.meta.dirname, "..");
const registerPath = path.join(
  projectRoot,
  "docs/audit/asset-recovery-register.json",
);
const allowedDecisions = new Set([
  "recover",
  "replace",
  "placeholder",
  "unresolved",
]);

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

const register = JSON.parse(await readFile(registerPath, "utf8"));
const failures = [];
const legacyPaths = new Set();

if (register.version !== 1) failures.push("register.version must be 1");
if (!Array.isArray(register.assets))
  failures.push("register.assets must be an array");

for (const [index, asset] of (register.assets ?? []).entries()) {
  const label = `assets[${index}] (${asset.legacyPath ?? "missing path"})`;
  if (!asset.legacyPath?.startsWith("/images/")) {
    failures.push(`${label}: legacyPath must start with /images/`);
  }
  if (legacyPaths.has(asset.legacyPath)) {
    failures.push(`${label}: duplicate legacyPath`);
  }
  legacyPaths.add(asset.legacyPath);

  if (!allowedDecisions.has(asset.decision)) {
    failures.push(`${label}: invalid decision ${asset.decision}`);
  }
  if (!asset.sourcePost) failures.push(`${label}: sourcePost is required`);

  if (["recover", "replace"].includes(asset.decision)) {
    if (asset.status !== "recovered") {
      failures.push(`${label}: recovered asset must have status=recovered`);
    }
    if (!asset.targetPath || !asset.sha256) {
      failures.push(`${label}: targetPath and sha256 are required`);
      continue;
    }
    const target = path.resolve(projectRoot, asset.targetPath);
    if (!target.startsWith(`${path.join(projectRoot, "public")}${path.sep}`)) {
      failures.push(`${label}: targetPath must be within public/`);
      continue;
    }
    if (!(await exists(target))) {
      failures.push(
        `${label}: target file does not exist: ${asset.targetPath}`,
      );
      continue;
    }
    const actualHash = sha256(await readFile(target));
    if (actualHash !== asset.sha256) {
      failures.push(
        `${label}: SHA-256 mismatch (${actualHash} !== ${asset.sha256})`,
      );
    }
  }
}

if (failures.length) {
  console.error(`Asset recovery register has ${failures.length} error(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

const recovered = register.assets.filter(
  (asset) => asset.status === "recovered",
).length;
const unresolved = register.assets.filter(
  (asset) => asset.decision === "unresolved",
).length;
console.log(
  `Asset recovery register valid: ${register.assets.length} entries, ${recovered} recovered, ${unresolved} unresolved.`,
);
