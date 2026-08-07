#!/usr/bin/env node
/**
 * Root `prepare`: build the client bundles when they are missing.
 *
 * Why this exists — the git-install path. The root `bin` points at
 * `clients/launcher/build/index.js` and the `files` allowlist ships only build
 * output, none of which is committed. For a registry install that is fine:
 * `npm publish` / `npm pack` run `prepack` (`npm run build`) first, so the
 * tarball is populated.
 *
 * Installing straight from the repo — `npx github:<owner>/inspector`,
 * `npm i <git-url>`, `npm i <path>` — does NOT run `prepack`. npm's git fetcher
 * (pacote) only ever runs `prepare`, and only when the manifest declares one.
 * With no `prepare` script it cloned, packed the allowlist against an unbuilt
 * tree, and produced a tarball of three files: README, package.json, and this
 * directory's install-clients.mjs. The bin target was absent, so the install
 * "succeeded" and the very next line was `mcp-inspector: command not found`.
 *
 * So `prepare` is the hook that has to do the build, and it is the reason this
 * script cannot simply be `npm run build`: `prepare` also runs on every plain
 * `npm install` in a source checkout, where a full four-client rebuild on each
 * dependency change is a minutes-long tax, and again during `npm pack` right
 * after `prepack` has already built. Both are avoided by building only when the
 * artifacts are actually absent.
 *
 * Skipped entirely when:
 *  - INSPECTOR_SKIP_PREPARE_BUILD=1 (CI sets this — it builds via `validate`);
 *  - the package lives under node_modules (installed as a dependency);
 *  - every artifact below already exists.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const installClients = join(repoRoot, "scripts", "install-clients.mjs");

/**
 * One representative file per entry in the root `files` allowlist, so a
 * half-built tree (say, a `vite build` that died after the launcher compiled)
 * still counts as missing rather than passing the check. Mirrors the installed
 * paths `scripts/pack-and-verify.mjs` asserts after a real install.
 */
export const REQUIRED_ARTIFACTS = [
  "clients/launcher/build/index.js",
  "clients/web/build/index.js",
  "clients/web/dist/index.html",
  "clients/cli/build/index.js",
  "clients/tui/build/index.js",
];

/**
 * Decide whether `prepare` should build, from already-gathered facts. Pure, so
 * the precedence between the three skip conditions is unit-testable without a
 * filesystem or a multi-minute build.
 *
 * @param {{ skipRequested: boolean, insideNodeModules: boolean, missing: string[] }} facts
 * @returns {{ build: boolean, reason: string }}
 */
export function prepareDecision({ skipRequested, insideNodeModules, missing }) {
  if (skipRequested) {
    return { build: false, reason: "INSPECTOR_SKIP_PREPARE_BUILD is set" };
  }
  if (insideNodeModules) {
    return { build: false, reason: "installed as a dependency" };
  }
  if (missing.length === 0) {
    return { build: false, reason: "client bundles are already built" };
  }
  return {
    build: true,
    reason: `missing build output (${missing.join(", ")})`,
  };
}

/** Run a command to completion in the repo root; exit the install on failure. */
function runOrExit(command, args, env, label) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...process.env, ...env },
    // npm is npm.cmd on Windows, which needs a shell to resolve.
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    console.error(
      `[prepare-build] ${label} failed (exit ${result.status ?? "unknown"}).`,
    );
    process.exit(result.status ?? 1);
  }
}

export function main() {
  const { build, reason } = prepareDecision({
    skipRequested: Boolean(process.env.INSPECTOR_SKIP_PREPARE_BUILD),
    insideNodeModules: repoRoot.split(sep).includes("node_modules"),
    missing: REQUIRED_ARTIFACTS.filter(
      (rel) => !existsSync(join(repoRoot, rel)),
    ),
  });

  if (!build) {
    console.log(`[prepare-build] Skipping build — ${reason}.`);
    return;
  }

  console.log(`[prepare-build] Building all clients — ${reason}.`);
  // The client-dependency cascade normally runs from the root `postinstall`,
  // but on the git-install path it never fires: npm installs the clone with
  // `--ignore-scripts` and then invokes `prepare` on its own, so nothing has
  // populated clients/*/node_modules and the build dies on a missing vite /
  // tsup / @mantine/core. Running it here makes `prepare` self-sufficient. On a
  // source checkout `postinstall` has already run it and this is a cheap no-op.
  //
  // `--ignore-scripts` also propagates to child npm processes through
  // `npm_config_ignore_scripts`, which would leave the clients' own dependency
  // trees half-installed (esbuild's postinstall is what links its platform
  // binary for tsup). Clearing it restores what a plain `npm install` in the
  // checkout does — the build we are about to run is this repo's own either way.
  runOrExit(
    "node",
    [installClients],
    { npm_config_ignore_scripts: "false" },
    "the client-dependency cascade",
  );
  runOrExit("npm", ["run", "build"], {}, "`npm run build`");

  const stillMissing = REQUIRED_ARTIFACTS.filter(
    (rel) => !existsSync(join(repoRoot, rel)),
  );
  if (stillMissing.length > 0) {
    // A build that exits 0 without producing the bin is the exact failure this
    // script exists to prevent, and it is silent until the user runs the
    // installed command. Fail the install instead.
    console.error(
      `[prepare-build] Build reported success but these artifacts are still missing:\n  ${stillMissing.join("\n  ")}`,
    );
    process.exit(1);
  }
}

// Run only when executed directly (`node scripts/prepare-build.mjs`); importing
// this file (tests) exposes the pure helpers without running a build.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main();
