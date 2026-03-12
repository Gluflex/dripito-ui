export const DRIP_SETS = [
  { label: "10 gtt/mL", gtt: 10, note: "Macro – rapid infusion" },
  { label: "15 gtt/mL", gtt: 15, note: "Macro – standard adult" },
  { label: "20 gtt/mL", gtt: 20, note: "Macro – standard adult" },
  { label: "60 gtt/mL", gtt: 60, note: "Micro – paediatric/neonate" },
];

export const FLOW_AVG_WINDOW = 5;
export const NO_FLOW_DEMO    = 8000;   // ms — short for demo
export const NO_FLOW_REAL    = 60000;  // ms — 60s real clinical

export const S = {
  BOOT: "BOOT",
  MEASURING: "MEASURING",
  MAIN: "MAIN",
  ARMED: "ARMED",
  ALARM_WARN: "ALARM_WARN",
  ALARM_HIGH: "ALARM_HIGH",
  ALARM_NOFLOW: "ALARM_NOFLOW",
  ALARM_LOWBAT: "ALARM_LOWBAT",
};

export const INFO_MODES = ["INFUSED", "ELAPSED", "DROPS"];
