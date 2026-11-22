/**
 * Small development utility to verify CORS headers from streaming CDNs and providers.
 * Run with: node scripts/check-cdn-cors.mjs
 */

const TEST_URLS = [
  { name: "Local Stream Proxy", url: "http://localhost:3000/api/stream/test" },
  { name: "JioSaavn CDN (aac)", url: "https://aac.saavncdn.com" },
  { name: "JioSaavn CDN (c)", url: "https://c.saavncdn.com" },
  { name: "Audius Stream CDN", url: "https://audius.co" },
  { name: "Internet Archive CDN", url: "https://archive.org" },
];

async function checkCdnCors() {
  console.log("=== Checking CDN CORS Eligibility ===");
  for (const item of TEST_URLS) {
    try {
      const res = await fetch(item.url, {
        method: "HEAD",
        headers: { Origin: "http://localhost:3000" },
      });
      const corsHeader = res.headers.get("access-control-allow-origin");
      const hasCors = corsHeader === "*" || corsHeader === "http://localhost:3000";
      console.log(`[${hasCors ? "CORS OK" : "NO CORS"}] ${item.name} (${item.url}) -> Header: ${corsHeader || "none"}`);
    } catch (err) {
      console.log(`[NETWORK / BLOCKED] ${item.name} (${item.url}): ${err.message}`);
    }
  }
}

checkCdnCors();
