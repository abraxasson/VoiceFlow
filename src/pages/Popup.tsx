import { useEffect, useState, useLayoutEffect } from "react";

type PopupState = "idle" | "recording" | "processing";

export function Popup() {
  const [state, setState] = useState<PopupState>("idle");
  const [amplitude, setAmplitude] = useState(0);

  // Force transparent background on mount - before first paint
  useLayoutEffect(() => {
    // Set transparent background at all levels
    document.documentElement.style.cssText = 'background: transparent !important; background-color: transparent !important;';
    document.body.style.cssText = 'background: transparent !important; background-color: transparent !important; margin: 0; padding: 0;';
    document.documentElement.classList.add('popup-transparent');

    // Also set on root element if it exists
    const root = document.getElementById('root');
    if (root) {
      root.style.cssText = 'background: transparent !important; background-color: transparent !important;';
    }
  }, []);

  useEffect(() => {
    const handleAmplitude = (e: CustomEvent<number>) => setAmplitude(e.detail);
    const handleState = (e: CustomEvent<{ state: PopupState }>) => {
      console.log('[Popup] State changed to:', e.detail.state);
      setState(e.detail.state);
    };

    document.addEventListener("amplitude" as any, handleAmplitude);
    document.addEventListener("popup-state" as any, handleState);

    return () => {
      document.removeEventListener("amplitude" as any, handleAmplitude);
      document.removeEventListener("popup-state" as any, handleState);
    };
  }, []);

  return (
    <div
      className="w-screen h-screen flex items-center justify-center select-none overflow-hidden"
      style={{ background: 'transparent' }}
    >
      {state === 'idle' && (
        /* Idle: Minimal thin line - very subtle */
        <div
          className="rounded-full"
          style={{
            width: '48px',
            height: '4px',
            background: 'rgba(255, 255, 255, 0.15)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        />
      )}

      {state === 'recording' && (
        /* Recording: Compact pill with subtle dots */
        <div
          className="flex items-center justify-center rounded-full px-3 py-1.5"
          style={{
            background: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <div className="flex items-center gap-1">
            {[0, 1, 2, 3].map((i) => {
              // Dots react to amplitude - inner more reactive
              const isInner = i === 1 || i === 2;
              const baseSize = isInner ? 5 : 4;
              const ampBoost = amplitude * (isInner ? 4 : 2);
              const size = Math.min(8, baseSize + ampBoost);

              return (
                <div
                  key={i}
                  className="rounded-full transition-all duration-100"
                  style={{
                    width: `${size}px`,
                    height: `${size}px`,
                    background: 'rgba(255, 255, 255, 0.7)',
                  }}
                />
              );
            })}
          </div>
        </div>
      )}

      {state === 'processing' && (
        /* Processing: Compact pill with subtle sweep */
        <div
          className="relative flex items-center justify-center rounded-full overflow-hidden"
          style={{
            background: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            width: '56px',
            height: '20px',
          }}
        >
          {/* Progress sweep */}
          <div className="absolute inset-1 rounded-full overflow-hidden bg-white/5">
            <div
              className="absolute top-0 bottom-0 left-0 w-1/3 rounded-full"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                animation: 'sweep 1s ease-in-out infinite',
              }}
            />
          </div>
        </div>
      )}

      <style>{`
        @keyframes sweep {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
}
