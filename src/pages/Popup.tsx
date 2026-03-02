import { useEffect, useState, useLayoutEffect, useRef, useMemo } from "react";
import { api } from "@/lib/api";

type PopupState = "idle" | "recording" | "processing";
type VisualizerStyle = "multiwave" | "ring" | "bar" | "scope";

interface AudioData {
  amplitude: number;
  bands: number[];
  samples: number[];
}

const N_BANDS = 20;
const EMPTY_AUDIO: AudioData = {
  amplitude: 0,
  bands: Array(N_BANDS).fill(0),
  samples: Array(64).fill(0),
};

// ---- Shared utilities ----

/** Power-curve boost with stronger lift for mid-range values */
function boost(v: number): number {
  return Math.min(1.0, Math.pow(v * 1.6, 0.55));
}

/** Interpolate N_BANDS values to a higher resolution using cubic interpolation */
function interpolateBands(bands: number[], targetCount: number): number[] {
  const result: number[] = [];
  const n = bands.length;
  for (let i = 0; i < targetCount; i++) {
    const t = (i / (targetCount - 1)) * (n - 1);
    const idx = Math.floor(t);
    const frac = t - idx;
    // Catmull-Rom style interpolation
    const p0 = bands[Math.max(0, idx - 1)];
    const p1 = bands[idx];
    const p2 = bands[Math.min(n - 1, idx + 1)];
    const p3 = bands[Math.min(n - 1, idx + 2)];
    const v = p1 + 0.5 * frac * (
      p2 - p0 + frac * (
        2 * p0 - 5 * p1 + 4 * p2 - p3 + frac * (
          3 * (p1 - p2) + p3 - p0
        )
      )
    );
    result.push(Math.max(0, Math.min(1, v)));
  }
  return result;
}

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

/** HSL color helper */
function hsl(h: number, s: number, l: number, a = 1): string {
  return a < 1
    ? `hsla(${h.toFixed(0)},${s.toFixed(0)}%,${l.toFixed(0)}%,${a.toFixed(2)})`
    : `hsl(${h.toFixed(0)},${s.toFixed(0)}%,${l.toFixed(0)}%)`;
}

// ============================================================================
// STYLE 1 — Multi-Wave: Flowing ribbon mesh (reference: layered flowing waves
// with gold→green→cyan→blue→red color shift, 10+ parallel lines, glow bloom)
// ============================================================================
const MW_LINES = 12;       // Number of parallel wave lines per half
const MW_HIRES = 48;       // Interpolated band count for smoother curves

