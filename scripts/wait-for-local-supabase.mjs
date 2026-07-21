import process from "node:process";

try {
  process.loadEnvFile?.(".env.local");
} catch {
  // CI may provide the variables directly instead of a local env file.
}

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!rawUrl || !publishableKey) {
  throw new Error("Local Supabase URL and publishable key are required before Playwright starts.");
}

const url = new URL(rawUrl);
if (!new Set(["127.0.0.1", "localhost", "::1"]).has(url.hostname)) {
  throw new Error("The local Playwright readiness gate refuses to contact a remote Supabase project.");
}

const deadline = Date.now() + 45_000;
let lastStatus = "not checked";

while (Date.now() < deadline) {
  try {
    const [auth, rest] = await Promise.all([
      fetch(new URL("/auth/v1/health", url), { headers: { apikey: publishableKey }, signal: AbortSignal.timeout(2_000) }),
      fetch(new URL("/rest/v1/restaurants?select=id&limit=1", url), { headers: { apikey: publishableKey, Authorization: `Bearer ${publishableKey}` }, signal: AbortSignal.timeout(2_000) }),
    ]);
    lastStatus = `auth=${auth.status}, rest=${rest.status}`;
    if (auth.ok && rest.ok) {
      console.log("Local Supabase Auth and REST are ready.");
      process.exit(0);
    }
  } catch (error) {
    lastStatus = error instanceof Error ? error.message : "request failed";
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}

throw new Error(`Local Supabase did not become ready within 45 seconds (${lastStatus}).`);
