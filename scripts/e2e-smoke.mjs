const base = process.env.E2E_BASE || "http://localhost:3000";

async function check(spec) {
  const { path, method = "GET", body, expectedStatus = 200 } = spec;
  const url = base + path;
  const init = { method, redirect: "manual" };
  if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  try {
    const res = await fetch(url, init);
    const passed = res.status === expectedStatus;
    console.log(`${method} ${path} → ${res.status} (expected ${expectedStatus}) ${passed ? "✓" : "✗"}`);
    return { spec, status: res.status, passed };
  } catch (err) {
    console.log(`${method} ${path} → ERROR ${err.message}`);
    return { spec, status: 0, passed: false, err: err.message };
  }
}

(async () => {
  console.log("E2E smoke tests against", base, "\n");
  const specs = [
    { path: "/",                   expectedStatus: 200 },
    { path: "/api/chat",           expectedStatus: 200 },
    { path: "/api/claims/create",  method: "POST", body: { title: "test", sourceUrl: "https://example.com" }, expectedStatus: 401 },
    { path: "/api/comments/create",method: "POST", body: { claim_id: "00000000-0000-0000-0000-000000000000", content: "hi" }, expectedStatus: 401 },
    { path: "/api/votes/toggle",   method: "POST", body: { claim_id: "00000000-0000-0000-0000-000000000000", vote_type: "upvote" }, expectedStatus: 401 },
    { path: "/api/evidence/create",method: "POST", body: { claim_id: "00000000-0000-0000-0000-000000000000", evidence_url: "https://example.com", title: "test" }, expectedStatus: 401 },
    { path: "/api/watchlist",      method: "POST", body: { claim_id: "00000000-0000-0000-0000-000000000000" }, expectedStatus: 401 },
    { path: "/api/chat-history",   method: "POST", body: { chat_session_id: "00000000-0000-0000-0000-000000000000", role: "user", content: "hi" }, expectedStatus: 401 },
  ];
  const results = [];
  for (const spec of specs) results.push(await check(spec));
  const failed = results.filter((r) => !r.passed);
  console.log("\n─────────────────────────────");
  if (failed.length === 0) { console.log(`All ${results.length} checks passed. ✓`); process.exit(0); }
  else { console.log(`${failed.length} of ${results.length} FAILED`); console.table(failed.map(f => ({ path: f.spec.path, expected: f.spec.expectedStatus, actual: f.status }))); process.exit(2); }
})();
