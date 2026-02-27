import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format a hotkey string for display: "ctrl+win" -> "Ctrl+Win", "f9" -> "F9"
export function formatHotkey(hotkey: string): string {
  return hotkey
    .split("+")
    .map((k) => k.charAt(0).toUpperCase() + k.slice(1))
    .join("+");
}
