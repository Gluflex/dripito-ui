import { useState, useEffect, useRef, useCallback } from "react";

const SIM = {
  nozzleY_mm: 0,
  beam1Y_mm: 25,
  beam2Y_mm: 35,
  chamberBottom_mm: 60,
  chamberWidth_mm: 22,
  g: 9810,
  beamGap_mm: 10,
};

const VIS = {
  scale: 6.0,
  chamberX: 260,
  chamberTop: 50,
  get nozzleY()    { return this.chamberTop + SIM.nozzleY_mm * this.scale; },
  get beam1Y()     { return this.chamberTop + SIM.beam1Y_mm * this.scale; },
  get beam2Y()     { return this.chamberTop + SIM.beam2Y_mm * this.scale; },
  get chamberBot() { return this.chamberTop + SIM.chamberBottom_mm * this.scale; },
  get chamberLeft(){ return this.chamberX - (SIM.chamberWidth_mm / 2) * this.scale; },
  get chamberRight(){ return this.chamberX + (SIM.chamberWidth_mm / 2) * this.scale; },
};

const TIME_SCALE = 0.15;

function rayleighFreq(gamma_mNm, rho_kgm3, R_mm) {
  const gamma = gamma_mNm * 1e-3;
  const R = R_mm * 1e-3;
  return (1 / (2 * Math.PI)) * Math.sqrt((8 * gamma) / (rho_kgm3 * R * R * R));
}

function sphereVolume(d_mm) {
  return (Math.PI / 6) * d_mm * d_mm * d_mm;
}

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

const FLUIDS = {
  nacl:  { name: "NaCl 0.9%",          gamma: 72.0, rho: 1005, color: "#a8d8ea", nozzleDia: 4.0 },
  ringer:{ name: "Ringer's Lactate",    gamma: 71.5, rho: 1005, color: "#b8e6c8", nozzleDia: 4.0 },
  d5w:   { name: "D5W (5% Dextrose)",   gamma: 68.0, rho: 1020, color: "#f5e6a3", nozzleDia: 4.0 },
  d10w:  { name: "D10W (10% Dextrose)", gamma: 64.0, rho: 1040, color: "#f0d080", nozzleDia: 4.0 },
};