function MultiWaveViz({ audio, animTime }: { audio: AudioData; animTime: number }) {
  const SVG_W = 460;
  const SVG_H = 86;
  const CY = SVG_H / 2;
  const MAX_H = CY * 0.92;
  const { amplitude, bands } = audio;

  // Interpolate 20 bands → 48 points for smoother curves
  const hiBands = useMemo(() => interpolateBands(bands, MW_HIRES), [bands]);

  // Gradient: gold → green → cyan → blue → indigo → magenta → red
  const gradStops = useMemo(() => [
    { offset: "0%",   color: "#ffb020" },  // gold
    { offset: "15%",  color: "#40e860" },   // green
    { offset: "35%",  color: "#00e8d0" },   // cyan-green
    { offset: "50%",  color: "#20a0ff" },   // blue
    { offset: "70%",  color: "#6040ff" },   // indigo
    { offset: "85%",  color: "#e040a0" },   // magenta
    { offset: "100%", color: "#ff3030" },   // red
  ], []);

  // Generate wave line points for a single line
  function wavePts(lineIdx: number, upper: boolean): Array<[number, number]> {
    const lineT = lineIdx / (MW_LINES - 1); // 0..1 across lines
    const phaseOff = lineT * Math.PI * 0.8;
    const scaleMultiplier = 1.0 - lineT * 0.55; // outer lines are biggest, inner smallest

    return hiBands.map((v, i) => {
      const pos = i / (MW_HIRES - 1);
      // Multi-frequency idle breathing
      const idle =
        (Math.sin(animTime * 2.4 + pos * Math.PI * 3.2 + phaseOff) * 0.30 +
         Math.sin(animTime * 1.3 + pos * Math.PI * 6.0 + 1.5 + phaseOff) * 0.35 +
         Math.sin(animTime * 3.8 + pos * Math.PI * 2.5 - 0.6 + phaseOff) * 0.20 +
         Math.sin(animTime * 5.2 + pos * Math.PI * 4.5 + 2.8 + phaseOff * 0.7) * 0.15) *
        0.5 + 0.5;
      const boosted = boost(v);
      const val = Math.max(idle * 0.04, boosted) * scaleMultiplier;
      // Add per-line vertical offset for ribbon depth
      const ribbonShift = (lineT - 0.5) * 3.5;
      const y = upper
        ? CY - val * MAX_H + ribbonShift
        : CY + val * MAX_H - ribbonShift;
      return [pos * SVG_W, y] as [number, number];
    });
  }

  const glowStd = 4 + amplitude * 10;

  return (
    <div style={{
      padding: "10px 8px",
      borderRadius: "24px",
      background: "#000000",
      boxShadow: `0 0 ${20 + amplitude * 40}px rgba(80, 180, 255, ${0.15 + amplitude * 0.45})`,
      cursor: "grab",
    }}>
      <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} overflow="visible"
        style={{ display: "block" }}>
        <defs>
          <linearGradient id="mwGrad" x1="0" x2="1" y1="0" y2="0">
            {gradStops.map((s) => (
              <stop key={s.offset} offset={s.offset} stopColor={s.color} />
            ))}
          </linearGradient>
          <filter id="mwBloom" x="-15%" y="-60%" width="130%" height="220%">
            <feGaussianBlur stdDeviation={glowStd} result="b" />
            <feComposite in="b" in2="b" operator="arithmetic" k1="0" k2="1.5" k3="0" k4="0" result="bright" />
            <feMerge>
              <feMergeNode in="bright" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Glow layer: fewer lines, blurred, for bloom effect */}
        <g filter="url(#mwBloom)" opacity={0.5 + amplitude * 0.4}>
          {[0, 3, 6, 9, 11].map((li) => {
            const upD = crPath(wavePts(li, true));
            const dnD = crPath(wavePts(li, false));
            return (
              <g key={`glow${li}`}>
                <path d={upD} stroke="url(#mwGrad)" strokeWidth={2.5} fill="none" />
                <path d={dnD} stroke="url(#mwGrad)" strokeWidth={2.5} fill="none" />
              </g>
            );
          })}
        </g>

        {/* Crisp line mesh: all lines rendered sharply */}
        {Array.from({ length: MW_LINES }, (_, li) => {
          const lineT = li / (MW_LINES - 1);
          const opacity = 0.3 + (1 - Math.abs(lineT - 0.5) * 2) * 0.55 + amplitude * 0.15;
          const sw = 0.8 + (1 - lineT) * 1.0;
          const upD = crPath(wavePts(li, true));
          const dnD = crPath(wavePts(li, false));
          return (
            <g key={`line${li}`} opacity={Math.min(1, opacity)}>
              <path d={upD} stroke="url(#mwGrad)" strokeWidth={sw} fill="none" />
              <path d={dnD} stroke="url(#mwGrad)" strokeWidth={sw} fill="none" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}


// ============================================================================
// STYLE 2 — Ring: Dense radial bars around a circle
// (reference: 60+ bars, cyan→purple→magenta gradient, strong glow bloom)
// ============================================================================
const RING_BAR_COUNT = 72;

function RingViz({ audio, animTime }: { audio: AudioData; animTime: number }) {
  const SIZE = 148;
  const CX = SIZE / 2;
  const CY_R = SIZE / 2;
  const INNER_R = 34;
  const MAX_BAR_LEN = 30;
  const { amplitude, bands } = audio;

  // Interpolate 20 bands → 72 bars
  const hiBands = useMemo(() => interpolateBands(bands, RING_BAR_COUNT), [bands]);

  const bars = useMemo(() => {
    return hiBands.map((v, i) => {
      const pos = i / RING_BAR_COUNT;
      // Idle breathing per bar
      const idle =
        (Math.sin(animTime * 2.0 + pos * Math.PI * 6.0) * 0.35 +
         Math.sin(animTime * 3.2 + pos * Math.PI * 3.5 + 1.4) * 0.30 +
         Math.sin(animTime * 1.6 + pos * Math.PI * 8.0 - 0.5) * 0.20 +
         Math.sin(animTime * 4.5 + pos * Math.PI * 5.0 + 2.1) * 0.15) *
        0.5 + 0.5;
      const val = Math.max(idle * 0.04, boost(v));
      const barLen = val * MAX_BAR_LEN;
      const angle = pos * Math.PI * 2 - Math.PI / 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const x1 = CX + cos * INNER_R;
      const y1 = CY_R + sin * INNER_R;
      const x2 = CX + cos * (INNER_R + barLen);
      const y2 = CY_R + sin * (INNER_R + barLen);

      // Color: cyan at top → blue at sides → purple at bottom-sides → magenta at bottom
      // Map angle (-PI/2 = top) to hue
      const normAngle = ((angle + Math.PI / 2) / (Math.PI * 2) + 1) % 1; // 0=top, 0.5=bottom
      const hue = 190 + normAngle * 130; // 190 (cyan) → 320 (magenta)
      const sat = 85 + amplitude * 15;
      const lit = 50 + val * 20 + amplitude * 10;
      const color = hsl(hue % 360, Math.min(100, sat), Math.min(80, lit));

      return { x1, y1, x2, y2, color, val };
    });
  }, [hiBands, animTime, amplitude]);

  const barGlowStd = 3 + amplitude * 8;

  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}
      style={{ cursor: "grab", display: "block" }}>
      <defs>
        {/* Hard circular clip — nothing escapes the circle boundary */}
        <clipPath id="ringClip">
          <circle cx={CX} cy={CY_R} r={SIZE / 2 - 0.5} />
        </clipPath>

        {/* Bloom for bars */}
        <filter id="ringBloom" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation={barGlowStd} result="b" />
          <feComposite in="b" in2="b" operator="arithmetic" k1="0" k2="2.0" k3="0" k4="0" result="bright" />
          <feMerge>
            <feMergeNode in="bright" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Glass body: dark semi-transparent with off-centre gradient for depth */}
        <radialGradient id="glassBg" cx="42%" cy="35%" r="68%">
          <stop offset="0%"   stopColor="rgba(55,30,130,0.52)" />
          <stop offset="55%"  stopColor="rgba(14,7,45,0.68)" />
          <stop offset="100%" stopColor="rgba(4,2,18,0.80)" />
        </radialGradient>

        {/* Specular highlight: top-left light catch */}
        <radialGradient id="glassSpec" cx="32%" cy="24%" r="38%">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.16)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>

      {/* Every element inside the clipPath — nothing leaks outside the circle */}
      <g clipPath="url(#ringClip)">

        {/* Glass disc body */}
        <circle cx={CX} cy={CY_R} r={SIZE / 2} fill="url(#glassBg)" />
        <circle cx={CX} cy={CY_R} r={SIZE / 2} fill="url(#glassSpec)" />

        {/* Bar glow layer */}
        <g filter="url(#ringBloom)" opacity={0.50 + amplitude * 0.45}>
          {bars.map((b, i) => (
            <line key={`rg${i}`} x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2}
              stroke={b.color} strokeWidth={3.5} strokeLinecap="round" />
          ))}
        </g>

        {/* Crisp bars */}
        {bars.map((b, i) => (
          <line key={`rc${i}`} x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2}
            stroke={b.color} strokeWidth={2} strokeLinecap="round"
            opacity={0.85 + b.val * 0.15}
          />
        ))}

        {/* Inner ring glow + accent */}
        <circle cx={CX} cy={CY_R} r={INNER_R - 1}
          fill="none"
          stroke={`hsla(200,100%,75%,${0.10 + amplitude * 0.25})`}
          strokeWidth={1 + amplitude * 2.5}
          filter="url(#ringBloom)"
        />
        <circle cx={CX} cy={CY_R} r={INNER_R - 1}
          fill="none"
          stroke={`hsla(270,90%,75%,${0.20 + amplitude * 0.35})`}
          strokeWidth={0.8}
        />

        {/* Glass rim line */}
        <circle cx={CX} cy={CY_R} r={SIZE / 2 - 1}
          fill="none"
          stroke="rgba(160,120,255,0.22)"
          strokeWidth={1.5}
        />

        {/* Top specular arc — inside clip, sits at the circle edge */}
        <path
          d={`M ${(CX + Math.cos(-Math.PI * 0.85) * (SIZE / 2 - 2)).toFixed(1)} ${(CY_R + Math.sin(-Math.PI * 0.85) * (SIZE / 2 - 2)).toFixed(1)} A ${SIZE / 2 - 2} ${SIZE / 2 - 2} 0 0 1 ${(CX + Math.cos(-Math.PI * 0.15) * (SIZE / 2 - 2)).toFixed(1)} ${(CY_R + Math.sin(-Math.PI * 0.15) * (SIZE / 2 - 2)).toFixed(1)}`}
          fill="none"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}


