#!/usr/bin/env node
// Runs the unit suite and prints a one-line summary the fleet quality gate can read.
//
// Why this exists: ~/.claude/quality/gate.mjs runs `npm test` and parses
// `Tests <n> failed ... <n> passed` (Vitest's wording). This project uses
// node:test, which reports `ℹ pass 600` / `ℹ fail 0`, so the gate saw
// "0 passed, 0 failed" and its hard bar on failing tests was blind — a red
// suite would have sailed through.
//
// The numbers printed here are the real ones straight from node:test, and a
// non-zero exit is propagated, so a failing suite fails the gate.

import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

// Expand the glob here rather than handing it to a shell. `shell: true` does not
// escape arguments, only concatenates them, and node deprecates it for exactly
// that reason (DEP0190) — a filename with a space or a quote would be split or
// injected. No shell is involved now.
const TEST_DIR = 'tests/unit';
const files = readdirSync(TEST_DIR)
  .filter((f) => f.endsWith('.test.js'))
  .sort()
  .map((f) => join(TEST_DIR, f));

if (files.length === 0) {
  console.error(`test-summary: no test files found in ${TEST_DIR}`);
  process.exit(1);
}

const child = spawn(process.execPath, ['--test', ...files], {
  stdio: ['ignore', 'pipe', 'pipe'],
});

let out = '';
child.stdout.on('data', (d) => { out += d; process.stdout.write(d); });
child.stderr.on('data', (d) => { out += d; process.stderr.write(d); });

child.on('close', (code) => {
  const num = (label) => {
    const m = out.match(new RegExp(`^\\s*(?:ℹ\\s*)?${label}\\s+(\\d+)\\s*$`, 'm'));
    return m ? parseInt(m[1], 10) : 0;
  };
  const passed = num('pass');
  const failed = num('fail');

  // The gate's shape. Emitted only when node:test actually reported counts, so a
  // crashed run cannot be mistaken for a clean one.
  if (passed || failed) {
    console.log(failed > 0 ? `Tests ${failed} failed | ${passed} passed` : `Tests ${passed} passed`);
  }

  // Fail loudly if the runner died without reporting, rather than exiting 0.
  if (!passed && !failed) {
    console.error('test-summary: node:test reported no counts — treating as failure');
    process.exit(code === 0 ? 1 : code);
  }
  process.exit(failed > 0 ? 1 : code);
});
