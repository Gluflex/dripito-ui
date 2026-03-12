import { DRIP_SETS } from "../constants/deviceConstants";

export default function DropSimulatorPanel({ onDrop, dripSetIdx, dripSet, onDripSetChange }) {
  return (
    <div style={{ background:"#fff", border:"1.5px solid #b8d8b8", borderRadius:10, padding:"14px",
      boxShadow:"0 2px 8px rgba(0,0,0,0.07)" }}>
      <div style={{ fontSize:10, letterSpacing:"0.15em", color:"#4a7a4a", marginBottom:12, textTransform:"uppercase" }}>
        Drop Simulator
      </div>

      {/* Big DROP button */}
      <div style={{ display:"flex", justifyContent:"center", marginBottom:10 }}>
        <button
          onMouseDown={() => onDrop()}
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

      <div style={{ textAlign:"center", fontSize:9, color:"#6a8a6a", marginBottom:14 }}>
        Click or&nbsp;
        <kbd style={{ background:"#f0f0ec", border:"1px solid #ccc", borderRadius:3, padding:"1px 5px", fontSize:9 }}>SPACE</kbd>
      </div>

      {/* Drip set selector */}
      <div style={{ borderTop:"1px solid #e8ece8", paddingTop:12 }}>
        <div style={{ fontSize:10, letterSpacing:"0.13em", color:"#4a7a4a", marginBottom:8, textTransform:"uppercase" }}>
          Drip Set
        </div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {DRIP_SETS.map((ds, i) => (
            <button key={i} onClick={() => onDripSetChange(i)} style={{
              background: dripSetIdx===i?"#1a6a1a":"#f0f4f0",
              border:`1.5px solid ${dripSetIdx===i?"#1a6a1a":"#c8d8c8"}`,
              borderRadius:5, color:dripSetIdx===i?"#fff":"#3a5a3a",
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
        <div style={{ fontSize:9, color:"#8aaa8a", marginTop:5 }}>
          Active: <b>{dripSet.label}</b> — {dripSet.note}
        </div>
      </div>
    </div>
  );
}
