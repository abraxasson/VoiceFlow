import { cn } from "@/lib/utils";

interface AudioVisualizerProps {
  amplitude: number; // 0-1 range
  className?: string;
  bars?: number;
}

export function AudioVisualizer({ amplitude, className, bars = 7 }: AudioVisualizerProps) {
  // Create an array of bars
  // We want a wave effect where the center is highest
  const barElements = Array.from({ length: bars }).map((_, i) => {
    // Calculate distance from center (0 to 1)
    const center = (bars - 1) / 2;
    const distance = Math.abs(i - center) / center;
    const scale = 1 - distance * 0.5; // Outer bars are 50% height of center base

    // varied movement based on amplitude
    // Randomize slightly to feel organic but deterministic based on index + amplitude
    const variation = Math.sin(i * 0.5 + amplitude * 10) * 0.2;
    
    // Height calculation
    // Min height 20%, Max height 100%
    // Amplitude drives the overall scale
    const height = 20 + (amplitude * 80 * scale) + (variation * 10);
    
    return Math.min(100, Math.max(10, height));
  });

  return (
    <div className={cn("flex items-center justify-center gap-1 h-6", className)}>
      {barElements.map((height, i) => (
        <div
          key={i}
          className="w-1 bg-foreground rounded-full transition-all duration-75 ease-out"
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
  );
}
