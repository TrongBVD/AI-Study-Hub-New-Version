#!/usr/bin/env node

/**
 * AI Study Hub system smoke test.
 *
 * Safe mode (default):
 *   - Checks frontend pages, public APIs, authentication guards and Guest bypass.
 *   - Does not create, update or delete application data.
 *
 * Write mode (explicit opt-in):
 *   - Creates a temporary library and workspace with the authenticated test user.
 *   - Updates them, checks Guest authorization against the temporary library,
 *     then deletes the temporary data.
 *
 * Required for authenticated tests:
 *   TEST_USERNAME and TEST_PASSWORD
 *   or TEST_ACCESS_TOKEN
 *
 * Optional:
 *   API_BASE_URL=http://localhost:5000/api
 *   FRONTEND_URL=http://localhost:5173
 *   RUN_WRITE_TESTS=true
 *   RUN_SECURITY_TESTS=true
 *   TEST_LIBRARY_ID=<existing library owned by the test user>
 *   TEST_WORKSPACE_ID=<existing workspace available to the test user>
 *   TEST_DOCUMENT_ID=<existing approved document>
 *   TEST_ADMIN_TOKEN=<admin access token>
 */

const HELP = `
AI Study Hub system smoke test

Usage:
  node tools/system-smoke-test.mjs

PowerShell example:
  $env:API_BASE_URL="http://localhost:5000/api"
  $env:FRONTEND_URL="http://localhost:5173"
  $env:TEST_USERNAME="your-test-account@example.com"
  $env:TEST_PASSWORD="your-test-password"
  node tools/system-smoke-test.mjs

Enable temporary CRUD and authorization tests:
  $env:RUN_WRITE_TESTS="true"
  $env:RUN_SECURITY_TESTS="true"
  node tools/system-smoke-test.mjs

Important:
  Use a dedicated test account. Write mode creates and deletes temporary data.
  Do not enable write mode against production unless you accept that behavior.
`;

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(HELP.trim());
  process.exit(0);
}

const config = {
  apiBaseUrl: stripTrailingSlash(
    process.env.API_BASE_URL || "http://localhost:5000/api",
  ),
  frontendUrl: stripTrailingSlash(
    process.env.FRONTEND_URL || "http://localhost:5173",
  ),
  username: process.env.TEST_USERNAME || "",
  password: process.env.TEST_PASSWORD || "",
  accessToken: process.env.TEST_ACCESS_TOKEN || "",
  adminToken: process.env.TEST_ADMIN_TOKEN || "",
  libraryId: process.env.TEST_LIBRARY_ID || "",
  workspaceId: process.env.TEST_WORKSPACE_ID || "",
  documentId: process.env.TEST_DOCUMENT_ID || "",
  runWriteTests: isTrue(process.env.RUN_WRITE_TESTS),
  runSecurityTests: isTrue(process.env.RUN_SECURITY_TESTS),
};

const guestToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjk5OTk5OTk5OTl9.guest_signature_bypass";

const results = [];
let userToken = config.accessToken;
let temporaryLibraryId = "";
let temporaryWorkspaceId = "";

function stripTrailingSlash(value) {
  return String(value).replace(/\/+$/, "");
}

function isTrue(value) {
  return ["1", "true", "yes", "on"].includes(
    String(value || "").trim().toLowerCase(),
  );
}

function record(status, name, detail = "") {
  results.push({ status, name, detail });
  const symbol =
    status === "PASS" ? "[PASS]" : status === "FAIL" ? "[FAIL]" : "[SKIP]";
  console.log(`${symbol} ${name}${detail ? ` - ${detail}` : ""}`);
}

async function test(name, callback) {
  try {
    const detail = await callback();
    record("PASS", name, detail || "");
    return true;
  } catch (error) {
    record("FAIL", name, error.message || String(error));
    return false;
  }
}

function skip(name, reason) {
  record("SKIP", name, reason);
}

async function request(url, options = {}) {
  const headers = {
    Accept: "application/json",
    ...(options.headers || {}),
  };

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  let body;
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const response = await fetch(url, {
    method: options.method || "GET",
    headers,
    body,
    redirect: options.redirect || "follow",
    signal: AbortSignal.timeout(options.timeoutMs || 15_000),
  });

  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  return {
    status: response.status,
    data,
    contentType: response.headers.get("content-type") || "",
    finalUrl: response.url,
  };
}

