#!/usr/bin/env node
import process from "node:process";

const [major] = process.versions.node.split(".").map(Number);

if (major !== 22) {
  console.error(
    `This project requires Node.js 22 LTS; found v${process.versions.node}. ` +
      "Activate the version in .nvmrc before installing or building.",
  );
  process.exit(1);
}

console.log(
  `Node.js ${process.versions.node} satisfies the Node 22 LTS project baseline.`,
);
