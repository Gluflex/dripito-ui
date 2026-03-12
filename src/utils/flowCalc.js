// mL/h from a single inter-drop interval
export function calcInstFlow(dt_ms, gtt) {
  return (3600 * 1000) / (dt_ms * gtt);
}

// mL/h from an array of inter-drop intervals
export function calcAvgFlow(buffer, gtt) {
  const avgDt = buffer.reduce((a, b) => a + b, 0) / buffer.length;
  return (3600 * 1000) / (avgDt * gtt);
}

// total volume from drop count
export function calcTotalMl(dropCount, gtt) {
  return dropCount / gtt;
}