function expectStatus(response, expected, context) {
  const statuses = Array.isArray(expected) ? expected : [expected];
  if (!statuses.includes(response.status)) {
    const message =
      typeof response.data === "object"
        ? response.data?.message || JSON.stringify(response.data)
        : String(response.data || "");
    throw new Error(
      `${context}: expected ${statuses.join("/")}, received ${response.status}` +
        (message ? ` (${message.slice(0, 180)})` : ""),
    );
  }
}

function findToken(payload) {
  return (
    payload?.accessToken ||
    payload?.token ||
    payload?.data?.accessToken ||
    payload?.data?.token ||
    ""
  );
}

function findId(payload) {
  if (!payload || typeof payload !== "object") return "";
  if (payload.id) return String(payload.id);
  if (payload.library?.id) return String(payload.library.id);
  if (payload.workspace?.id) return String(payload.workspace.id);
  if (payload.data) return findId(payload.data);
  return "";
}

function findFirstId(payload, keys = []) {
  if (!payload || typeof payload !== "object") return "";

  for (const key of keys) {
    const value = payload[key] || payload?.data?.[key];
    if (Array.isArray(value) && value[0]?.id) {
      return String(value[0].id);
    }
  }

  if (Array.isArray(payload) && payload[0]?.id) {
    return String(payload[0].id);
  }

  if (payload.data && payload.data !== payload) {
    return findFirstId(payload.data, keys);
  }

  return "";
}

async function api(path, options = {}) {
  return request(`${config.apiBaseUrl}${path}`, options);
}

async function frontend(path) {
  return request(`${config.frontendUrl}${path}`, {
    headers: { Accept: "text/html" },
  });
}

async function runFrontendTests() {
  console.log("\n=== Frontend ===");

  for (const path of ["/", "/login", "/register", "/dashboard/discover"]) {
    await test(`Frontend route ${path}`, async () => {
      const response = await frontend(path);
      expectStatus(response, 200, path);
      if (!response.contentType.includes("text/html")) {
        throw new Error(`expected HTML, received ${response.contentType}`);
      }
      return response.finalUrl;
    });
  }
}

async function runPublicApiTests() {
  console.log("\n=== Public API ===");

  let publicLibraryId = "";

  await test("List public libraries", async () => {
    const response = await api("/public/libraries");
    expectStatus(response, 200, "GET /public/libraries");
    publicLibraryId =
      config.libraryId ||
      findFirstId(response.data, ["libraries", "items", "results"]);
    return publicLibraryId
      ? `found library ${publicLibraryId}`
      : "request succeeded; no public library available";
  });

  if (publicLibraryId) {
    await test("Open a public library and its documents", async () => {
      const response = await api(`/public/libraries/${publicLibraryId}`);
      expectStatus(response, 200, "GET public library");
      return `library ${publicLibraryId}`;
    });
  } else {
    skip("Open a public library and its documents", "no public library id");
  }
}

async function runAuthenticationGuardTests() {
  console.log("\n=== Authentication guards ===");

  const protectedRoutes = [
    ["/documents", "Documents"],
    ["/documents/libraries", "Libraries"],
    ["/profile/me", "Profile"],
    ["/workspaces", "Workspaces"],
    ["/issues/me", "Issue reports"],
    ["/admin/dashboard", "Admin dashboard"],
  ];

  for (const [path, label] of protectedRoutes) {
    await test(`${label} rejects missing token`, async () => {
      const response = await api(path);
      expectStatus(response, [401, 403], `GET ${path}`);
      return `HTTP ${response.status}`;
    });
  }

  await test("Backend rejects fake Guest token", async () => {
    const response = await api("/documents/libraries", {
      token: guestToken,
    });

    if (response.status === 200) {
      throw new Error(
        "SECURITY: fake Guest token was accepted by an authenticated endpoint",
      );
    }

    expectStatus(
      response,
      [401, 403],
      "GET /documents/libraries with Guest token",
    );
    return `HTTP ${response.status}`;
  });
}

async function loginIfConfigured() {
  console.log("\n=== Test account ===");

  if (userToken) {
    record("PASS", "Use TEST_ACCESS_TOKEN", "token supplied");
    return;
  }

  if (!config.username || !config.password) {
    skip(
      "Login test account",
      "set TEST_USERNAME and TEST_PASSWORD for authenticated tests",
    );
    return;
  }

  await test("Login test account", async () => {
    const response = await api("/auth/login", {
      method: "POST",
      body: {
        username: config.username,
        password: config.password,
        rememberMe: false,
      },
    });
    expectStatus(response, 200, "POST /auth/login");
    userToken = findToken(response.data);
    if (!userToken) {
      throw new Error("login succeeded but access token was not found");
    }
    return "access token received";
  });
}

