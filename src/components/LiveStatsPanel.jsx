export default function LiveStatsPanel({
  flowMlh, instFlowMlh, dropCount, totalMl, eH, eM, eS,
  armedFlow, devP, alarmLevel, GTT_PER_ML,
  demoMode, onDemoModeChange, onReset,
}) {
  const alLv = alarmLevel;
  return (
    <div style={{ background:"#fff", border:"1px solid #ddd", borderRadius:8, padding:"10px 14px",
      boxShadow:"0 1px 4px rgba(0,0,0,0.05)", fontSize:10.5 }}>
      <div style={{ fontSize:10, letterSpacing:"0.13em", color:"#6a8a6a", marginBottom:8, textTransform:"uppercase" }}>
        Live Computed Values
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"3px 14px", color:"#3a4a3a", lineHeight:1.9 }}>
        {[
          ["Avg flow",     flowMlh>0?`${flowMlh.toFixed(1)} mL/h`:"—",                   "#1a4a1a"],
          ["Inst flow",    instFlowMlh>0?`${instFlowMlh.toFixed(1)} mL/h`:"—",           "#1a4a1a"],
          ["Total drops",  String(dropCount),                                               "#1a4a1a"],
          ["Total vol.",   `${totalMl.toFixed(2)} mL`,                                    "#1a4a1a"],
          ["Elapsed",      `${eH}:${eM}:${eS}`,                                           "#1a4a1a"],
          ["Armed target", armedFlow?`${armedFlow.toFixed(1)} mL/h`:"—",                  armedFlow?"#1a6a1a":"#999"],
          ["Deviation",    armedFlow&&flowMlh>0?`${devP>=0?"+":""}${devP.toFixed(1)}%`:"—",
            alLv==="HIGH"?"#cc2200":alLv==="WARN"?"#cc7700":"#2a8a2a"],
          ["Drip factor",  `${GTT_PER_ML} gtt/mL`,                                       "#1a4a1a"],
        ].map(([k, v, vc]) => (
          <>
            <span key={k} style={{ color:"#6a8a6a" }}>{k}</span>
            <b key={v} style={{ color:vc }}>{v}</b>
          </>
        ))}
      </div>
      <div style={{ marginTop:8, paddingTop:7, borderTop:"1px solid #eee", display:"flex", gap:8, alignItems:"center" }}>
        <label style={{ fontSize:9, color:"#6a8a6a", display:"flex", alignItems:"center", gap:4, cursor:"pointer" }}>
          <input type="checkbox" checked={demoMode} onChange={e => onDemoModeChange(e.target.checked)} style={{ accentColor:"#1a6a1a" }}/>
          Demo: 8s no-flow timeout
        </label>
        <button onClick={onReset} style={{ marginLeft:"auto", background:"#f8e8e8",
          border:"1px solid #e0b0b0", borderRadius:4, color:"#aa2222",
          fontSize:9, padding:"3px 8px", cursor:"pointer", fontFamily:"'Share Tech Mono',monospace" }}>
          RESET
        </button>
      </div>
    </div>
  );
}
