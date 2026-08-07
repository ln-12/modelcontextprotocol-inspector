// Table-driven tests for the root `prepare` decision. Each case pins one of the
// three skip conditions, their precedence, or the invariant that ties the
// artifact list to the `files` allowlist it stands in for.
// Run via `npm run test:scripts` (node:test; the root has no vitest harness).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { REQUIRED_ARTIFACTS, prepareDecision } from "./prepare-build.mjs";

/** The git-install case: nothing built, nothing skipping — the reason this exists. */
const unbuiltCheckout = {
  skipRequested: false,
  insideNodeModules: false,
  missing: REQUIRED_ARTIFACTS,
};

test("builds when a source tree has no build output", () => {
  const { build, reason } = prepareDecision(unbuiltCheckout);
  assert.equal(build, true);
  assert.match(reason, /clients\/launcher\/build\/index\.js/);
});

test("builds when only some artifacts are missing (half-built tree)", () => {
  assert.equal(
    prepareDecision({
      ...unbuiltCheckout,
      missing: ["clients/web/dist/index.html"],
    }).build,
    true,
  );
});

test("skips once everything is built — the `npm pack` post-prepack case", () => {
  const { build, reason } = prepareDecision({
    ...unbuiltCheckout,
    missing: [],
  });
  assert.equal(build, false);
  assert.match(reason, /already built/);
});

test("skips when installed as a dependency, even with nothing built", () => {
  const { build, reason } = prepareDecision({
    ...unbuiltCheckout,
    insideNodeModules: true,
  });
  assert.equal(build, false);
  assert.match(reason, /as a dependency/);
});

test("the opt-out wins over both other conditions", () => {
  const { build, reason } = prepareDecision({
    skipRequested: true,
    insideNodeModules: false,
    missing: REQUIRED_ARTIFACTS,
  });
  assert.equal(build, false);
  assert.match(reason, /INSPECTOR_SKIP_PREPARE_BUILD/);
});

test("every required artifact sits under a path the `files` allowlist ships", () => {
  // The check is only meaningful if the artifacts it probes are the ones that
  // actually reach a consumer — an entry outside the allowlist would be built,
  // pass this gate, and still be absent from the installed package.
  const { files, bin } = JSON.parse(readFileSync("package.json", "utf8"));
  for (const artifact of REQUIRED_ARTIFACTS) {
    assert.ok(
      files.some((entry) => artifact.startsWith(entry + "/")),
      `${artifact} is not under any "files" entry`,
    );
  }
  // The bin is the artifact whose absence produced `command not found`.
  assert.ok(
    REQUIRED_ARTIFACTS.includes(bin["mcp-inspector"].replace("./", "")),
  );
});
