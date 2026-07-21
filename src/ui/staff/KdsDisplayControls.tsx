"use client";

import { useState } from "react";

export function KdsDisplayControls() {
  const [compact, setCompact] = useState(false);
  function toggle() {
    const next = !compact;
    setCompact(next);
    document.documentElement.dataset.kdsDensity = next ? "compact" : "comfortable";
  }
  return <button aria-pressed={compact} className="min-h-11 rounded-full border px-4 text-sm font-semibold" onClick={toggle}>{compact ? "Comfortable density" : "High-peak density"}</button>;
}
