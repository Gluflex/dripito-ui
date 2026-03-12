import { S } from "../constants/deviceConstants";

export function formatElapsed(elapsedMs) {
  const eTotal = elapsedMs / 1000;
  return {
    eH: String(Math.floor(eTotal / 3600)).padStart(2, "0"),
    eM: String(Math.floor((eTotal % 3600) / 60)).padStart(2, "0"),
    eS: String(Math.floor(eTotal % 60)).padStart(2, "0"),
  };
}

export function alarmLevel(screen) {
  if (screen === S.ALARM_HIGH || screen === S.ALARM_NOFLOW) return "HIGH";
  if (screen === S.ALARM_WARN) return "WARN";
  return "NONE";
}

export function devPct(armedFlow, flowMlh) {
  if (!armedFlow || flowMlh === 0) return 0;
  return (flowMlh - armedFlow) / armedFlow * 100;
}

export function infoRow(infoMode, totalMl, eH, eM, eS, dropCount) {
  if (infoMode === 0) return `Infsd:${totalMl.toFixed(1).padStart(5, " ")} mL`;
  if (infoMode === 1) return `Time: ${eH}:${eM}:${eS}`;
  return `Drops: ${String(dropCount).padStart(5, " ")}  `;
}

export function getLines({ screen, flowMlh, GTT_PER_ML, dropCount, armedFlow, infoMode,
  totalMl, blink, blinkFast, eH, eM, eS, devP }) {
  const flow = flowMlh > 0 ? String(Math.round(flowMlh)).padStart(4, " ")
                           : (screen === S.MEASURING ? "----" : "   0");
  const bat    = `BAT:72%`;
  const gttStr = String(GTT_PER_ML).padStart(2, "0");
  const info   = infoRow(infoMode, totalMl, eH, eM, eS, dropCount);

  switch (screen) {
    case S.BOOT:       return ["                ","  Dripito  V2   ","    ETHZ GHE    ", blink?"                ":"   Loading...   "];
    case S.MEASURING:  return ["-- Measuring -- ",`Flow:${flow} mL/h`,`Drops: ${String(dropCount).padStart(5," ")}   `, blink?"  Please wait.. ":"  Stabilising.. "];
    case S.MAIN:       return [`Flow:${flow} mL/h`, info,`${bat}  ${gttStr}gtt/mL`,"[SET]arm [MODE]+"];
    case S.ARMED:      return [`Flow:${flow} mL/h`, info,`Tgt:${String(Math.round(armedFlow)).padStart(4," ")} ${bat}  `,"[MODE]+ [MUTE]  "];
    case S.ALARM_WARN: {
      const sign = devP >= 0 ? "+" : "-"; const p = Math.abs(devP).toFixed(0).padStart(2, " ");
      return [blinkFast?"> RATE SHIFT <  ":`Flow:${flow} mL/h`,`Dev:${sign}${p}%      `,`Tgt:${String(Math.round(armedFlow)).padStart(4," ")} mL/h  `,"[MUTE] silence  "];
    }
    case S.ALARM_HIGH: {
      const sign = devP >= 0 ? "+" : "-"; const p = Math.abs(devP).toFixed(0).padStart(2, " ");
      return [blinkFast?"!! RATE ALARM !!":"                ",`Flow:${flow} mL/h`,`Dev:${sign}${p}%    !!!`,"[MUTE] silence  "];
    }
    case S.ALARM_NOFLOW: return [blinkFast?"!! NO  FLOW !!!!":"                ",`Last:${String(Math.round(armedFlow||flowMlh)).padStart(4," ")} mL/h`,`${totalMl.toFixed(1).padStart(5," ")} mL infused`,"[MUTE] silence  "];
    case S.ALARM_LOWBAT: return [blinkFast?"!! LOW BATTERY !":"LOW BATTERY     ",`BAT: ~72% left   `,`${totalMl.toFixed(1).padStart(5," ")} mL infused`,"[MUTE] silence  "];
    default: return ["","","",""];
  }
}
