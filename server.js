const express = require("express");
const multer  = require("multer");
const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const upload = multer({ dest: "/tmp" });
const app = express();

app.post("/mix", upload.fields([{ name: "voice" }, { name: "bg" }]), (req, res) => {
  const voice = req.files?.voice?.[0]?.path;
  const bg    = req.files?.bg?.[0]?.path;
  if (!voice || !bg) return res.status(400).json({ error: "Missing 'voice' or 'bg' file" });

  const mode      = (req.query.mode || "duck").toLowerCase(); // "duck" or "mix"
  const bgVolume  = req.query.bgVolume || (mode === "duck" ? "0.5" : "0.15");
  const lufs      = req.query.lufs || "-16";
  const fadeInSec = req.query.fadeInSec || "3";
  const sr        = req.query.sr || "44100";
  const out       = path.join("/tmp", `out_${Date.now()}.m4a`);

  const filter = (mode === "duck")
    ? `[1:a]afade=t=in:st=0:d=${fadeInSec},volume=${bgVolume}[bg];`+
      `[bg][0:a]sidechaincompress=threshold=0.05:ratio=8:attack=5:release=250:makeup=0[ducked];`+
      `[ducked][0:a]amix=inputs=2:duration=first:dropout_transition=3[mix];`+
      `[mix]loudnorm=I=${lufs}:TP=-1.0:LRA=11[out]`
    : `[1:a]volume=${bgVolume},afade=t=in:st=0:d=${fadeInSec},asetpts=N/SR/TB[bg];`+
      `[0:a]volume=1.0[vox];[bg][vox]amix=inputs=2:duration=first:dropout_transition=3[mix];`+
      `[mix]loudnorm=I=${lufs}:TP=-1.0:LRA=11[out]`;

  const args = ["-y","-i",voice,"-stream_loop","-1","-i",bg,"-filter_complex",filter,
                "-map","[out]","-ar",sr,"-ac","2","-c:a","aac","-b:a","192k",
                "-shortest",out];

  execFile("ffmpeg", args, { timeout: 300000 }, (err) => {
    if (err) return res.status(500).json({ error: "ffmpeg_failed", details: err.message });
    res.setHeader("Content-Type","audio/mp4");
    res.setHeader("Content-Disposition",'inline; filename="meditation.m4a"');
    fs.createReadStream(out).on("close", () => {
      fs.unlink(out, ()=>{}); fs.unlink(voice, ()=>{}); fs.unlink(bg, ()=>{});
    }).pipe(res);
  });
});

app.get("/healthz", (_, res) => res.json({ ok: true }));
app.listen(process.env.PORT || 8080, () => console.log("Mixer listening"));
