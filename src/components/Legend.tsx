"use client";

import { moveFill } from "@/lib/colors";
import { DOMAIN, type Window as TfWindow } from "@/lib/constants";

export function Legend({ win }: { win: TfWindow }) {
  const m = DOMAIN[win];
  const stops = [-m, -m * 0.55, -m * 0.18, 0, m * 0.18, m * 0.55, m];
  return (
    <div className="legend">
      <span className="lgl">falling</span>
      {stops.map((s, i) => (
        <div key={i} className="lgcell">
          <div className="lgsw" style={{ background: moveFill(s, win) }} />
          <span>
            {s > 0 ? "+" : ""}
            {Math.round(s)}
          </span>
        </div>
      ))}
      <span className="lgl">rising</span>
    </div>
  );
}
