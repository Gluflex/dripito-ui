import DripitoSim from "./DripitoSim";
import { useDripMonitor } from "./hooks/useDripMonitor";
import { formatElapsed, alarmLevel, devPct, getLines } from "./utils/displayHelpers";
import DevicePanel from "./components/DevicePanel";
import DropSimulatorPanel from "./components/DropSimulatorPanel";
import LiveStatsPanel from "./components/LiveStatsPanel";
import ScreenJumper from "./components/ScreenJumper";
import SpecPanel from "./components/SpecPanel";

const LCD_FONT_URL = "https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap";

export default function DripitoV2() {
  const monitor = useDripMonitor();
  const {
    dripSetIdx, setDripSetIdx, dripSet, GTT_PER_ML,
    dropCount, flowMlh, instFlowMlh, totalMl, elapsedMs,
    screen, setScreen, infoMode, armedFlow, setArmedFlow, demoMode, setDemoMode,
    blink, blinkFast,
    registerDrop, handleMode, handleSet, handlePlus, handleMute, hardReset,
    _bootDone, _measDone,
  } = monitor;

  const { eH, eM, eS } = formatElapsed(elapsedMs);
  const alLv  = alarmLevel(screen);
  const devP  = devPct(armedFlow, flowMlh);
  const lines = getLines({ screen, flowMlh, GTT_PER_ML, dropCount, armedFlow, infoMode,
    totalMl, blink, blinkFast, eH, eM, eS, devP });

  return (
    <div style={{ minHeight:"100vh", background:"#e8eae6",
      backgroundImage:"radial-gradient(ellipse at 30% 0%,#dde8dd 0%,transparent 50%),radial-gradient(ellipse at 70% 100%,#dde0e8 0%,transparent 50%)",
      fontFamily:"'Share Tech Mono','Courier New',monospace", color:"#1a2a1a", padding:"22px 14px" }}>
      <style>{`@import url('${LCD_FONT_URL}');`}</style>

      {/* Header */}
      <div style={{ maxWidth:920, margin:"0 auto 18px" }}>
        <div style={{ display:"flex", alignItems:"baseline", gap:12 }}>
          <span style={{ fontSize:22, fontWeight:700, color:"#1a4a1a" }}>Dripito V2</span>
          <span style={{ fontSize:10, color:"#6a8a6a", letterSpacing:"0.16em" }}>UI SPEC · Rev-B · ETHZ GHE</span>
        </div>
        <div style={{ fontSize:10, color:"#8a9a8a", marginTop:1 }}>EA DOGS164W-A · 4×16 · STM32G030 · Real drop-counting logic</div>
      </div>

      <div style={{ maxWidth:920, margin:"0 auto", display:"grid", gridTemplateColumns:"1fr 1fr", gap:18 }}>
        {/* ── LEFT ── */}
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <DevicePanel
            lines={lines} alarmLevel={alLv}
            onMode={handleMode} onSet={handleSet} onPlus={handlePlus} onMute={handleMute}
          />
          <DropSimulatorPanel
            onDrop={registerDrop}
            dripSetIdx={dripSetIdx} dripSet={dripSet} onDripSetChange={setDripSetIdx}
          />
          <LiveStatsPanel
            flowMlh={flowMlh} instFlowMlh={instFlowMlh} dropCount={dropCount}
            totalMl={totalMl} eH={eH} eM={eM} eS={eS}
            armedFlow={armedFlow} devP={devP} alarmLevel={alLv} GTT_PER_ML={GTT_PER_ML}
            demoMode={demoMode} onDemoModeChange={setDemoMode} onReset={hardReset}
          />
          <ScreenJumper
            screen={screen} flowMlh={flowMlh} onJump={setScreen}
            bootDoneRef={_bootDone} measDoneRef={_measDone} setArmedFlow={setArmedFlow}
          />
        </div>

        {/* ── RIGHT: spec ── */}
        <SpecPanel
          GTT_PER_ML={GTT_PER_ML} demoMode={demoMode}
          armedFlow={armedFlow} flowMlh={flowMlh}
          alarmLevel={alLv} devP={devP} dripSetIdx={dripSetIdx}
        />
      </div>

      <div style={{ maxWidth:920, margin:"14px auto 0", fontSize:9, color:"#9aaa9a", textAlign:"center", lineHeight:1.8 }}>
        Clinical: \u00b115% warn \u00b7 \u00b125% alarm \u00b7 NICE CG174 \u00b7 IEC 60601-2-24 \u00b7 Atanda et al. PMC 2023
      </div>

      {/* ── SIMULATION SECTION ─────────────────────────────────────────────── */}
      <div style={{ maxWidth:1400, margin:"28px auto 0" }}>
        <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:14 }}>
          <div style={{ flex:1, height:1, background:"linear-gradient(to right, transparent, #c8d8c8)" }}/>
          <div style={{
            fontSize:10, letterSpacing:"0.18em", color:"#4a7a4a", fontWeight:700,
            textTransform:"uppercase", whiteSpace:"nowrap",
            fontFamily:"'Share Tech Mono','Courier New',monospace",
          }}>
            Physics Simulation \u2014 Dual-Beam Sensor Module
          </div>
          <div style={{ flex:1, height:1, background:"linear-gradient(to left, transparent, #c8d8c8)" }}/>
        </div>

        <p style={{
          fontSize:10, color:"#6a8a6a", marginBottom:12, lineHeight:1.7,
          fontFamily:"'Share Tech Mono','Courier New',monospace",
          background:"#f4f8f4", border:"1px solid #d8e8d8", borderRadius:6,
          padding:"8px 14px",
        }}>
          The simulation below shows the Dripito sensor module (left) clipped onto a transparent drip chamber.
          Two IR beams \u2014 TX\u2081/RX\u2081 and TX\u2082/RX\u2082 \u2014 detect each drop in real time.
          Transit time \u0394t between the beams is used to estimate drop velocity and volume without nurse interaction.
        </p>

        <div style={{ borderRadius:12, overflow:"hidden", border:"1.5px solid #1a2a1a", boxShadow:"0 8px 32px rgba(0,0,0,0.25)" }}>
          <DripitoSim />
        </div>
      </div>
    </div>
  );
}
