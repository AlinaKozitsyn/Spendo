import { useState } from "react";
import type { CategorySummary } from "../types";
import { CHART_COLORS } from "./SpendingBarChart";

// ── Chart geometry ──────────────────────────────────────────────
const CX = 190, CY = 118;   // ellipse centre
const RX = 155, RY = 56;    // outer radii  (RY/RX ≈ 0.36 = tilt angle)
const DEPTH = 32;            // visible thickness of the 3-D disc
const PUSH = 8;              // hover "pop-out" distance

// Point on the outer ellipse at angle a
const ept = (a: number): [number, number] => [
  CX + RX * Math.cos(a),
  CY + RY * Math.sin(a),
];

// Darken a hex colour by `by` units per channel
function darken(hex: string, by = 58): string {
  const p = (i: number) => Math.max(0, parseInt(hex.slice(i, i + 2), 16) - by);
  return `#${[1, 3, 5].map(i => p(i).toString(16).padStart(2, "0")).join("")}`;
}

// SVG path for the top-face wedge
function topPath(a1: number, a2: number): string {
  const [x1, y1] = ept(a1);
  const [x2, y2] = ept(a2);
  return `M ${CX} ${CY} L ${x1} ${y1} A ${RX} ${RY} 0 ${a2 - a1 > Math.PI ? 1 : 0} 1 ${x2} ${y2} Z`;
}

// SVG path for the front-facing side wall
// Only drawn for the arc portion that falls in [0, π] (visible front)
function sidePath(a1: number, a2: number): string | null {
  const sa = Math.max(a1, 0);
  const ea = Math.min(a2, Math.PI);
  if (sa >= ea) return null;
  const [x1, y1] = ept(sa);
  const [x2, y2] = ept(ea);
  const large = ea - sa > Math.PI ? 1 : 0;
  return [
    `M ${x1} ${y1}`,
    `A ${RX} ${RY} 0 ${large} 1 ${x2} ${y2}`,
    `L ${x2} ${y2 + DEPTH}`,
    `A ${RX} ${RY} 0 ${large} 0 ${x1} ${y1 + DEPTH}`,
    "Z",
  ].join(" ");
}

// CSS translate for the hover pop-out effect
function popTranslate(a1: number, a2: number): string {
  const mid = (a1 + a2) / 2;
  return `translate(${(Math.cos(mid) * PUSH).toFixed(1)}px, ${(Math.sin(mid) * PUSH).toFixed(1)}px)`;
}

interface Slice {
  a1: number; a2: number;
  color: string; name: string;
  value: number; pct: number; idx: number;
}

interface Props { data: CategorySummary[]; }

export function SpendingPieChart({ data }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [mouse, setMouse]   = useState({ x: 0, y: 0 });

  if (data.length === 0) return <p className="loading">No data</p>;

  const total = data.reduce((s, d) => s + d.total_spent, 0);

  // Build slice angle ranges starting from top (−π/2), clockwise
  const slices: Slice[] = [];
  let angle = -Math.PI / 2;
  data.forEach((cat, i) => {
    const sweep = (cat.total_spent / total) * 2 * Math.PI;
    slices.push({
      a1: angle, a2: angle + sweep,
      color: CHART_COLORS[i % CHART_COLORS.length],
      name: cat.name, value: cat.total_spent,
      pct: cat.total_spent / total, idx: i,
    });
    angle += sweep;
  });

  // Painter's algorithm: render back-to-front by sin(midAngle)
  const byDepth = [...slices].sort(
    (a, b) => Math.sin((a.a1 + a.a2) / 2) - Math.sin((b.a1 + b.a2) / 2)
  );

  const svgH = CY + RY + DEPTH + 16;
  const hovSlice = hovered !== null ? slices[hovered] : null;

  return (
    <div style={{ position: "relative", userSelect: "none" }}>
      <svg
        viewBox={`0 0 380 ${svgH}`}
        width="100%"
        style={{ display: "block", overflow: "visible" }}
        onMouseMove={e => {
          const r = e.currentTarget.getBoundingClientRect();
          setMouse({ x: e.clientX - r.left, y: e.clientY - r.top });
        }}
        onMouseLeave={() => setHovered(null)}
      >
        {/* ── Side walls (front-facing depth) ── */}
        {byDepth.map(s => {
          const path = sidePath(s.a1, s.a2);
          if (!path) return null;
          const isHov = hovered === s.idx;
          return (
            <path
              key={`side-${s.idx}`}
              d={path}
              fill={darken(s.color)}
              stroke="none"
              style={{ transform: isHov ? popTranslate(s.a1, s.a2) : "none" }}
            />
          );
        })}

        {/* ── Top faces ── */}
        {byDepth.map(s => {
          const isHov = hovered === s.idx;
          return (
            <path
              key={`top-${s.idx}`}
              d={topPath(s.a1, s.a2)}
              fill={s.color}
              stroke="#0b0f1a"
              strokeWidth={1.5}
              style={{
                cursor: "pointer",
                transform: isHov ? popTranslate(s.a1, s.a2) : "none",
                filter: isHov ? `drop-shadow(0 0 12px ${s.color}bb)` : "none",
                opacity: hovered !== null && !isHov ? 0.65 : 1,
                transition: "opacity 0.15s, filter 0.15s",
              }}
              onMouseEnter={() => setHovered(s.idx)}
            />
          );
        })}
      </svg>

      {/* ── Floating tooltip ── */}
      {hovSlice && (
        <div style={{
          position: "absolute",
          left: mouse.x + 14,
          top: mouse.y - 8,
          background: "#1c2438",
          border: `1px solid ${hovSlice.color}55`,
          borderRadius: 10,
          padding: "10px 14px",
          fontSize: 13,
          color: "#e2e8f0",
          boxShadow: `0 8px 28px rgba(0,0,0,0.6), 0 0 0 1px ${hovSlice.color}22`,
          pointerEvents: "none",
          zIndex: 20,
          whiteSpace: "nowrap",
        }}>
          <div style={{ fontWeight: 700, color: hovSlice.color, marginBottom: 4 }}>
            {hovSlice.name}
          </div>
          <div>
            {hovSlice.value.toLocaleString("he-IL", { maximumFractionDigits: 0 })}{" "}
            <span style={{ color: "#64748b" }}>ILS</span>
          </div>
          <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>
            {(hovSlice.pct * 100).toFixed(1)}% of total
          </div>
        </div>
      )}

      {/* ── Legend ── */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: "6px 14px",
        marginTop: 14, justifyContent: "center", padding: "0 8px",
      }}>
        {slices.map(s => (
          <div
            key={s.idx}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              fontSize: 11, cursor: "pointer",
              opacity: hovered !== null && hovered !== s.idx ? 0.4 : 1,
              transition: "opacity 0.15s",
            }}
            onMouseEnter={() => setHovered(s.idx)}
            onMouseLeave={() => setHovered(null)}
          >
            <span style={{
              width: 10, height: 10, borderRadius: 3,
              background: s.color, display: "inline-block", flexShrink: 0,
              boxShadow: `0 0 6px ${s.color}99`,
            }} />
            <span style={{ color: "#94a3b8" }}>{s.name}</span>
            <span style={{ color: s.color, fontWeight: 700 }}>
              {(s.pct * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
