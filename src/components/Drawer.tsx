"use client";

import { X, ExternalLink } from "lucide-react";
import { moveText } from "@/lib/colors";
import { POS_COLORS, TEAM_COLORS, WINDOWS } from "@/lib/constants";
import { fmtDelta, fmtDeltaArrow } from "@/lib/format";
import type { DashboardPlayer } from "@/lib/types";

type Props = {
  p: DashboardPlayer;
  scoring: "ppr" | "bb";
  onClose: () => void;
};

const W = 300;
const H = 80;
const PAD = 6;

export function Drawer({ p, scoring, onClose }: Props) {
  const d = p.d;
  const win30 = d["30D"];
  const teamColor = p.t ? TEAM_COLORS[p.t] ?? "#3a3a3a" : "#3a3a3a";
  const posInfo = POS_COLORS[p.p];
  const sparkline = renderSparkline(p.trend);
  const fpUrl =
    scoring === "bb"
      ? "https://www.fantasypros.com/nfl/adp/best-ball-overall.php"
      : "https://www.fantasypros.com/nfl/adp/ppr-overall.php";

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer">
        <button className="dx" onClick={onClose}>
          <X size={18} />
        </button>
        <div className="dhead">
          <span className="dot lg" style={{ background: teamColor }} />
          <div>
            <h3>
              {p.n}
              {p.rk && <i className="rkTag big">ROOKIE</i>}
            </h3>
            <p>
              {posInfo && (
                <span
                  className="posBadge"
                  style={{ color: posInfo.c, background: posInfo.bg }}
                >
                  {p.p}
                  {p.posRank}
                </span>
              )}{" "}
              {p.t ?? "FA"} · Bye {p.by ?? "—"}
            </p>
          </div>
        </div>

        <div className="dstat">
          <div>
            <label>PPR ADP</label>
            <b>{p.ppr !== null ? p.ppr.toFixed(1) : "—"}</b>
          </div>
          <div>
            <label>Best Ball ADP</label>
            <b>{p.bb !== null ? p.bb.toFixed(1) : "—"}</b>
          </div>
          <div>
            <label>Overall Rank</label>
            <b>#{p.rank}</b>
          </div>
        </div>

        <div className="dmove">
          <h4>Movement</h4>
          <div className="dmoveRow">
            {WINDOWS.map((w) => (
              <div key={w} className="dmoveCell">
                <label>{w}</label>
                <b style={{ color: moveText(d[w]) }}>
                  {fmtDeltaArrow(d[w])} {d[w] === null ? "—" : Math.abs(d[w]).toFixed(1)}
                </b>
              </div>
            ))}
          </div>
        </div>

        <div className="dspark">
          <h4>30-day ADP trend</h4>
          {sparkline.points.length >= 2 ? (
            <>
              <svg viewBox={`0 0 ${W} ${H}`} width="100%">
                <path
                  d={sparkline.path}
                  fill="none"
                  stroke={sparkline.color}
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                <circle
                  cx={sparkline.endX}
                  cy={sparkline.endY}
                  r="3.5"
                  fill={sparkline.color}
                />
              </svg>
              <div className="sparkLabels">
                <span>{sparkline.start.toFixed(1)}</span>
                <span>now {sparkline.end.toFixed(1)}</span>
              </div>
            </>
          ) : (
            <p className="empty-mini">
              Not enough history yet — snapshots are still accumulating.
            </p>
          )}
        </div>

        <div className="v2">
          <h4>Coming in v2</h4>
          <p>
            Click-through to multi-season receiving / rushing stats, injury
            history, and prior-season ADP comparison — pulled into this panel.
          </p>
        </div>

        <a className="fpLink" href={fpUrl} target="_blank" rel="noreferrer">
          View source ADP on FantasyPros <ExternalLink size={13} />
        </a>
      </aside>
    </>
  );
}

function renderSparkline(trend: number[]) {
  if (trend.length < 2) {
    return {
      points: trend,
      path: "",
      color: "#9aa3b2",
      start: trend[0] ?? 0,
      end: trend[0] ?? 0,
      endX: 0,
      endY: 0,
    };
  }
  const min = Math.min(...trend);
  const max = Math.max(...trend);
  const span = max - min || 1;
  const x = (i: number) => PAD + (i / (trend.length - 1)) * (W - PAD * 2);
  const y = (v: number) => PAD + ((v - min) / span) * (H - PAD * 2);
  const path = trend
    .map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    .join(" ");
  const start = trend[0];
  const end = trend[trend.length - 1];
  // Positive trend in ADP space = ADP went UP = stock DOWN = red. Inverse.
  const overall = start - end;
  const color = overall > 0.3 ? "#11d676" : overall < -0.3 ? "#ff4d5e" : "#9aa3b2";
  return {
    points: trend,
    path,
    color,
    start,
    end,
    endX: x(trend.length - 1),
    endY: y(end),
  };
}
