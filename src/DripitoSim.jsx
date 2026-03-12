import { useState, useEffect, useRef, useCallback } from "react";
import { SIM, VIS, TIME_SCALE, FLUIDS } from "./constants/simConstants";
import { makeDrop, updateDropPhysics, calcBeamOcclusion } from "./sim/physics";
import { tryMeasureDrop } from "./sim/measurement";
import { drawChamberCanvas } from "./sim/drawChamber";
import { drawScope } from "./sim/drawScope";

export default function DripitoSim() {
  const canvasRef      = useRef(null);
  const scopeCanvasRef = useRef(null);
  const animRef        = useRef(null);

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

  // Reset simulation when fluid changes
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

  // Wrap makeDrop so it captures current fluidType without stale closure in tick
  const makeDropForFluid = useCallback(() => {
    return makeDrop(FLUIDS[fluidType], sim.current.time);
  }, [fluidType]);

  useEffect(() => {
    const canvas      = canvasRef.current;
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
      const fluid   = FLUIDS[fluidType];
      const interval = 1 / dropRate;

      // Spawn drop
      if (s.time - s.lastDropTime >= interval) {
        s.drops.push(makeDropForFluid());
        s.lastDropTime = s.time;
      }

      // Physics + beam values
      let b1Val = 1.0, b2Val = 1.0;

      for (const drop of s.drops) {
        if (!drop.active) continue;

        const shape = updateDropPhysics(drop, simDt, s.time);
        const occ   = calcBeamOcclusion(drop, s.time, shape);
        b1Val = Math.min(b1Val, occ.b1Val);
        b2Val = Math.min(b2Val, occ.b2Val);

        const meas = tryMeasureDrop(drop, s.time);
        if (meas) {
          s.dropCount++;
          meas.idx = s.dropCount;
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

        if (drop.y_mm > SIM.chamberBottom_mm + 10) drop.active = false;
      }

      s.drops = s.drops.filter(d => d.active);
      s.scope1[s.scopeIdx % 1200] = b1Val;
      s.scope2[s.scopeIdx % 1200] = b2Val;
      s.scopeIdx++;

      drawChamberCanvas(ctx, CW, CH, s, fluid, interval, s.drops, b1Val, b2Val);
      drawScope(sctx, SW, SHt, s.scope1, s.scope2, s.scopeIdx);

      animRef.current = requestAnimationFrame(tick);
    }

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [isRunning, fluidType, dropRate, makeDropForFluid]);

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
        <div style={{ background: "#0a0e14", border: "1px solid #151e28", borderRadius: "4px", padding: "6px", flexShrink: 0 }}>
          <canvas ref={canvasRef} style={{ width: 520, height: 460, display: "block" }} />
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "10px", minWidth: "280px" }}>
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