// ============================================================================
// STYLE 3 — Bar Equalizer with wave mesh overlay
// (reference: vertical bars with 10+ overlapping sinusoidal wave lines,
// full rainbow coloring green→cyan→blue→magenta→orange, mesh interference)
// ============================================================================
const BAR_COUNT = 28;
const WAVE_LINES = 14;

// Rainbow colors for bars: green → cyan → blue → purple → magenta → orange → gold
function barColor(pos: number): string {
  const hue = 140 - pos * 280; // 140 (green) → -140 → wraps to 220 (warm)
  const h = ((hue % 360) + 360) % 360;
  return hsl(h, 95, 55);
}

function BarViz({ audio, animTime }: { audio: AudioData; animTime: number }) {
  const SVG_W = 460;
  const SVG_H = 86;
  const CY = SVG_H / 2;
  const MAX_H = CY * 0.92;
  const { amplitude, bands } = audio;

  // Interpolate 20 bands → 28 for denser bars
  const hiBands = useMemo(() => interpolateBands(bands, BAR_COUNT), [bands]);

  const BAR_W = 12;
  const GAP = (SVG_W - BAR_COUNT * BAR_W) / (BAR_COUNT - 1);

  const barData = useMemo(() => {
    return hiBands.map((v, i) => {
      const pos = i / (BAR_COUNT - 1);
      const idle =
        (Math.sin(animTime * 2.2 + pos * Math.PI * 4.0) * 0.35 +
         Math.sin(animTime * 1.4 + pos * Math.PI * 6.5 + 0.8) * 0.30 +
         Math.sin(animTime * 3.5 + pos * Math.PI * 2.5 - 1.0) * 0.20 +
         Math.sin(animTime * 5.0 + pos * Math.PI * 3.0 + 2.5) * 0.15) *
        0.5 + 0.5;
      const val = Math.max(idle * 0.04, boost(v));
      const h = Math.max(1.5, val * MAX_H);
      const x = i * (BAR_W + GAP);
      const color = barColor(pos);
      return { x, h, val, color, pos };
    });
  }, [hiBands, animTime, amplitude]);

  // Generate wave mesh lines that flow through the bars
  function waveLinePts(lineIdx: number, upper: boolean): Array<[number, number]> {
    const lineT = lineIdx / (WAVE_LINES - 1);
    const phaseOff = lineT * Math.PI * 0.6;
    const yScale = 0.3 + lineT * 0.7; // inner lines smaller, outer bigger

    return barData.map((b) => {
      const pos = b.pos;
      const wave =
        (Math.sin(animTime * 2.8 + pos * Math.PI * 3.5 + phaseOff) * 0.35 +
         Math.sin(animTime * 1.5 + pos * Math.PI * 7.0 + 1.2 + phaseOff) * 0.30 +
         Math.sin(animTime * 4.2 + pos * Math.PI * 2.0 - 0.8 + phaseOff * 1.5) * 0.20 +
         Math.sin(animTime * 6.0 + pos * Math.PI * 5.0 + 3.0 + phaseOff * 0.5) * 0.15) *
        0.5 + 0.5;
      const val = Math.max(wave * 0.06, b.val) * yScale;
      const y = upper
        ? CY - val * MAX_H + (lineT - 0.5) * 2
        : CY + val * MAX_H - (lineT - 0.5) * 2;
      return [b.x + BAR_W / 2, y] as [number, number];
    });
  }

  const glowStd = 3 + amplitude * 8;

  return (
    <div style={{
      padding: "10px 8px",
      borderRadius: "24px",
      background: "#000000",
      boxShadow: `0 0 ${20 + amplitude * 40}px rgba(100, 50, 255, ${0.15 + amplitude * 0.40})`,
      cursor: "grab",
    }}>
      <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} overflow="visible"
        style={{ display: "block" }}>
        <defs>
          <filter id="barBloom" x="-15%" y="-40%" width="130%" height="180%">
            <feGaussianBlur stdDeviation={glowStd} result="b" />
            <feComposite in="b" in2="b" operator="arithmetic" k1="0" k2="1.5" k3="0" k4="0" result="bright" />
            <feMerge>
              <feMergeNode in="bright" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="barWaveGrad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%"   stopColor="#00ff80" />
            <stop offset="20%"  stopColor="#00e0ff" />
            <stop offset="40%"  stopColor="#2080ff" />
            <stop offset="60%"  stopColor="#8020ff" />
            <stop offset="75%"  stopColor="#ff20a0" />
            <stop offset="90%"  stopColor="#ff8020" />
            <stop offset="100%" stopColor="#ffc020" />
          </linearGradient>
        </defs>

        {/* Bar glow layer */}
        <g filter="url(#barBloom)" opacity={0.4 + amplitude * 0.4}>
          {barData.map((b, i) => (
            <g key={`bg${i}`}>
              <rect x={b.x} y={CY - b.h} width={BAR_W} height={b.h}
                fill={b.color} rx={1.5} />
              <rect x={b.x} y={CY} width={BAR_W} height={b.h}
                fill={b.color} rx={1.5} />
            </g>
          ))}
        </g>

        {/* Crisp bars */}
        {barData.map((b, i) => (
          <g key={`bc${i}`} opacity={0.75 + b.val * 0.25}>
            <rect x={b.x} y={CY - b.h} width={BAR_W} height={b.h}
              fill={b.color} rx={1.5} />
            <rect x={b.x} y={CY} width={BAR_W} height={b.h}
              fill={b.color} rx={1.5} />
          </g>
        ))}

        {/* Wave mesh overlay: multiple sinusoidal lines threading through bars */}
        {Array.from({ length: WAVE_LINES }, (_, li) => {
          const lineT = li / (WAVE_LINES - 1);
          const opacity = 0.15 + (1 - Math.abs(lineT - 0.5) * 2) * 0.45 + amplitude * 0.2;
          const sw = 0.6 + (1 - Math.abs(lineT - 0.5) * 2) * 0.8;
          const upD = crPath(waveLinePts(li, true));
          const dnD = crPath(waveLinePts(li, false));
          return (
            <g key={`wl${li}`} opacity={Math.min(0.9, opacity)}>
              <path d={upD} stroke="url(#barWaveGrad)" strokeWidth={sw} fill="none" />
              <path d={dnD} stroke="url(#barWaveGrad)" strokeWidth={sw} fill="none" />
            </g>
          );
        })}

        {/* Bright peak connecting lines */}
        <path d={crPath(barData.map(b => [b.x + BAR_W / 2, CY - b.h]))}
          stroke="rgba(255,255,255,0.7)" strokeWidth={1.2} fill="none"
          opacity={0.5 + amplitude * 0.4} />
        <path d={crPath(barData.map(b => [b.x + BAR_W / 2, CY + b.h]))}
          stroke="rgba(255,255,255,0.7)" strokeWidth={1.2} fill="none"
          opacity={0.5 + amplitude * 0.4} />
      </svg>
    </div>
  );
}


