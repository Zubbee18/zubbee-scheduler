import { ReactNode, useEffect, useRef, useState } from "react";

let flameCounter = 0;

// Measures its own width and only renders the chart once a real width is
// available. This avoids recharts rendering at 0 width on first paint, which
// collapses axis ticks to duplicate keys and triggers a React key warning.
export function ChartFrame({
  height,
  children,
}: {
  height: number;
  children: (width: number, height: number) => ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ height }} className="w-full">
      {width > 0 ? children(width, height) : null}
    </div>
  );
}

// Firecrawl flame logo mark.
export function Flame({ className = "size-5" }: { className?: string }) {
  // Stable, colon-free id so the gradient url(#...) reference stays valid.
  const [gradientId] = useState(() => `fc-flame-${flameCounter++}`);
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FF9D4D" />
          <stop offset="100%" stopColor="#F2540B" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${gradientId})`}
        d="M13.4 1.6c.6 3-1 4.9-2.8 6.6C8.7 10 6.5 11.9 6.5 15.2A5.5 5.5 0 0 0 12 20.7a5.5 5.5 0 0 0 5.5-5.5c0-2-.9-3.6-1.9-5-.3 1-1 1.8-2 2.1.8-2.3.4-4.9-1-6.9-.5-.7-1.6-1.8-1.4-3.8 0 0 1.3.3 2.2.9Z"
      />
    </svg>
  );
}

type Point = { day: string; pages: number };

// Lightweight responsive area chart (no recharts) — avoids recharts' internal
// duplicate-key warning while keeping the subtle Firecrawl look.
export function AreaSpark({
  data,
  height = 168,
}: {
  data: Point[];
  height?: number;
}) {
  const labelH = 22;
  const padX = 8;
  const padTop = 10;
  const gid = "area-fill";
  const max = Math.max(...data.map((d) => d.pages), 1);

  return (
    <ChartFrame height={height}>
      {(w, h) => {
        const chartH = h - labelH;
        const innerW = w - padX * 2;
        const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;
        const x = (i: number) => padX + i * stepX;
        const y = (v: number) => padTop + (chartH - padTop) * (1 - v / max);

        const line = data
          .map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d.pages)}`)
          .join(" ");
        const area = `${line} L ${x(data.length - 1)} ${chartH} L ${x(0)} ${chartH} Z`;

        return (
          <svg width={w} height={h} className="overflow-visible">
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F2540B" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#F2540B" stopOpacity={0} />
              </linearGradient>
            </defs>
            <path d={area} fill={`url(#${gid})`} />
            <path
              d={line}
              fill="none"
              stroke="#F2540B"
              strokeWidth={2}
              strokeLinejoin="round"
            />
            {data.map((d, i) => (
              <circle
                key={d.day}
                cx={x(i)}
                cy={y(d.pages)}
                r={2.5}
                fill="#F2540B"
              />
            ))}
            {data.map((d, i) => (
              <text
                key={d.day}
                x={x(i)}
                y={h - 6}
                textAnchor="middle"
                fontSize={11}
                fill="#a3a3a3"
              >
                {d.day}
              </text>
            ))}
          </svg>
        );
      }}
    </ChartFrame>
  );
}

// Lightweight responsive bar chart (no recharts).
export function BarMini({
  data,
  height = 224,
}: {
  data: Point[];
  height?: number;
}) {
  const labelH = 22;
  const padX = 8;
  const padTop = 10;
  const max = Math.max(...data.map((d) => d.pages), 1);

  return (
    <ChartFrame height={height}>
      {(w, h) => {
        const chartH = h - labelH;
        const innerW = w - padX * 2;
        const slot = innerW / data.length;
        const barW = Math.min(slot * 0.5, 36);

        return (
          <svg width={w} height={h}>
            {data.map((d, i) => {
              const barH = (chartH - padTop) * (d.pages / max);
              const cx = padX + slot * i + slot / 2;
              return (
                <g key={d.day}>
                  <rect
                    x={cx - barW / 2}
                    y={chartH - barH}
                    width={barW}
                    height={barH}
                    rx={4}
                    fill="#F2540B"
                  />
                  <text
                    x={cx}
                    y={h - 6}
                    textAnchor="middle"
                    fontSize={11}
                    fill="#a3a3a3"
                  >
                    {d.day}
                  </text>
                </g>
              );
            })}
          </svg>
        );
      }}
    </ChartFrame>
  );
}

export function StatusDot({
  status,
}: {
  status: "success" | "failed" | "running" | "COMPLETED" | "FAILED" | "RUNNING";
}) {
  const map: Record<string, string> = {
    success: "bg-emerald-500",
    COMPLETED: "bg-emerald-500",
    failed: "bg-rose-500",
    FAILED: "bg-rose-500",
    running: "bg-amber-500",
    RUNNING: "bg-amber-500",
  };
  return (
    <span className={`inline-block size-1.5 rounded-full ${map[status]}`} />
  );
}

export function Card({
  children,
  className = "",
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={`rounded-xl border border-neutral-200 bg-white ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
