import { useEffect, useState, useLayoutEffect, useRef } from "react";

type PopupState = "idle" | "recording" | "processing";

const N_BANDS = 20;

// SVG canvas dimensions (popup minus padding)
const SVG_W = 364;
const SVG_H = 68;
const CY = SVG_H / 2;          // center Y
const MAX_H = CY * 0.96;       // max wave excursion in pixels

// Warm → cool gradient matching the reference (left = low freq, right = high freq)
const GRAD_STOPS = [
  { pct: "0%",   color: "#ffd000" },
  { pct: "18%",  color: "#ff8800" },
  { pct: "36%",  color: "#ff2800" },
  { pct: "54%",  color: "#0060ff" },
  { pct: "72%",  color: "#00aaff" },
  { pct: "88%",  color: "#00e4ff" },
  { pct: "100%", color: "#4466ff" },
];

/** Catmull-Rom spline → SVG cubic bezier path */
function crPath(pts: Array<[number, number]>): string {
  if (pts.length < 2) return "";
  const n = pts.length;
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(n - 1, i + 2)];
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

/** Build closed area path: upper wave → reversed lower wave */
function areaPath(upper: Array<[number, number]>, lower: Array<[number, number]>): string {
  const rev = [...lower].reverse();
  return crPath(upper) +
    ` L ${rev[0][0].toFixed(1)} ${rev[0][1].toFixed(1)}` +
    crPath(rev).replace(/^M[\d. ]+/, "") +
    " Z";
}