async function runAuthenticatedReadTests() {
  console.log("\n=== Authenticated read APIs ===");

  if (!userToken) {
    skip("Authenticated API suite", "no test account token");
    return;
  }

  const routes = [
    ["/profile/me", "Read own profile"],
    ["/documents", "List own documents"],
    ["/documents/storage/usage", "Read document storage usage"],
    ["/documents/libraries", "List own libraries"],
    ["/workspaces", "List own workspaces"],
    ["/workspaces/notifications/me", "List workspace notifications"],
    ["/issues/me", "List own issue reports"],
  ];

  let detectedLibraryId = config.libraryId;
  let detectedWorkspaceId = config.workspaceId;

  for (const [path, label] of routes) {
    await test(label, async () => {
      const response = await api(path, { token: userToken });
      expectStatus(response, 200, `GET ${path}`);

      if (path === "/documents/libraries" && !detectedLibraryId) {
        detectedLibraryId = findFirstId(response.data, [
          "libraries",
          "items",
          "results",
        ]);
      }

      if (path === "/workspaces" && !detectedWorkspaceId) {
        detectedWorkspaceId = findFirstId(response.data, [
          "workspaces",
          "items",
          "results",
        ]);
      }

      return "HTTP 200";
    });
  }

  if (detectedLibraryId) {
    for (const [suffix, label] of [
      ["", "Read library detail"],
      ["/engagement", "Read library engagement"],
    ]) {
      await test(label, async () => {
        const response = await api(
          `/documents/libraries/${detectedLibraryId}${suffix}`,
          { token: userToken },
        );
        expectStatus(response, 200, label);
        return `library ${detectedLibraryId}`;
      });
    }
  } else {
    skip("Authenticated library detail tests", "no TEST_LIBRARY_ID or library");
  }

  if (detectedWorkspaceId) {
    const workspaceRoutes = [
      ["", "Read workspace detail"],
      ["/members", "List workspace members"],
      ["/messages", "List workspace messages"],
      ["/flashcards", "List workspace flashcards"],
      ["/discussion/topics", "List discussion topics"],
      ["/documents", "List workspace documents"],
    ];

    for (const [suffix, label] of workspaceRoutes) {
      await test(label, async () => {
        const response = await api(
          `/workspaces/${detectedWorkspaceId}${suffix}`,
          { token: userToken },
        );
        expectStatus(response, 200, label);
        return `workspace ${detectedWorkspaceId}`;
      });
    }
  } else {
    skip(
      "Authenticated workspace detail tests",
      "no TEST_WORKSPACE_ID or workspace",
    );
  }

  if (config.documentId) {
    await test("Read existing document flashcards", async () => {
      const response = await api(
        `/ai/documents/${config.documentId}/flashcards`,
        { token: userToken },
      );
      expectStatus(response, 200, "GET document flashcards");
      return `document ${config.documentId}`;
    });
  } else {
    skip("Document AI read test", "set TEST_DOCUMENT_ID");
  }
}

async function runWriteTests() {
  console.log("\n=== Temporary CRUD tests ===");

  if (!config.runWriteTests) {
    skip("Temporary CRUD suite", "set RUN_WRITE_TESTS=true to enable");
    return;
  }

  if (!userToken) {
    skip("Temporary CRUD suite", "authenticated test account is required");
    return;
  }

  const marker = `SYSTEM_TEST_${Date.now()}`;

  await test("Create temporary library", async () => {
    const response = await api("/documents/libraries", {
      method: "POST",
      token: userToken,
      body: {
        name: marker,
        description: "Temporary library created by system-smoke-test.mjs",
        is_public: true,
        share_on_profile: false,
      },
    });
    expectStatus(response, 201, "POST /documents/libraries");
    temporaryLibraryId = findId(response.data);
    if (!temporaryLibraryId) {
      throw new Error("created library id was not found");
    }
    return temporaryLibraryId;
  });

  if (temporaryLibraryId) {
    await test("Update own temporary library", async () => {
      const response = await api(
        `/documents/libraries/${temporaryLibraryId}`,
        {
          method: "PUT",
          token: userToken,
          body: {
            name: marker,
            description: "Updated safely by system smoke test",
            is_public: true,
            share_on_profile: false,
          },
        },
      );
      expectStatus(response, 200, "PUT own library");
      return "HTTP 200";
    });

    if (config.runSecurityTests) {
      await test("Guest cannot update another user's library", async () => {
        const response = await api(
          `/documents/libraries/${temporaryLibraryId}`,
          {
            method: "PUT",
            token: guestToken,
            body: {
              name: marker,
              description: "GUEST_AUTHORIZATION_PROBE",
              is_public: true,
              share_on_profile: false,
            },
          },
        );

        if (response.status === 200) {
          throw new Error(
            "SECURITY: Guest changed a library owned by the test account",
          );
        }

        expectStatus(response, [401, 403, 404], "Guest library update");
        return `blocked with HTTP ${response.status}`;
      });
    } else {
      skip(
        "Guest ownership update test",
        "set RUN_SECURITY_TESTS=true to enable",
      );
    }
  }

  await test("Create temporary workspace", async () => {
    const response = await api("/workspaces", {
      method: "POST",
      token: userToken,
      body: {
        name: marker,
        description: "Temporary workspace created by system smoke test",
      },
    });
    expectStatus(response, 201, "POST /workspaces");
    temporaryWorkspaceId = findId(response.data);
    if (!temporaryWorkspaceId) {
      throw new Error("created workspace id was not found");
    }
    return temporaryWorkspaceId;
  });

  if (temporaryWorkspaceId) {
    await test("Update own temporary workspace", async () => {
      const response = await api(`/workspaces/${temporaryWorkspaceId}`, {
        method: "PUT",
        token: userToken,
        body: {
          name: marker,
          description: "Updated safely by system smoke test",
        },
      });
      expectStatus(response, 200, "PUT own workspace");
      return "HTTP 200";
    });
  }
}

