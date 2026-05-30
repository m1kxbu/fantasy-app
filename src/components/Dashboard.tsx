"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  X,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  Grid2x2,
  Circle,
  Filter,
  Minus,
} from "lucide-react";
import { moveText } from "@/lib/colors";
import { POS_COLORS, TEAM_COLORS, WINDOWS, type Window } from "@/lib/constants";
import { fmtDelta, fmtDeltaArrow, lastName } from "@/lib/format";
import type {
  ApiPlayer,
  ApiResponse,
  DashboardData,
  DashboardPlayer,
} from "@/lib/types";
import { Bubbles } from "./Bubbles";
import { Heatmap } from "./Heatmap";
import { Legend } from "./Legend";
import { Drawer } from "./Drawer";
import { VizBoundary } from "./VizBoundary";

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: DashboardData };

export function Dashboard() {
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const [scoring, setScoring] = useState<"ppr" | "bb">("ppr");
  const [posTab, setPosTab] = useState<"ALL" | "QB" | "RB" | "WR" | "TE" | "ROOKIES">(
    "ALL",
  );
  const [view, setView] = useState<"bubbles" | "heatmap">("bubbles");
  const [win, setWin] = useState<Window>("7D");
  const [sizeBy, setSizeBy] = useState<"value" | "move" | "uniform">("value");
  const [teamSel, setTeamSel] = useState<string[]>([]);
  const [teamOpen, setTeamOpen] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<"rank" | "move">("rank");
  const [sel, setSel] = useState<DashboardPlayer | null>(null);
  const [hover, setHover] = useState<{
    p: DashboardPlayer;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [pprRes, bbRes] = await Promise.all([
          fetch("/api/players?format=ppr"),
          fetch("/api/players?format=best_ball"),
        ]);
        if (!pprRes.ok && !bbRes.ok) {
          const txt = await pprRes.text();
          throw new Error(txt || `HTTP ${pprRes.status}`);
        }
        const pprJson = (await pprRes.json()) as ApiResponse;
        const bbJson = (await bbRes.json()) as ApiResponse;
        if (cancelled) return;
        const data = merge(pprJson, bbJson);
        setLoad({ kind: "ready", data });
      } catch (err) {
        if (cancelled) return;
        setLoad({
          kind: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const universe = useMemo<DashboardPlayer[]>(() => {
    if (load.kind !== "ready") return [];
    return scoring === "ppr" ? load.data.ppr : load.data.bb;
  }, [load, scoring]);

  const teams = useMemo(
    () =>
      Array.from(
        new Set(universe.map((p) => p.t).filter((t): t is string => !!t)),
      ).sort(),
    [universe],
  );

  const filtered = useMemo(() => {
    return universe.filter((p) => {
      if (posTab === "ROOKIES") {
        if (!p.rk) return false;
      } else if (posTab !== "ALL" && p.p !== posTab) {
        return false;
      }
      if (teamSel.length && (!p.t || !teamSel.includes(p.t))) return false;
      if (q && !p.n.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [universe, posTab, teamSel, q]);

  const tableRows = useMemo(() => {
    const arr = [...filtered];
    if (sortKey === "move") {
      arr.sort((a, b) => moveSortKey(b.d[win]) - moveSortKey(a.d[win]));
    } else {
      arr.sort((a, b) => a.adp - b.adp);
    }
    return arr;
  }, [filtered, sortKey, win]);

  const ticker = useMemo(() => {
    const withDelta = universe.filter((p) => p.d[win] !== null);
    const up = [...withDelta]
      .sort((a, b) => (b.d[win] ?? 0) - (a.d[win] ?? 0))
      .slice(0, 8);
    const dn = [...withDelta]
      .sort((a, b) => (a.d[win] ?? 0) - (b.d[win] ?? 0))
      .slice(0, 8);
    return [...up, ...dn].sort(
      (a, b) => Math.abs(b.d[win] ?? 0) - Math.abs(a.d[win] ?? 0),
    );
  }, [universe, win]);

  if (load.kind === "loading") {
    return (
      <div className="gx">
        <div className="empty" style={{ padding: "140px 0" }}>
          Loading the exchange…
        </div>
      </div>
    );
  }
  if (load.kind === "error") {
    return (
      <div className="gx">
        <div className="empty" style={{ padding: "140px 0" }}>
          <div style={{ marginBottom: 8 }}>The exchange is offline.</div>
          <div style={{ fontSize: 12, color: "#6b7484" }}>{load.message}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="gx">
      {/* ===== TICKER ===== */}
      <div className="ticker">
        <div className="tickInner">
          {ticker.length === 0
            ? Array.from({ length: 2 }).map((_, i) => (
                <span className="tk" key={i}>
                  <span className="tkn">No movement yet — snapshots accumulating</span>
                </span>
              ))
            : [...ticker, ...ticker].map((p, i) => (
                <span className="tk" key={`${p.id}-${i}`}>
                  <span className="tkn">{lastName(p.n)}</span>
                  <span style={{ color: moveText(p.d[win]) }}>
                    {(p.d[win] ?? 0) > 0 ? (
                      <TrendingUp size={11} />
                    ) : (p.d[win] ?? 0) < 0 ? (
                      <TrendingDown size={11} />
                    ) : (
                      <Minus size={11} />
                    )}{" "}
                    {fmtDelta(p.d[win])}
                  </span>
                </span>
              ))}
        </div>
      </div>

      {/* ===== HEADER ===== */}
      <header className="hd">
        <div className="brand">
          <div className="logo">
            <span />
            <span />
            <span />
          </div>
          <div>
            <h1>
              GRIDIRON <em>EXCHANGE</em>
            </h1>
            <p>fantasy ADP · traded like stock</p>
          </div>
        </div>
        <div className="searchBox">
          <Search size={15} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search player…"
          />
          {q && <X size={14} className="clr" onClick={() => setQ("")} />}
        </div>
      </header>

      {/* ===== CONTROL BAR 1 ===== */}
      <div className="bar">
        <div className="seg score">
          <button
            className={scoring === "ppr" ? "on" : ""}
            onClick={() => setScoring("ppr")}
          >
            PPR
          </button>
          <button
            className={scoring === "bb" ? "on bbon" : ""}
            onClick={() => setScoring("bb")}
          >
            BEST BALL
          </button>
        </div>
        <div className="tabs">
          {(["ALL", "QB", "RB", "WR", "TE", "ROOKIES"] as const).map((t) => {
            const posInfo = t in POS_COLORS ? POS_COLORS[t] : undefined;
            return (
              <button
                key={t}
                className={posTab === t ? "tab on" : "tab"}
                onClick={() => setPosTab(t)}
                style={
                  posTab === t && posInfo
                    ? { color: posInfo.c, borderColor: posInfo.c }
                    : undefined
                }
              >
                {t === "ALL" ? "Overall" : t === "ROOKIES" ? "Rookies" : t}
              </button>
            );
          })}
        </div>
      </div>

      {/* ===== CONTROL BAR 2 ===== */}
      <div className="bar bar2">
        <div className="seg">
          <button
            className={view === "bubbles" ? "on" : ""}
            onClick={() => setView("bubbles")}
          >
            <Circle size={13} /> Bubbles
          </button>
          <button
            className={view === "heatmap" ? "on" : ""}
            onClick={() => setView("heatmap")}
          >
            <Grid2x2 size={13} /> Heat Map
          </button>
        </div>

        <div className="seg tf">
          {WINDOWS.map((w) => (
            <button
              key={w}
              className={win === w ? "on" : ""}
              onClick={() => setWin(w)}
            >
              {w}
            </button>
          ))}
        </div>

        <div className="dd">
          <button
            className="ddbtn"
            onClick={() => {
              setSizeOpen((o) => !o);
              setTeamOpen(false);
            }}
          >
            Size:{" "}
            {sizeBy === "value"
              ? "ADP value"
              : sizeBy === "move"
                ? "Movement"
                : "Uniform"}{" "}
            <ChevronDown size={13} />
          </button>
          {sizeOpen && (
            <div className="ddmenu">
              <span className="ddhead">SIZE BY</span>
              {(
                [
                  ["value", "ADP value"],
                  ["move", "Movement"],
                  ["uniform", "Uniform"],
                ] as const
              ).map(([k, l]) => (
                <button
                  key={k}
                  className={sizeBy === k ? "sel" : ""}
                  onClick={() => {
                    setSizeBy(k);
                    setSizeOpen(false);
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="dd">
          <button
            className="ddbtn"
            onClick={() => {
              setTeamOpen((o) => !o);
              setSizeOpen(false);
            }}
          >
            <Filter size={12} /> Team
            {teamSel.length ? ` · ${teamSel.length}` : ""}{" "}
            <ChevronDown size={13} />
          </button>
          {teamOpen && (
            <div className="ddmenu teamMenu">
              <div className="teamTop">
                <span className="ddhead">FILTER TEAM</span>
                {teamSel.length > 0 && (
                  <button className="lnk" onClick={() => setTeamSel([])}>
                    clear
                  </button>
                )}
              </div>
              <div className="teamGrid">
                {teams.map((t) => (
                  <button
                    key={t}
                    className={teamSel.includes(t) ? "tchip on" : "tchip"}
                    style={
                      teamSel.includes(t)
                        ? {
                            background: TEAM_COLORS[t] ?? "#1c2530",
                            borderColor: TEAM_COLORS[t] ?? "#232c38",
                          }
                        : undefined
                    }
                    onClick={() =>
                      setTeamSel((s) =>
                        s.includes(t) ? s.filter((x) => x !== t) : [...s, t],
                      )
                    }
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="count">{filtered.length} players</div>
      </div>

      {/* ===== VISUALIZATION ===== */}
      <div
        className="vizWrap"
        onClick={() => {
          setSizeOpen(false);
          setTeamOpen(false);
        }}
      >
        {filtered.length === 0 ? (
          <div className="empty">No players match these filters.</div>
        ) : (
          <VizBoundary
            dep={`${view}|${win}|${sizeBy}|${scoring}|${posTab}|${teamSel.join(
              ",",
            )}|${q}`}
          >
            {view === "bubbles" ? (
              <Bubbles
                data={filtered}
                win={win}
                sizeBy={sizeBy}
                onPick={setSel}
                onHover={setHover}
              />
            ) : (
              <Heatmap
                data={filtered}
                win={win}
                sizeBy={sizeBy}
                onPick={setSel}
                onHover={setHover}
              />
            )}
          </VizBoundary>
        )}
        {view === "heatmap" && filtered.length > 0 && <Legend win={win} />}
        {hover && (
          <div className="tip" style={{ left: hover.x, top: hover.y }}>
            <b>{hover.p.n}</b>
            <span className="tipsub">
              {hover.p.p}
              {hover.p.posRank ?? ""} · {hover.p.t ?? "FA"} · ADP{" "}
              {hover.p.adp.toFixed(1)}
            </span>
            <span style={{ color: moveText(hover.p.d[win]) }}>
              {fmtDelta(hover.p.d[win])} spots ({win})
            </span>
          </div>
        )}
      </div>

      {/* ===== LIST ===== */}
      <div className="listHead">
        <h2>
          {scoring === "bb" ? "Best Ball" : "PPR"} ADP ·{" "}
          {posTab === "ALL"
            ? "Overall"
            : posTab === "ROOKIES"
              ? "Rookies"
              : posTab}
        </h2>
        <div className="sortToggle">
          <span>Sort</span>
          <button
            className={sortKey === "rank" ? "on" : ""}
            onClick={() => setSortKey("rank")}
          >
            ADP
          </button>
          <button
            className={sortKey === "move" ? "on" : ""}
            onClick={() => setSortKey("move")}
          >
            Movers {win}
          </button>
        </div>
      </div>

      <div className="tableScroll">
        <table className="tbl">
          <thead>
            <tr>
              <th className="cR">#</th>
              <th>Player</th>
              <th className="cP">POS</th>
              <th className="cN" onClick={() => setSortKey("rank")}>
                ADP
              </th>
              <th className="cN" onClick={() => setSortKey("move")}>
                Δ {win}
              </th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((p) => {
              const posInfo = POS_COLORS[p.p];
              const teamColor = p.t ? TEAM_COLORS[p.t] ?? "#3a3a3a" : "#3a3a3a";
              const d = p.d[win];
              return (
                <tr key={p.id} onClick={() => setSel(p)}>
                  <td className="cR">{p.rank}</td>
                  <td>
                    <span className="dot" style={{ background: teamColor }} />
                    <span className="pn">{p.n}</span>
                    <span className="pmeta">
                      {p.t ?? "FA"} ({p.by ?? "—"})
                      {p.rk && <i className="rkTag">R</i>}
                    </span>
                  </td>
                  <td className="cP">
                    {posInfo && (
                      <span
                        className="posBadge"
                        style={{ color: posInfo.c, background: posInfo.bg }}
                      >
                        {p.p}
                        {p.posRank ?? ""}
                      </span>
                    )}
                  </td>
                  <td className="cN adp">{p.adp.toFixed(1)}</td>
                  <td className="cN" style={{ color: moveText(d) }}>
                    {fmtDeltaArrow(d)}{" "}
                    {d === null ? "—" : Math.abs(d).toFixed(1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <footer className="ft">
        <span>
          <b>
            ADP from Fantasy Football Calculator (PPR consensus) +
            FantasyPros (Best Ball consensus).
          </b>{" "}
          Movement is computed from real daily snapshots stored in Postgres.
          Windows showing &ldquo;—&rdquo; mean we don&apos;t have enough history
          yet — nothing is simulated.
        </span>
        <span>
          Green = rising draft stock (ADP getting earlier) · Red = falling.
        </span>
      </footer>

      {sel && <Drawer p={sel} scoring={scoring} onClose={() => setSel(null)} />}
    </div>
  );
}

/** Sort movers descending; nulls go to the bottom (least mover info). */
function moveSortKey(d: number | null): number {
  if (d === null) return -Infinity;
  return d;
}

function toDashboardPlayer(
  ap: ApiPlayer,
  rankFallback: number,
  pprAdp: Map<number, number>,
  bbAdp: Map<number, number>,
): DashboardPlayer {
  return {
    id: ap.id,
    n: ap.name,
    t: ap.team,
    by: ap.bye,
    p: ap.position,
    posRank: ap.posRank,
    rank: ap.overallRank ?? rankFallback,
    adp: ap.adp,
    ppr: pprAdp.get(ap.id) ?? null,
    bb: bbAdp.get(ap.id) ?? null,
    rk: ap.isRookie,
    slug: ap.slug,
    source: ap.source,
    d: ap.deltas,
    trend: ap.series30d.map((s) => s.adp),
    timesDrafted: ap.timesDrafted,
    adpHigh: ap.adpHigh,
    adpLow: ap.adpLow,
    adpStdev: ap.adpStdev,
  };
}

function merge(ppr: ApiResponse, bb: ApiResponse): DashboardData {
  const pprAdp = new Map<number, number>();
  const bbAdp = new Map<number, number>();
  for (const p of ppr.players) pprAdp.set(p.id, p.adp);
  for (const p of bb.players) bbAdp.set(p.id, p.adp);

  return {
    ppr: ppr.players.map((p, i) => toDashboardPlayer(p, i + 1, pprAdp, bbAdp)),
    bb: bb.players.map((p, i) => toDashboardPlayer(p, i + 1, pprAdp, bbAdp)),
    pprCapturedAt: ppr.capturedAt,
    bbCapturedAt: bb.capturedAt,
  };
}
