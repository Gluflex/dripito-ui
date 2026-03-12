import LCD from "./LCD";
import Btn from "./Btn";

export default function DevicePanel({ lines, alarmLevel, onMode, onSet, onPlus, onMute }) {
  return (
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
          <LCD lines={lines} alarmLevel={alarmLevel}/>
        </div>
      </div>
      {/* Buttons */}
      <div style={{ display:"flex", justifyContent:"center", gap:6 }}>
        <Btn label="MODE" sublabel="view/nav"  onClick={onMode}/>
        <Btn label="SET"  sublabel="arm alarm" color="#1a6a1a" bg="#e0f0e0" onClick={onSet}/>
        <Btn label="+"    sublabel="disarm"    onClick={onPlus}/>
        <Btn label="MUTE" sublabel="silence"   red onClick={onMute}/>
      </div>
      <div style={{ textAlign:"center", marginTop:9, fontSize:9, color:"#bbb" }}>↓ CLIP-ON · IV DRIP CHAMBER ↓</div>
    </div>
  );
}
