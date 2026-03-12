import { SIM } from "../constants/simConstants";
import { sphereVolume } from "./physics";

// Attempt to measure a drop after it has fully passed both beams.
// Returns a measurement object if successful, or null otherwise.
export function tryMeasureDrop(drop, simTime) {
  if (drop.b2Hit && !drop.measured) {
    const rV = drop.trueDia * 0.5; // approximate rV for exit check
    // Check if drop has fully cleared beam2
    if (drop.y_mm - rV <= SIM.beam2Y_mm + 2) return null;

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

        return {
          dt: dt_transit * 1000,
          v1: v1 / 1000, v2: v2 / 1000,
          occ1: occ1 * 1000, occ2: occ2 * 1000,
          d1, d2, dAvg, vEst,
          trueVol: drop.trueVol, trueDia: drop.trueDia,
          err: ((vEst - drop.trueVol) / drop.trueVol) * 100,
        };
      }
    }
  }
  return null;
}
