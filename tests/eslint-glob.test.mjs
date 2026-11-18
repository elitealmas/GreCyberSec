import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import fastGlob from "fast-glob";
import { globSync, isDynamicPattern } from "tinyglobby";

test("lint glob dependencies resolve Next.js roots and TypeScript projects", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "grecybersec-eslint-glob-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  for (const file of [
    "sites/web/tsconfig.json",
    "sites/web/src/page.tsx",
    "sites/web/src/generated/types.ts",
    "sites/web/src/.hidden.ts",
    "sites/readme.txt",
    "node_modules/example/tsconfig.json",
  ]) {
    const target = path.join(cwd, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, "");
  }

  assert.deepEqual(fastGlob.globSync("sites/*", { cwd, onlyDirectories: true }), ["sites/web"]);
  assert.equal(isDynamicPattern("tsconfig.json"), false);
  assert.equal(isDynamicPattern("sites/{web,api}/tsconfig.json"), true);
  assert.deepEqual(globSync([], { cwd }), []);
  assert.deepEqual(
    globSync("**/tsconfig.json", { cwd, expandDirectories: false, ignore: ["**/node_modules/**"] }),
    ["sites/web/tsconfig.json"],
  );
  const sourcePaths = globSync(["sites/web/src", "!sites/web/src/generated/**"], {
    cwd,
    absolute: true,
    dot: true,
  });
  assert.deepEqual(
    sourcePaths.map((filename) => path.relative(cwd, filename).split(path.sep).join("/")).sort(),
    ["sites/web/src/.hidden.ts", "sites/web/src/page.tsx"],
  );
});
