import { useState, useEffect, useRef, useCallback } from "react";
import DripitoSim from "./DripitoSim";

const LCD_FONT_URL = "https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap";

// ─── Constants ────────────────────────────────────────────────────────────────
const AVG_WINDOW           = 5;      // inter-drop intervals kept for moving average
const NO_DROP_TIMEOUT_DEMO = 8000;   // ms — short for demo
const NO_DROP_TIMEOUT_REAL = 60000;  // ms — 60s real clinical

const S = {
  BOOT: "BOOT",
  MEASURING: "MEASURING",
  MAIN: "MAIN",
  ARMED: "ARMED",
  ALARM_WARN: "ALARM_WARN",
  ALARM_HIGH: "ALARM_HIGH",
  ALARM_NOFLOW: "ALARM_NOFLOW",
  ALARM_LOWBAT: "ALARM_LOWBAT",
};

const INFO_MODES = ["INFUSED", "ELAPSED", "DROPS"];

// ─── LCD display ──────────────────────────────────────────────────────────────
function LCD({ lines, alarmLevel }) {
  const padded = [...lines];
  while (padded.length < 4) padded.push("");
  const bg = alarmLevel === "HIGH" ? "#c8e87a" : alarmLevel === "WARN" ? "#d0e87a" : "#c8d87a";
  return (
    <div style={{
      background: bg, border: "2px solid #6a7a40", borderRadius: "3px",
      padding: "6px 10px 7px",
      fontFamily: "'Share Tech Mono','Courier New',monospace",
      fontSize: "12px", letterSpacing: "0.09em", lineHeight: "1.65em",
      boxShadow: "inset 0 1px 6px rgba(0,0,0,0.22)",
      minWidth: "210px", position: "relative", userSelect: "none",
      transition: "background 0.15s",
    }}>
      <style>{`@import url('${LCD_FONT_URL}');`}</style>
      <div style={{ position:"absolute",inset:0,
        backgroundImage:"radial-gradient(circle,rgba(0,0,0,0.08) 1px,transparent 1px)",
        backgroundSize:"4px 4px", borderRadius:"3px", pointerEvents:"none", opacity:0.5 }}/>
      <div style={{ position:"absolute",inset:0,
        backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 11px,rgba(0,0,0,0.05) 11px,rgba(0,0,0,0.05) 12px)",
        borderRadius:"3px", pointerEvents:"none" }}/>
      {padded.slice(0,4).map((line, i) => (
        <div key={i} style={{ color:"#151e08", whiteSpace:"pre", textShadow:"0 0 2px rgba(40,60,0,0.5)", position:"relative", zIndex:1 }}>
          {(line + " ".repeat(16)).slice(0,16)}
        </div>
      ))}
    </div>
  );
}

