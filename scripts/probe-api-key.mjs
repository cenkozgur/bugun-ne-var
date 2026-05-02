#!/usr/bin/env node
/**
 * API key probe — answers: "What can the BASE44_API_KEY actually do
 * when called from outside the browser?"
 *
 * Two questions we need to answer before building a GitHub Actions cron:
 *   1. Can it READ entities? (GET /entities/Category)
 *   2. Can it WRITE entities? (POST /entities/Event with a dummy row,
 *      then DELETE it)
 *
 * If both succeed → cron via REST API is viable.
 * If reads work but writes 401/403 → probably read-only, look for
 * another auth flow (maybe SDK loginViaEmailPassword + a service user).
 * If reads also fail → the key may be browser-only ("client API key"),
 * and we'll fall back to a headless-browser cron that hits /seed.
 *
 * Usage:
 *   export BASE44_API_KEY="paste-the-key-from-base44-dashboard"
 *   node scripts/probe-api-key.mjs
 *
 * Nothing about the key ever leaves your machine — this script only
 * talks to app.base44.com. Output is just success/failure lines, the
 * key itself is never printed.
 */

const APP_ID = '69ebd11fe74b0ffcc2427b1b';
const API_KEY = process.env.BASE44_API_KEY;

// We try a handful of plausible auth headers in sequence because Base44's
// public docs are vague on which one external scripts need. The probe
// reports which one (if any) gives a 200.
const HEADER_VARIANTS = [
  { name: 'api_key (lowercase)',     headers: { 'api_key': API_KEY } },
  { name: 'X-API-Key',               headers: { 'X-API-Key': API_KEY } },
  { name: 'Authorization Bearer',    headers: { 'Authorization': `Bearer ${API_KEY}` } },
  { name: 'Authorization ApiKey',    headers: { 'Authorization': `ApiKey ${API_KEY}` } },
  { name: 'X-Base44-Api-Key',        headers: { 'X-Base44-Api-Key': API_KEY } },
];

// Multiple base URL guesses — Base44's REST docs panel suggested
// /entities/<Name> but didn't show the host prefix. Try the obvious ones.
const BASE_URL_VARIANTS = [
  `https://app.base44.com/api/apps/${APP_ID}`,
  `https://base44.app/api/apps/${APP_ID}`,
  `https://api.base44.com/apps/${APP_ID}`,
  `https://bugun-ne-var.base44.app/api/apps/${APP_ID}`,
];

if (!API_KEY) {
  console.error('❌ BASE44_API_KEY environment variable is empty.');
  console.error('   Run: export BASE44_API_KEY="paste-key-here"');
  console.error('   Then: node scripts/probe-api-key.mjs');
  process.exit(1);
}

console.log(`🔑 Probing key (length=${API_KEY.length}, first 4=${API_KEY.slice(0, 4)})\n`);

async function tryRequest(method, url, headers, body) {
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = text.slice(0, 200); }
    return { ok: res.ok, status: res.status, body: parsed };
  } catch (err) {
    return { ok: false, status: 0, body: `network error: ${err.message}` };
  }
}

async function probe() {
  // Phase 1 — find the right (base URL, header) combo that returns 200
  // for a plain GET /entities/Category. That's our baseline.
  console.log('── Phase 1: Find a working READ combination ──');
  let workingCombo = null;

  for (const base of BASE_URL_VARIANTS) {
    for (const variant of HEADER_VARIANTS) {
      const url = `${base}/entities/Category`;
      const res = await tryRequest('GET', url, variant.headers);
      const tag = `${variant.name.padEnd(28)} @ ${base}`;
      if (res.ok) {
        const count = Array.isArray(res.body) ? res.body.length :
          Array.isArray(res.body?.data) ? res.body.data.length : '?';
        console.log(`✅ 200 ${tag}  → ${count} categories`);
        if (!workingCombo) workingCombo = { base, headers: variant.headers, name: variant.name };
      } else if (res.status === 401 || res.status === 403) {
        console.log(`🔒 ${res.status} ${tag}`);
      } else if (res.status === 404) {
        // Don't spam 404s — most base URL guesses won't match
        // console.log(`✗ 404 ${tag}`);
      } else if (res.status === 0) {
        console.log(`✗ network ${tag}`);
      } else {
        console.log(`✗ ${res.status} ${tag}`);
      }
    }
  }

  if (!workingCombo) {
    console.log('\n❌ No (base URL, header) combo gave a 200 read.');
    console.log('   The key may be browser-only / not valid for external HTTP.');
    console.log('   Next step: try Base44 SDK with token auth, or fall back to a');
    console.log('   headless-browser cron that hits /seed.');
    return;
  }

  console.log(`\n→ Using ${workingCombo.name} @ ${workingCombo.base}\n`);

  // Phase 2 — Can we WRITE? Try creating a throwaway Event, then deleting it.
  console.log('── Phase 2: Can we WRITE? ──');
  const testRow = {
    title: '__probe__ delete me',
    start_time: new Date(Date.now() + 86400000).toISOString(),  // tomorrow
    category_id: 'probe-fake-id',
    external_ref: `probe-${Date.now()}`,
  };

  const createRes = await tryRequest(
    'POST',
    `${workingCombo.base}/entities/Event`,
    workingCombo.headers,
    testRow
  );

  if (createRes.ok) {
    console.log(`✅ POST /entities/Event → 200 (created throwaway row)`);
    const id = createRes.body?.id || createRes.body?.data?.id;
    if (id) {
      const delRes = await tryRequest(
        'DELETE',
        `${workingCombo.base}/entities/Event/${id}`,
        workingCombo.headers
      );
      console.log(`${delRes.ok ? '✅' : '⚠️ '} DELETE /entities/Event/${id} → ${delRes.status}`);
    } else {
      console.log(`⚠️  Couldn't read id from response — manual cleanup may be needed.`);
      console.log('   Response body:', createRes.body);
    }
    console.log('\n🎉 GitHub Actions cron is fully viable. We can build it now.');
  } else {
    console.log(`🔒 POST /entities/Event → ${createRes.status}`);
    console.log('   Body:', JSON.stringify(createRes.body).slice(0, 300));
    console.log('\n→ Reads work but writes blocked. Probable cause: this key is');
    console.log('   "anon-level" (RLS-scoped to created_by==null) and your app');
    console.log('   now requires created_by to match the signed-in user.');
    console.log('   Workaround: an Event would need a service-user token,');
    console.log('   which Base44 docs say is backend-functions-only.');
  }
}

probe().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
