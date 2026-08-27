const ytdl = require("ytdl-core-enhanced");
(async () => {
  const id = "dQw4w9WgXcQ";
  const t = Date.now();
  try {
    const info = await ytdl.getInfo(id, { playerClients: ["ANDROID", "IOS"] });
    const f = ytdl.chooseFormat(info.formats, { quality: "highestaudio" });
    console.log("OK in", Date.now() - t, "ms");
    console.log("itag:", f.itag, "mime:", f.mimeType, "hasUrl:", !!f.url, "len:", f.contentLength);
    const r = await fetch(f.url, { headers: { Range: "bytes=1048576-2097151" }, signal: AbortSignal.timeout(8000) });
    console.log("bytes1-2MB status:", r.status);
  } catch (e) {
    console.log("FAIL in", Date.now() - t, "ms:", e.message);
  }
})();
