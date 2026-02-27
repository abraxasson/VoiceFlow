import { useEffect, useState, useLayoutEffect, useRef } from "react";

type PopupState = "idle" | "recording" | "processing";

const BAR_COUNT = 22;
const EMERALD = "52, 211, 153";

export function Popup() {
  const [state, setState] = useState<PopupState>("idle");
  const [amplitude, setAmplitude] = useState(0);
  const [animTime, setAnimTime] = useState(0);
  const rafRef = useRef<number>(0);

  useLayoutEffect(() => {
    document.documentElement.style.cssText =
      "background: transparent !important;";
    document.body.style.cssText =
      "background: transparent !important; margin: 0; padding: 0;";
    document.documentElement.classList.add("popup-transparent");

    const root = document.getElementById("root");
    if (root) {
      root.style.cssText = "background: transparent !important;";
    }
  }, []);

  useEffect(() => {
    const handleAmplitude = (e: CustomEvent<number>) => setAmplitude(e.detail);
    const handleState = (e: CustomEvent<{ state: PopupState }>) => {
      setState(e.detail.state);
    };

    document.addEventListener("amplitude" as any, handleAmplitude);
    document.addEventListener("popup-state" as any, handleState);

    return () => {
      document.removeEventListener("amplitude" as any, handleAmplitude);
      document.removeEventListener("popup-state" as any, handleState);
    };
  }, []);

  // Drive animation via requestAnimationFrame when recording
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

  return (
    <div
      className="w-screen h-screen flex items-center justify-center select-none"
      style={{ background: "transparent" }}
    >
      {/* IDLE: Tiny pill */}
      {state === "idle" && (
        <div
          style={{
            width: "32px",
            height: "4px",
            borderRadius: "2px",
            background: "rgba(255, 255, 255, 0.15)",
          }}
        />
      )}

      {/* RECORDING: Multi-wave visualizer */}
      {state === "recording" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "10px 18px",
            borderRadius: "24px",
            background: "rgba(0, 0, 0, 0.72)",
            backdropFilter: "blur(20px)",
            boxShadow: [
              `0 0 ${14 + amplitude * 24}px rgba(${EMERALD}, ${0.18 + amplitude * 0.38})`,
              `0 4px 24px rgba(0,0,0,0.5)`,
              `inset 0 0 0 1px rgba(${EMERALD}, ${0.12 + amplitude * 0.22})`,
            ].join(", "),
          }}
        >
          {/* Pulsing mic dot */}
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              flexShrink: 0,
              background: `rgba(${EMERALD}, 1)`,
              boxShadow: `0 0 ${5 + amplitude * 10}px rgba(${EMERALD}, 0.95)`,
              animation: "micpulse 1.4s ease-in-out infinite",
            }}
          />

          {/* Bars */}
          <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
            {Array.from({ length: BAR_COUNT }).map((_, i) => {
              const pos = i / (BAR_COUNT - 1); // 0..1

              // Four overlapping sine waves at different spatial and temporal frequencies
              const w1 = Math.sin(animTime * 3.1  + pos * Math.PI * 3.0) * 0.35;
              const w2 = Math.sin(animTime * 1.8  + pos * Math.PI * 5.5 + 1.2) * 0.28;
              const w3 = Math.sin(animTime * 4.7  + pos * Math.PI * 2.0 - 0.8) * 0.22;
              const w4 = Math.sin(animTime * 0.85 + pos * Math.PI * 8.0 + 2.4) * 0.15;
              const wave = (w1 + w2 + w3 + w4 + 1) / 2; // normalize 0..1

              // Always-on base motion + amplitude-driven height
              const base = 3 + wave * 6;
              const driven = wave * 48 * amplitude + amplitude * 8;
              const height = base + driven;

              const opacity = 0.45 + amplitude * 0.55;
              const glow = amplitude > 0.06
                ? `0 0 6px rgba(${EMERALD}, ${(amplitude * 0.85).toFixed(2)})`
                : "none";

              return (
                <div
                  key={i}
                  style={{
                    width: "4px",
                    height: `${height}px`,
                    borderRadius: "2px",
                    flexShrink: 0,
                    background: `rgba(${EMERALD}, ${opacity})`,
                    boxShadow: glow,
                  }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* PROCESSING: Three dots */}
      {state === "processing" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            padding: "8px 12px",
            borderRadius: "12px",
            background: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(12px)",
          }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: "4px",
                height: "4px",
                borderRadius: "50%",
                background: "rgba(255, 255, 255, 0.7)",
                animation: "fade 1s ease-in-out infinite",
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      )}

      <style>{`
        @keyframes fade {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        @keyframes micpulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.45; transform: scale(0.7); }
        }
      `}</style>
    </div>
  );
}
