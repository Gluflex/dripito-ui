import { useState, useEffect, useRef, useCallback } from "react";
import { DRIP_SETS, FLOW_AVG_WINDOW, NO_FLOW_DEMO, NO_FLOW_REAL, S } from "../constants/deviceConstants";
import { calcInstFlow, calcAvgFlow, calcTotalMl } from "../utils/flowCalc";

export function useDripMonitor() {
  // drip set
  const [dripSetIdx, setDripSetIdx] = useState(2);
  const dripSet    = DRIP_SETS[dripSetIdx];
  const GTT_PER_ML = dripSet.gtt;

  // drop tracking refs (no re-render on every drop, mirrors firmware)
  const intervalBuffer = useRef([]);
  const lastDropTime   = useRef(null);
  const noFlowTimer    = useRef(null);
  const startTime      = useRef(null);

  // reactive state
  const [dropCount,   setDropCount]   = useState(0);
  const [flowMlh,     setFlowMlh]     = useState(0);
  const [instFlowMlh, setInstFlowMlh] = useState(0);
  const [totalMl,     setTotalMl]     = useState(0);
  const [elapsedMs,   setElapsedMs]   = useState(0);

  // UI state
  const [screen,    setScreen]    = useState(S.BOOT);
  const [infoMode,  setInfoMode]  = useState(0);
  const [armedFlow, setArmedFlow] = useState(null);
  const [demoMode,  setDemoMode]  = useState(true);
  const [blink,     setBlink]     = useState(true);
  const [blinkFast, setBlinkFast] = useState(true);

  const bootDone = useRef(false);
  const measDone = useRef(false);

  // Ref copies for use inside callbacks — must stay at hook body top level
  const armedFlowRef = useRef(null);
  const gttRef       = useRef(GTT_PER_ML);
  const screenRef    = useRef(S.BOOT);
  armedFlowRef.current = armedFlow;
  gttRef.current       = GTT_PER_ML;
  screenRef.current    = screen;

  // blink tickers
  useEffect(() => {
    const t1 = setInterval(() => setBlink(b => !b), 600);
    const t2 = setInterval(() => setBlinkFast(b => !b), 280);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, []);

  // elapsed timer
  useEffect(() => {
    const active = [S.MAIN, S.ARMED, S.ALARM_WARN, S.ALARM_HIGH, S.ALARM_NOFLOW];
    if (!active.includes(screen)) return;
    const t = setInterval(() => {
      if (startTime.current) setElapsedMs(Date.now() - startTime.current);
    }, 500);
    return () => clearInterval(t);
  }, [screen]);

  // boot sequence
  useEffect(() => {
    if (screen === S.BOOT && !bootDone.current) {
      bootDone.current = true;
      setTimeout(() => { setScreen(S.MEASURING); measDone.current = false; }, 2500);
    }
    if (screen === S.MEASURING && !measDone.current) {
      measDone.current = true;
      startTime.current = Date.now();
      setTimeout(() => setScreen(S.MAIN), 4000);
    }
  }, [screen]);

  // no-flow watchdog
  const resetNoFlowTimer = useCallback(() => {
    if (noFlowTimer.current) clearTimeout(noFlowTimer.current);
    const timeout = demoMode ? NO_FLOW_DEMO : NO_FLOW_REAL;
    noFlowTimer.current = setTimeout(() => setScreen(S.ALARM_NOFLOW), timeout);
  }, [demoMode]);

  useEffect(() => {
    const monitoring = [S.MAIN, S.ARMED, S.ALARM_WARN, S.ALARM_HIGH];
    if (monitoring.includes(screen)) resetNoFlowTimer();
    return () => { if (noFlowTimer.current) clearTimeout(noFlowTimer.current); };
  }, [screen, resetNoFlowTimer]);

  // ── Core drop handler (mirrors EXTI ISR + flow calc in firmware) ────────────
  const registerDrop = useCallback(() => {
    const now    = Date.now();
    const gtt    = gttRef.current;
    const armed  = armedFlowRef.current;
    const curScr = screenRef.current;

    const valid = [S.MAIN, S.ARMED, S.ALARM_WARN, S.ALARM_HIGH, S.ALARM_NOFLOW, S.MEASURING];
    if (!valid.includes(curScr)) return;

    resetNoFlowTimer();

    let newInst = 0;
    let newAvg  = 0;

    if (lastDropTime.current !== null) {
      const dt = now - lastDropTime.current;
      newInst  = calcInstFlow(dt, gtt);

      intervalBuffer.current.push(dt);
      if (intervalBuffer.current.length > FLOW_AVG_WINDOW)
        intervalBuffer.current.shift();

      newAvg = calcAvgFlow(intervalBuffer.current, gtt);
    }
    lastDropTime.current = now;

    setDropCount(prev => {
      const n = prev + 1;
      setTotalMl(calcTotalMl(n, gtt));
      return n;
    });
    setInstFlowMlh(Math.round(newInst * 10) / 10);
    setFlowMlh(Math.round(newAvg * 10) / 10);

    if (armed !== null && intervalBuffer.current.length >= 1) {
      const dev = Math.abs(newAvg - armed) / armed;
      setScreen(prev => {
        if (prev === S.ALARM_NOFLOW) return S.ARMED;
        if (dev >= 0.25) return S.ALARM_HIGH;
        if (dev >= 0.15) return S.ALARM_WARN;
        return S.ARMED;
      });
    } else if (curScr === S.ALARM_NOFLOW) {
      setScreen(armedFlowRef.current ? S.ARMED : S.MAIN);
    }
  }, [resetNoFlowTimer]);

  // keyboard shortcut: SPACE = drop
  useEffect(() => {
    const handler = (e) => {
      if (e.code === "Space") { e.preventDefault(); registerDrop(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [registerDrop]);

  // recalculate flow when drip set changes
  useEffect(() => {
    if (intervalBuffer.current.length > 0) {
      setFlowMlh(Math.round(calcAvgFlow(intervalBuffer.current, GTT_PER_ML) * 10) / 10);
    }
    setDropCount(prev => { setTotalMl(calcTotalMl(prev, GTT_PER_ML)); return prev; });
  // eslint-disable-next-line
  }, [GTT_PER_ML]);

  // ── Button handlers ─────────────────────────────────────────────────────────
  function handleMode() {
    if ([S.MAIN, S.ARMED].includes(screen)) setInfoMode(m => (m + 1) % 3);
    else if ([S.ALARM_WARN, S.ALARM_HIGH, S.ALARM_NOFLOW, S.ALARM_LOWBAT].includes(screen))
      setScreen(armedFlow ? S.ARMED : S.MAIN);
  }
  function handleSet() {
    if ([S.MAIN, S.MEASURING, S.ARMED].includes(screen) && flowMlh > 0) {
      setArmedFlow(flowMlh); setScreen(S.ARMED);
    }
  }
  function handlePlus() {
    if ([S.ARMED, S.ALARM_WARN, S.ALARM_HIGH].includes(screen)) { setArmedFlow(null); setScreen(S.MAIN); }
  }
  function handleMute() {
    if ([S.ALARM_WARN, S.ALARM_HIGH, S.ALARM_NOFLOW, S.ALARM_LOWBAT].includes(screen))
      setScreen(armedFlow ? S.ARMED : S.MAIN);
  }

  function hardReset() {
    intervalBuffer.current = []; lastDropTime.current = null; startTime.current = null;
    if (noFlowTimer.current) clearTimeout(noFlowTimer.current);
    setDropCount(0); setFlowMlh(0); setInstFlowMlh(0); setTotalMl(0); setElapsedMs(0);
    setArmedFlow(null); bootDone.current = false; measDone.current = false; setScreen(S.BOOT);
  }

  // expose bootDone/measDone refs for ScreenJumper
  const _bootDone = bootDone;
  const _measDone = measDone;

  return {
    // drip set
    dripSetIdx, setDripSetIdx, dripSet, GTT_PER_ML,
    // measurements
    dropCount, flowMlh, instFlowMlh, totalMl, elapsedMs,
    // device state
    screen, setScreen, infoMode, armedFlow, setArmedFlow, demoMode, setDemoMode,
    blink, blinkFast,
    // actions
    registerDrop, handleMode, handleSet, handlePlus, handleMute, hardReset,
    // internal refs needed by ScreenJumper jump buttons
    _bootDone, _measDone,
  };
}
