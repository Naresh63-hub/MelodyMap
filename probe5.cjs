const ytdl = require("@ru-hend/ytdl-core");
(async () => {
  const t = Date.now();
  try {
    const info = await ytdl.getInfo("dQw4w9WgXcQ", { playerClients: ["ANDROID", "IOS"] });
    const f = ytdl.chooseFormat(info.formats, { quality: "highestaudio" });
    console.log("OK in", Date.now()-t, "ms itag", f.itag, "mime", (f.mimeType||"").split(";")[0], "url?", !!f.url);
    const r = await fetch(f.url, { headers: { Range: "bytes=1048576-2097151" }, signal: AbortSignal.timeout(8000) });
    console.log("bytes1-2MB status:", r.status);
  } catch (e) {
    console.log("FAIL in", Date.now()-t, "ms:", e.message.slice(0, 120));
  }
})();
