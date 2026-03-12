import { S } from "../constants/deviceConstants";

export default function ScreenJumper({ screen, flowMlh, onJump, bootDoneRef, measDoneRef, setArmedFlow }) {
  const screens = [
    {l:"Boot",    s:S.BOOT},
    {l:"Measuring",s:S.MEASURING},
    {l:"Main",   s:S.MAIN},
    {l:"Armed",  s:S.ARMED},
    {l:"⚠ Warn", s:S.ALARM_WARN},
    {l:"🔴 Alarm",s:S.ALARM_HIGH},
    {l:"No Flow",s:S.ALARM_NOFLOW},
    {l:"Low Bat",s:S.ALARM_LOWBAT},
  ];
  return (
    <div>
      <div style={{ fontSize:10, letterSpacing:"0.13em", color:"#6a8a6a", marginBottom:5 }}>JUMP TO SCREEN</div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
        {screens.map(({l, s}) => (
          <button key={s} onClick={() => {
            if (s === S.BOOT)     { bootDoneRef.current = false; }
            if (s === S.MEASURING){ measDoneRef.current = false; }
            if ([S.ARMED, S.ALARM_WARN, S.ALARM_HIGH].includes(s) && flowMlh > 0) setArmedFlow(flowMlh);
            onJump(s);
          }} style={{
            background: screen===s?"#e0f0e0":"#f0f0ec",
            border:`1px solid ${screen===s?"#4a9a4a":"#ccc"}`,
            borderRadius:4, color:screen===s?"#1a6a1a":"#666",
            fontSize:9, padding:"3px 7px", cursor:"pointer",
            fontFamily:"'Share Tech Mono',monospace",
          }}>{l}</button>
        ))}
      </div>
    </div>
  );
}
