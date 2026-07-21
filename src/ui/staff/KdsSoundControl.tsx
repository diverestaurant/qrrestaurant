"use client";

import { useEffect, useRef, useState } from "react";

export function KdsSoundControl({ ticketCount }: { ticketCount: number }) {
  const audioContext = useRef<AudioContext | null>(null);
  const previousCount = useRef(ticketCount);
  const [armed, setArmed] = useState(false);
  const [message, setMessage] = useState("Sound off");

  function beep() {
    const context = audioContext.current;
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.18);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.2);
  }

  async function enableAndTest() {
    audioContext.current ??= new AudioContext();
    await audioContext.current.resume();
    setArmed(true);
    setMessage("Sound armed; visual tickets remain authoritative");
    beep();
  }

  useEffect(() => {
    if (armed && ticketCount > previousCount.current) beep();
    previousCount.current = ticketCount;
  }, [armed, ticketCount]);

  return <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-muted" role="status">{message}</span><button className="min-h-11 rounded-full border px-4 text-sm font-semibold hover:bg-background" onClick={() => void enableAndTest()}>{armed ? "Test sound" : "Enable & test sound"}</button></div>;
}
