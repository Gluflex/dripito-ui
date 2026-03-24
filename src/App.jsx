import { useState, useEffect, useRef, useCallback } from "react";
import DripitoSim from "./DripitoSim";

const LCD_FONT_URL = "https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap";

// ─── Constants ────────────────────────────────────────────────────────────────
const DRIP_SETS = [
  { label: "10 gtt/mL", gtt: 10, note: "Macro – rapid infusion" },
  { label: "15 gtt/mL", gtt: 15, note: "Macro – standard adult" },
  { label: "20 gtt/mL", gtt: 20, note: "Macro – standard adult" },
  { label: "60 gtt/mL", gtt: 60, note: "Micro – paediatric/neonate" },
];

const FLOW_AVG_WINDOW = 5;
const NO_FLOW_DEMO    = 8000;   // ms — short for demo
const NO_FLOW_REAL    = 60000;  // ms — 60s real clinical

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
      padding: "9px 13px 10px",
      fontFamily: "'Share Tech Mono','Courier New',monospace",
      fontSize: "14.5px", letterSpacing: "0.13em", lineHeight: "1.7em",
      boxShadow: "inset 0 1px 6px rgba(0,0,0,0.22)",
      minWidth: "255px", position: "relative", userSelect: "none",
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
  // drip set
  const [dripSetIdx, setDripSetIdx] = useState(2);
  const dripSet = DRIP_SETS[dripSetIdx];
  const GTT_PER_ML = dripSet.gtt;

  // drop tracking (refs = no re-render on every drop like firmware would)
  const intervalBuffer = useRef([]);   // last N inter-drop dt values (ms)
  const lastDropTime   = useRef(null);
  const noFlowTimer    = useRef(null);
  const startTime      = useRef(null);

  // reactive state
  const [dropCount,    setDropCount]    = useState(0);
  const [flowMlh,      setFlowMlh]      = useState(0);    // moving-avg
  const [instFlowMlh,  setInstFlowMlh]  = useState(0);    // single-interval
  const [totalMl,      setTotalMl]      = useState(0);
  const [elapsedMs,    setElapsedMs]    = useState(0);


  // UI state
  const [screen,    setScreen]    = useState(S.BOOT);
  const [infoMode,  setInfoMode]  = useState(0);
  const [armedFlow, setArmedFlow] = useState(null);
  const [demoMode,  setDemoMode]  = useState(true);
  const [blink,     setBlink]     = useState(true);
  const [blinkFast, setBlinkFast] = useState(true);

  const bootDone = useRef(false);
  const measDone = useRef(false);

  // local copies for use inside callbacks without stale closure issues
  const armedFlowRef  = useRef(null);
  const gttRef        = useRef(GTT_PER_ML);
  const screenRef     = useRef(S.BOOT);
  armedFlowRef.current = armedFlow;
  gttRef.current       = GTT_PER_ML;
  screenRef.current    = screen;

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
    const timeout = demoMode ? NO_FLOW_DEMO : NO_FLOW_REAL;
    noFlowTimer.current = setTimeout(() => setScreen(S.ALARM_NOFLOW), timeout);
  }, [demoMode]);

  useEffect(() => {
    const monitoring = [S.MAIN,S.ARMED,S.ALARM_WARN,S.ALARM_HIGH];
    if (monitoring.includes(screen)) resetNoFlowTimer();
    return () => { if (noFlowTimer.current) clearTimeout(noFlowTimer.current); };
  }, [screen, resetNoFlowTimer]);

  // ── Core drop handler (mirrors EXTI ISR + flow calc in firmware) ──────────
  const registerDrop = useCallback(() => {
    const now    = Date.now();
    const gtt    = gttRef.current;
    const armed  = armedFlowRef.current;
    const curScr = screenRef.current;

    // Only register drops in monitoring screens
    const valid = [S.MAIN,S.ARMED,S.ALARM_WARN,S.ALARM_HIGH,S.ALARM_NOFLOW,S.MEASURING];
    if (!valid.includes(curScr)) return;

    // Reset no-flow watchdog
    resetNoFlowTimer();

    // Compute flow
    let newInst = 0;
    let newAvg  = 0;

    if (lastDropTime.current !== null) {
      const dt = now - lastDropTime.current;             // ms between drops
      newInst  = (3600 * 1000) / (dt * gtt);            // mL/h instantaneous

      intervalBuffer.current.push(dt);
      if (intervalBuffer.current.length > FLOW_AVG_WINDOW)
        intervalBuffer.current.shift();

      const avgDt = intervalBuffer.current.reduce((a,b)=>a+b,0) / intervalBuffer.current.length;
      newAvg = (3600 * 1000) / (avgDt * gtt);           // mL/h moving avg
    }
    lastDropTime.current = now;

    // Update reactive state via functional updaters to avoid stale closures
    setDropCount(prev => {
      const n = prev + 1;
      setTotalMl(n / gtt);
      return n;
    });
    setInstFlowMlh(Math.round(newInst * 10) / 10);
    setFlowMlh(Math.round(newAvg  * 10) / 10);

    // Alarm logic (only when armed and we have enough drops for avg)
    if (armed !== null && intervalBuffer.current.length >= 1) {
      const dev = Math.abs(newAvg - armed) / armed;
      setScreen(prev => {
        if (prev === S.ALARM_NOFLOW) return S.ARMED;
        if (dev >= 0.25) return S.ALARM_HIGH;
        if (dev >= 0.15) return S.ALARM_WARN;
        return S.ARMED;
      });
    } else if (curScr === S.ALARM_NOFLOW) {
      setScreen(armedFlowRef.current ? S.ARMED : S.MAIN);
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

  // recalculate flow when drip set changes
  useEffect(() => {
    if (intervalBuffer.current.length > 0) {
      const avgDt = intervalBuffer.current.reduce((a,b)=>a+b,0) / intervalBuffer.current.length;
      setFlowMlh(Math.round((3600*1000)/(avgDt*GTT_PER_ML)*10)/10);
    }
    setDropCount(prev => { setTotalMl(prev / GTT_PER_ML); return prev; });
  // eslint-disable-next-line
  }, [GTT_PER_ML]);

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
    if (!armedFlow||flowMlh===0) return 0;
    return (flowMlh-armedFlow)/armedFlow*100;
  }
  const devP = devPct();

  function infoRow() {
    if (infoMode===0) return `Infsd:${totalMl.toFixed(1).padStart(5," ")} mL`;
    if (infoMode===1) return `Time: ${eH}:${eM}:${eS}`;
    return `Drops: ${String(dropCount).padStart(5," ")}  `;
  }

  function getLines() {
    const flow = flowMlh>0 ? String(Math.round(flowMlh)).padStart(4," ")
                           : (screen===S.MEASURING ? "----" : "   0");
    const bat  = `BAT:${batPct}%`;
    const gttStr = String(GTT_PER_ML).padStart(2,"0");

    switch(screen) {
      case S.BOOT:       return ["                ","  Dripito  V2   ","    ETHZ GHE    ", blink?"                ":"   Loading...   "];
      case S.MEASURING:  return ["-- Measuring -- ",`Flow:${flow} mL/h`,`Drops: ${String(dropCount).padStart(5," ")}   `, blink?"  Please wait.. ":"  Stabilising.. "];
      case S.MAIN:       return [`Flow:${flow} mL/h`, infoRow(),`${bat}  ${gttStr}gtt/mL`,"[SET]arm [MODE]+"];
      case S.ARMED:      return [`Flow:${flow} mL/h`, infoRow(),`Tgt:${String(Math.round(armedFlow)).padStart(4," ")} ${bat}  `,"[MODE]+ [MUTE]  "];
      case S.ALARM_WARN: {
        const sign=devP>=0?"+":"-"; const p=Math.abs(devP).toFixed(0).padStart(2," ");
        return [blinkFast?"> RATE SHIFT <  ":`Flow:${flow} mL/h`,`Dev:${sign}${p}%      `,`Tgt:${String(Math.round(armedFlow)).padStart(4," ")} mL/h  `,"[MUTE] silence  "];
      }
      case S.ALARM_HIGH: {
        const sign=devP>=0?"+":"-"; const p=Math.abs(devP).toFixed(0).padStart(2," ");
        return [blinkFast?"!! RATE ALARM !!":"                ",`Flow:${flow} mL/h`,`Dev:${sign}${p}%    !!!`,"[MUTE] silence  "];
      }
      case S.ALARM_NOFLOW: return [blinkFast?"!! NO  FLOW !!!!":"                ",`Last:${String(Math.round(armedFlow||flowMlh)).padStart(4," ")} mL/h`,`${totalMl.toFixed(1).padStart(5," ")} mL infused`,"[MUTE] silence  "];
      case S.ALARM_LOWBAT: return [blinkFast?"!! LOW BATTERY !":"LOW BATTERY     ",`BAT: ~${batPct}% left   `,`${totalMl.toFixed(1).padStart(5," ")} mL infused`,"[MUTE] silence  "];
      default: return ["","","",""];
    }
  }

  // ── Button handlers ───────────────────────────────────────────────────────
  function handleMode() {
    if ([S.MAIN,S.ARMED].includes(screen)) setInfoMode(m=>(m+1)%3);
    else if ([S.ALARM_WARN,S.ALARM_HIGH,S.ALARM_NOFLOW,S.ALARM_LOWBAT].includes(screen))
      setScreen(armedFlow?S.ARMED:S.MAIN);
  }
  function handleSet() {
    if ([S.MAIN,S.MEASURING,S.ARMED].includes(screen) && flowMlh>0) {
      setArmedFlow(flowMlh); setScreen(S.ARMED);
    }
  }
  function handlePlus() {
    if ([S.ARMED,S.ALARM_WARN,S.ALARM_HIGH].includes(screen)) { setArmedFlow(null); setScreen(S.MAIN); }
  }
  function handleMute() {
    if ([S.ALARM_WARN,S.ALARM_HIGH,S.ALARM_NOFLOW,S.ALARM_LOWBAT].includes(screen))
      setScreen(armedFlow?S.ARMED:S.MAIN);
  }

  function hardReset() {
    intervalBuffer.current=[]; lastDropTime.current=null; startTime.current=null;
    if(noFlowTimer.current) clearTimeout(noFlowTimer.current);
    setDropCount(0); setFlowMlh(0); setInstFlowMlh(0); setTotalMl(0); setElapsedMs(0);
    setArmedFlow(null); bootDone.current=false; measDone.current=false; setScreen(S.BOOT);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh", background:"#0f1210",
      backgroundImage:"radial-gradient(ellipse at 30% 0%,#0d1a0d 0%,transparent 50%),radial-gradient(ellipse at 70% 100%,#0d1018 0%,transparent 50%)",
      fontFamily:"'Share Tech Mono','Courier New',monospace", color:"#b0c8b0", padding:"22px 14px" }}>
      <style>{`@import url('${LCD_FONT_URL}');`}</style>

      {/* Header */}
      <div style={{ maxWidth:920, margin:"0 auto 18px" }}>
        <div style={{ display:"flex", alignItems:"baseline", gap:12 }}>
          <span style={{ fontSize:22, fontWeight:700, color:"#44cc44" }}>Dripito V2</span>
          <span style={{ fontSize:10, color:"#4a7a4a", letterSpacing:"0.16em" }}>UI SPEC · Rev-B · ETHZ GHE</span>
        </div>
        <div style={{ fontSize:10, color:"#4a6a4a", marginTop:1 }}>EA DOGS164W-A · 4×16 · STM32G030 · Real drop-counting logic</div>
      </div>

      <div style={{ maxWidth:920, margin:"0 auto", display:"grid", gridTemplateColumns:"1fr 1fr", gap:18 }}>

        {/* ── LEFT ── */}
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

          {/* Device */}
          <div style={{ background:"linear-gradient(160deg,#fff 0%,#f0f0ee 60%,#e4e4e0 100%)",
            border:"1.5px solid #c8c8c4", borderRadius:14, padding:"16px 14px 18px",
            boxShadow:"0 6px 24px rgba(0,0,0,0.13),inset 0 1px 0 rgba(255,255,255,0.9)" }}>
            {/* brand bar */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10, paddingBottom:7, borderBottom:"1px solid #ddd" }}>
              <span style={{ fontSize:12, fontWeight:700, color:"#2a4a2a", letterSpacing:"0.06em" }}>DRIPITO</span>
              <span style={{ fontSize:9, color:"#aaa" }}>V2 PROTOTYPE</span>
            </div>
            {/* LCD */}
            <div style={{ display:"flex", justifyContent:"center", marginBottom:14 }}>
              <div style={{ background:"#1a1a1a", padding:"6px 8px", borderRadius:5, boxShadow:"inset 0 2px 8px rgba(0,0,0,0.5)" }}>
                <LCD lines={getLines()} alarmLevel={alLv}/>
              </div>
            </div>
            {/* Buttons */}
            <div style={{ display:"flex", justifyContent:"center", gap:6 }}>
              <Btn label="MODE" sublabel="view/nav" onClick={handleMode}/>
              <Btn label="SET"  sublabel="arm alarm" color="#1a6a1a" bg="#e0f0e0" onClick={handleSet}/>
              <Btn label="+"    sublabel="disarm"    onClick={handlePlus}/>
              <Btn label="MUTE" sublabel="silence"   red onClick={handleMute}/>
            </div>
            <div style={{ textAlign:"center", marginTop:9, fontSize:9, color:"#bbb" }}>↓ CLIP-ON · IV DRIP CHAMBER ↓</div>
          </div>

          {/* Drop simulator panel */}
          <div style={{ background:"#161d16", border:"1.5px solid #2a402a", borderRadius:10, padding:"14px",
            boxShadow:"0 2px 8px rgba(0,0,0,0.4)" }}>
            <div style={{ fontSize:10, letterSpacing:"0.15em", color:"#5a9a5a", marginBottom:12, textTransform:"uppercase" }}>
              Drop Simulator
            </div>

            {/* Big DROP button */}
            <div style={{ display:"flex", justifyContent:"center", marginBottom:10 }}>
              <button
                onMouseDown={() => registerDrop()}
                style={{ background:"linear-gradient(180deg,#2a8a2a 0%,#1a6a1a 100%)",
                  border:"none", borderBottom:"4px solid #0a4a0a", borderRadius:"50%",
                  width:76, height:76, color:"#fff",
                  fontFamily:"'Share Tech Mono',monospace", fontSize:"10px", fontWeight:"700",
                  cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center",
                  justifyContent:"center", boxShadow:"0 4px 12px rgba(0,0,0,0.2)",
                  userSelect:"none", outline:"none", lineHeight:1.4 }}>
                <span style={{ fontSize:20 }}>💧</span>
                <span>DROP</span>
              </button>
            </div>

            <div style={{ textAlign:"center", fontSize:9, color:"#5a7a5a", marginBottom:14 }}>
              Click or&nbsp;
              <kbd style={{ background:"#1e2a1e", border:"1px solid #3a5a3a", borderRadius:3, padding:"1px 5px", fontSize:9, color:"#8ab08a" }}>SPACE</kbd>
            </div>

            {/* Drip set selector */}
            <div style={{ borderTop:"1px solid #2a3a2a", paddingTop:12 }}>
              <div style={{ fontSize:10, letterSpacing:"0.13em", color:"#5a9a5a", marginBottom:8, textTransform:"uppercase" }}>
                Drip Set
              </div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {DRIP_SETS.map((ds,i) => (
                  <button key={i} onClick={() => setDripSetIdx(i)} style={{
                    background: dripSetIdx===i?"#1a6a1a":"#1a221a",
                    border:`1.5px solid ${dripSetIdx===i?"#2a8a2a":"#2a402a"}`,
                    borderRadius:5, color:dripSetIdx===i?"#c8f0c8":"#5a8a5a",
                    fontSize:10, padding:"5px 10px", cursor:"pointer",
                    fontFamily:"'Share Tech Mono',monospace",
                    fontWeight:dripSetIdx===i?"700":"400", transition:"all 0.1s",
                    lineHeight:1.4,
                  }}>
                    <div style={{ fontWeight:700 }}>{ds.gtt} gtt</div>
                    <div style={{ fontSize:8, opacity:0.75, marginTop:1 }}>{ds.note.split("–")[0].trim()}</div>
                  </button>
                ))}
              </div>
              <div style={{ fontSize:9, color:"#5a7a5a", marginTop:5 }}>
                Active: <b style={{ color:"#7ab07a" }}>{dripSet.label}</b> — {dripSet.note}
              </div>
            </div>
          </div>

          {/* Live stats */}
          <div style={{ background:"#161d16", border:"1px solid #2a3a2a", borderRadius:8, padding:"10px 14px",
            boxShadow:"0 1px 4px rgba(0,0,0,0.3)", fontSize:10.5 }}>
            <div style={{ fontSize:10, letterSpacing:"0.13em", color:"#5a9a5a", marginBottom:8, textTransform:"uppercase" }}>
              Live Computed Values
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"3px 14px", color:"#8ab08a", lineHeight:1.9 }}>
              {[
                ["Avg flow",    flowMlh>0?`${flowMlh.toFixed(1)} mL/h`:"—",           "#44cc44"],
                ["Inst flow",   instFlowMlh>0?`${instFlowMlh.toFixed(1)} mL/h`:"—",  "#44cc44"],
                ["Total drops", String(dropCount),                                      "#44cc44"],
                ["Total vol.",  `${totalMl.toFixed(2)} mL`,                            "#44cc44"],
                ["Elapsed",     `${eH}:${eM}:${eS}`,                                  "#44cc44"],
                ["Armed target",armedFlow?`${armedFlow.toFixed(1)} mL/h`:"—",          armedFlow?"#5aee5a":"#555"],
                ["Deviation",   armedFlow&&flowMlh>0?`${devP>=0?"+":""}${devP.toFixed(1)}%`:"—",
                  alLv==="HIGH"?"#ff5533":alLv==="WARN"?"#ffaa22":"#44cc44"],
                ["Drip factor", `${GTT_PER_ML} gtt/mL`,                               "#44cc44"],
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
                Demo: 8s no-flow timeout
              </label>
              <button onClick={hardReset} style={{ marginLeft:"auto", background:"#2a1010",
                border:"1px solid #6a2222", borderRadius:4, color:"#ee4444",
                fontSize:9, padding:"3px 8px", cursor:"pointer", fontFamily:"'Share Tech Mono',monospace" }}>
                RESET
              </button>
            </div>
          </div>

          {/* Screen jumps */}
          <div>
            <div style={{ fontSize:10, letterSpacing:"0.13em", color:"#4a7a4a", marginBottom:5 }}>JUMP TO SCREEN</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
              {[
                {l:"Boot",s:S.BOOT},{l:"Measuring",s:S.MEASURING},{l:"Main",s:S.MAIN},
                {l:"Armed",s:S.ARMED},{l:"⚠ Warn",s:S.ALARM_WARN},{l:"🔴 Alarm",s:S.ALARM_HIGH},
                {l:"No Flow",s:S.ALARM_NOFLOW},{l:"Low Bat",s:S.ALARM_LOWBAT},
              ].map(({l,s}) => (
                <button key={s} onClick={() => {
                  if(s===S.BOOT){bootDone.current=false;}
                  if(s===S.MEASURING){measDone.current=false;}
                  if([S.ARMED,S.ALARM_WARN,S.ALARM_HIGH].includes(s)&&flowMlh>0) setArmedFlow(flowMlh);
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

        {/* ── RIGHT: spec ── */}
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ fontSize:10, letterSpacing:"0.16em", color:"#4a7a4a", textTransform:"uppercase" }}>Design Specification</div>

          {/* Spec cards */}
          {[
            {
              title:"Drop → Flow Algorithm", color:"#1a6a1a",
              rows:[
                ["Each drop",   "Timestamp in ms (equivalent to EXTI interrupt on STM32)"],
                ["Inst. flow",  `dt = now − prev_ms  →  3 600 000 ÷ (dt × ${GTT_PER_ML}) = mL/h`],
                ["Avg. flow",   `Moving average over last ${FLOW_AVG_WINDOW} inter-drop intervals`],
                ["Total vol.",  `drop_count ÷ ${GTT_PER_ML} gtt/mL = mL infused`],
                ["No-flow WD",  `${demoMode?"8 s (demo)":"60 s"} since last drop → ALARM_NOFLOW`],
                ["Drip change", "Recalculates flow & volume instantly from existing buffer"],
              ]
            },
            {
              title:"Button Map", color:"#1a4a9a",
              rows:[
                ["MODE",  "Cycle row-2: Infused / Elapsed / Drops · dismiss alarm → armed/main"],
                ["SET",   "Arm alarm to current avg flow · re-arm if already armed"],
                ["+",     "Disarm alarm (return to unmonitored main)"],
                ["MUTE",  "Silence active alarm · stay on armed screen"],
                ["SPACE", "Keyboard shortcut: simulate a drop"],
              ]
            },
            {
              title:"Alarm Thresholds (Paediatric)", color:"#b85a00",
              rows:[
                ["±15% warn",    "Intermittent beep · row-1 blinks · nurse adjusts clamp"],
                ["±25% alarm",   "Rapid continuous beep · full blink · urgent intervention"],
                ["No flow",      `No drops for ${demoMode?"8 s (demo)":"60 s"} → highest priority`],
                ["Low battery",  "Non-blocking, single beep every 60 s"],
                ["Clinical ref", "IEC 60601-2-24 ±20% for pumps. ±15% warn tightened for paediatric (NICE CG174). Gravity sets show >85% obs outside ±10% (Atanda 2023)"],
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
                  <span style={{ color:sec.color, minWidth:80, flexShrink:0, fontWeight:700 }}>{k}</span>
                  <span style={{ color:"#8ab08a" }}>{v}</span>
                </div>
              ))}
            </div>
          ))}

          {/* Alarm band visual */}
          <div style={{ background:"#161d16", border:"1px solid #2a3a2a", borderRadius:7, padding:"11px 14px", boxShadow:"0 1px 4px rgba(0,0,0,0.3)" }}>
            <div style={{ fontSize:10, fontWeight:700, color:"#7a9a7a", letterSpacing:"0.12em", marginBottom:10, textTransform:"uppercase" }}>
              Alarm Bands
            </div>
            {(() => {
              const c   = armedFlow||(flowMlh>0?flowMlh:100);
              const lo25= (c*0.75).toFixed(1); const lo15=(c*0.85).toFixed(1);
              const hi15= (c*1.15).toFixed(1); const hi25=(c*1.25).toFixed(1);
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
                    Target: <b style={{ color:"#8ab08a" }}>{c.toFixed(1)}</b> mL/h {armedFlow?"(armed)":"(arm to update)"}
                    {armedFlow&&flowMlh>0&&(
                      <span style={{ marginLeft:8, fontWeight:700,
                        color:alLv==="HIGH"?"#ff5533":alLv==="WARN"?"#ffaa22":"#44cc44" }}>
                        · {flowMlh.toFixed(1)} mL/h ({devP>=0?"+":""}{devP.toFixed(1)}%)
                        → {alLv==="NONE"?"✓ OK":alLv==="WARN"?"⚠ WARN":"🔴 ALARM"}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize:8, color:"#3a5a3a", textAlign:"center", marginTop:3 }}>
                    {GTT_PER_ML} gtt/mL · avg over last {FLOW_AVG_WINDOW} intervals
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Drop rate reference table */}
          <div style={{ background:"#161d16", border:"1px solid #2a3a2a", borderRadius:7, padding:"11px 14px", boxShadow:"0 1px 4px rgba(0,0,0,0.3)" }}>
            <div style={{ fontSize:10, fontWeight:700, color:"#7a9a7a", letterSpacing:"0.12em", marginBottom:8, textTransform:"uppercase" }}>
              Reference: drops/min for target flow
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:"2px 0", fontSize:9 }}>
              {/* header */}
              <div style={{ color:"#4a6a4a", borderBottom:"1px solid #2a3a2a", paddingBottom:3 }}>mL/h</div>
              {DRIP_SETS.map(ds=>(
                <div key={ds.gtt} style={{ color:dripSetIdx===DRIP_SETS.indexOf(ds)?"#44cc44":"#4a6a4a",
                  fontWeight:dripSetIdx===DRIP_SETS.indexOf(ds)?"700":"400",
                  borderBottom:"1px solid #2a3a2a", paddingBottom:3 }}>{ds.gtt}gtt</div>
              ))}
              {[20,40,60,80,100,125,150,200].map(rate=>(
                [
                  <div key={`r${rate}`} style={{ color:"#5a8a5a", padding:"2px 0", borderBottom:"1px solid #1e2a1e" }}>{rate}</div>,
                  ...DRIP_SETS.map(ds=>{
                    const dpm=(rate*ds.gtt/60).toFixed(1);
                    const sel=dripSetIdx===DRIP_SETS.indexOf(ds);
                    return <div key={`${rate}-${ds.gtt}`} style={{ color:sel?"#44cc44":"#4a6a4a",
                      fontWeight:sel?"700":"400", padding:"2px 0", borderBottom:"1px solid #1e2a1e" }}>{dpm}</div>;
                  })
                ]
              ))}
            </div>
            <div style={{ fontSize:8, color:"#3a5a3a", marginTop:5 }}>Highlighted column = active drip set.</div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:920, margin:"14px auto 0", fontSize:9, color:"#3a5a3a", textAlign:"center", lineHeight:1.8 }}>
        Clinical: ±15% warn · ±25% alarm · NICE CG174 · IEC 60601-2-24 · Atanda et al. PMC 2023
      </div>

      {/* ── SIMULATION SECTION ─────────────────────────────────────────────── */}
      <div style={{ maxWidth:1400, margin:"28px auto 0" }}>
        {/* Section divider */}
        <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:14 }}>
          <div style={{ flex:1, height:1, background:"linear-gradient(to right, transparent, #c8d8c8)" }}/>
          <div style={{
            fontSize:10, letterSpacing:"0.18em", color:"#4a7a4a", fontWeight:700,
            textTransform:"uppercase", whiteSpace:"nowrap",
            fontFamily:"'Share Tech Mono','Courier New',monospace",
          }}>
            Physics Simulation — Dual-Beam Sensor Module
          </div>
          <div style={{ flex:1, height:1, background:"linear-gradient(to left, transparent, #c8d8c8)" }}/>
        </div>

        {/* Sim description blurb */}
        <p style={{
          fontSize:10, color:"#6a8a6a", marginBottom:12, lineHeight:1.7,
          fontFamily:"'Share Tech Mono','Courier New',monospace",
          background:"#f4f8f4", border:"1px solid #d8e8d8", borderRadius:6,
          padding:"8px 14px",
        }}>
          The simulation below shows the Dripito sensor module (left) clipped onto a transparent drip chamber.
          Two IR beams — TX\u2081/RX\u2081 and TX\u2082/RX\u2082 — detect each drop in real time.
          Transit time \u0394t between the beams is used to estimate drop velocity and volume without nurse interaction.
        </p>

        {/* Dark sim panel */}
        <div style={{
          borderRadius:12, overflow:"hidden",
          border:"1.5px solid #1a2a1a",
          boxShadow:"0 8px 32px rgba(0,0,0,0.25)",
        }}>
          <DripitoSim />
        </div>
      </div>
    </div>
  );
}