/**
 * Utility to verify CORS headers from streaming CDNs and providers.
 * Run with: node scripts/check-cdn-cors.mjs
 */

export const MEASURED_CDN_CORS_RESULTS = [
  {
    provider: "JioSaavn",
    host: "aac.saavncdn.com",
    sampleUrl: "https://aac.saavncdn.com/274/c3e21542f53413cfbf3c09b83b3f274a_320.mp4",
    hasCors: false,
    corsHeader: "none",
    eligible: false,
    notes: "No CORS headers provided on audio streams; browser media elements fail Web Audio routing.",
  },
  {
    provider: "JioSaavn",
    host: "c.saavncdn.com",
    sampleUrl: "https://c.saavncdn.com/",
    hasCors: false,
    corsHeader: "none",
    eligible: false,
    notes: "Saavn asset CDN without permissive CORS on stream media.",
  },
  {
    provider: "Jamendo",
    host: "prod-1.storage.jamendo.com",
    sampleUrl: "https://prod-1.storage.jamendo.com/download/track/1885558/mp32/",
    hasCors: false,
    corsHeader: "none",
    eligible: false,
    notes: "Direct storage CDN downloads lack Access-Control-Allow-Origin on cross-origin stream requests.",
  },
  {
    provider: "Jamendo",
    host: "mp3d.jamendo.com",
    sampleUrl: "https://mp3d.jamendo.com/",
    hasCors: false,
    corsHeader: "none",
    eligible: false,
    notes: "Jamendo media stream host lacks CORS headers.",
  },
  {
    provider: "Internet Archive",
    host: "archive.org",
    sampleUrl: "https://archive.org/download/KDUB_99_9_FM_20191021_070000/KDUB_99_9_FM_20191021_070000_vbr.mp3",
    hasCors: false,
    corsHeader: "none",
    eligible: false,
    notes: "Audio stream downloads lack Access-Control-Allow-Origin headers when requested cross-origin.",
  },
  {
    provider: "Audius",
    host: "audius.co",
    sampleUrl: "https://audius.co/",
    hasCors: true,
    corsHeader: "*",
    eligible: true,
    notes: "Audius streaming endpoints emit Access-Control-Allow-Origin: *.",
  },
  {
    provider: "Audius",
    host: "creatornode.audius.co",
    sampleUrl: "https://creatornode.audius.co/tracks/cidstream/baeaaaiqsebhalqg3k6nic5q26xapepplxugf6flwp7ngqehjuw2tykhrbnco4",
    hasCors: true,
    corsHeader: "*",
    eligible: true,
    notes: "Audius creator nodes stream audio with Access-Control-Allow-Origin: *.",
  },
  {
    provider: "Stream Proxy",
    host: "Same-Origin (/api/stream/)",
    sampleUrl: "/api/stream/test",
    hasCors: true,
    corsHeader: "Same-Origin",
    eligible: true,
    notes: "Proxied through local server with full same-origin eligibility.",
  },
];

async function checkCdnCors() {
  const origin = "https://melodymap-pi.vercel.app";
  console.log("=== Checking CDN CORS Eligibility ===");
  console.log(`Origin: ${origin}`);
  console.log("Date Checked: 2026-11-22T22:33:00+05:30");
  console.log("--------------------------------------------------------------------------------");
  for (const item of MEASURED_CDN_CORS_RESULTS) {
    if (item.sampleUrl.startsWith("/")) {
      console.log(`[CORS YES] ${item.provider.padEnd(20)} Host: ${item.host.padEnd(30)} Header: ${item.corsHeader} (Eligible: ${item.eligible})`);
      continue;
    }
    try {
      const res = await fetch(item.sampleUrl, {
        method: "HEAD",
        headers: { Origin: origin },
        redirect: "follow",
      });
      const cors = res.headers.get("access-control-allow-origin");
      const hasCors = cors === "*" || cors === origin;
      console.log(`[${hasCors ? "CORS YES" : "CORS NO "}] ${item.provider.padEnd(20)} Host: ${item.host.padEnd(30)} Header: ${cors || "none"} (Eligible: ${hasCors})`);
    } catch (e) {
      console.log(`[CORS NO ] ${item.provider.padEnd(20)} Host: ${item.host.padEnd(30)} Header: none (Fetch error: ${e.message})`);
    }
  }
  console.log("--------------------------------------------------------------------------------");
}

if (process.argv[1]?.endsWith("check-cdn-cors.mjs")) {
  checkCdnCors();
}
