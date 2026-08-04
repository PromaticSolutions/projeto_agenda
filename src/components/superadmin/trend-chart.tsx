"use client";

import { useId, useMemo, useState, type PointerEvent } from "react";
import type { DailyPoint } from "@/lib/data/platformMetrics";

const WIDTH = 640;
const HEIGHT = 200;
const PAD_X = 4;
const PAD_TOP = 12;
const PAD_BOTTOM = 4;

function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(
    new Date(Date.UTC(y, m - 1, d))
  );
}

/** Gráfico de linha de uma série só (contagem diária) — sem legenda porque o
 * título do card já diz o que está plotado. Crosshair + tooltip no hover,
 * como manda a skill de dataviz pra qualquer gráfico de linha. */
export function TrendChart({ data, color }: { data: DailyPoint[]; color: string }) {
  const gradientId = useId();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const { points, path, areaPath } = useMemo(() => {
    const max = Math.max(1, ...data.map((d) => d.count));
    const innerW = WIDTH - PAD_X * 2;
    const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;
    const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;
    const pts = data.map((d, i) => ({
      x: PAD_X + stepX * i,
      y: PAD_TOP + innerH - (d.count / max) * innerH,
      ...d,
    }));
    const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const areaPath =
      pts.length > 0
        ? `${linePath} L${pts[pts.length - 1].x.toFixed(1)},${PAD_TOP + innerH} L${pts[0].x.toFixed(1)},${PAD_TOP + innerH} Z`
        : "";
    return { points: pts, path: linePath, areaPath };
  }, [data]);

  function handlePointerMove(e: PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    let nearest = 0;
    let nearestDist = Infinity;
    points.forEach((p, i) => {
      const dist = Math.abs(p.x - relX);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  }

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;
  const gridLines = [0, 0.5, 1];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full touch-none"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoverIndex(null)}
        role="img"
        aria-label={`Tendência diária, ${data.length} dias`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.14} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>

        {gridLines.map((g) => {
          const y = PAD_TOP + (HEIGHT - PAD_TOP - PAD_BOTTOM) * g;
          return (
            <line
              key={g}
              x1={PAD_X}
              x2={WIDTH - PAD_X}
              y1={y}
              y2={y}
              stroke="currentColor"
              strokeWidth={1}
              className="text-border"
            />
          );
        })}

        {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />}
        {path && (
          <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        )}

        {points.length > 0 && (
          <circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r={4}
            fill={color}
            stroke="var(--card)"
            strokeWidth={2}
          />
        )}

        {hovered && (
          <>
            <line
              x1={hovered.x}
              x2={hovered.x}
              y1={PAD_TOP}
              y2={HEIGHT - PAD_BOTTOM}
              stroke="currentColor"
              strokeWidth={1}
              className="text-muted-foreground/40"
            />
            <circle cx={hovered.x} cy={hovered.y} r={5} fill={color} stroke="var(--card)" strokeWidth={2} />
          </>
        )}
      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg bg-plum-900 px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-lg"
          style={{ left: `${(hovered.x / WIDTH) * 100}%` }}
        >
          <p className="font-semibold">{hovered.count}</p>
          <p className="text-white/60">{formatShortDate(hovered.date)}</p>
        </div>
      )}
    </div>
  );
}
