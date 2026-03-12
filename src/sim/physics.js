import { SIM } from "../constants/simConstants";

function rayleighFreq(gamma_mNm, rho_kgm3, R_mm) {
  const gamma = gamma_mNm * 1e-3;
  const R = R_mm * 1e-3;
  return (1 / (2 * Math.PI)) * Math.sqrt((8 * gamma) / (rho_kgm3 * R * R * R));
}

function sphereVolume(d_mm) {
  return (Math.PI / 6) * d_mm * d_mm * d_mm;
}

// Create a new drop from fluid properties and current sim time
export function makeDrop(fluid, simTime) {
  const vol = (Math.PI * fluid.nozzleDia * (fluid.gamma * 1e-3) * 0.6) / ((fluid.rho * 1e-9) * SIM.g);
  const v = vol * (1 + (Math.random() - 0.5) * 0.02);
  const d = Math.pow((6 * v) / Math.PI, 1 / 3);
  const oscF = rayleighFreq(fluid.gamma, fluid.rho, d / 2);
  return {
    y_mm: SIM.nozzleY_mm, vy: 0,
    trueDia: d, trueVol: v,
    oscFreq: oscF, oscPhase: Math.random() * Math.PI * 2,
    oscAmp: 0.15, oscDecay: 2.5,
    detachTime: simTime,
    b1Hit: false, b2Hit: false,
    b1TimeFirst: 0, b2TimeFirst: 0,
    b1OccStart: 0, b1OccEnd: 0,
    b2OccStart: 0, b2OccEnd: 0,
    measured: false, active: true,
  };
}

// Update a drop's physics for one simulation step; mutates drop in place
export function updateDropPhysics(drop, simDt, simTime) {
  drop.vy   += SIM.g * simDt;
  drop.y_mm += drop.vy * simDt;

  const ft  = simTime - drop.detachTime;
  const osc = drop.oscAmp * Math.sin(2 * Math.PI * drop.oscFreq * ft + drop.oscPhase) * Math.exp(-drop.oscDecay * ft);
  return {
    dH: drop.trueDia * (1 + osc),
    dV: drop.trueDia * (1 - osc * 0.5),
    osc,
  };
}

// Calculate beam occlusion for a drop against both beams; mutates drop hit tracking
export function calcBeamOcclusion(drop, simTime, shape) {
  const { dH, dV } = shape;
  const rH = dH / 2, rV = dV / 2;
  let b1Val = 1.0, b2Val = 1.0;

  for (let bi = 0; bi < 2; bi++) {
    const beamY  = bi === 0 ? SIM.beam1Y_mm : SIM.beam2Y_mm;
    const dropTop = drop.y_mm - rV;
    const dropBot = drop.y_mm + rV;

    if (dropTop < beamY + 0.3 && dropBot > beamY - 0.3) {
      const dist  = Math.abs(drop.y_mm - beamY);
      const norm  = Math.min(dist / rV, 1);
      const chord = norm < 1 ? 2 * rH * Math.sqrt(1 - norm * norm) : 0;
      const occ   = Math.min(chord / SIM.chamberWidth_mm, 0.9);

      if (bi === 0) {
        b1Val = Math.min(b1Val, 1 - occ);
        if (!drop.b1Hit && occ > 0.02) { drop.b1Hit = true; drop.b1TimeFirst = simTime; drop.b1OccStart = simTime; }
        if (drop.b1Hit && occ > 0.02)  drop.b1OccEnd = simTime;
      } else {
        b2Val = Math.min(b2Val, 1 - occ);
        if (!drop.b2Hit && occ > 0.02) { drop.b2Hit = true; drop.b2TimeFirst = simTime; drop.b2OccStart = simTime; }
        if (drop.b2Hit && occ > 0.02)  drop.b2OccEnd = simTime;
      }
    }
  }
  return { b1Val, b2Val };
}

export { sphereVolume };
