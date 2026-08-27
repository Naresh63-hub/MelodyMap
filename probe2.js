const KEY = "AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w";
const clients = [
  { name: "ANDROID", body: { clientName: "ANDROID", clientVersion: "19.09.37", androidSdkVersion: 30, hl: "en", gl: "US" } },
  { name: "ANDROID_MUSIC", body: { clientName: "ANDROID_MUSIC", clientVersion: "6.27.54", androidSdkVersion: 30, hl: "en", gl: "US" } },
  { name: "IOS", body: { clientName: "IOS", clientVersion: "19.09.3", deviceModel: "iPhone16,1", hl: "en", gl: "US" } },
  { name: "WEB", body: { clientName: "WEB", clientVersion: "2.20240820.01.00", hl: "en", gl: "US" } },
];
async function tryPlayer(videoId, c, useKey) {
  const url = `https://www.youtube.com/youtubei/v1/player${useKey ? "?key=" + KEY : ""}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip", "Origin": "https://www.youtube.com" },
    body: JSON.stringify({ context: { client: c.body }, videoId, contentCheckOk: true, racyCheckOk: true }),
    signal: AbortSignal.timeout(10000),
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { return `${res.status} notjson ${text.slice(0,80)}`; }
  const st = data.playabilityStatus?.status;
  const fmts = [...(data.streamingData?.formats||[]), ...(data.streamingData?.adaptiveFormats||[])];
  const audio = fmts.filter(f => f.url && (f.mimeType||"").startsWith("audio/"));
  return `${res.status} status=${st} total=${fmts.length} audio=${audio.length}`;
}
(async () => {
  for (const c of clients) {
    for (const useKey of [true, false]) {
      try {
        const r = await tryPlayer("dQw4w9WgXcQ", c, useKey);
        console.log(`${c.name} key=${useKey}: ${r}`);
      } catch (e) { console.log(`${c.name} key=${useKey}: ERR ${e.message}`); }
    }
  }
})();
