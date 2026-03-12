import { SIM, VIS } from "../constants/simConstants";

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawSensorModule(ctx, b1Val, b2Val) {
  const wL   = VIS.chamberLeft - 8;
  const hLeft  = 14;
  const hRight = 150;
  const hTop   = VIS.chamberTop - 26;
  const hBot   = VIS.chamberBot + 26;
  const hCx    = (hLeft + hRight) / 2;

  // Housing body
  roundRect(ctx, hLeft, hTop, hRight - hLeft, hBot - hTop, 10);
  ctx.fillStyle = "#0d141e"; ctx.fill();
  roundRect(ctx, hLeft, hTop, hRight - hLeft, hBot - hTop, 10);
  ctx.strokeStyle = "#253848"; ctx.lineWidth = 1.8; ctx.stroke();

  // PCB substrate
  ctx.fillStyle = "#060e07";
  ctx.fillRect(hLeft + 7, hTop + 7, hRight - hLeft - 14, hBot - hTop - 14);

  // PCB traces
  ctx.strokeStyle = "#0c1e0e"; ctx.lineWidth = 0.5;
  for (let y = hTop + 20; y < hBot - 6; y += 13) {
    ctx.beginPath(); ctx.moveTo(hLeft + 8, y); ctx.lineTo(hRight - 8, y); ctx.stroke();
  }
  // PCB vias
  ctx.fillStyle = "#1a3a1a";
  for (let y = hTop + 28; y < hBot - 20; y += 32) {
    for (let x = hLeft + 16; x < hRight - 20; x += 18) {
      ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
    }
  }

  // MCU chip
  const chipX = hLeft + 10, chipY = hTop + 36;
  ctx.fillStyle = "#0a0e12"; ctx.fillRect(chipX, chipY, 36, 22);
  ctx.strokeStyle = "#1e2e3e"; ctx.lineWidth = 0.8; ctx.strokeRect(chipX, chipY, 36, 22);
  ctx.strokeStyle = "#2a4038"; ctx.lineWidth = 0.8;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath(); ctx.moveTo(chipX + 5 + i * 6, chipY - 2); ctx.lineTo(chipX + 5 + i * 6, chipY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(chipX + 5 + i * 6, chipY + 22); ctx.lineTo(chipX + 5 + i * 6, chipY + 24); ctx.stroke();
  }
  ctx.fillStyle = "#1a2a2a"; ctx.font = "5.5px monospace";
  ctx.fillText("STM32", chipX + 3, chipY + 11);
  ctx.fillText("G030",  chipX + 5, chipY + 18);

  // Bottom connector block
  ctx.fillStyle = "#161e2c"; ctx.fillRect(hCx - 14, hBot - 9, 28, 14);
  ctx.strokeStyle = "#263848"; ctx.lineWidth = 1; ctx.strokeRect(hCx - 14, hBot - 9, 28, 14);
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = "#8a9a6a"; ctx.fillRect(hCx - 9 + i * 6, hBot + 3, 3, 9);
  }

  // LED emitter modules
  for (let i = 0; i < 2; i++) {
    const beamY   = i === 0 ? VIS.beam1Y : VIS.beam2Y;
    const val     = i === 0 ? b1Val : b2Val;
    const ledX    = hRight - 10;
    const baseCol = i === 0 ? [255, 60, 60] : [60, 150, 255];
    const txLabel = i === 0 ? "TX\u2081" : "TX\u2082";

    roundRect(ctx, ledX - 18, beamY - 13, 28, 26, 4);
    ctx.fillStyle = "#16202c"; ctx.fill();
    ctx.strokeStyle = "#2a3a50"; ctx.lineWidth = 1; ctx.stroke();

    ctx.beginPath(); ctx.arc(ledX + 4, beamY, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#18202a"; ctx.fill();
    ctx.strokeStyle = "#303850"; ctx.lineWidth = 1; ctx.stroke();

    const ledAlpha = 0.35 + val * 0.65;
    ctx.beginPath(); ctx.arc(ledX + 4, beamY, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${baseCol[0]},${baseCol[1]},${baseCol[2]},${ledAlpha})`; ctx.fill();

    if (val > 0.4) {
      const halo = ctx.createRadialGradient(ledX + 4, beamY, 0, ledX + 4, beamY, 18);
      halo.addColorStop(0, `rgba(${baseCol[0]},${baseCol[1]},${baseCol[2]},${0.35 * val})`);
      halo.addColorStop(1, `rgba(${baseCol[0]},${baseCol[1]},${baseCol[2]},0)`);
      ctx.beginPath(); ctx.arc(ledX + 4, beamY, 18, 0, Math.PI * 2);
      ctx.fillStyle = halo; ctx.fill();
    }

    ctx.fillStyle = i === 0 ? "#cc4444" : "#4477cc";
    ctx.font = "bold 8px monospace"; ctx.textAlign = "center";
    ctx.fillText(txLabel, ledX - 10, beamY + 3); ctx.textAlign = "left";
  }

  // Clip arms (C-clamp)
  const clipTop = hTop + 16;
  const clipBot = hBot - 16;
  ctx.strokeStyle = "#18242e"; ctx.lineWidth = 8; ctx.lineCap = "square";
  ctx.beginPath(); ctx.moveTo(hRight - 2, clipTop); ctx.lineTo(wL - 6, clipTop); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(wL - 6, clipTop);     ctx.lineTo(wL - 6, clipTop + 24); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hRight - 2, clipBot); ctx.lineTo(wL - 6, clipBot); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(wL - 6, clipBot);     ctx.lineTo(wL - 6, clipBot - 24); ctx.stroke();

  ctx.strokeStyle = "#22344a"; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(hRight - 2, clipTop); ctx.lineTo(wL - 6, clipTop); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(wL - 6, clipTop);     ctx.lineTo(wL - 6, clipTop + 24); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hRight - 2, clipBot); ctx.lineTo(wL - 6, clipBot); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(wL - 6, clipBot);     ctx.lineTo(wL - 6, clipBot - 24); ctx.stroke();

  ctx.strokeStyle = "#2e4860"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(hRight - 2, clipTop - 1); ctx.lineTo(wL - 6, clipTop - 1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hRight - 2, clipBot + 1); ctx.lineTo(wL - 6, clipBot + 1); ctx.stroke();
  ctx.lineCap = "butt";

  // Cable
  ctx.strokeStyle = "#161e2a"; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(hCx - 4, hBot + 10); ctx.bezierCurveTo(hCx - 8, hBot + 40, hLeft + 4, hBot + 60, 0, hBot + 90); ctx.stroke();
  ctx.strokeStyle = "#1e2e3e"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(hCx - 4, hBot + 10); ctx.bezierCurveTo(hCx - 8, hBot + 40, hLeft + 4, hBot + 60, 0, hBot + 90); ctx.stroke();

  // Module label
  ctx.fillStyle = "#4a7a8a"; ctx.font = "bold 9px monospace"; ctx.textAlign = "center";
  ctx.fillText("DRIPITO MODULE", hCx, hTop - 12);
  ctx.fillText("IR SENSOR",      hCx, hTop - 2);
  ctx.textAlign = "left";
}

function drawDripChamber(ctx, fluid, s, interval, drops, b1Val, b2Val) {
  const wL = VIS.chamberLeft - 8;
  const wR = VIS.chamberRight + 8;

  // Chamber walls
  ctx.strokeStyle = "#2a3a4a"; ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(wL, VIS.chamberTop - 5); ctx.lineTo(wL, VIS.chamberBot + 5);
  ctx.moveTo(wR, VIS.chamberTop - 5); ctx.lineTo(wR, VIS.chamberBot + 5);
  ctx.stroke();

  ctx.fillStyle = fluid.color + "0a";
  ctx.fillRect(wL + 2, VIS.chamberTop, wR - wL - 4, VIS.chamberBot - VIS.chamberTop);

  // Nozzle
  ctx.fillStyle = "#445566";
  const nw = 6;
  ctx.fillRect(VIS.chamberX - nw / 2, VIS.chamberTop - 10, nw, VIS.nozzleY - VIS.chamberTop + 12);

  // Forming drop at nozzle
  const tSinceDrop = s.time - s.lastDropTime;
  const prog = Math.min(tSinceDrop / interval, 0.92);
  if (prog > 0.08) {
    const pr = prog * 2.2 * VIS.scale;
    ctx.beginPath();
    ctx.ellipse(VIS.chamberX, VIS.nozzleY + pr * 0.7, pr * 0.65, pr, 0, 0, Math.PI * 2);
    ctx.fillStyle = fluid.color + "bb"; ctx.fill();
    ctx.beginPath();
    ctx.moveTo(VIS.chamberX - 2, VIS.nozzleY);
    ctx.quadraticCurveTo(VIS.chamberX - pr * 0.4, VIS.nozzleY + pr * 0.35, VIS.chamberX - pr * 0.65, VIS.nozzleY + pr * 0.7);
    ctx.moveTo(VIS.chamberX + 2, VIS.nozzleY);
    ctx.quadraticCurveTo(VIS.chamberX + pr * 0.4, VIS.nozzleY + pr * 0.35, VIS.chamberX + pr * 0.65, VIS.nozzleY + pr * 0.7);
    ctx.strokeStyle = fluid.color + "66"; ctx.lineWidth = 1; ctx.stroke();
  }

  // IR beams + RX side
  for (let i = 0; i < 2; i++) {
    const by      = i === 0 ? VIS.beam1Y : VIS.beam2Y;
    const val     = i === 0 ? b1Val : b2Val;
    const baseCol = i === 0 ? [255, 60, 60] : [60, 150, 255];

    ctx.beginPath(); ctx.moveTo(wL - 1, by); ctx.lineTo(wR + 1, by);
    ctx.strokeStyle = `rgba(${baseCol[0]},${baseCol[1]},${baseCol[2]},${0.12 + val * 0.55})`;
    ctx.lineWidth = val < 0.8 ? 3 : 2; ctx.stroke();

    if (val < 0.7) {
      ctx.beginPath(); ctx.moveTo(wL - 1, by); ctx.lineTo(wR + 1, by);
      ctx.strokeStyle = `rgba(${baseCol[0]},${baseCol[1]},${baseCol[2]},${(1 - val) * 0.3})`;
      ctx.lineWidth = 6; ctx.stroke();
    }

    ctx.fillStyle = i === 0 ? "#551818" : "#182855";
    ctx.fillRect(wR + 2, by - 6, 22, 12);
    ctx.strokeStyle = i === 0 ? "#7a2a2a" : "#2a4a7a"; ctx.lineWidth = 0.8;
    ctx.strokeRect(wR + 2, by - 6, 22, 12);

    ctx.beginPath(); ctx.arc(wR + 6, by, 3, 0, Math.PI * 2);
    ctx.fillStyle = i === 0 ? "#2a0808" : "#081828"; ctx.fill();

    ctx.fillStyle = i === 0 ? "#ff5555" : "#5599ff";
    ctx.font = "bold 9px monospace";
    ctx.fillText(i === 0 ? "RX\u2081" : "RX\u2082", wR + 28, by + 3);
  }

  // Δh annotation
  const midBy = (VIS.beam1Y + VIS.beam2Y) / 2;
  ctx.strokeStyle = "#445566"; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(wR + 54, VIS.beam1Y); ctx.lineTo(wR + 66, VIS.beam1Y);
  ctx.moveTo(wR + 54, VIS.beam2Y); ctx.lineTo(wR + 66, VIS.beam2Y);
  ctx.moveTo(wR + 60, VIS.beam1Y + 4); ctx.lineTo(wR + 60, VIS.beam2Y - 4);
  ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = "#88aacc"; ctx.font = "bold 9px monospace"; ctx.textAlign = "center";
  ctx.fillText("\u0394h", wR + 60, midBy - 2);
  ctx.fillText(SIM.beamGap_mm + "mm", wR + 60, midBy + 10);
  ctx.textAlign = "left";

  // Falling drops
  for (const drop of drops) {
    if (!drop.active) continue;
    const ft     = s.time - drop.detachTime;
    const oscVal = drop.oscAmp * Math.sin(2 * Math.PI * drop.oscFreq * ft + drop.oscPhase) * Math.exp(-drop.oscDecay * ft);
    const pixRH  = (drop.trueDia * (1 + oscVal) / 2) * VIS.scale;
    const pixRV  = (drop.trueDia * (1 - oscVal * 0.5) / 2) * VIS.scale;
    const pixY   = VIS.chamberTop + drop.y_mm * VIS.scale;

    ctx.beginPath(); ctx.ellipse(VIS.chamberX, pixY + 1, pixRH + 1, pixRV + 1, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fill();

    ctx.beginPath(); ctx.ellipse(VIS.chamberX, pixY, pixRH, pixRV, 0, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(
      VIS.chamberX - pixRH * 0.3, pixY - pixRV * 0.3, 0,
      VIS.chamberX, pixY, Math.max(pixRH, pixRV)
    );
    grad.addColorStop(0, fluid.color + "ff");
    grad.addColorStop(0.6, fluid.color + "cc");
    grad.addColorStop(1, fluid.color + "88");
    ctx.fillStyle = grad; ctx.fill();
    ctx.strokeStyle = fluid.color + "44"; ctx.lineWidth = 0.5; ctx.stroke();

    ctx.beginPath(); ctx.ellipse(VIS.chamberX - pixRH * 0.25, pixY - pixRV * 0.25, pixRH * 0.25, pixRV * 0.2, -0.4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.2)"; ctx.fill();
  }

  // Pool + outlet tube
  ctx.fillStyle = fluid.color + "30";
  ctx.fillRect(wL + 2, VIS.chamberBot - 18, wR - wL - 4, 18);
  ctx.fillStyle = "#445566";
  ctx.fillRect(VIS.chamberX - 3, VIS.chamberBot, 6, 25);

  // Chamber label
  ctx.fillStyle = "#5a8899"; ctx.font = "bold 10px monospace"; ctx.textAlign = "center";
  ctx.fillText("DRIP CHAMBER", VIS.chamberX, VIS.chamberTop - 18);
  ctx.textAlign = "left";
}

export function drawChamberCanvas(ctx, CW, CH, s, fluid, interval, drops, b1Val, b2Val) {
  ctx.clearRect(0, 0, CW, CH);
  ctx.fillStyle = "#080c11";
  ctx.fillRect(0, 0, CW, CH);

  drawSensorModule(ctx, b1Val, b2Val);
  drawDripChamber(ctx, fluid, s, interval, drops, b1Val, b2Val);
}
