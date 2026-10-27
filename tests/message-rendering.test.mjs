import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const requireDependency = createRequire(resolve(root, "package.json"));
const ts = requireDependency("typescript");
const { createElement } = requireDependency("react");
const { renderToStaticMarkup } = requireDependency("react-dom/server");

// Render the real components so inherited object properties cannot silently
// become React children when an untrusted message query is supplied.
function loadComponent(file, name) {
  const source = readFileSync(resolve(root, file), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  new Function("require", "exports", compiled)(requireDependency, exports);
  return exports[name];
}

for (const [file, name] of [
  ["components/auth-message.tsx", "AuthMessage"],
  ["components/course-message.tsx", "CourseMessage"],
]) {
  const Component = loadComponent(file, name);
  test(`${name} ignores inherited and unknown message query values`, () => {
    for (const code of ["__proto__", "constructor", "toString", "hasOwnProperty", "unknown", "<script>alert(1)</script>", "", undefined]) {
      assert.equal(renderToStaticMarkup(createElement(Component, { code })), "", String(code));
    }
  });
}

test("known authentication messages retain their text, styling and status role", () => {
  const AuthMessage = loadComponent("components/auth-message.tsx", "AuthMessage");
  assert.equal(renderToStaticMarkup(createElement(AuthMessage, { code: "invalid-login" })), '<p class="auth-message" role="status">Unable to sign in with those credentials.</p>');
  assert.equal(renderToStaticMarkup(createElement(AuthMessage, { code: "password-updated" })), '<p class="auth-message auth-message-success" role="status">Your password has been updated. You can now sign in.</p>');
});

test("known course messages retain their text, styling and status role", () => {
  const CourseMessage = loadComponent("components/course-message.tsx", "CourseMessage");
  assert.equal(renderToStaticMarkup(createElement(CourseMessage, { code: "progress-unavailable" })), '<p class="auth-message" role="status">We could not update your lesson progress. Please try again.</p>');
  assert.equal(renderToStaticMarkup(createElement(CourseMessage, { code: "quiz-unavailable" })), '<p class="auth-message" role="status">We could not submit that quiz attempt. Please try again.</p>');
});
