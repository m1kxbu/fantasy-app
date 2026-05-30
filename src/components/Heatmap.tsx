"use client";

import { useMemo } from "react";
import {
  hierarchy,
  treemap,
  type HierarchyRectangularNode,
} from "d3-hierarchy";
import { moveFill } from "@/lib/colors";
import { TEAM_COLORS, type Window as TfWindow } from "@/lib/constants";
import { lastName, fmtDelta } from "@/lib/format";
import type { DashboardPlayer } from "@/lib/types";

type Props = {
  data: DashboardPlayer[];
  win: TfWindow;
  sizeBy: "value" | "move" | "uniform";
  onPick: (p: DashboardPlayer) => void;
  onHover: (h: { p: DashboardPlayer; x: number; y: number } | null) => void;
};

type Datum = { children?: Datum[]; player?: DashboardPlayer };

const W = 1000;
const H = 560;

export function Heatmap({ data, win, sizeBy, onPick, onHover }: Props) {
  const leaves = useMemo(() => {
    const val = (p: DashboardPlayer): number => {
      if (sizeBy === "uniform") return 1;
      if (sizeBy === "move") {
        const d = p.d[win];
        if (d === null) return 6;
        return 6 + Math.abs(d) * 4;
      }
      return Math.pow(Math.max(2, 150 - p.adp), 1.2);
    };

    const root = hierarchy<Datum>({
      children: data.map((p) => ({ player: p })),
    })
      .sum((d) => (d.player ? Math.max(0.001, val(d.player)) : 0))
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    const laidOut = treemap<Datum>()
      .size([W, H])
      .paddingInner(2)
      .round(true)(root);

    return laidOut
      .leaves()
      .filter(
        (l) =>
          Number.isFinite(l.x0) &&
          Number.isFinite(l.x1) &&
          l.x1 > l.x0 &&
          l.y1 > l.y0,
      ) as HierarchyRectangularNode<Datum>[];
  }, [data, win, sizeBy]);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="viz"
      preserveAspectRatio="xMidYMid meet"
    >
      {leaves.map((nd, i) => {
        const p = nd.data.player;
        if (!p) return null;
        const x0 = nd.x0;
        const y0 = nd.y0;
        const w = nd.x1 - x0;
        const h = nd.y1 - y0;
        const d = p.d[win];
        const area = Math.min(w, h);
        const showPct = area > 34;
        const showName = area > 20;
        const fs = Math.max(8, Math.min(area * 0.22, 22));
        const ln = lastName(p.n);
        const truncated =
          ln.length * fs * 0.55 > w - 6
            ? `${ln.slice(0, Math.max(2, Math.floor((w - 6) / (fs * 0.55))))}…`
            : ln;
        const teamColor = p.t ? TEAM_COLORS[p.t] ?? "#3a3a3a" : "#3a3a3a";
        return (
          <g
            key={p.id}
            transform={`translate(${x0},${y0})`}
            className="tile"
            style={{ animationDelay: `${Math.min(i * 6, 360)}ms` }}
            onClick={() => onPick(p)}
            onMouseMove={(e) =>
              onHover({ p, x: e.clientX + 12, y: e.clientY + 12 })
            }
            onMouseLeave={() => onHover(null)}
          >
            <rect width={w} height={h} fill={moveFill(d, win)} rx={2} />
            <rect width={3} height={h} fill={teamColor} opacity={0.9} rx={1.5} />
            {showName && (
              <text
                x={w / 2}
                y={showPct ? h / 2 - fs * 0.35 : h / 2}
                textAnchor="middle"
                className="tileName"
                style={{ fontSize: fs }}
              >
                {truncated}
              </text>
            )}
            {showPct && (
              <text
                x={w / 2}
                y={h / 2 + fs * 0.75}
                textAnchor="middle"
                className="tilePct"
                style={{ fontSize: fs * 0.82 }}
              >
                {fmtDelta(d)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