// ============================================================================
// STYLE 4 — Scope: Oscilloscope waveform display
// (reference: classic CRT phosphor with green glow, grid lines,
//  raw 64-sample waveform reflecting true audio shape)
// ============================================================================
function ScopeViz({ audio, animTime }: { audio: AudioData; animTime: number }) {
  const SVG_W = 460;
  const SVG_H = 86;
  const CY = SVG_H / 2;
  const { amplitude, samples } = audio;

  // Build the waveform path from raw samples
  const pts: Array<[number, number]> = useMemo(() => {
    return samples.map((s, i) => {
      const x = (i / (samples.length - 1)) * SVG_W;
      // When silent, add a slow idle drift so the line gently breathes
      const idle = amplitude < 0.015
        ? Math.sin(animTime * 1.2 + i * 0.22) * 2.0 + Math.sin(animTime * 0.7 + i * 0.11) * 1.2
        : 0;
      const y = CY - (s + idle) * (CY - 6) * 1.1;
      return [x, Math.max(4, Math.min(SVG_H - 4, y))];
    });
  }, [samples, amplitude, animTime]);

  const pathD = crPath(pts);
  const glowStd = 2 + amplitude * 7;

  // Phosphor green, brightens with amplitude
  const phosphorColor = `rgba(0, 255, 110, ${0.85 + amplitude * 0.15})`;
  const glowColor = `rgba(0, 255, 80, ${0.25 + amplitude * 0.55})`;
  const outerGlow = 14 + amplitude * 32;

  return (
    <div style={{
      padding: "8px",
      borderRadius: "20px",
      background: "linear-gradient(145deg, #000d08, #000810)",
      boxShadow: [
        `0 0 ${outerGlow}px rgba(0,255,80,${0.10 + amplitude * 0.30})`,
        `inset 0 0 24px rgba(0,20,10,0.9)`,
        `inset 0 1px 0 rgba(0,255,80,0.06)`,
      ].join(", "),
      cursor: "grab",
    }}>
      <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        style={{ display: "block" }}>
        <defs>
          <filter id="scopeGlow" x="-10%" y="-60%" width="120%" height="220%">
            <feGaussianBlur stdDeviation={glowStd} result="b" />
            <feComposite in="b" in2="b" operator="arithmetic" k1="0" k2="2.2" k3="0" k4="0" result="bright" />
            <feMerge>
              <feMergeNode in="bright" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Subtle scanline overlay */}
          <pattern id="scanlines" x="0" y="0" width="2" height="2" patternUnits="userSpaceOnUse">
            <rect x="0" y="0" width="2" height="1" fill="rgba(0,0,0,0.08)" />
          </pattern>
        </defs>

        {/* Grid: horizontal divisions */}
        {[1, 2, 3].map((i) => (
          <line key={`gh${i}`}
            x1={0} y1={i * SVG_H / 4} x2={SVG_W} y2={i * SVG_H / 4}
            stroke="rgba(0,160,70,0.12)" strokeWidth={0.6}
            strokeDasharray={i === 2 ? "none" : "4,6"}
          />
        ))}
        {/* Grid: vertical divisions */}
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <line key={`gv${i}`}
            x1={i * SVG_W / 8} y1={0} x2={i * SVG_W / 8} y2={SVG_H}
            stroke="rgba(0,160,70,0.10)" strokeWidth={0.6}
            strokeDasharray="4,6"
          />
        ))}

        {/* Zero/center line — slightly brighter */}
        <line x1={0} y1={CY} x2={SVG_W} y2={CY}
          stroke="rgba(0,200,80,0.20)" strokeWidth={0.8} />

        {/* Trigger marker: small tick at left edge */}
        <line x1={0} y1={CY - 4} x2={0} y2={CY + 4}
          stroke="rgba(0,255,110,0.35)" strokeWidth={1.5} />

        {/* Glow trace — rendered first for bloom */}
        <path d={pathD} stroke={glowColor} strokeWidth={5} fill="none"
          filter="url(#scopeGlow)" opacity={0.65} />

        {/* Crisp phosphor trace */}
        <path d={pathD} stroke={phosphorColor} strokeWidth={1.8} fill="none"
          strokeLinecap="round" strokeLinejoin="round" />

        {/* Scanline texture on top */}
        <rect x={0} y={0} width={SVG_W} height={SVG_H}
          fill="url(#scanlines)" opacity={0.4} style={{ pointerEvents: "none" }} />
      </svg>
    </div>
  );
}


