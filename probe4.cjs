const ytdl = require("ytdl-core-enhanced");
const combos = [
  ["default", undefined],
  ["WEB", ["WEB"]],
  ["MSTV", ["MSTV"]],
  ["TV_EMBEDDED", ["TV_EMBEDDED"]],
  ["ANDROID_WEB", ["ANDROID", "WEB"]],
];
(async () => {
  for (const [name, clients] of combos) {
    const t = Date.now();
    try {
      const opts = clients ? { playerClients: clients } : {};
      const info = await ytdl.getInfo("dQw4w9WgXcQ", opts);
      const f = ytdl.chooseFormat(info.formats, { quality: "highestaudio" });
      console.log(name, "OK", Date.now()-t, "ms itag", f.itag, "mime", (f.mimeType||"").split(";")[0]);
    } catch (e) {
      console.log(name, "FAIL", Date.now()-t, "ms:", e.message.slice(0, 90));
    }
  }
})();
