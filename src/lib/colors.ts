import { DOMAIN, type Window } from "./constants";

const FLAT = "#2a2f3a";
const G_MID = "#1f7a44";
const G_HI = "#11d676";
const R_MID = "#7a2330";
const R_HI = "#ff4d5e";

function hx(h: string): [number, number, number] {
  const clean = h.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function mix(a: string, b: string, t: number): string {
  const A = hx(a);
  const B = hx(b);
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(
    A[1] + (B[1] - A[1]) * t,
  )},${Math.round(A[2] + (B[2] - A[2]) * t)})`;
}

/**
 * Heatmap tile / bubble fill: green when delta > 0 (stock up), red when
 * delta < 0, gray when ~flat. Saturation scales with |delta| / DOMAIN[win].
 */
export function moveFill(delta: number | null, win: Window): string {
  if (delta === null) return FLAT;
  const t = Math.max(-1, Math.min(1, delta / DOMAIN[win]));
  const a = Math.abs(t);
  if (a < 0.045) return FLAT;
  if (t > 0) {
    return mix(FLAT, a < 0.5 ? G_MID : G_HI, a < 0.5 ? a / 0.5 : (a - 0.5) / 0.5);
  }
  return mix(FLAT, a < 0.5 ? R_MID : R_HI, a < 0.5 ? a / 0.5 : (a - 0.5) / 0.5);
}

/** Text color for a delta — softer than the fill colors. */
export function moveText(delta: number | null): string {
  if (delta === null || Math.abs(delta) < 0.05) return "#9aa3b2";
  return delta > 0 ? "#7df2b0" : "#ff9aa6";
}

export { FLAT };
