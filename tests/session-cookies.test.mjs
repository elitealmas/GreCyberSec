import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const requireDependency = createRequire(import.meta.url);
const ts = requireDependency("typescript");
const ssr = requireDependency("@supabase/ssr");
const { NextRequest, NextResponse } = requireDependency("next/server");

// Execute each application helper with the installed Supabase SDK. The only
// HTTP boundary is a local fake response; no environment file or service is used.
async function sessionCookies(helper, nodeEnv) {
  const writtenCookies = [];
  const cookieJar = new Map();
  let client;
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const accessToken = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: "00000000-0000-4000-8000-000000000001", exp: expiresAt })}.synthetic-signature`;
  const factory = (name) => (url, key, options = {}) => {
    const originalCookies = options.cookies;
    client = ssr[name](url, key, {
      ...options,
      global: {
        fetch: async (requestUrl) => {
          assert.equal(String(requestUrl), "https://cookies.example.invalid/auth/v1/token?grant_type=password");
          return Response.json({
            access_token: accessToken,
            refresh_token: "synthetic-refresh-token",
            token_type: "bearer",
            expires_in: 3600,
            user: { id: "00000000-0000-4000-8000-000000000001", aud: "authenticated", email: "member@example.invalid" },
          });
        },
      },
      cookies: {
        getAll: originalCookies?.getAll ?? (() => []),
        setAll: (cookies, responseHeaders) => {
          writtenCookies.push(...cookies);
          originalCookies?.setAll?.(cookies, responseHeaders);
        },
      },
    });
    return client;
  };
  const filename = resolve(root, `lib/supabase/${helper}.ts`);
  const source = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  function isolatedRequire(id) {
    if (id === "@supabase/ssr") return {
      createServerClient: factory("createServerClient"),
    };
    if (id === "@/lib/supabase/config") return {
      getSupabaseConfig: () => ({ url: "https://cookies.example.invalid", publishableKey: "synthetic-publishable-key" }),
      isSupabaseConfigured: () => true,
    };
    if (id === "next/server") return { NextResponse };
    if (id === "next/headers") return {
      cookies: async () => ({
        getAll: () => [...cookieJar].map(([name, value]) => ({ name, value })),
        set: (name, value) => cookieJar.set(name, value),
      }),
    };
    throw new Error(`Unmocked dependency: ${id}`);
  }
  new Function("require", "module", "exports", "process", source)(
    isolatedRequire, loaded, loaded.exports, { env: { NODE_ENV: nodeEnv } },
  );
  if (helper === "proxy") {
    await loaded.exports.updateSession(new NextRequest("https://site.example.invalid/"));
  } else {
    await loaded.exports.createClient();
  }
  try {
    const { error } = await client.auth.signInWithPassword({ email: "member@example.invalid", password: "synthetic-test-password" });
    assert.equal(error, null);
    assert.ok(writtenCookies.length > 0, "the SDK should emit a session cookie");
    return writtenCookies;
  } finally {
    await client.auth.stopAutoRefresh();
  }
}

for (const helper of ["server", "proxy"]) {
  test(`${helper} sessions are HttpOnly, same-site and HTTPS-only in production`, async () => {
    for (const cookie of await sessionCookies(helper, "production")) {
      assert.equal(cookie.options.secure, true);
      assert.equal(cookie.options.sameSite, "lax");
      assert.equal(cookie.options.httpOnly, true);
      assert.equal(cookie.options.path, "/");
    }
  });

  test(`${helper} sessions remain HttpOnly while supporting local HTTP during development`, async () => {
    for (const cookie of await sessionCookies(helper, "development")) {
      assert.notEqual(cookie.options.secure, true);
      assert.equal(cookie.options.sameSite, "lax");
      assert.equal(cookie.options.httpOnly, true);
    }
  });
}
