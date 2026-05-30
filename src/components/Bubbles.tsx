"use client";

import { useMemo } from "react";
import {
  forceCollide,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
} from "d3-force";
import { moveFill, moveText } from "@/lib/colors";
import { lastName, fmtDelta } from "@/lib/format";
import type { Window as TfWindow } from "@/lib/constants";
import type { DashboardPlayer } from "@/lib/types";

type Props = {
  data: DashboardPlayer[];
  win: TfWindow;
  sizeBy: "value" | "move" | "uniform";
  onPick: (p: DashboardPlayer) => void;
  onHover: (h: { p: DashboardPlayer; x: number; y: number } | null) => void;
};

const W = 1000;
const H = 620;

// Tiny seeded RNG so a player's bubble float and starting position are
// stable across re-renders.
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Node = {
  p: DashboardPlayer;
  r: number;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
};

export function Bubbles({ data, win, sizeBy, onPick, onHover }: Props) {
  const nodes = useMemo<Node[]>(() => {
    const radius = (p: DashboardPlayer): number => {
      if (sizeBy === "uniform") return 26;
      if (sizeBy === "move") {
        const d = p.d[win];
        if (d === null) return 16;
        return 12 + Math.sqrt(Math.abs(d)) * 9;
      }
      return 8 + Math.pow(Math.max(1, 135 - p.adp), 0.6) * 2.6;
    };

    const arr: Node[] = data.map((p) => {
      const rnd = mulberry32(hashStr(p.n));
      return {
        p,
        r: Math.max(8, radius(p) || 8),
        x: W * (0.12 + rnd() * 0.76),
        y: H * (0.12 + rnd() * 0.76),
      };
    });

    // Normalize total bubble area to ~40% of the canvas — lots of gaps.
    const target = W * H * 0.4;
    const area = arr.reduce((s, d) => s + Math.PI * d.r * d.r, 0) || 1;
    const k = Math.sqrt(target / area);
    arr.forEach((d) => {
      d.r = Math.max(9, Math.min(d.r * k, 92));
    });

    const sim = forceSimulation(arr)
      .force("x", forceX(W / 2).strength(0.022))
      .force("y", forceY(H / 2).strength(0.03))
      .force("charge", forceManyBody().strength(-6))
      .force(
        "collide",
        forceCollide((d) => (d as Node).r + 8)
          .strength(0.92)
          .iterations(3),
      )
      .stop();

    for (let i = 0; i < 300; i++) sim.tick();

    arr.forEach((d) => {
      if (!Number.isFinite(d.x)) d.x = W / 2;
      if (!Number.isFinite(d.y)) d.y = H / 2;
      d.x = Math.max(d.r + 3, Math.min(W - d.r - 3, d.x));
      d.y = Math.max(d.r + 3, Math.min(H - d.r - 3, d.y));
    });

    return arr;
  }, [data, win, sizeBy]);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="viz bub"
      preserveAspectRatio="xMidYMid meet"
    >
      {nodes.map((nd, i) => {
        const { p, r, x, y } = nd;
        const d = p.d[win];
        const col = moveFill(d, win);
        const tc = moveText(d);
        const big = r > 40;
        const mid = r > 22;
        const rnd = mulberry32(hashStr(p.n) + 7);
        const dur = (7 + rnd() * 7).toFixed(2);
        const dly = (-rnd() * 8).toFixed(2);
        const ln = lastName(p.n);
        const label = ln.length > 12 && r < 58 ? `${ln.slice(0, 10)}…` : ln;
        return (
          <g
            key={`${p.id}-${p.n}`}
            transform={`translate(${x},${y})`}
            className="bubble"
            style={{ animationDelay: `${Math.min(i * 7, 420)}ms` }}
          >
            <g
              className="float"
              style={{ animationDuration: `${dur}s`, animationDelay: `${dly}s` }}
              onClick={() => onPick(p)}
              onMouseMove={(e) =>
                onHover({ p, x: e.clientX + 12, y: e.clientY + 12 })
              }
              onMouseLeave={() => onHover(null)}
            >
              <circle r={r} className="halo" fill={col} opacity={0.12} />
              <circle r={r} fill={col} opacity={0.2} />
              <circle r={r * 0.6} fill={col} opacity={0.12} />
              <circle
                r={r}
                fill="none"
                stroke={col}
                strokeWidth={Math.max(1.3, r * 0.045)}
                opacity={0.95}
                className="ring"
              />
              {mid && (
                <text
                  textAnchor="middle"
                  dy={big ? -3 : 3}
                  className="bubName"
                  style={{ fontSize: Math.max(8.5, Math.min(r * 0.4, 28)) }}
                >
                  {label}
                </text>
              )}
              {big && (
                <text
                  textAnchor="middle"
                  dy={r * 0.42}
                  className="bubPct"
                  style={{
                    fontSize: Math.max(9, Math.min(r * 0.28, 18)),
                    fill: tc,
                  }}
                >
                  {fmtDelta(d)}
                </text>
              )}
            </g>
          </g>
        );
      })}
    </svg>
  );
}
