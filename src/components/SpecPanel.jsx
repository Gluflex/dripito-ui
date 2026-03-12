import { DRIP_SETS, FLOW_AVG_WINDOW } from "../constants/deviceConstants";

export default function SpecPanel({
  GTT_PER_ML, demoMode, armedFlow, flowMlh, alarmLevel, devP, dripSetIdx,
}) {
  const alLv = alarmLevel;
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ fontSize:10, letterSpacing:"0.16em", color:"#6a8a6a", textTransform:"uppercase" }}>Design Specification</div>

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
        <div key={sec.title} style={{ background:"#fff", border:`1px solid ${sec.color}33`,
          borderLeft:`3px solid ${sec.color}`, borderRadius:"0 7px 7px 0",
          padding:"11px 14px", boxShadow:"0 1px 4px rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize:10, fontWeight:700, color:sec.color, letterSpacing:"0.12em", marginBottom:8, textTransform:"uppercase" }}>
            {sec.title}
          </div>
          {sec.rows.map(([k, v], i) => (
            <div key={i} style={{ display:"flex", gap:10, marginBottom:5, fontSize:10.5, lineHeight:1.55 }}>
              <span style={{ color:sec.color, minWidth:80, flexShrink:0, fontWeight:700 }}>{k}</span>
              <span style={{ color:"#3a4a3a" }}>{v}</span>
            </div>
          ))}
        </div>
      ))}

      {/* Alarm band visual */}
      <div style={{ background:"#fff", border:"1px solid #ddd", borderRadius:7, padding:"11px 14px", boxShadow:"0 1px 4px rgba(0,0,0,0.05)" }}>
        <div style={{ fontSize:10, fontWeight:700, color:"#555", letterSpacing:"0.12em", marginBottom:10, textTransform:"uppercase" }}>
          Alarm Bands
        </div>
        {(() => {
          const c    = armedFlow || (flowMlh > 0 ? flowMlh : 100);
          const lo25 = (c * 0.75).toFixed(1); const lo15 = (c * 0.85).toFixed(1);
          const hi15 = (c * 1.15).toFixed(1); const hi25 = (c * 1.25).toFixed(1);
          return (
            <div>
              <div style={{ display:"flex", borderRadius:4, overflow:"hidden", fontSize:9, marginBottom:5 }}>
                {[
                  {bg:"#ff4444", label:`ALARM\n<${lo25}`,     flex:1},
                  {bg:"#ffaa00", label:`WARN\n${lo25}–${lo15}`,flex:1},
                  {bg:"#44aa44", label:`OK\n${lo15}–${hi15}`,  flex:1.6, bold:true},
                  {bg:"#ffaa00", label:`WARN\n${hi15}–${hi25}`,flex:1},
                  {bg:"#ff4444", label:`ALARM\n>${hi25}`,      flex:1},
                ].map((seg, i) => (
                  <div key={i} style={{ background:seg.bg, color:"#fff", flex:seg.flex,
                    padding:"4px 2px", textAlign:"center", whiteSpace:"pre-line",
                    fontWeight:seg.bold?"700":"400", lineHeight:1.4 }}>{seg.label}</div>
                ))}
              </div>
              <div style={{ fontSize:9, color:"#888", textAlign:"center", lineHeight:1.7 }}>
                Target: <b>{c.toFixed(1)}</b> mL/h {armedFlow?"(armed)":"(arm to update)"}
                {armedFlow && flowMlh > 0 && (
                  <span style={{ marginLeft:8, fontWeight:700,
                    color:alLv==="HIGH"?"#cc2200":alLv==="WARN"?"#cc7700":"#2a8a2a" }}>
                    · {flowMlh.toFixed(1)} mL/h ({devP>=0?"+":""}{devP.toFixed(1)}%)
                    → {alLv==="NONE"?"✓ OK":alLv==="WARN"?"⚠ WARN":"🔴 ALARM"}
                  </span>
                )}
              </div>
              <div style={{ fontSize:8, color:"#aaa", textAlign:"center", marginTop:3 }}>
                {GTT_PER_ML} gtt/mL · avg over last {FLOW_AVG_WINDOW} intervals
              </div>
            </div>
          );
        })()}
      </div>

      {/* Drop rate reference table */}
      <div style={{ background:"#fff", border:"1px solid #ddd", borderRadius:7, padding:"11px 14px", boxShadow:"0 1px 4px rgba(0,0,0,0.05)" }}>
        <div style={{ fontSize:10, fontWeight:700, color:"#555", letterSpacing:"0.12em", marginBottom:8, textTransform:"uppercase" }}>
          Reference: drops/min for target flow
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:"2px 0", fontSize:9 }}>
          <div style={{ color:"#999", borderBottom:"1px solid #eee", paddingBottom:3 }}>mL/h</div>
          {DRIP_SETS.map(ds => (
            <div key={ds.gtt} style={{ color:dripSetIdx===DRIP_SETS.indexOf(ds)?"#1a6a1a":"#999",
              fontWeight:dripSetIdx===DRIP_SETS.indexOf(ds)?"700":"400",
              borderBottom:"1px solid #eee", paddingBottom:3 }}>{ds.gtt}gtt</div>
          ))}
          {[20, 40, 60, 80, 100, 125, 150, 200].map(rate => (
            [
              <div key={`r${rate}`} style={{ color:"#3a5a3a", padding:"2px 0", borderBottom:"1px solid #f4f4f4" }}>{rate}</div>,
              ...DRIP_SETS.map(ds => {
                const dpm = (rate * ds.gtt / 60).toFixed(1);
                const sel = dripSetIdx === DRIP_SETS.indexOf(ds);
                return <div key={`${rate}-${ds.gtt}`} style={{ color:sel?"#1a4a1a":"#6a8a6a",
                  fontWeight:sel?"700":"400", padding:"2px 0", borderBottom:"1px solid #f4f4f4" }}>{dpm}</div>;
              })
            ]
          ))}
        </div>
        <div style={{ fontSize:8, color:"#aaa", marginTop:5 }}>Highlighted column = active drip set.</div>
      </div>
    </div>
  );
}
