import React, { useState } from "react";

interface DonutChartProps {
  title: string;
  subtitle?: string;
  total: number;
  admk: number;
  dmk: number;
  tvk: number;
  // When provided, legend + hover show % of each party's own manifesto instead of raw counts.
  // The donut ring is sized proportionally to the share values.
  admkTotal?: number;
  dmkTotal?: number;
  tvkTotal?: number;
  noBorderLeft?: boolean;
  noBorderRight?: boolean;
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const startRad = (startAngle - 90) * Math.PI / 180;
  const endRad = (endAngle - 90) * Math.PI / 180;
  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

export function DonutChart({ title, subtitle, total, admk, dmk, tvk, admkTotal, dmkTotal, tvkTotal, noBorderLeft, noBorderRight }: DonutChartProps) {
  const [hovered, setHovered] = useState<"admk" | "dmk" | "tvk" | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const r = 82;
  const strokeW = 28;

  const shareMode = admkTotal !== undefined && dmkTotal !== undefined && tvkTotal !== undefined;
  const admkShare = shareMode && admkTotal! > 0 ? (admk / admkTotal!) * 100 : 0;
  const dmkShare = shareMode && dmkTotal! > 0 ? (dmk / dmkTotal!) * 100 : 0;
  const tvkShare = shareMode && tvkTotal! > 0 ? (tvk / tvkTotal!) * 100 : 0;
  const shareSum = admkShare + dmkShare + tvkShare;

  // Ring weights: use shares in share mode, raw counts otherwise
  const weightAdmk = shareMode ? admkShare : admk;
  const weightDmk = shareMode ? dmkShare : dmk;
  const weightTvk = shareMode ? tvkShare : tvk;
  const weightSum = shareMode ? shareSum : total;

  const admkAngle = weightSum > 0 ? (weightAdmk / weightSum) * 360 : 0;
  const dmkAngle = weightSum > 0 ? (weightDmk / weightSum) * 360 : 0;
  const tvkAngle = weightSum > 0 ? (weightTvk / weightSum) * 360 : 0;

  const displayAdmk = shareMode ? `${admkShare.toFixed(1)}%` : String(admk);
  const displayDmk = shareMode ? `${dmkShare.toFixed(1)}%` : String(dmk);
  const displayTvk = shareMode ? `${tvkShare.toFixed(1)}%` : String(tvk);

  const segments: { key: "admk" | "dmk" | "tvk"; label: string; display: string; color: string; start: number; end: number }[] = [
    { key: "admk", label: "ADMK", display: displayAdmk, color: "#547c5b", start: 0, end: admkAngle },
    { key: "dmk", label: "DMK", display: displayDmk, color: "#c94d48", start: admkAngle, end: admkAngle + dmkAngle },
    { key: "tvk", label: "TVK", display: displayTvk, color: "#E5A000", start: admkAngle + dmkAngle, end: admkAngle + dmkAngle + tvkAngle },
  ];

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const hoveredSegment = hovered ? segments.find(s => s.key === hovered) : null;

  return (
    <div style={{
      background: "#fff", padding: "16px", flex: 1
    }}>
      <p style={{ fontFamily: '"Inter Tight", sans-serif', fontSize: 12, fontWeight: 600, letterSpacing: "1.56px", textTransform: "uppercase", color: "#6b6b6b", margin: 0, marginBottom: subtitle ? 4 : 8 }}>{title}</p>
      {subtitle && (
        <p style={{ fontFamily: '"Source Serif 4", serif', fontStyle: "italic", fontSize: 14, lineHeight: 1.3, color: "#8a8a8a", margin: 0, marginBottom: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{subtitle}</p>
      )}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ position: "relative", width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} onMouseMove={handleMouseMove}>
            {segments.map(seg => (
              <path
                key={seg.key}
                d={describeArc(cx, cy, r, seg.start, Math.min(seg.end, seg.start + 359.99))}
                fill="none"
                stroke={seg.color}
                strokeWidth={hovered === seg.key ? strokeW + 4 : strokeW}
                strokeLinecap="butt"
                style={{ cursor: "pointer", transition: "stroke-width 0.2s" }}
                onMouseEnter={() => setHovered(seg.key)}
                onMouseLeave={() => setHovered(null)}
              />
            ))}
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <span style={{ fontFamily: '"Source Serif 4", serif', fontWeight: 500, fontSize: shareMode ? 28 : 40, color: "#a16749", lineHeight: 1 }}>
              {shareMode ? `${(shareSum / 3).toFixed(1)}%` : total}
            </span>
            <span style={{ fontFamily: '"Inter Tight", sans-serif', fontSize: 11, color: "#6b6b6b", marginTop: 4, textAlign: "center" as const }}>
              {shareMode ? "avg" : "promises"}
            </span>
          </div>
          {hovered && hoveredSegment && (
            <div style={{
              position: "absolute",
              left: mousePos.x + 12,
              top: mousePos.y - 36,
              background: "#fff",
              borderWidth: 1,
              borderStyle: "solid",
              borderColor: hoveredSegment.color,
              borderRadius: 6,
              padding: "6px 12px",
              pointerEvents: "none",
              boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
              whiteSpace: "nowrap",
              zIndex: 10,
            }}>
              <span style={{ fontFamily: '"Inter Tight", sans-serif', fontWeight: 600, fontSize: 12, color: hoveredSegment.color }}>{hoveredSegment.label}</span>
              <span style={{ fontFamily: '"Source Serif 4", serif', fontWeight: 600, fontSize: 14, color: "#0a0a0a", marginLeft: 8 }}>{hoveredSegment.display}</span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 56, marginTop: 16 }}>
          {[
            { label: "ADMK", display: displayAdmk, color: "#547c5b" },
            { label: "DMK", display: displayDmk, color: "#c94d48" },
            { label: "TVK", display: displayTvk, color: "#E5A000" },
          ].map(p => (
            <div key={p.label} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ fontFamily: '"Source Serif 4", serif', fontWeight: 600, fontSize: 20, color: p.color }}>{p.display}</span>
              <span style={{ fontFamily: '"Inter Tight", sans-serif', fontWeight: 500, fontSize: 12, color: "#0a0a0a" }}>{p.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}