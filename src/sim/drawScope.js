function drawSig(sctx, data, color, mg, pw, ph, len, head) {
  sctx.beginPath();
  sctx.strokeStyle = color;
  sctx.lineWidth = 1.5;
  for (let i = 0; i < len; i++) {
    const idx = (head + i) % len;
    const x = mg.l + (i / len) * pw;
    const y = mg.t + (1 - data[idx]) * ph;
    if (i === 0) sctx.moveTo(x, y);
    else sctx.lineTo(x, y);
  }
  sctx.stroke();
}

export function drawScope(sctx, SW, SHt, scope1, scope2, scopeIdx) {
  sctx.clearRect(0, 0, SW, SHt);
  sctx.fillStyle = "#060a0e";
  sctx.fillRect(0, 0, SW, SHt);

  const mg  = { l: 52, r: 16, t: 30, b: 30 };
  const pw  = SW - mg.l - mg.r;
  const ph  = SHt - mg.t - mg.b;
  const len = 1200;
  const head = scopeIdx;

  // Grid
  sctx.strokeStyle = "#111a22";
  sctx.lineWidth = 0.5;
  for (let i = 0; i <= 10; i++) {
    const x = mg.l + (pw / 10) * i;
    sctx.beginPath(); sctx.moveTo(x, mg.t); sctx.lineTo(x, mg.t + ph); sctx.stroke();
  }
  for (let i = 0; i <= 4; i++) {
    const y = mg.t + (ph / 4) * i;
    sctx.beginPath(); sctx.moveTo(mg.l, y); sctx.lineTo(mg.l + pw, y); sctx.stroke();
  }

  // Axis labels
  sctx.fillStyle = "#3a5566";
  sctx.font = "9px monospace";
  sctx.fillText("1.0", mg.l - 28, mg.t + 4);
  sctx.fillText("0.5", mg.l - 28, mg.t + ph / 2 + 3);
  sctx.fillText("0.0", mg.l - 28, mg.t + ph + 4);
  sctx.textAlign = "center";
  sctx.fillText("V/Vmax", mg.l - 10, mg.t - 10);
  sctx.fillText("Time \u2192", mg.l + pw / 2, SHt - 6);
  sctx.textAlign = "left";

  // Signals
  drawSig(sctx, scope1, "#ff3333", mg, pw, ph, len, head);
  drawSig(sctx, scope2, "#3388ff", mg, pw, ph, len, head);

  // Border
  sctx.strokeStyle = "#2a3a4a";
  sctx.lineWidth = 1;
  sctx.strokeRect(mg.l, mg.t, pw, ph);

  // Legend
  sctx.fillStyle = "#ff4444";
  sctx.fillRect(mg.l + pw - 120, mg.t + 6, 10, 2);
  sctx.fillStyle = "#ff6666";
  sctx.font = "bold 9px monospace";
  sctx.fillText("CH1 Beam 1", mg.l + pw - 106, mg.t + 10);
  sctx.fillStyle = "#3388ff";
  sctx.fillRect(mg.l + pw - 120, mg.t + 20, 10, 2);
  sctx.fillStyle = "#5599ff";
  sctx.fillText("CH2 Beam 2", mg.l + pw - 106, mg.t + 24);

  // Title
  sctx.fillStyle = "#5a8899";
  sctx.font = "bold 10px monospace";
  sctx.textAlign = "center";
  sctx.fillText("OSCILLOSCOPE \u2014 PHOTODIODE OUTPUT", SW / 2, 16);
  sctx.textAlign = "left";
}