// ─── Physical button ──────────────────────────────────────────────────────────
function Btn({ label, sublabel, color, bg, onClick, red }) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onMouseDown={() => { setPressed(true); onClick?.(); }}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        background: pressed ? (red?"#cc2222":"#d0d8d0") : (bg||(red?"#f0e0e0":"#e8e8e8")),
        border: `1.5px solid ${pressed?"#aaa":(red?"#e08080":"#bbb")}`,
        borderBottom: pressed ? "1.5px solid #aaa" : "3px solid #999",
        borderRadius: "5px", color: color||(red?"#aa1111":"#222"),
        padding: "7px 10px", cursor: "pointer",
        fontFamily: "'Share Tech Mono',monospace",
        fontSize: "11px", fontWeight: "700", letterSpacing: "0.06em",
        textTransform: "uppercase", minWidth: "60px",
        transition: "all 0.07s",
        transform: pressed ? "translateY(2px)" : "none",
        textAlign: "center", lineHeight: 1.3, outline: "none", userSelect: "none",
      }}
    >
      <div>{label}</div>
      {sublabel && <div style={{ fontSize:"9px", color:"#888", marginTop:"2px" }}>{sublabel}</div>}
    </button>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function DripitoV2() {
  // drop tracking (refs — no re-render on every drop, mirrors firmware ISR approach)
  const dropBuffer   = useRef([]);   // last N {volMl, dtMs} entries for moving average
  const lastDropTime = useRef(null);
  const totalVolRef  = useRef(0);    // running total infused volume (mL)
  const noFlowTimer  = useRef(null);
  const startTime    = useRef(null);

  // reactive state — flow values in mL/h, volume in mL
  const [dropCount,  setDropCount]  = useState(0);
  const [avgFlow,    setAvgFlow]    = useState(0);   // moving-average flow rate (mL/h)
  const [instFlow,   setInstFlow]   = useState(0);   // single-interval flow rate (mL/h)
  const [infusedVol, setInfusedVol] = useState(0);   // total volume delivered (mL)
  const [elapsedMs,  setElapsedMs]  = useState(0);

  // UI state
  const [screen,      setScreen]      = useState(S.BOOT);
  const [infoMode,    setInfoMode]    = useState(0);
  const [targetFlow,  setTargetFlow]  = useState(null); // armed alarm target (mL/h)
  const [demoMode,    setDemoMode]    = useState(true);
  const [blink,       setBlink]       = useState(true);
  const [blinkFast,   setBlinkFast]   = useState(true);

  const bootDone = useRef(false);
  const measDone = useRef(false);

  // refs for stale-closure-safe access inside callbacks
  const targetFlowRef = useRef(null);
  const screenRef     = useRef(S.BOOT);
  targetFlowRef.current = targetFlow;
  screenRef.current     = screen;

  // blink tickers
  useEffect(() => {
    const t1 = setInterval(() => setBlink(b=>!b), 600);
    const t2 = setInterval(() => setBlinkFast(b=>!b), 280);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, []);

  // elapsed timer
  useEffect(() => {
    const active = [S.MAIN,S.ARMED,S.ALARM_WARN,S.ALARM_HIGH,S.ALARM_NOFLOW];
    if (!active.includes(screen)) return;
    const t = setInterval(() => {
      if (startTime.current) setElapsedMs(Date.now() - startTime.current);
    }, 500);
    return () => clearInterval(t);
  }, [screen]);

  // boot sequence
  useEffect(() => {
    if (screen === S.BOOT && !bootDone.current) {
      bootDone.current = true;
      setTimeout(() => { setScreen(S.MEASURING); measDone.current = false; }, 2500);
    }
    if (screen === S.MEASURING && !measDone.current) {
      measDone.current = true;
      startTime.current = Date.now();
      setTimeout(() => setScreen(S.MAIN), 4000);
    }
  }, [screen]);

  // no-flow watchdog
  const resetNoFlowTimer = useCallback(() => {
    if (noFlowTimer.current) clearTimeout(noFlowTimer.current);
    const timeout = demoMode ? NO_DROP_TIMEOUT_DEMO : NO_DROP_TIMEOUT_REAL;
    noFlowTimer.current = setTimeout(() => setScreen(S.ALARM_NOFLOW), timeout);
  }, [demoMode]);

  useEffect(() => {
    const monitoring = [S.MAIN,S.ARMED,S.ALARM_WARN,S.ALARM_HIGH];
    if (monitoring.includes(screen)) resetNoFlowTimer();
    return () => { if (noFlowTimer.current) clearTimeout(noFlowTimer.current); };
  }, [screen, resetNoFlowTimer]);

  // ── Core drop handler (mirrors EXTI ISR + flow calc in firmware) ──────────
  const registerDrop = useCallback((volMl = 0.05) => {
    const now    = Date.now();
    const target = targetFlowRef.current;
    const curScr = screenRef.current;

    const validScreens = [S.MAIN,S.ARMED,S.ALARM_WARN,S.ALARM_HIGH,S.ALARM_NOFLOW,S.MEASURING];
    if (!validScreens.includes(curScr)) return;

    resetNoFlowTimer();

    // Compute instantaneous and moving-average flow rate (mL/h)
    let newInstFlow = 0;
    let newAvgFlow  = 0;

    if (lastDropTime.current !== null) {
      const dtMs  = now - lastDropTime.current;         // inter-drop interval (ms)
      newInstFlow = (volMl * 3_600_000) / dtMs;         // mL/h from single drop

      dropBuffer.current.push({ volMl, dtMs });
      if (dropBuffer.current.length > AVG_WINDOW) dropBuffer.current.shift();

      // Average flow = total volume in window / total time in window
      const bufVol  = dropBuffer.current.reduce((s, d) => s + d.volMl, 0);
      const bufTime = dropBuffer.current.reduce((s, d) => s + d.dtMs,  0);
      newAvgFlow = (bufVol * 3_600_000) / bufTime;
    }
    lastDropTime.current = now;

    // Accumulate delivered volume and drop count
    totalVolRef.current += volMl;
    setInfusedVol(Math.round(totalVolRef.current * 1000) / 1000);
    setDropCount(prev => prev + 1);
    setInstFlow(Math.round(newInstFlow * 10) / 10);
    setAvgFlow(Math.round(newAvgFlow   * 10) / 10);

    // Alarm logic — evaluate deviation from armed target
    if (target !== null && dropBuffer.current.length >= 1) {
      const deviation = Math.abs(newAvgFlow - target) / target;
      setScreen(prev => {
        if (prev === S.ALARM_NOFLOW) return S.ARMED;
        if (deviation >= 0.25) return S.ALARM_HIGH;
        if (deviation >= 0.15) return S.ALARM_WARN;
        return S.ARMED;
      });
    } else if (curScr === S.ALARM_NOFLOW) {
      setScreen(targetFlowRef.current ? S.ARMED : S.MAIN);
    }
  }, [resetNoFlowTimer]);

  // keyboard shortcut: SPACE = drop
  useEffect(() => {
    const handler = (e) => {
      if (e.code === "Space") { e.preventDefault(); registerDrop(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [registerDrop]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const eTotal = elapsedMs / 1000;
  const eH = String(Math.floor(eTotal/3600)).padStart(2,"0");
  const eM = String(Math.floor((eTotal%3600)/60)).padStart(2,"0");
  const eS = String(Math.floor(eTotal%60)).padStart(2,"0");
  const batPct = 72;

  function alarmLevel() {
    if (screen===S.ALARM_HIGH||screen===S.ALARM_NOFLOW) return "HIGH";
    if (screen===S.ALARM_WARN) return "WARN";
    return "NONE";
  }
  const alLv = alarmLevel();

  function devPct() {
    if (!targetFlow || avgFlow === 0) return 0;
    return (avgFlow - targetFlow) / targetFlow * 100;
  }
  const devP = devPct();

  function infoRow() {
    if (infoMode===0) return `Vol: ${infusedVol.toFixed(1).padStart(5," ")} mL`;
    if (infoMode===1) return `Time: ${eH}:${eM}:${eS}`;
    return `Drops: ${String(dropCount).padStart(5," ")}  `;
  }

  function getLines() {
    const flow = avgFlow > 0 ? String(Math.round(avgFlow)).padStart(4," ")
                             : (screen===S.MEASURING ? "----" : "   0");
    const bat  = `BAT:${batPct}%`;

    switch(screen) {
      case S.BOOT:         return ["                ","  Dripito  V2   ","    ETHZ GHE    ", blink?"                ":"   Loading...   "];
      case S.MEASURING:    return ["-- Measuring -- ",`Flow:${flow} mL/h`,`Drops: ${String(dropCount).padStart(5," ")}   `, blink?"  Please wait.. ":"  Stabilising.. "];
      case S.MAIN:         return [`Flow:${flow} mL/h`, infoRow(), `${bat}            `, "[ALM]arm [MODE] "];
      case S.ARMED:        return [`Flow:${flow} mL/h`, infoRow(), `Tgt:${String(Math.round(targetFlow)).padStart(4," ")} ${bat}  `, "[ALM]off [MODE] "];
      case S.ALARM_WARN: {
        const sign=devP>=0?"+":"-"; const p=Math.abs(devP).toFixed(0).padStart(2," ");
        return [blinkFast?"> RATE SHIFT <  ":`Flow:${flow} mL/h`, `Dev:${sign}${p}%      `, `Tgt:${String(Math.round(targetFlow)).padStart(4," ")} mL/h  `, "[ALM] silence   "];
      }
      case S.ALARM_HIGH: {
        const sign=devP>=0?"+":"-"; const p=Math.abs(devP).toFixed(0).padStart(2," ");
        return [blinkFast?"!! RATE ALARM !!":"                ", `Flow:${flow} mL/h`, `Dev:${sign}${p}%    !!!`, "[ALM] silence   "];
      }
      case S.ALARM_NOFLOW: return [blinkFast?"!! NO  FLOW !!!!":"                ", `Last:${String(Math.round(targetFlow||avgFlow)).padStart(4," ")} mL/h`, `${infusedVol.toFixed(1).padStart(5," ")} mL infused`, "[ALM] silence   "];
      case S.ALARM_LOWBAT: return [blinkFast?"!! LOW BATTERY !":"LOW BATTERY     ", `BAT: ~${batPct}% left   `, `${infusedVol.toFixed(1).padStart(5," ")} mL infused`, "[ALM] silence   "];
      default: return ["","","",""];
    }
  }

  // ── Button handlers ───────────────────────────────────────────────────────
  function handleMode() {
    if ([S.MAIN,S.ARMED].includes(screen)) setInfoMode(m=>(m+1)%3);
    else if ([S.ALARM_WARN,S.ALARM_HIGH,S.ALARM_NOFLOW,S.ALARM_LOWBAT].includes(screen))
      setScreen(targetFlow ? S.ARMED : S.MAIN);
  }
  function handleAlarm() {
    if ([S.MAIN,S.MEASURING].includes(screen) && avgFlow > 0) {
      setTargetFlow(avgFlow); setScreen(S.ARMED);          // arm to current avg flow
    } else if (screen===S.ARMED) {
      setTargetFlow(null); setScreen(S.MAIN);              // disarm
    } else if ([S.ALARM_WARN,S.ALARM_HIGH,S.ALARM_NOFLOW,S.ALARM_LOWBAT].includes(screen)) {
      setScreen(targetFlow ? S.ARMED : S.MAIN);            // silence alarm
    }
  }

  function hardReset() {
    dropBuffer.current=[]; lastDropTime.current=null; startTime.current=null; totalVolRef.current=0;
    if(noFlowTimer.current) clearTimeout(noFlowTimer.current);
    setDropCount(0); setAvgFlow(0); setInstFlow(0); setInfusedVol(0); setElapsedMs(0);
    setTargetFlow(null); bootDone.current=false; measDone.current=false; setScreen(S.BOOT);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const isAlarming = [S.ALARM_WARN,S.ALARM_HIGH,S.ALARM_NOFLOW,S.ALARM_LOWBAT].includes(screen);
  const alarmBg       = isAlarming ? "#f0e0e0" : screen===S.ARMED ? "#fff8e0" : avgFlow>0 ? "#e0f0e0" : "#e8e8e8";
  const alarmColor    = isAlarming ? "#aa1111" : screen===S.ARMED ? "#8a6a00" : avgFlow>0 ? "#1a6a1a" : "#888";
  const alarmSublabel = isAlarming ? "silence"  : screen===S.ARMED ? "disarm"  : "arm";

  return (
    <div style={{ minHeight:"100vh", background:"#0f1210",
      backgroundImage:"radial-gradient(ellipse at 30% 0%,#0d1a0d 0%,transparent 50%),radial-gradient(ellipse at 70% 100%,#0d1018 0%,transparent 50%)",
      fontFamily:"'Share Tech Mono','Courier New',monospace", color:"#b0c8b0", padding:"16px 14px 28px" }}>
      <style>{`@import url('${LCD_FONT_URL}');`}</style>

      {/* Header */}
      <div style={{ maxWidth:1400, margin:"0 auto 12px" }}>
        <div style={{ display:"flex", alignItems:"baseline", gap:12 }}>
          <span style={{ fontSize:22, fontWeight:700, color:"#44cc44" }}>Dripito V2</span>
          <span style={{ fontSize:10, color:"#4a7a4a", letterSpacing:"0.16em" }}>UI SPEC · Rev-B · ETHZ GHE</span>
        </div>
        <div style={{ fontSize:10, color:"#4a6a4a", marginTop:1 }}>EA DOGS164W-A · 4×16 · STM32G030 · Real drop-counting logic</div>
      </div>

      {/* ── 3-column layout: IV setup | Dripito device | Live data ── */}
      <div style={{ maxWidth:1400, margin:"0 auto",
        display:"grid", gridTemplateColumns:"minmax(0,1fr) 240px 270px", gap:14, alignItems:"start" }}>

        {/* ── COL 1: IV drip chamber + dual-beam sensor ── */}
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          <div style={{ fontSize:10, letterSpacing:"0.16em", color:"#4a7a4a", textTransform:"uppercase" }}>
            IV Drip Chamber — Dual-Beam IR Sensor
          </div>
          <div style={{ borderRadius:10, overflow:"hidden", border:"1.5px solid #1a2a1a",
            boxShadow:"0 4px 24px rgba(0,0,0,0.5)" }}>
            <DripitoSim onDrop={registerDrop} />
          </div>
        </div>

        {/* ── COL 2: Dripito device ── */}
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>

          {/* Dripito casing — intentionally white */}
          <div style={{ background:"linear-gradient(160deg,#fff 0%,#f0f0ee 60%,#e4e4e0 100%)",
            border:"1.5px solid #c8c8c4", borderRadius:14, padding:"16px 14px 18px",
            boxShadow:"0 6px 24px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.9)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10, paddingBottom:7, borderBottom:"1px solid #ddd" }}>
              <span style={{ fontSize:12, fontWeight:700, color:"#2a4a2a", letterSpacing:"0.06em" }}>DRIPITO</span>
              <span style={{ fontSize:9, color:"#aaa" }}>V2 PROTOTYPE</span>
            </div>
            <div style={{ display:"flex", justifyContent:"center", marginBottom:14 }}>
              <div style={{ background:"#1a1a1a", padding:"6px 8px", borderRadius:5, boxShadow:"inset 0 2px 8px rgba(0,0,0,0.5)" }}>
                <LCD lines={getLines()} alarmLevel={alLv}/>
              </div>
            </div>
            <div style={{ display:"flex", justifyContent:"center", gap:12 }}>
              <Btn label="MODE" sublabel="view/nav" onClick={handleMode}/>
              <Btn label="ALARM" sublabel={alarmSublabel} bg={alarmBg} color={alarmColor} onClick={handleAlarm}/>
            </div>
            <div style={{ textAlign:"center", marginTop:9, fontSize:9, color:"#bbb" }}>← CLIP-ON · IV DRIP CHAMBER</div>
          </div>

          {/* Screen jumps */}
          <div style={{ background:"#161d16", border:"1px solid #2a3a2a", borderRadius:8, padding:"10px 12px" }}>
            <div style={{ fontSize:10, letterSpacing:"0.13em", color:"#4a7a4a", marginBottom:6 }}>JUMP TO SCREEN</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
              {[
                {l:"Boot",s:S.BOOT},{l:"Measuring",s:S.MEASURING},{l:"Main",s:S.MAIN},
                {l:"Armed",s:S.ARMED},{l:"⚠ Warn",s:S.ALARM_WARN},{l:"🔴 Alarm",s:S.ALARM_HIGH},
                {l:"No Flow",s:S.ALARM_NOFLOW},{l:"Low Bat",s:S.ALARM_LOWBAT},
              ].map(({l,s}) => (
                <button key={s} onClick={() => {
                  if(s===S.BOOT){bootDone.current=false;}
                  if(s===S.MEASURING){measDone.current=false;}
                  if([S.ARMED,S.ALARM_WARN,S.ALARM_HIGH].includes(s)&&avgFlow>0) setTargetFlow(avgFlow);
                  setScreen(s);
                }} style={{
                  background:screen===s?"#1a3a1a":"#161d16",
                  border:`1px solid ${screen===s?"#3a8a3a":"#2a402a"}`,
                  borderRadius:4, color:screen===s?"#5aee5a":"#4a7a4a",
                  fontSize:9, padding:"3px 7px", cursor:"pointer",
                  fontFamily:"'Share Tech Mono',monospace",
                }}>{l}</button>
              ))}
            </div>
          </div>
        </div>

        {/* ── COL 3: Live data ── */}
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>

          {/* Live stats */}
          <div style={{ background:"#161d16", border:"1px solid #2a3a2a", borderRadius:8, padding:"10px 14px",
            boxShadow:"0 1px 4px rgba(0,0,0,0.3)", fontSize:10.5 }}>
            <div style={{ fontSize:10, letterSpacing:"0.13em", color:"#5a9a5a", marginBottom:8, textTransform:"uppercase" }}>
              Live Data
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"3px 14px", color:"#8ab08a", lineHeight:1.9 }}>
              {[
                ["Avg flow rate",   avgFlow>0  ? `${avgFlow.toFixed(1)} mL/h`  : "—",  "#44cc44"],
                ["Instant rate",    instFlow>0 ? `${instFlow.toFixed(1)} mL/h` : "—",  "#44cc44"],
                ["Volume infused",  `${infusedVol.toFixed(2)} mL`,                       "#44cc44"],
                ["Drop count",      String(dropCount),                                    "#44cc44"],
                ["Elapsed time",    `${eH}:${eM}:${eS}`,                                 "#44cc44"],
                ["Target flow",     targetFlow ? `${targetFlow.toFixed(1)} mL/h` : "—",  targetFlow?"#5aee5a":"#555"],
                ["Deviation",       targetFlow&&avgFlow>0 ? `${devP>=0?"+":""}${devP.toFixed(1)}%` : "—",
                  alLv==="HIGH"?"#ff5533":alLv==="WARN"?"#ffaa22":"#44cc44"],
              ].map(([k,v,vc]) => (
                <>
                  <span key={k} style={{ color:"#4a7a4a" }}>{k}</span>
                  <b key={v} style={{ color:vc }}>{v}</b>
                </>
              ))}
            </div>
            <div style={{ marginTop:8, paddingTop:7, borderTop:"1px solid #2a3a2a", display:"flex", gap:8, alignItems:"center" }}>
              <label style={{ fontSize:9, color:"#5a7a5a", display:"flex", alignItems:"center", gap:4, cursor:"pointer" }}>
                <input type="checkbox" checked={demoMode} onChange={e=>setDemoMode(e.target.checked)} style={{ accentColor:"#2a8a2a" }}/>
                Demo: 8s no-drop timeout
              </label>
              <button onClick={hardReset} style={{ marginLeft:"auto", background:"#2a1010",
                border:"1px solid #6a2222", borderRadius:4, color:"#ee4444",
                fontSize:9, padding:"3px 8px", cursor:"pointer", fontFamily:"'Share Tech Mono',monospace" }}>
                RESET
              </button>
            </div>
          </div>

          {/* Alarm band visual */}
          <div style={{ background:"#161d16", border:"1px solid #2a3a2a", borderRadius:7, padding:"11px 14px", boxShadow:"0 1px 4px rgba(0,0,0,0.3)" }}>
            <div style={{ fontSize:10, fontWeight:700, color:"#7a9a7a", letterSpacing:"0.12em", marginBottom:10, textTransform:"uppercase" }}>
              Alarm Bands
            </div>
            {(() => {
              const ref = targetFlow || (avgFlow > 0 ? avgFlow : 100);
              const lo25 = (ref*0.75).toFixed(1); const lo15 = (ref*0.85).toFixed(1);
              const hi15 = (ref*1.15).toFixed(1); const hi25 = (ref*1.25).toFixed(1);
              return (
                <div>
                  <div style={{ display:"flex", borderRadius:4, overflow:"hidden", fontSize:9, marginBottom:5 }}>
                    {[
                      {bg:"#ff4444",label:`ALARM\n<${lo25}`,flex:1},
                      {bg:"#ffaa00",label:`WARN\n${lo25}–${lo15}`,flex:1},
                      {bg:"#44aa44",label:`OK\n${lo15}–${hi15}`,flex:1.6,bold:true},
                      {bg:"#ffaa00",label:`WARN\n${hi15}–${hi25}`,flex:1},
                      {bg:"#ff4444",label:`ALARM\n>${hi25}`,flex:1},
                    ].map((seg,i)=>(
                      <div key={i} style={{ background:seg.bg, color:"#fff", flex:seg.flex,
                        padding:"4px 2px", textAlign:"center", whiteSpace:"pre-line",
                        fontWeight:seg.bold?"700":"400", lineHeight:1.4 }}>{seg.label}</div>
                    ))}
                  </div>
                  <div style={{ fontSize:9, color:"#5a7a5a", textAlign:"center", lineHeight:1.7 }}>
                    Target: <b style={{ color:"#8ab08a" }}>{ref.toFixed(1)}</b> mL/h {targetFlow?"(armed)":"(arm to update)"}
                    {targetFlow&&avgFlow>0&&(
                      <span style={{ marginLeft:8, fontWeight:700,
                        color:alLv==="HIGH"?"#ff5533":alLv==="WARN"?"#ffaa22":"#44cc44" }}>
                        · {avgFlow.toFixed(1)} mL/h ({devP>=0?"+":""}{devP.toFixed(1)}%)
                        → {alLv==="NONE"?"✓ OK":alLv==="WARN"?"⚠ WARN":"🔴 ALARM"}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize:8, color:"#3a5a3a", textAlign:"center", marginTop:3 }}>
                    avg over last {AVG_WINDOW} inter-drop intervals · volume from dual-beam sensor
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* ── Spec section ── */}
      <div style={{ maxWidth:1400, margin:"16px auto 0" }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14 }}>
          {[
            {
              title:"Drop → Flow Algorithm", color:"#1a6a1a",
              rows:[
                ["Each drop",    "Dual-beam transit time → drop volume estimated (mm³ → mL)"],
                ["Instant rate", "instFlow = volMl × 3 600 000 / dtMs  (mL/h)"],
                ["Avg rate",     `Moving window: totalVol / totalTime over last ${AVG_WINDOW} drops`],
                ["Vol. infused", "Running sum of measured drop volumes (mL)"],
                ["No-drop WD",   `${demoMode?"8 s (demo)":"60 s"} without a detected drop → ALARM_NOFLOW`],
              ]
            },
            {
              title:"Button Map", color:"#1a4a9a",
              rows:[
                ["MODE",  "Cycle info row: Volume / Elapsed / Drop count · dismiss alarm"],
                ["ALARM", "Main → arm to current avg flow rate · Armed → disarm · Alarm → silence"],
              ]
            },
            {
              title:"Alarm Thresholds (Paediatric)", color:"#b85a00",
              rows:[
                ["±15% deviation", "Intermittent beep · row-1 blinks · nurse adjusts clamp"],
                ["±25% deviation", "Rapid continuous beep · full blink · urgent intervention"],
                ["No flow",        `No drops detected for ${demoMode?"8 s (demo)":"60 s"} → highest priority`],
                ["Low battery",    "Non-blocking, single beep every 60 s"],
                ["Clinical ref",   "IEC 60601-2-24 · NICE CG174 · Atanda et al. PMC 2023"],
              ]
            },
          ].map(sec => (
            <div key={sec.title} style={{ background:"#161d16", border:`1px solid ${sec.color}44`,
              borderLeft:`3px solid ${sec.color}`, borderRadius:"0 7px 7px 0",
              padding:"11px 14px", boxShadow:"0 1px 4px rgba(0,0,0,0.3)" }}>
              <div style={{ fontSize:10, fontWeight:700, color:sec.color, letterSpacing:"0.12em", marginBottom:8, textTransform:"uppercase" }}>
                {sec.title}
              </div>
              {sec.rows.map(([k,v],i) => (
                <div key={i} style={{ display:"flex", gap:10, marginBottom:5, fontSize:10.5, lineHeight:1.55 }}>
                  <span style={{ color:sec.color, minWidth:90, flexShrink:0, fontWeight:700 }}>{k}</span>
                  <span style={{ color:"#8ab08a" }}>{v}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div style={{ maxWidth:1400, margin:"14px auto 0", fontSize:9, color:"#3a5a3a", textAlign:"center", lineHeight:1.8 }}>
        Clinical: ±15% warn · ±25% alarm · NICE CG174 · IEC 60601-2-24 · Atanda et al. PMC 2023
      </div>
    </div>
  );
}