// ============================================================================
// Main Popup Component
// ============================================================================
export function Popup() {
  const [state, setState] = useState<PopupState>("idle");
  const [vizStyle, setVizStyle] = useState<VisualizerStyle>("multiwave");
  const [audio, setAudio] = useState<AudioData>(EMPTY_AUDIO);
  const [animTime, setAnimTime] = useState(0);
  const rafRef = useRef<number>(0);

  useLayoutEffect(() => {
    // Override all backgrounds and the noise texture overlay from index.css
    const styleEl = document.createElement("style");
    styleEl.id = "popup-transparency";
    styleEl.textContent = `
      html, body, #root { background: transparent !important; }
      body::before, body::after { display: none !important; }
    `;
    document.head.appendChild(styleEl);
    document.documentElement.style.cssText = "background: transparent !important;";
    document.body.style.cssText = "background: transparent !important; margin: 0; padding: 0;";
    const root = document.getElementById("root");
    if (root) root.style.cssText = "background: transparent !important;";
    return () => styleEl.remove();
  }, []);

  // Load initial visualizer style from settings
  useEffect(() => {
    api.getSettings().then((s) => {
      if (s.visualizerStyle) setVizStyle(s.visualizerStyle as VisualizerStyle);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const handleAmplitude = (e: CustomEvent<AudioData>) => setAudio(e.detail);
    const handleState = (e: CustomEvent<{ state: PopupState }>) => setState(e.detail.state);
    const handleStyle = (e: CustomEvent<{ style: string }>) =>
      setVizStyle(e.detail.style as VisualizerStyle);

    document.addEventListener("amplitude" as any, handleAmplitude);
    document.addEventListener("popup-state" as any, handleState);
    document.addEventListener("visualizer-style" as any, handleStyle);
    return () => {
      document.removeEventListener("amplitude" as any, handleAmplitude);
      document.removeEventListener("popup-state" as any, handleState);
      document.removeEventListener("visualizer-style" as any, handleStyle);
    };
  }, []);

  // rAF loop for animation timing
  useEffect(() => {
    if (state !== "recording") {
      cancelAnimationFrame(rafRef.current);
      return;
    }
    let startTs: number | null = null;
    const tick = (ts: number) => {
      if (startTs === null) startTs = ts;
      setAnimTime((ts - startTs) / 1000);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [state]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      api.startPopupDrag().catch(() => {});
    }
  };

  // For ring style, clip the entire viewport to a circle so no rectangular
  // artefacts from SVG filter bleed or Qt compositing are visible.
  const containerClip = vizStyle === "ring" && state === "recording"
    ? "circle(50%)"
    : undefined;

  return (
    <div
      className="w-screen h-screen flex items-center justify-center select-none"
      style={{ background: "transparent", clipPath: containerClip }}
      onMouseDown={handleMouseDown}
    >
      {/* IDLE: invisible tiny pill (popup is hidden at idle anyway) */}
      {state === "idle" && (
        <div style={{
          width: "28px", height: "3px", borderRadius: "2px",
          background: "rgba(255,255,255,0.12)",
        }} />
      )}

      {/* RECORDING: Visualizer */}
      {state === "recording" && (
        <>
          {vizStyle === "ring" && <RingViz audio={audio} animTime={animTime} />}
          {vizStyle === "bar" && <BarViz audio={audio} animTime={animTime} />}
          {vizStyle === "scope" && <ScopeViz audio={audio} animTime={animTime} />}
          {(vizStyle === "multiwave" || !["ring", "bar", "scope"].includes(vizStyle)) && (
            <MultiWaveViz audio={audio} animTime={animTime} />
          )}
        </>
      )}

      {/* PROCESSING: Animated dots */}
      {state === "processing" && (
        <div style={{
          display: "flex", alignItems: "center", gap: "5px",
          padding: "8px 14px", borderRadius: "14px",
          background: "#000000",
        }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{
              width: "5px", height: "5px", borderRadius: "50%",
              background: "rgba(180,200,255,0.8)",
              animation: "dotspin 1s ease-in-out infinite",
              animationDelay: `${i * 0.22}s`,
            }} />
          ))}
        </div>
      )}

      <style>{`
        @keyframes dotspin {
          0%, 100% { opacity: 0.2; transform: scale(0.75); }
          50%       { opacity: 1;   transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}