export function Popup() {
  const [state, setState] = useState<PopupState>("idle");
  // data[0] = overall amplitude, data[1..N_BANDS] = spectrum bands
  const [data, setData] = useState<number[]>(Array(N_BANDS + 1).fill(0));
  const [animTime, setAnimTime] = useState(0);
  const rafRef = useRef<number>(0);

  useLayoutEffect(() => {
    document.documentElement.style.cssText = "background: transparent !important;";
    document.body.style.cssText = "background: transparent !important; margin: 0; padding: 0;";
    document.documentElement.classList.add("popup-transparent");
    const root = document.getElementById("root");
    if (root) root.style.cssText = "background: transparent !important;";
  }, []);

  useEffect(() => {
    const handleAmplitude = (e: CustomEvent<number[]>) => setData(e.detail);
    const handleState = (e: CustomEvent<{ state: PopupState }>) => setState(e.detail.state);

    document.addEventListener("amplitude" as any, handleAmplitude);
    document.addEventListener("popup-state" as any, handleState);
    return () => {
      document.removeEventListener("amplitude" as any, handleAmplitude);
      document.removeEventListener("popup-state" as any, handleState);
    };
  }, []);

  // rAF loop — always runs while recording for idle wave blending
  useEffect(() => {
    if (state !== "recording") { cancelAnimationFrame(rafRef.current); return; }
    let startTs: number | null = null;
    const tick = (ts: number) => {
      if (startTs === null) startTs = ts;
      setAnimTime((ts - startTs) / 1000);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [state]);

  const amplitude = data[0] ?? 0;
  const rawBands = data.slice(1);

  // Blend spectrum with a gentle idle animation so bars always move
  const bands = rawBands.map((v, i) => {
    const pos = i / (N_BANDS - 1);
    const idle =
      (Math.sin(animTime * 2.8 + pos * Math.PI * 3.0) * 0.35 +
       Math.sin(animTime * 1.5 + pos * Math.PI * 5.5 + 1.3) * 0.40 +
       Math.sin(animTime * 4.1 + pos * Math.PI * 2.2 - 0.9) * 0.25) *
      0.5 + 0.5; // 0..1
    const idleFloor = idle * 0.14;
    return Math.max(idleFloor, v);
  });

  // Compute upper and lower wave point arrays
  const upperPts: Array<[number, number]> = bands.map((v, i) => [
    (i / (N_BANDS - 1)) * SVG_W,
    CY - v * MAX_H,
  ]);
  const lowerPts: Array<[number, number]> = bands.map((v, i) => [
    (i / (N_BANDS - 1)) * SVG_W,
    CY + v * MAX_H,
  ]);

  const upperD = crPath(upperPts);
  const lowerD = crPath(lowerPts);
  const fillD  = areaPath(upperPts, lowerPts);

  const glowStrength = 2 + amplitude * 5;
  const containerGlow = [
    `0 0 ${12 + amplitude * 22}px rgba(120, 160, 255, ${0.15 + amplitude * 0.3})`,
    `0 4px 24px rgba(0,0,0,0.55)`,
    `inset 0 0 0 1px rgba(180, 160, 255, ${0.1 + amplitude * 0.18})`,
  ].join(", ");

  return (
    <div
      className="w-screen h-screen flex items-center justify-center select-none"
      style={{ background: "transparent" }}
    >
      {/* IDLE: Tiny pill */}
      {state === "idle" && (
        <div style={{ width: "32px", height: "4px", borderRadius: "2px", background: "rgba(255,255,255,0.15)" }} />
      )}

      {/* RECORDING: Spectrum wave */}
      {state === "recording" && (
        <div
          style={{
            padding: "10px 18px",
            borderRadius: "26px",
            background: "rgba(4, 6, 18, 0.82)",
            backdropFilter: "blur(20px)",
            boxShadow: containerGlow,
          }}
        >
          <svg
            width={SVG_W}
            height={SVG_H}
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            overflow="visible"
          >
            <defs>
              <linearGradient id="wg" x1="0" x2="1" y1="0" y2="0">
                {GRAD_STOPS.map((s) => (
                  <stop key={s.pct} offset={s.pct} stopColor={s.color} />
                ))}
              </linearGradient>

              {/* Glow filter */}
              <filter id="glow" x="-20%" y="-40%" width="140%" height="180%">
                <feGaussianBlur stdDeviation={glowStrength} result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Filled area — subtle */}
            <path
              d={fillD}
              fill="url(#wg)"
              opacity={0.1 + amplitude * 0.18}
            />

            {/* Lower wave — glow layer */}
            <path d={lowerD} stroke="url(#wg)" strokeWidth="1.5" fill="none"
              opacity={0.35 + amplitude * 0.35} filter="url(#glow)" />

            {/* Upper wave — glow layer */}
            <path d={upperD} stroke="url(#wg)" strokeWidth="1.5" fill="none"
              opacity={0.35 + amplitude * 0.35} filter="url(#glow)" />

            {/* Lower wave — sharp layer */}
            <path d={lowerD} stroke="url(#wg)" strokeWidth="1.5" fill="none"
              opacity={0.7 + amplitude * 0.3} />

            {/* Upper wave — sharp layer */}
            <path d={upperD} stroke="url(#wg)" strokeWidth="1.5" fill="none"
              opacity={0.7 + amplitude * 0.3} />

            {/* Center line — thin, always visible */}
            <line
              x1="0" y1={CY} x2={SVG_W} y2={CY}
              stroke="url(#wg)" strokeWidth="0.5"
              opacity={0.25 + amplitude * 0.2}
            />
          </svg>
        </div>
      )}

      {/* PROCESSING: Three dots */}
      {state === "processing" && (
        <div style={{
          display: "flex", alignItems: "center", gap: "4px",
          padding: "8px 12px", borderRadius: "12px",
          background: "rgba(0,0,0,0.5)", backdropFilter: "blur(12px)",
        }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{
              width: "4px", height: "4px", borderRadius: "50%",
              background: "rgba(255,255,255,0.7)",
              animation: "fade 1s ease-in-out infinite",
              animationDelay: `${i * 0.2}s`,
            }} />
          ))}
        </div>
      )}

      <style>{`
        @keyframes fade {
          0%, 100% { opacity: 0.3; }
          50%       { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
