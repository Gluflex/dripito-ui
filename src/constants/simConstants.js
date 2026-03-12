export const SIM = {
  nozzleY_mm: 0,
  beam1Y_mm: 25,
  beam2Y_mm: 35,
  chamberBottom_mm: 60,
  chamberWidth_mm: 22,
  g: 9810,
  beamGap_mm: 10,
};

export const VIS = {
  scale: 6.0,
  chamberX: 260,
  chamberTop: 50,
  get nozzleY()     { return this.chamberTop + SIM.nozzleY_mm * this.scale; },
  get beam1Y()      { return this.chamberTop + SIM.beam1Y_mm * this.scale; },
  get beam2Y()      { return this.chamberTop + SIM.beam2Y_mm * this.scale; },
  get chamberBot()  { return this.chamberTop + SIM.chamberBottom_mm * this.scale; },
  get chamberLeft() { return this.chamberX - (SIM.chamberWidth_mm / 2) * this.scale; },
  get chamberRight(){ return this.chamberX + (SIM.chamberWidth_mm / 2) * this.scale; },
};

export const TIME_SCALE = 0.15;

export const FLUIDS = {
  nacl:  { name: "NaCl 0.9%",          gamma: 72.0, rho: 1005, color: "#a8d8ea", nozzleDia: 4.0 },
  ringer:{ name: "Ringer's Lactate",    gamma: 71.5, rho: 1005, color: "#b8e6c8", nozzleDia: 4.0 },
  d5w:   { name: "D5W (5% Dextrose)",   gamma: 68.0, rho: 1020, color: "#f5e6a3", nozzleDia: 4.0 },
  d10w:  { name: "D10W (10% Dextrose)", gamma: 64.0, rho: 1040, color: "#f0d080", nozzleDia: 4.0 },
};