async function runAdminTests() {
  console.log("\n=== Admin read APIs ===");

  if (!config.adminToken) {
    skip("Admin API suite", "set TEST_ADMIN_TOKEN");
    return;
  }

  for (const [path, label] of [
    ["/admin/dashboard", "Admin dashboard"],
    ["/admin/moderation", "Admin moderation queue"],
    ["/admin/users", "Admin users"],
    ["/admin/logs", "Admin activity logs"],
    ["/admin/usage", "Admin usage"],
    ["/admin/issues", "Admin issue reports"],
    ["/admin/workspaces/deleted", "Admin deleted workspaces"],
  ]) {
    await test(label, async () => {
      const response = await api(path, { token: config.adminToken });
      expectStatus(response, 200, `GET ${path}`);
      return "HTTP 200";
    });
  }
}

async function cleanup() {
  console.log("\n=== Cleanup ===");

  if (temporaryWorkspaceId && userToken) {
    await test("Delete temporary workspace", async () => {
      const response = await api(`/workspaces/${temporaryWorkspaceId}`, {
        method: "DELETE",
        token: userToken,
      });
      expectStatus(response, [200, 204], "DELETE temporary workspace");
      temporaryWorkspaceId = "";
      return "removed";
    });
  }

  if (temporaryLibraryId && userToken) {
    await test("Delete temporary library", async () => {
      const response = await api(
        `/documents/libraries/${temporaryLibraryId}`,
        {
          method: "DELETE",
          token: userToken,
        },
      );
      expectStatus(response, [200, 204], "DELETE temporary library");
      temporaryLibraryId = "";
      return "removed";
    });
  }

  if (!temporaryWorkspaceId && !temporaryLibraryId) {
    console.log("No temporary resources remain.");
  }
}

function printSummary() {
  const counts = results.reduce(
    (summary, result) => {
      summary[result.status] += 1;
      return summary;
    },
    { PASS: 0, FAIL: 0, SKIP: 0 },
  );

  console.log("\n=== Summary ===");
  console.log(`PASS: ${counts.PASS}`);
  console.log(`FAIL: ${counts.FAIL}`);
  console.log(`SKIP: ${counts.SKIP}`);
  console.log(`API: ${config.apiBaseUrl}`);
  console.log(`Frontend: ${config.frontendUrl}`);

  if (counts.FAIL > 0) {
    console.log("\nFailed checks:");
    for (const result of results.filter((item) => item.status === "FAIL")) {
      console.log(`- ${result.name}: ${result.detail}`);
    }
    process.exitCode = 1;
  }
}

console.log("AI Study Hub system smoke test");
console.log(`Mode: ${config.runWriteTests ? "temporary CRUD" : "safe read-only"}`);

try {
  await runFrontendTests();
  await runPublicApiTests();
  await runAuthenticationGuardTests();
  await loginIfConfigured();
  await runAuthenticatedReadTests();
  await runWriteTests();
  await runAdminTests();
} catch (error) {
  record("FAIL", "Unexpected test runner error", error.message || String(error));
} finally {
  await cleanup();
  printSummary();
}
