// Design tokens for recurring color values across the app.
// Import these instead of using magic hex strings directly.

export const COLORS = {
  // Brand greens
  green: {
    darkest: "#0a4a0a",
    dark:    "#1a4a1a",
    medium:  "#1a6a1a",
    light:   "#2a8a2a",
    muted:   "#4a7a4a",
    soft:    "#6a8a6a",
    pale:    "#8aaa8a",
  },
  // Device body
  device: {
    bg:      "#e8eae6",
    border:  "#c8c8c4",
    panelBg: "#f0f4f0",
  },
  // LCD display
  lcd: {
    bgNormal: "#c8d87a",
    bgWarn:   "#d0e87a",
    bgHigh:   "#c8e87a",
    border:   "#6a7a40",
    text:     "#151e08",
  },
  // Alarm levels
  alarm: {
    high:  "#cc2200",
    warn:  "#cc7700",
    ok:    "#2a8a2a",
    red:   "#ff4444",
    amber: "#ffaa00",
    greenBand: "#44aa44",
  },
  // Simulation (dark theme)
  sim: {
    bg:         "#050810",
    panelBg:    "#0a0e14",
    panelBorder:"#151e28",
    text:       "#b0c4d4",
    accent:     "#6aacbc",
  },
};
