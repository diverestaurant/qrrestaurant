import type { Freshness } from "@/contracts/view-models";

export type FreshnessPresentation = {
  label: string;
  detail: string;
  tone: "success" | "info" | "warning";
};

export function presentFreshness(freshness: Freshness): FreshnessPresentation {
  switch (freshness) {
    case "fresh":
      return { label: "App reachable", detail: "Authoritative refresh available", tone: "success" };
    case "reconnecting":
      return { label: "Reconnecting", detail: "Checking the local app…", tone: "info" };
    case "stale":
      return { label: "Check required", detail: "The latest state is not confirmed", tone: "warning" };
    case "offline":
      return { label: "Offline", detail: "Use the manual fallback until connection returns", tone: "warning" };
  }
}
