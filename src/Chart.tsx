import { useEffect, useState } from "react";
import { projection } from "./engine";
import { dateAt, type Profile } from "./model";
export const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
export const monthLabel = (p: Profile, m: number) =>
  new Date(dateAt(p.start, m) + "-01T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
export function Chart({
  p,
  objective,
  protectedReserve = p.reserve,
}: {
  p: Profile;
  objective: string;
  protectedReserve?: number;
}) {
  const [selected, setSelected] = useState<number | null>(null),
    [series, setSeries] = useState<"cash" | "equity" | "balance" | "netWorth">(
      "cash",
    );
  useEffect(() => {
    setSeries(
      objective === "wealth"
        ? "netWorth"
        : objective === "payment"
          ? "balance"
          : "cash",
    );
    setSelected(null);
  }, [objective]);
  const points = projection(p),
    width = 960,
    height = 260,
    pad = 32;
  const vals = points.map((x) => x[series]),
    min = Math.min(0, ...vals),
    max = Math.max(protectedReserve * 1.15, 1, ...vals),
    x = (m: number) => pad + (m / (points.length - 1)) * (width - pad * 2),
    y = (v: number) =>
      height - pad - ((v - min) / (max - min)) * (height - pad * 2);
  const path = points
      .map(
        (v, i) =>
          `${i ? "L" : "M"}${x(v.month).toFixed(2)},${y(v[series]).toFixed(2)}`,
      )
      .join(" "),
    active = points[selected ?? p.months];
  const selectedPoint = active ?? points[0];
  return (
    <div className="trajectory">
      <div className="chart-heading">
        <div>
          <span className="eyebrow">PATH TO YOUR NORTH STAR</span>
          <h2>
            {objective === "wealth"
              ? "A longer view of your future."
              : "From today to your front door."}
          </h2>
        </div>
        <div className="segmented" role="group" aria-label="Chart series">
          {(["cash", "equity", "balance", "netWorth"] as const).map((k) => (
            <button
              key={k}
              aria-pressed={series === k}
              onClick={() => setSeries(k)}
            >
              {k === "cash"
                ? "Cash savings"
                : k === "equity"
                  ? "Home equity"
                  : k === "netWorth"
                    ? "Net worth"
                    : "Mortgage"}
            </button>
          ))}
        </div>
      </div>
      <div className="chart-summary" aria-live="polite">
        <span>{monthLabel(p, selectedPoint.month)}</span>
        <strong>{money(selectedPoint[series])}</strong>
        <span>
          {selectedPoint.closing
            ? "Immediately after closing"
            : selectedPoint.month > p.months
              ? "After purchase"
              : "Before purchase"}
        </span>
      </div>
      <svg
        className="chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${series} trajectory with closing in ${monthLabel(p, p.months)}. Use the month slider below for exact values.`}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setSelected(
            Math.max(
              0,
              Math.min(
                points.length - 1,
                Math.round(
                  ((((e.clientX - r.left) / r.width) * width - pad) /
                    (width - pad * 2)) *
                    (points.length - 1),
                ),
              ),
            ),
          );
        }}
        onPointerLeave={() => setSelected(null)}
      >
        <defs>
          <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#A8BFAF" stopOpacity=".45" />
            <stop offset="1" stopColor="#A8BFAF" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line
              x1={pad}
              x2={width - pad}
              y1={y(min + (max - min) * t)}
              y2={y(min + (max - min) * t)}
              stroke="#15232B"
              opacity=".08"
            />
            <text x={pad} y={y(min + (max - min) * t) - 7} className="axis">
              {money(min + (max - min) * t)}
            </text>
          </g>
        ))}
        {series === "cash" && (
          <>
            <line
              x1={pad}
              x2={width - pad}
              y1={y(protectedReserve)}
              y2={y(protectedReserve)}
              stroke="#C48758"
              strokeDasharray="4 5"
            />
            <text
              x={width - pad}
              y={y(protectedReserve) - 7}
              textAnchor="end"
              className="axis"
            >
              Protected cash floor
            </text>
          </>
        )}
        <path
          d={`${path} L${x(points.length - 1)},${y(min)} L${pad},${y(min)} Z`}
          fill="url(#fill)"
        />
        <path
          d={path}
          fill="none"
          stroke={series === "balance" ? "#15232B" : "#2C6E68"}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <line
          x1={x(p.months)}
          x2={x(p.months)}
          y1={pad}
          y2={height - pad}
          stroke="#C48758"
          strokeDasharray="3 4"
        />
        <circle
          cx={x(p.months)}
          cy={y(points[p.months]?.[series] ?? 0)}
          r="5"
          fill="#C48758"
        />
        <line
          x1={x(selectedPoint.month)}
          x2={x(selectedPoint.month)}
          y1={pad}
          y2={height - pad}
          stroke="#15232B"
          opacity=".2"
        />
        <circle
          cx={x(selectedPoint.month)}
          cy={y(selectedPoint[series])}
          r="5"
          fill="#2C6E68"
          stroke="#F7F4ED"
          strokeWidth="2"
        />
      </svg>
      <div className="chart-dates">
        <span>{monthLabel(p, 0)}</span>
        <span className="copper">Closing · {monthLabel(p, p.months)}</span>
        <span>{monthLabel(p, points.length - 1)}</span>
      </div>
      <label className="scrubber">
        Inspect month{" "}
        <input
          type="range"
          min="0"
          max={points.length - 1}
          value={selected ?? p.months}
          onChange={(e) => setSelected(Number(e.target.value))}
        />
      </label>
      <p className="chart-note">
        The dip is your down payment, closing costs and moving expenses. Cash
        projections use available monthly cash flow, capped by optional
        contribution limits. Mortgage and equity use the same purchase
        assumptions.
      </p>
    </div>
  );
}
