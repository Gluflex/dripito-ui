import { useState } from "react";

export default function Btn({ label, sublabel, color, bg, onClick, red }) {
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
