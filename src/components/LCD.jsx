const LCD_FONT_URL = "https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap";

export default function LCD({ lines, alarmLevel }) {
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