export default function DripitoSim({ onDrop }) {
  const canvasRef     = useRef(null);
  const scopeCanvasRef = useRef(null);
  const animRef        = useRef(null);
  const onDropRef      = useRef(onDrop);
  useEffect(() => { onDropRef.current = onDrop; }, [onDrop]);

  const [fluidType, setFluidType] = useState("nacl");
  const [dropRate,  setDropRate]  = useState(1.5);
  const [isRunning, setIsRunning] = useState(true);
  const [display, setDisplay] = useState({
    phase: "calibrating", dropCount: 0,
    avgVolume: 0, avgDiameter: 0, avgGttMl: 0,
    last: null, measurements: [],
  });

  const sim = useRef({
    drops: [], time: 0, lastDropTime: -10,
    scope1: new Float32Array(1200).fill(1),
    scope2: new Float32Array(1200).fill(1),
    scopeIdx: 0,
    measurements: [], dropCount: 0,
    avgVolume: 0, avgDiameter: 0, phase: "calibrating",
  });

  useEffect(() => {
    const s = sim.current;
    s.drops = []; s.time = 0; s.lastDropTime = -10;
    s.scope1 = new Float32Array(1200).fill(1);
    s.scope2 = new Float32Array(1200).fill(1);
    s.scopeIdx = 0;
    s.measurements = []; s.dropCount = 0;
    s.avgVolume = 0; s.avgDiameter = 0; s.phase = "calibrating";
    setDisplay({ phase: "calibrating", dropCount: 0, avgVolume: 0, avgDiameter: 0, avgGttMl: 0, last: null, measurements: [] });
  }, [fluidType]);

  const makeDrop = useCallback(() => {
    const f = FLUIDS[fluidType];
    const vol = (Math.PI * f.nozzleDia * (f.gamma * 1e-3) * 0.6) / ((f.rho * 1e-9) * SIM.g);
    const v = vol * (1 + (Math.random() - 0.5) * 0.02);
    const d = Math.pow((6 * v) / Math.PI, 1 / 3);
    const oscF = rayleighFreq(f.gamma, f.rho, d / 2);
    return {
      y_mm: SIM.nozzleY_mm, vy: 0,
      trueDia: d, trueVol: v,
      oscFreq: oscF, oscPhase: Math.random() * Math.PI * 2,
      oscAmp: 0.15, oscDecay: 2.5,
      detachTime: sim.current.time,
      b1Hit: false, b2Hit: false,
      b1TimeFirst: 0, b2TimeFirst: 0,
      b1OccStart: 0, b1OccEnd: 0,
      b2OccStart: 0, b2OccEnd: 0,
      measured: false, active: true,
    };
  }, [fluidType]);

  useEffect(() => {
    const canvas     = canvasRef.current;
    const scopeCanvas = scopeCanvasRef.current;
    if (!canvas || !scopeCanvas) return;

    const ctx  = canvas.getContext("2d");
    const sctx = scopeCanvas.getContext("2d");
    const dpr  = window.devicePixelRatio || 1;

    const CW = 520, CH = 460, SW = 640, SHt = 280;
    canvas.width  = CW * dpr; canvas.height  = CH * dpr;
    scopeCanvas.width = SW * dpr; scopeCanvas.height = SHt * dpr;
    ctx.scale(dpr, dpr); sctx.scale(dpr, dpr);

    const frameDt = 1 / 60;

    function tick() {
      if (!isRunning) { animRef.current = requestAnimationFrame(tick); return; }

      const s      = sim.current;
      const simDt  = frameDt * TIME_SCALE;
      s.time      += simDt;
      const fluid  = FLUIDS[fluidType];
      const interval = 1 / dropRate;

      if (s.time - s.lastDropTime >= interval) {
        s.drops.push(makeDrop());
        s.lastDropTime = s.time;
      }

      let b1Val = 1.0, b2Val = 1.0;

      for (const drop of s.drops) {
        if (!drop.active) continue;

        drop.vy    += SIM.g * simDt;
        drop.y_mm  += drop.vy * simDt;

        const ft  = s.time - drop.detachTime;
        const osc = drop.oscAmp * Math.sin(2 * Math.PI * drop.oscFreq * ft + drop.oscPhase) * Math.exp(-drop.oscDecay * ft);
        const dH = drop.trueDia * (1 + osc);
        const dV = drop.trueDia * (1 - osc * 0.5);
        const rH = dH / 2, rV = dV / 2;

        for (let bi = 0; bi < 2; bi++) {
          const beamY  = bi === 0 ? SIM.beam1Y_mm : SIM.beam2Y_mm;
          const dropTop = drop.y_mm - rV;
          const dropBot = drop.y_mm + rV;

          if (dropTop < beamY + 0.3 && dropBot > beamY - 0.3) {
            const dist = Math.abs(drop.y_mm - beamY);
            const norm = Math.min(dist / rV, 1);
            const chord = norm < 1 ? 2 * rH * Math.sqrt(1 - norm * norm) : 0;
            const occ  = Math.min(chord / SIM.chamberWidth_mm, 0.9);

            if (bi === 0) {
              b1Val = Math.min(b1Val, 1 - occ);
              if (!drop.b1Hit && occ > 0.02) { drop.b1Hit = true; drop.b1TimeFirst = s.time; drop.b1OccStart = s.time; }
              if (drop.b1Hit && occ > 0.02) drop.b1OccEnd = s.time;
            } else {
              b2Val = Math.min(b2Val, 1 - occ);
              if (!drop.b2Hit && occ > 0.02) { drop.b2Hit = true; drop.b2TimeFirst = s.time; drop.b2OccStart = s.time; }
              if (drop.b2Hit && occ > 0.02) drop.b2OccEnd = s.time;
            }
          }

          if (bi === 1 && drop.b2Hit && !drop.measured && drop.y_mm - rV > SIM.beam2Y_mm + 2) {
            if (drop.b1Hit && drop.b1OccEnd > drop.b1OccStart && drop.b2OccEnd > drop.b2OccStart) {
              drop.measured = true;
              const dt_transit = drop.b2TimeFirst - drop.b1TimeFirst;
              if (dt_transit > 1e-6) {
                const dh   = SIM.beamGap_mm;
                const v1   = (dh - 0.5 * SIM.g * dt_transit * dt_transit) / dt_transit;
                const v2   = v1 + SIM.g * dt_transit;
                const occ1 = drop.b1OccEnd - drop.b1OccStart;
                const occ2 = drop.b2OccEnd - drop.b2OccStart;
                const d1   = Math.abs(v1) * occ1;
                const d2   = Math.abs(v2) * occ2;
                const dAvg = (d1 + d2) / 2;
                const vEst = sphereVolume(dAvg);

                s.dropCount++;
                onDropRef.current?.();
                const meas = {
                  idx: s.dropCount, dt: dt_transit * 1000,
                  v1: v1 / 1000, v2: v2 / 1000,
                  occ1: occ1 * 1000, occ2: occ2 * 1000,
                  d1, d2, dAvg, vEst,
                  trueVol: drop.trueVol, trueDia: drop.trueDia,
                  err: ((vEst - drop.trueVol) / drop.trueVol) * 100,
                };
                s.measurements.push(meas);
                if (s.measurements.length > 30) s.measurements = s.measurements.slice(-30);
                const recent = s.measurements.slice(-10);
                s.avgVolume   = recent.reduce((a, b) => a + b.vEst, 0) / recent.length;
                s.avgDiameter = recent.reduce((a, b) => a + b.dAvg, 0) / recent.length;
                if (s.dropCount >= 10) s.phase = "calibrated";

                setDisplay({
                  phase: s.phase, dropCount: s.dropCount,
                  avgVolume: s.avgVolume, avgDiameter: s.avgDiameter,
                  avgGttMl: s.avgVolume > 0 ? 1000 / s.avgVolume : 0,
                  last: meas, measurements: [...s.measurements],
                });
              }
            }
          }
        }

        if (drop.y_mm > SIM.chamberBottom_mm + 10) drop.active = false;
      }

      s.drops = s.drops.filter(d => d.active);
      s.scope1[s.scopeIdx % 1200] = b1Val;
      s.scope2[s.scopeIdx % 1200] = b2Val;
      s.scopeIdx++;

      // ─── Clear ────────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, CW, CH);
      ctx.fillStyle = "#080c11";
      ctx.fillRect(0, 0, CW, CH);

      const wL = VIS.chamberLeft - 8;
      const wR = VIS.chamberRight + 8;

      // ─── SENSOR MODULE (holder, left of chamber) ──────────────────────────
      const hLeft  = 14;
      const hRight = 150;
      const hTop   = VIS.chamberTop - 26;
      const hBot   = VIS.chamberBot + 26;
      const hCx    = (hLeft + hRight) / 2;

      // Housing body
      roundRect(ctx, hLeft, hTop, hRight - hLeft, hBot - hTop, 10);
      ctx.fillStyle = "#0d141e";
      ctx.fill();
      roundRect(ctx, hLeft, hTop, hRight - hLeft, hBot - hTop, 10);
      ctx.strokeStyle = "#253848";
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // PCB substrate
      ctx.fillStyle = "#060e07";
      ctx.fillRect(hLeft + 7, hTop + 7, hRight - hLeft - 14, hBot - hTop - 14);

      // PCB horizontal traces
      ctx.strokeStyle = "#0c1e0e";
      ctx.lineWidth = 0.5;
      for (let y = hTop + 20; y < hBot - 6; y += 13) {
        ctx.beginPath();
        ctx.moveTo(hLeft + 8, y);
        ctx.lineTo(hRight - 8, y);
        ctx.stroke();
      }
      // PCB vias
      ctx.fillStyle = "#1a3a1a";
      for (let y = hTop + 28; y < hBot - 20; y += 32) {
        for (let x = hLeft + 16; x < hRight - 20; x += 18) {
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // MCU chip
      const chipX = hLeft + 10, chipY = hTop + 36;
      ctx.fillStyle = "#0a0e12";
      ctx.fillRect(chipX, chipY, 36, 22);
      ctx.strokeStyle = "#1e2e3e";
      ctx.lineWidth = 0.8;
      ctx.strokeRect(chipX, chipY, 36, 22);
      ctx.strokeStyle = "#2a4038";
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath(); ctx.moveTo(chipX + 5 + i * 6, chipY - 2);
        ctx.lineTo(chipX + 5 + i * 6, chipY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(chipX + 5 + i * 6, chipY + 22);
        ctx.lineTo(chipX + 5 + i * 6, chipY + 24); ctx.stroke();
      }
      ctx.fillStyle = "#1a2a2a";
      ctx.font = "5.5px monospace";
      ctx.fillText("STM32", chipX + 3, chipY + 11);
      ctx.fillText("G030", chipX + 5, chipY + 18);

      // Bottom connector block
      ctx.fillStyle = "#161e2c";
      ctx.fillRect(hCx - 14, hBot - 9, 28, 14);
      ctx.strokeStyle = "#263848";
      ctx.lineWidth = 1;
      ctx.strokeRect(hCx - 14, hBot - 9, 28, 14);
      // connector pins (gold)
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = "#8a9a6a";
        ctx.fillRect(hCx - 9 + i * 6, hBot + 3, 3, 9);
      }

      // LED emitter modules on right edge of housing
      for (let i = 0; i < 2; i++) {
        const beamY  = i === 0 ? VIS.beam1Y : VIS.beam2Y;
        const val    = i === 0 ? b1Val : b2Val;
        const ledX   = hRight - 10;
        const baseCol = i === 0 ? [255, 60, 60] : [60, 150, 255];
        const txLabel = i === 0 ? "TX\u2081" : "TX\u2082";

        // LED mount plate
        roundRect(ctx, ledX - 18, beamY - 13, 28, 26, 4);
        ctx.fillStyle = "#16202c";
        ctx.fill();
        ctx.strokeStyle = "#2a3a50";
        ctx.lineWidth = 1;
        ctx.stroke();

        // LED barrel housing
        ctx.beginPath();
        ctx.arc(ledX + 4, beamY, 7, 0, Math.PI * 2);
        ctx.fillStyle = "#18202a";
        ctx.fill();
        ctx.strokeStyle = "#303850";
        ctx.lineWidth = 1;
        ctx.stroke();

        // LED lens
        const ledAlpha = 0.35 + val * 0.65;
        ctx.beginPath();
        ctx.arc(ledX + 4, beamY, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${baseCol[0]},${baseCol[1]},${baseCol[2]},${ledAlpha})`;
        ctx.fill();

        // Glow halo
        if (val > 0.4) {
          const halo = ctx.createRadialGradient(ledX + 4, beamY, 0, ledX + 4, beamY, 18);
          halo.addColorStop(0, `rgba(${baseCol[0]},${baseCol[1]},${baseCol[2]},${0.35 * val})`);
          halo.addColorStop(1, `rgba(${baseCol[0]},${baseCol[1]},${baseCol[2]},0)`);
          ctx.beginPath();
          ctx.arc(ledX + 4, beamY, 18, 0, Math.PI * 2);
          ctx.fillStyle = halo;
          ctx.fill();
        }

        // TX label
        ctx.fillStyle = i === 0 ? "#cc4444" : "#4477cc";
        ctx.font = "bold 8px monospace";
        ctx.textAlign = "center";
        ctx.fillText(txLabel, ledX - 10, beamY + 3);
        ctx.textAlign = "left";
      }

      // Clip arms (C-clamp connecting housing to chamber left wall)
      const clipTop = hTop + 16;
      const clipBot = hBot - 16;

      // Dark outer stroke
      ctx.strokeStyle = "#18242e";
      ctx.lineWidth = 8;
      ctx.lineCap = "square";
      ctx.beginPath(); ctx.moveTo(hRight - 2, clipTop); ctx.lineTo(wL - 6, clipTop); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(wL - 6, clipTop);     ctx.lineTo(wL - 6, clipTop + 24); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hRight - 2, clipBot); ctx.lineTo(wL - 6, clipBot); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(wL - 6, clipBot);     ctx.lineTo(wL - 6, clipBot - 24); ctx.stroke();

      // Mid fill
      ctx.strokeStyle = "#22344a";
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(hRight - 2, clipTop); ctx.lineTo(wL - 6, clipTop); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(wL - 6, clipTop);     ctx.lineTo(wL - 6, clipTop + 24); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hRight - 2, clipBot); ctx.lineTo(wL - 6, clipBot); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(wL - 6, clipBot);     ctx.lineTo(wL - 6, clipBot - 24); ctx.stroke();

      // Highlight shimmer
      ctx.strokeStyle = "#2e4860";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(hRight - 2, clipTop - 1); ctx.lineTo(wL - 6, clipTop - 1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hRight - 2, clipBot + 1); ctx.lineTo(wL - 6, clipBot + 1); ctx.stroke();

      ctx.lineCap = "butt";

      // Cable out from bottom-left
      ctx.strokeStyle = "#161e2a";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(hCx - 4, hBot + 10);
      ctx.bezierCurveTo(hCx - 8, hBot + 40, hLeft + 4, hBot + 60, 0, hBot + 90);
      ctx.stroke();
      // Cable sheath highlight
      ctx.strokeStyle = "#1e2e3e";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(hCx - 4, hBot + 10);
      ctx.bezierCurveTo(hCx - 8, hBot + 40, hLeft + 4, hBot + 60, 0, hBot + 90);
      ctx.stroke();

      // Module label at top
      ctx.fillStyle = "#4a7a8a";
      ctx.font      = "bold 9px monospace";
      ctx.textAlign = "center";
      ctx.fillText("DRIPITO MODULE", hCx, hTop - 12);
      ctx.fillText("IR SENSOR", hCx, hTop - 2);
      ctx.textAlign = "left";

      // ─── DRIP CHAMBER ─────────────────────────────────────────────────────
      ctx.strokeStyle = "#2a3a4a";
      ctx.lineWidth = 2.5;
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
        ctx.fillStyle = fluid.color + "bb";
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(VIS.chamberX - 2, VIS.nozzleY);
        ctx.quadraticCurveTo(VIS.chamberX - pr * 0.4, VIS.nozzleY + pr * 0.35, VIS.chamberX - pr * 0.65, VIS.nozzleY + pr * 0.7);
        ctx.moveTo(VIS.chamberX + 2, VIS.nozzleY);
        ctx.quadraticCurveTo(VIS.chamberX + pr * 0.4, VIS.nozzleY + pr * 0.35, VIS.chamberX + pr * 0.65, VIS.nozzleY + pr * 0.7);
        ctx.strokeStyle = fluid.color + "66";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // IR beams + RX side
      for (let i = 0; i < 2; i++) {
        const by      = i === 0 ? VIS.beam1Y : VIS.beam2Y;
        const val     = i === 0 ? b1Val : b2Val;
        const baseCol = i === 0 ? [255, 60, 60] : [60, 150, 255];

        // Beam
        ctx.beginPath();
        ctx.moveTo(wL - 1, by); ctx.lineTo(wR + 1, by);
        ctx.strokeStyle = `rgba(${baseCol[0]},${baseCol[1]},${baseCol[2]},${0.12 + val * 0.55})`;
        ctx.lineWidth = val < 0.8 ? 3 : 2;
        ctx.stroke();

        if (val < 0.7) {
          ctx.beginPath();
          ctx.moveTo(wL - 1, by); ctx.lineTo(wR + 1, by);
          ctx.strokeStyle = `rgba(${baseCol[0]},${baseCol[1]},${baseCol[2]},${(1 - val) * 0.3})`;
          ctx.lineWidth = 6;
          ctx.stroke();
        }

        // RX housing (right side)
        ctx.fillStyle = i === 0 ? "#551818" : "#182855";
        ctx.fillRect(wR + 2, by - 6, 22, 12);
        ctx.strokeStyle = i === 0 ? "#7a2a2a" : "#2a4a7a";
        ctx.lineWidth = 0.8;
        ctx.strokeRect(wR + 2, by - 6, 22, 12);

        // RX photodiode
        ctx.beginPath();
        ctx.arc(wR + 6, by, 3, 0, Math.PI * 2);
        ctx.fillStyle = i === 0 ? "#2a0808" : "#081828";
        ctx.fill();

        // RX label
        ctx.fillStyle = i === 0 ? "#ff5555" : "#5599ff";
        ctx.font = "bold 9px monospace";
        ctx.fillText(i === 0 ? "RX\u2081" : "RX\u2082", wR + 28, by + 3);
      }

      // Δh annotation
      const midBy = (VIS.beam1Y + VIS.beam2Y) / 2;
      ctx.strokeStyle = "#445566";
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(wR + 54, VIS.beam1Y); ctx.lineTo(wR + 66, VIS.beam1Y);
      ctx.moveTo(wR + 54, VIS.beam2Y); ctx.lineTo(wR + 66, VIS.beam2Y);
      ctx.moveTo(wR + 60, VIS.beam1Y + 4); ctx.lineTo(wR + 60, VIS.beam2Y - 4);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#88aacc";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "center";
      ctx.fillText("\u0394h", wR + 60, midBy - 2);
      ctx.fillText(SIM.beamGap_mm + "mm", wR + 60, midBy + 10);
      ctx.textAlign = "left";

      // Falling drops
      for (const drop of s.drops) {
        if (!drop.active) continue;
        const ft     = s.time - drop.detachTime;
        const oscVal = drop.oscAmp * Math.sin(2 * Math.PI * drop.oscFreq * ft + drop.oscPhase) * Math.exp(-drop.oscDecay * ft);
        const pixRH  = (drop.trueDia * (1 + oscVal) / 2) * VIS.scale;
        const pixRV  = (drop.trueDia * (1 - oscVal * 0.5) / 2) * VIS.scale;
        const pixY   = VIS.chamberTop + drop.y_mm * VIS.scale;

        ctx.beginPath();
        ctx.ellipse(VIS.chamberX, pixY + 1, pixRH + 1, pixRV + 1, 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.fill();

        ctx.beginPath();
        ctx.ellipse(VIS.chamberX, pixY, pixRH, pixRV, 0, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(
          VIS.chamberX - pixRH * 0.3, pixY - pixRV * 0.3, 0,
          VIS.chamberX, pixY, Math.max(pixRH, pixRV)
        );
        grad.addColorStop(0, fluid.color + "ff");
        grad.addColorStop(0.6, fluid.color + "cc");
        grad.addColorStop(1, fluid.color + "88");
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = fluid.color + "44";
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Specular highlight
        ctx.beginPath();
        ctx.ellipse(VIS.chamberX - pixRH * 0.25, pixY - pixRV * 0.25, pixRH * 0.25, pixRV * 0.2, -0.4, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.fill();
      }

      // Chamber bottom pool + outlet tube
      ctx.fillStyle = fluid.color + "30";
      ctx.fillRect(wL + 2, VIS.chamberBot - 18, wR - wL - 4, 18);
      ctx.fillStyle = "#445566";
      ctx.fillRect(VIS.chamberX - 3, VIS.chamberBot, 6, 25);

      // Chamber label
      ctx.fillStyle = "#5a8899";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.fillText("DRIP CHAMBER", VIS.chamberX, VIS.chamberTop - 18);
      ctx.textAlign = "left";

      // ─── SCOPE ────────────────────────────────────────────────────────────
      sctx.clearRect(0, 0, SW, SHt);
      sctx.fillStyle = "#060a0e";
      sctx.fillRect(0, 0, SW, SHt);

      const mg = { l: 52, r: 16, t: 30, b: 30 };
      const pw = SW - mg.l - mg.r;
      const ph = SHt - mg.t - mg.b;

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

      sctx.fillStyle = "#3a5566";
      sctx.font = "9px monospace";
      sctx.fillText("1.0", mg.l - 28, mg.t + 4);
      sctx.fillText("0.5", mg.l - 28, mg.t + ph / 2 + 3);
      sctx.fillText("0.0", mg.l - 28, mg.t + ph + 4);
      sctx.textAlign = "center";
      sctx.fillText("V/Vmax", mg.l - 10, mg.t - 10);
      sctx.fillText("Time \u2192", mg.l + pw / 2, SHt - 6);
      sctx.textAlign = "left";

      const len  = 1200;
      const head = s.scopeIdx;

      function drawSig(data, color) {
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

      drawSig(s.scope1, "#ff3333");
      drawSig(s.scope2, "#3388ff");

      sctx.strokeStyle = "#2a3a4a";
      sctx.lineWidth = 1;
      sctx.strokeRect(mg.l, mg.t, pw, ph);

      sctx.fillStyle = "#ff4444";
      sctx.fillRect(mg.l + pw - 120, mg.t + 6, 10, 2);
      sctx.fillStyle = "#ff6666";
      sctx.font = "bold 9px monospace";
      sctx.fillText("CH1 Beam 1", mg.l + pw - 106, mg.t + 10);
      sctx.fillStyle = "#3388ff";
      sctx.fillRect(mg.l + pw - 120, mg.t + 20, 10, 2);
      sctx.fillStyle = "#5599ff";
      sctx.fillText("CH2 Beam 2", mg.l + pw - 106, mg.t + 24);

      sctx.fillStyle = "#5a8899";
      sctx.font = "bold 10px monospace";
      sctx.textAlign = "center";
      sctx.fillText("OSCILLOSCOPE \u2014 PHOTODIODE OUTPUT", SW / 2, 16);
      sctx.textAlign = "left";

      animRef.current = requestAnimationFrame(tick);
    }

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [isRunning, fluidType, dropRate, makeDrop]);

  const d = display;

  return (
    <div style={{
      background: "#050810", color: "#b0c4d4",
      fontFamily: "'SF Mono','Fira Code','Consolas',monospace",
      padding: "14px", display: "flex", flexDirection: "column", gap: "10px",
    }}>
      {/* Sub-header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #1a2530", paddingBottom: "8px" }}>
        <div>
          <h2 style={{ fontSize: "14px", fontWeight: 700, color: "#6aacbc", margin: 0, letterSpacing: "1.4px" }}>
            DUAL-BEAM DROP VOLUME ESTIMATOR
          </h2>
          <p style={{ fontSize: "9px", color: "#3a5566", margin: "2px 0 0 0" }}>
            Physics simulation · Auto-calibration · \u0394h = {SIM.beamGap_mm} mm
          </p>
        </div>
        <button onClick={() => setIsRunning(r => !r)} style={{
          background: isRunning ? "#0f1a0f" : "#1a0f0f",
          border: `1px solid ${isRunning ? "#2a5a2a" : "#5a2a2a"}`,
          color: isRunning ? "#55bb55" : "#bb5555",
          padding: "5px 14px", borderRadius: "3px", cursor: "pointer",
          fontFamily: "inherit", fontSize: "11px", fontWeight: 600,
        }}>
          {isRunning ? "\u23F8 PAUSE" : "\u25B6 RUN"}
        </button>
      </div>

      {/* Controls row */}
      <div style={{
        display: "flex", gap: "18px", alignItems: "center", flexWrap: "wrap",
        background: "#0a0e14", padding: "8px 12px", borderRadius: "4px", border: "1px solid #151e28",
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          <label style={{ fontSize: "8px", color: "#3a5566", textTransform: "uppercase", letterSpacing: "1px" }}>Fluid</label>
          <select value={fluidType} onChange={e => setFluidType(e.target.value)} style={{
            background: "#0e1520", border: "1px solid #1e2e3e", color: "#8ab0c8",
            padding: "3px 6px", borderRadius: "2px", fontFamily: "inherit", fontSize: "10px",
          }}>
            {Object.entries(FLUIDS).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          <label style={{ fontSize: "8px", color: "#3a5566", textTransform: "uppercase", letterSpacing: "1px" }}>
            Rate: {dropRate.toFixed(1)} gtt/s
          </label>
          <input type="range" min="0.5" max="4" step="0.25" value={dropRate}
            onChange={e => setDropRate(parseFloat(e.target.value))}
            style={{ width: "100px", accentColor: "#6aacbc" }} />
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: "6px", padding: "4px 10px", marginLeft: "auto",
          background: d.phase === "calibrated" ? "#0a180a" : "#18150a",
          border: `1px solid ${d.phase === "calibrated" ? "#1e4a1e" : "#4a3a1e"}`,
          borderRadius: "3px",
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: "50%",
            background: d.phase === "calibrated" ? "#44bb44" : "#bbaa22",
            boxShadow: `0 0 5px ${d.phase === "calibrated" ? "#44bb44" : "#bbaa22"}`,
          }} />
          <span style={{ fontSize: "10px", fontWeight: 600, color: d.phase === "calibrated" ? "#55cc55" : "#ccaa33" }}>
            {d.phase === "calibrated" ? `CALIBRATED \u00B7 ${d.dropCount} drops` : `CALIBRATING ${d.dropCount}/10`}
          </span>
        </div>
      </div>

      {/* Main canvas + panels */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        {/* Chamber canvas */}
        <div style={{ background: "#0a0e14", border: "1px solid #151e28", borderRadius: "4px", padding: "6px", flexShrink: 0 }}>
          <canvas ref={canvasRef} style={{ width: 520, height: 460, display: "block" }} />
        </div>

        {/* Right panels */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "10px", minWidth: "280px" }}>
          {/* Scope */}
          <div style={{ background: "#0a0e14", border: "1px solid #151e28", borderRadius: "4px", padding: "6px" }}>
            <canvas ref={scopeCanvasRef} style={{ width: 640, height: 280, display: "block", maxWidth: "100%" }} />
          </div>

          {/* Kinematics panel */}
          <div style={{ background: "#0a0e14", border: "1px solid #151e28", borderRadius: "4px", padding: "12px" }}>
            <h3 style={{ fontSize: "10px", color: "#6aacbc", margin: "0 0 8px 0", letterSpacing: "1.2px", textTransform: "uppercase" }}>
              Kinematics &amp; Volume Estimation
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div style={{ background: "#070b10", borderRadius: "3px", padding: "8px", border: "1px solid #121c28" }}>
                <div style={{ fontSize: "8px", color: "#3a5566", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "1px" }}>Method</div>
                <div style={{ fontSize: "11px", color: "#7799aa", lineHeight: 1.9 }}>
                  <div><span style={{ color: "#445566" }}>1.</span> \u0394h = v\u2081\u00B7\u0394t + \u00BDg\u00B7\u0394t\u00B2</div>
                  <div style={{ color: "#55bb88" }}><span style={{ color: "#445566" }}>2.</span> v\u2081 = (\u0394h \u2212 \u00BDg\u00B7\u0394t\u00B2) / \u0394t</div>
                  <div><span style={{ color: "#445566" }}>3.</span> v\u2082 = v\u2081 + g\u00B7\u0394t</div>
                  <div style={{ color: "#ddaa44" }}><span style={{ color: "#445566" }}>4.</span> d = v \u00B7 t_occ</div>
                  <div style={{ color: "#ee6688" }}><span style={{ color: "#445566" }}>5.</span> V = \u03C0/6 \u00B7 d\u00B3</div>
                </div>
              </div>
              <div style={{ background: "#070b10", borderRadius: "3px", padding: "8px", border: "1px solid #121c28" }}>
                <div style={{ fontSize: "8px", color: "#3a5566", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "1px" }}>Last Drop</div>
                {d.last ? (
                  <div style={{ fontSize: "11px", lineHeight: 1.9 }}>
                    <div><span style={{ color: "#3a5566" }}>\u0394t = </span><span style={{ color: "#88aacc" }}>{d.last.dt.toFixed(2)} ms</span></div>
                    <div><span style={{ color: "#3a5566" }}>v\u2081 = </span><span style={{ color: "#55bb88" }}>{d.last.v1.toFixed(3)} m/s</span></div>
                    <div><span style={{ color: "#3a5566" }}>d = </span><span style={{ color: "#ddaa44" }}>{d.last.dAvg.toFixed(2)} mm</span></div>
                    <div><span style={{ color: "#3a5566" }}>V = </span><span style={{ color: "#ee6688" }}>{d.last.vEst.toFixed(2)} \u00B5L</span>
                      <span style={{ color: "#3a5566", fontSize: "9px" }}> (true: {d.last.trueVol.toFixed(2)})</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: "11px", color: "#334455" }}>Waiting for first drop...</div>
                )}
              </div>
            </div>

            {d.phase === "calibrated" && (
              <div style={{
                marginTop: "10px", background: "#081208", border: "1px solid #1a3a1a",
                borderRadius: "3px", padding: "10px",
                display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px",
              }}>
                {[
                  ["Avg Volume",   d.avgVolume.toFixed(2) + " \u00B5L"],
                  ["Avg Diameter", d.avgDiameter.toFixed(2) + " mm"],
                  ["Est. gtt/mL",  d.avgGttMl > 0 ? d.avgGttMl.toFixed(1) : "\u2014"],
                ].map(([label, val]) => (
                  <div key={label}>
                    <div style={{ fontSize: "8px", color: "#2a5a2a", textTransform: "uppercase", letterSpacing: "1px" }}>{label}</div>
                    <div style={{ fontSize: "15px", fontWeight: 700, color: "#44cc44" }}>{val}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Measurement log */}
          {d.measurements.length > 0 && (
            <div style={{
              background: "#0a0e14", border: "1px solid #151e28", borderRadius: "4px",
              padding: "10px", maxHeight: "170px", overflowY: "auto",
            }}>
              <h3 style={{ fontSize: "10px", color: "#6aacbc", margin: "0 0 6px 0", letterSpacing: "1.2px", textTransform: "uppercase" }}>
                Measurement Log
              </h3>
              <table style={{ width: "100%", fontSize: "9px", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ color: "#3a5566" }}>
                    {["#", "\u0394t ms", "v\u2081 m/s", "d mm", "V \u00B5L", "True \u00B5L", "Err"].map(h => (
                      <th key={h} style={{ textAlign: h === "#" ? "left" : "right", padding: "2px 4px", borderBottom: "1px solid #151e28" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {d.measurements.slice(-8).reverse().map(m => (
                    <tr key={m.idx} style={{ color: "#7799aa" }}>
                      <td style={{ padding: "2px 4px", borderBottom: "1px solid #0e1620" }}>{m.idx}</td>
                      <td style={{ textAlign: "right", padding: "2px 4px", borderBottom: "1px solid #0e1620" }}>{m.dt.toFixed(1)}</td>
                      <td style={{ textAlign: "right", padding: "2px 4px", borderBottom: "1px solid #0e1620", color: "#55bb88" }}>{m.v1.toFixed(3)}</td>
                      <td style={{ textAlign: "right", padding: "2px 4px", borderBottom: "1px solid #0e1620", color: "#ddaa44" }}>{m.dAvg.toFixed(2)}</td>
                      <td style={{ textAlign: "right", padding: "2px 4px", borderBottom: "1px solid #0e1620", color: "#ee6688" }}>{m.vEst.toFixed(1)}</td>
                      <td style={{ textAlign: "right", padding: "2px 4px", borderBottom: "1px solid #0e1620", color: "#3a5566" }}>{m.trueVol.toFixed(1)}</td>
                      <td style={{
                        textAlign: "right", padding: "2px 4px", borderBottom: "1px solid #0e1620",
                        color: Math.abs(m.err) < 5 ? "#44bb44" : Math.abs(m.err) < 15 ? "#bbaa22" : "#bb4444",
                      }}>{m.err > 0 ? "+" : ""}{m.err.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Footer info */}
      <div style={{
        background: "#0a0e14", border: "1px solid #151e28", borderRadius: "4px", padding: "12px",
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px",
        fontSize: "9px", color: "#445566", lineHeight: 1.6,
      }}>
        <div>
          <div style={{ color: "#6aacbc", fontWeight: 600, marginBottom: "3px", fontSize: "8px", textTransform: "uppercase", letterSpacing: "1px" }}>Principle</div>
          Two IR beams at known \u0394h={SIM.beamGap_mm}mm measure inter-beam transit time \u0394t. Kinematics gives velocity. Occlusion duration \u00D7 velocity gives diameter. V = \u03C0/6\u00B7d\u00B3.
        </div>
        <div>
          <div style={{ color: "#ddaa44", fontWeight: 600, marginBottom: "3px", fontSize: "8px", textTransform: "uppercase", letterSpacing: "1px" }}>Oscillation</div>
          Drops oscillate oblate\u2194prolate after detachment (~50\u2013100 Hz). Individual measurements show noise; averaging 10+ drops cancels it.
        </div>
        <div>
          <div style={{ color: "#55bb88", fontWeight: 600, marginBottom: "3px", fontSize: "8px", textTransform: "uppercase", letterSpacing: "1px" }}>Sensor Module</div>
          The Dripito IR sensor module clips directly onto the drip chamber. TX\u2081/TX\u2082 are IR LED emitters (left); RX\u2081/RX\u2082 are photodiode receivers (right).
        </div>
      </div>
    </div>
  );
}
