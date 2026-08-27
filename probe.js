const KEY = "AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w";
async function player(videoId, client) {
  const res = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip" },
    body: JSON.stringify({ context: { client }, videoId, contentCheckOk: true, racyCheckOk: true }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return await res.json();
}
async function probe(url) {
  try {
    const r = await fetch(url, { headers: { Range: "bytes=0-65535" }, signal: AbortSignal.timeout(8000) });
    return r.status;
  } catch { return "err"; }
}
async function probe2mb(url) {
  try {
    const r = await fetch(url, { headers: { Range: "bytes=1048576-2097151" }, signal: AbortSignal.timeout(8000) });
    return r.status;
  } catch { return "err"; }
}
async function test(id, name) {
  const t = Date.now();
  const data = await player(id, { clientName: "ANDROID", clientVersion: "19.09.37", androidSdkVersion: 30, hl: "en", gl: "US" });
  const st = data.playabilityStatus?.status;
  const fmts = [...(data.streamingData?.formats || []), ...(data.streamingData?.adaptiveFormats || [])];
  const audio = fmts.filter(f => f.url && (f.mimeType || "").startsWith("audio/")).sort((a,b)=>(b.bitrate||0)-(a.bitrate||0));
  if (!audio.length) { console.log(`${name}: status=${st} no-audio (${Date.now()-t}ms)`); return; }
  const u = audio[0];
  const p1 = await probe(u.url);
  const p2 = await probe2mb(u.url);
  console.log(`${name}: status=${st} audio=${audio.length} firstByte=${p1} bytes1-2MB=${p2} itag=${u.itag} br=${u.bitrate} (${Date.now()-t}ms)`);
}
test("kJQP7kiw5Fk", "Despacito");
test("dQw4w9WgXcQ", "RickRoll");
test("M7lc1UVf-VE", "CappedVid");
