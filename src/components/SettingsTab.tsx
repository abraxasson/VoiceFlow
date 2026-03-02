import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Globe,
  Mic,
  Cpu,
  Zap,
  FolderOpen,
  Trash2,
  FileAudio,
  Keyboard,
  Hand,
  ToggleRight,
  Activity,
  Database,
  ChevronRight,
} from "lucide-react";
import { api } from "@/lib/api";
import type { Settings, Options, GpuInfo, ModelStorageInfo } from "@/lib/types";
import { ModelDownloadModal } from "./ModelDownloadModal";
import { HotkeyCapture } from "./HotkeyCapture";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pb-1">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground tracking-tight">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

// ─── Uniform setting card ─────────────────────────────────────────────────────
function SettingCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("glass-card p-5 flex flex-col gap-4 h-full", className)}>
      <div>
        <p className="text-sm font-semibold text-foreground tracking-tight">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <div className="flex-1 flex flex-col justify-end">{children}</div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export function SettingsTab() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [options, setOptions] = useState<Options | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const [pendingModel, setPendingModel] = useState<string | null>(null);
  const [gpuInfo, setGpuInfo] = useState<GpuInfo | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const [settingsData, optionsData, gpuData] = await Promise.all([
        api.getSettings(),
        api.getOptions(),
        api.getGpuInfo(),
      ]);
      setSettings(settingsData);
      setOptions(optionsData);
      setGpuInfo(gpuData);
    } catch {
      setError("Failed to load settings. Please try again.");
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSettings(); }, []);

  const updateSetting = async <K extends keyof Settings>(key: K, value: Settings[K]) => {
    if (!settings) return;
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    try {
      await api.updateSettings({ [key]: value });
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
      setSettings(settings);
    }
  };

  const handleModelChange = useCallback(async (newModel: string) => {
    if (!settings) return;
    try {
      const modelInfo = await api.getModelInfo(newModel);
      if (modelInfo.cached) {
        updateSetting("model", newModel);
      } else {
        setPendingModel(newModel);
        setDownloadModalOpen(true);
      }
    } catch {
      toast.error("Failed to check model status");
    }
  }, [settings]);

  const handleDownloadComplete = useCallback((success: boolean) => {
    if (success && pendingModel) updateSetting("model", pendingModel);
    setDownloadModalOpen(false);
    setPendingModel(null);
  }, [pendingModel]);

  const handleDownloadCancel = useCallback(() => {
    setDownloadModalOpen(false);
    setPendingModel(null);
  }, []);

  const validateHotkey = useCallback(async (hotkey: string, excludeField: "holdHotkey" | "toggleHotkey") => {
    try {
      const result = await api.validateHotkey(hotkey, excludeField);
      return { valid: result.valid, error: result.error };
    } catch {
      return { valid: false, error: "Failed to validate hotkey" };
    }
  }, []);

  const handleDeviceChange = useCallback(async (newDevice: string) => {
    if (!settings) return;
    setDeviceError(null);
    const validation = await api.validateDevice(newDevice);
    if (!validation.valid) {
      setDeviceError(validation.error);
      toast.error(validation.error || "Invalid device selection");
      return;
    }
    setSettings({ ...settings, device: newDevice });
    try {
      await api.updateSettings({ device: newDevice });
      const gpuData = await api.getGpuInfo();
      setGpuInfo(gpuData);
      toast.success("Device updated — model will reload");
    } catch {
      toast.error("Failed to update device");
      setSettings(settings);
    }
  }, [settings]);

  useEffect(() => {
    if (!settings) return;
    const root = document.documentElement;
    let isDark = settings.theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : settings.theme === "dark";
    isDark ? root.classList.add("dark") : root.classList.remove("dark");
  }, [settings?.theme]);

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-background/50 p-6 md:p-10 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground animate-pulse">Loading preferences...</p>
        </div>
      </div>
    );
  }

  if (error || !settings || !options) {
    return (
      <div className="min-h-screen w-full bg-background/50 p-6 md:p-10 flex items-center justify-center">
        <div className="text-center py-20 px-10 glass-card space-y-4">
          <p className="text-destructive font-medium text-lg">{error || "Failed to load settings"}</p>
          <button
            className="px-6 py-2.5 text-sm font-medium rounded-xl bg-background border border-border shadow-sm hover:bg-secondary/50 transition-all"
            onClick={loadSettings}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const retentionEntries = Object.entries(options.retentionOptions);

  return (
    <div className="min-h-screen w-full bg-background/50 relative overflow-x-hidden">
      <div className="fixed inset-0 bg-grid opacity-20 pointer-events-none overflow-hidden" />
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="orb orb-primary w-[400px] h-[400px] absolute -top-40 -right-40 opacity-20" />
        <div className="orb orb-accent w-[300px] h-[300px] absolute bottom-20 -left-20 opacity-15" />
      </div>

      <div className="w-full max-w-4xl mx-auto p-6 md:p-10 space-y-10 relative z-10">
        {/* Page header */}
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tighter text-foreground">
            Sett<span className="headline-serif text-primary">ings</span>
          </h1>
          <p className="text-lg text-muted-foreground/80 font-light">
            Customize your voice experience. All preferences are saved locally.
          </p>
        </div>

        <div className="divider-gradient" />

        {/* ── SECTION 1: Transcription ──────────────────────────── */}
        <Section icon={Globe} title="Transcription" description="Language, model and processing options">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SettingCard title="Language" description="Target transcription language">
              <Select value={settings.language} onValueChange={(v) => updateSetting("language", v)}>
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.languages.map((lang) => (
                    <SelectItem key={lang} value={lang}>
                      {lang === "auto" ? "Auto-detect" : lang.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingCard>

            <SettingCard title="AI Model" description="Smaller is faster, larger is more accurate">
              <Select value={settings.model} onValueChange={handleModelChange}>
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.models.map((model) => (
                    <SelectItem key={model} value={model}>
                      {model.charAt(0).toUpperCase() + model.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingCard>

            <SettingCard title="Theme" description="Interface color scheme">
              <Select value={settings.theme} onValueChange={(v) => updateSetting("theme", v as Settings["theme"])}>
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.themeOptions.map((theme) => (
                    <SelectItem key={theme} value={theme}>
                      {theme.charAt(0).toUpperCase() + theme.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingCard>
          </div>
        </Section>

        {/* ── SECTION 2: Input & History ────────────────────────── */}
        <Section icon={Mic} title="Input & History" description="Microphone, data retention and audio recording">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SettingCard title="Microphone" description="Audio capture device" className="sm:col-span-1">
              <Select
                value={String(settings.microphone)}
                onValueChange={(v) => updateSetting("microphone", Number(v))}
              >
                <SelectTrigger className="h-10 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Mic className="w-3.5 h-3.5 opacity-50" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="-1">Default System Mic</SelectItem>
                  {options.microphones.map((mic) => (
                    <SelectItem key={mic.id} value={String(mic.id)}>{mic.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingCard>

            <SettingCard title="Data Retention" description="How long to keep transcriptions">
              <Select
                value={String(settings.retention)}
                onValueChange={(v) => updateSetting("retention", Number(v))}
              >
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {retentionEntries.map(([label, days]) => (
                    <SelectItem key={days} value={String(days)}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingCard>

            <SettingCard title="History Audio" description="Store dictation recordings with each entry">
              <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors">
                <div className="flex items-center gap-2">
                  <FileAudio className="w-4 h-4 text-muted-foreground/70" />
                  <Label htmlFor="save-audio-history" className="text-sm font-medium cursor-pointer">
                    Save audio
                  </Label>
                </div>
                <Switch
                  id="save-audio-history"
                  checked={settings.saveAudioToHistory}
                  onCheckedChange={(checked) => updateSetting("saveAudioToHistory", checked)}
                />
              </div>
            </SettingCard>
          </div>
        </Section>

        {/* ── SECTION 3: Appearance ─────────────────────────────── */}
        <Section icon={Activity} title="Appearance & Behavior" description="Popup visualizer and system settings">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
            {/* Visualizer picker — spans 2 cols */}
            <SettingCard title="Voice Visualizer" description="Recording animation style" className="sm:col-span-2">
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: "multiwave", label: "Wave" },
                  { id: "ring",      label: "Ring" },
                  { id: "bar",       label: "Equalizer" },
                  { id: "scope",     label: "Scope" },
                ].map((viz) => (
                  <button
                    key={viz.id}
                    onClick={() => updateSetting("visualizerStyle", viz.id)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all",
                      settings.visualizerStyle === viz.id
                        ? "border-primary/60 bg-primary/10 text-primary"
                        : "border-border/40 bg-secondary/20 hover:bg-secondary/40 text-muted-foreground"
                    )}
                  >
                    <VizMiniPreview style={viz.id} />
                    <span className="text-[10px] font-medium">{viz.label}</span>
                  </button>
                ))}
              </div>
            </SettingCard>

            {/* Right column: stacked behavior cards */}
            <div className="flex flex-col gap-4">
              <SettingCard title="Startup" description="Run automatically with Windows">
                <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-muted-foreground/70" />
                    <Label htmlFor="auto-start" className="text-sm font-medium cursor-pointer">
                      Auto-start
                    </Label>
                  </div>
                  <Switch
                    id="auto-start"
                    checked={settings.autoStart}
                    onCheckedChange={(checked) => updateSetting("autoStart", checked)}
                  />
                </div>
              </SettingCard>

              <SettingCard title="Storage" description="Browse local data files">
                <button
                  onClick={() => api.openDataFolder()}
                  className="w-full flex items-center justify-between gap-2 h-10 px-3 rounded-xl border border-border/50 bg-background/50 hover:bg-primary/5 hover:border-primary/30 hover:text-primary transition-all text-sm font-medium text-muted-foreground"
                >
                  <div className="flex items-center gap-2">
                    <FolderOpen className="w-4 h-4" />
                    Open Data Folder
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 opacity-50" />
                </button>
              </SettingCard>
            </div>
          </div>
        </Section>

        {/* ── SECTION 4: Keyboard Shortcuts ─────────────────────── */}
        <Section icon={Keyboard} title="Keyboard Shortcuts" description="Configure recording hotkeys">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Hold Mode */}
            <div className="glass-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Hand className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Hold Mode</p>
                    <p className="text-xs text-muted-foreground">Hold to record, release to stop</p>
                  </div>
                </div>
                <Switch
                  checked={settings.holdHotkeyEnabled}
                  onCheckedChange={(checked) => updateSetting("holdHotkeyEnabled", checked)}
                />
              </div>
              <HotkeyCapture
                value={settings.holdHotkey}
                onChange={(hotkey) => updateSetting("holdHotkey", hotkey)}
                onValidate={(hotkey) => validateHotkey(hotkey, "holdHotkey")}
                disabled={!settings.holdHotkeyEnabled}
              />
            </div>

            {/* Toggle Mode */}
            <div className="glass-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <ToggleRight className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Toggle Mode</p>
                    <p className="text-xs text-muted-foreground">Press once to start, again to stop</p>
                  </div>
                </div>
                <Switch
                  checked={settings.toggleHotkeyEnabled}
                  onCheckedChange={(checked) => updateSetting("toggleHotkeyEnabled", checked)}
                />
              </div>
              <HotkeyCapture
                value={settings.toggleHotkey}
                onChange={(hotkey) => updateSetting("toggleHotkey", hotkey)}
                onValidate={(hotkey) => validateHotkey(hotkey, "toggleHotkey")}
                disabled={!settings.toggleHotkeyEnabled}
              />
            </div>
          </div>
        </Section>

        {/* ── SECTION 5: Advanced ───────────────────────────────── */}
        <Section icon={Cpu} title="Advanced" description="Hardware and performance configuration">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Compute Device */}
            <div className="glass-card p-5 space-y-4 h-full">
              <div>
                <p className="text-sm font-semibold text-foreground">Compute Device</p>
                <p className="text-xs text-muted-foreground mt-0.5">CPU or GPU for transcription inference</p>
              </div>
              <Select value={settings.device} onValueChange={handleDeviceChange}>
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.deviceOptions.map((device) => (
                    <SelectItem
                      key={device}
                      value={device}
                      disabled={device === "cuda" && !gpuInfo?.cudaAvailable}
                    >
                      {device === "auto"
                        ? "Auto (Recommended)"
                        : device === "cuda"
                          ? `CUDA${!gpuInfo?.cudaAvailable ? " (Unavailable)" : ""}`
                          : "CPU"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {deviceError && <p className="text-xs text-destructive">{deviceError}</p>}
              {gpuInfo && (
                <div className="p-3 rounded-xl bg-secondary/30 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span className={
                      gpuInfo.cudaAvailable ? "text-green-500"
                        : gpuInfo.gpuName && !gpuInfo.cudnnAvailable ? "text-amber-500"
                        : "text-muted-foreground"
                    }>
                      {gpuInfo.cudaAvailable ? "CUDA Available"
                        : gpuInfo.gpuName && !gpuInfo.cudnnAvailable ? "cuDNN Missing"
                        : "CPU Only"}
                    </span>
                  </div>
                  {gpuInfo.gpuName && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">GPU</span>
                      <span className="truncate ml-2 max-w-[180px]" title={gpuInfo.gpuName}>
                        {gpuInfo.gpuName}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Active</span>
                    <span>{gpuInfo.currentDevice.toUpperCase()} ({gpuInfo.currentComputeType})</span>
                  </div>
                  {gpuInfo.gpuName && !gpuInfo.cudnnAvailable && (
                    <p className="text-xs text-amber-500 pt-1">Install cuDNN 9.x for GPU acceleration</p>
                  )}
                </div>
              )}
            </div>

            {/* Model Storage */}
            <ModelStorageCard />
          </div>
        </Section>

        {/* ── SECTION 6: Danger Zone ────────────────────────────── */}
        <div className="border border-destructive/20 rounded-2xl p-5 space-y-4 bg-destructive/5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10 text-destructive">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Danger Zone</p>
              <p className="text-xs text-muted-foreground">Irreversible — all deleted data cannot be recovered</p>
            </div>
          </div>
          <DangerZoneActions />
        </div>
      </div>

      {pendingModel && (
        <ModelDownloadModal
          open={downloadModalOpen}
          modelName={pendingModel}
          onComplete={handleDownloadComplete}
          onCancel={handleDownloadCancel}
        />
      )}
    </div>
  );
}

// ─── Visualizer mini previews ─────────────────────────────────────────────────
function VizMiniPreview({ style }: { style: string }) {
  if (style === "ring") {
    return (
      <svg width={40} height={40} viewBox="0 0 44 44">
        {Array.from({ length: 24 }, (_, i) => {
          const angle = (i / 24) * Math.PI * 2 - Math.PI / 2;
          const val = 0.3 + Math.abs(Math.sin(i * 0.8 + 0.5)) * 0.7;
          const innerR = 8, outerR = innerR + val * 12;
          const x1 = 22 + Math.cos(angle) * innerR;
          const y1 = 22 + Math.sin(angle) * innerR;
          const x2 = 22 + Math.cos(angle) * outerR;
          const y2 = 22 + Math.sin(angle) * outerR;
          const normA = ((angle + Math.PI / 2) / (Math.PI * 2) + 1) % 1;
          const hue = 190 + normA * 130;
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={`hsl(${hue},90%,60%)`} strokeWidth={1.5} strokeLinecap="round" />
          );
        })}
      </svg>
    );
  }
  if (style === "bar") {
    const heights = [4, 7, 11, 14, 12, 13, 10, 14, 9, 5];
    const colors = ["#00ff80","#00e0ff","#2080ff","#6040ff","#c020ff","#ff20a0","#ff4040","#ff8020","#ffc020","#ffe040"];
    return (
      <svg width={40} height={40} viewBox="0 0 44 44">
        {heights.map((h, i) => (
          <g key={i}>
            <rect x={2 + i * 4} y={22 - h} width={3} height={h} fill={colors[i]} rx={1} opacity={0.8} />
            <rect x={2 + i * 4} y={22} width={3} height={h} fill={colors[i]} rx={1} opacity={0.8} />
          </g>
        ))}
      </svg>
    );
  }
  if (style === "scope") {
    const pts: Array<[number, number]> = Array.from({ length: 22 }, (_, i) => {
      const x = 2 + (i / 21) * 40;
      const y = 22 + Math.sin(i * 0.65) * 11 * (0.45 + Math.abs(Math.sin(i * 0.4)) * 0.55);
      return [x, y];
    });
    const d = pts.reduce((acc, [x, y], i) => acc + (i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`), "");
    return (
      <svg width={40} height={40} viewBox="0 0 44 44">
        <rect x={2} y={2} width={40} height={40} rx={3} fill="#000810" opacity={0.6} />
        {[1, 2, 3].map(i => (
          <line key={`h${i}`} x1={2} y1={i * 11} x2={42} y2={i * 11} stroke="rgba(0,140,60,0.25)" strokeWidth={0.4} />
        ))}
        {[1, 2, 3].map(i => (
          <line key={`v${i}`} x1={2 + i * 10} y1={2} x2={2 + i * 10} y2={42} stroke="rgba(0,140,60,0.25)" strokeWidth={0.4} />
        ))}
        <path d={d} stroke="#00ff64" strokeWidth={1.5} fill="none" />
      </svg>
    );
  }
  // multiwave
  return (
    <svg width={40} height={40} viewBox="0 0 44 44">
      <defs>
        <linearGradient id="mwpg" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#ffb020" />
          <stop offset="25%" stopColor="#00e8d0" />
          <stop offset="50%" stopColor="#20a0ff" />
          <stop offset="75%" stopColor="#e040a0" />
          <stop offset="100%" stopColor="#ff3030" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3, 4, 5].map((li) => {
        const off = li * 1.2;
        const s = 1.0 - li * 0.12;
        return (
          <g key={li} opacity={0.3 + (1 - li / 5) * 0.55}>
            <path d={`M2,${22 - off} C8,${14 - off * s} 14,${30 - off * s} 22,${22 - off} C30,${14 - off * s} 36,${30 - off * s} 42,${22 - off}`}
              stroke="url(#mwpg)" strokeWidth={1.8 - li * 0.2} fill="none" />
            <path d={`M2,${22 + off} C8,${30 + off * s} 14,${14 + off * s} 22,${22 + off} C30,${30 + off * s} 36,${14 + off * s} 42,${22 + off}`}
              stroke="url(#mwpg)" strokeWidth={1.8 - li * 0.2} fill="none" />
          </g>
        );
      })}
    </svg>
  );
}

// ─── Model Storage Card ───────────────────────────────────────────────────────
function ModelStorageCard() {
  const [storageInfo, setStorageInfo] = useState<ModelStorageInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getModelStorageInfo()
      .then(setStorageInfo)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const sizeFmt = (mb: number) =>
    mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(0)} MB`;

  return (
    <div className="glass-card p-5 flex flex-col gap-4 h-full">
      <div>
        <p className="text-sm font-semibold text-foreground">Model Storage</p>
        <p className="text-xs text-muted-foreground mt-0.5">Cached Whisper models — disk and RAM usage</p>
      </div>

      {loading ? (
        <div className="flex-1 rounded-xl bg-secondary/30 animate-pulse min-h-[80px]" />
      ) : storageInfo ? (
        <div className="flex flex-col gap-3 flex-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
            <span>{storageInfo.models.length} model{storageInfo.models.length !== 1 ? "s" : ""} cached</span>
            <span>Total: <span className="font-medium text-foreground">{sizeFmt(storageInfo.totalSizeMb)}</span></span>
          </div>

          {storageInfo.models.length > 0 ? (
            <div className="space-y-1.5 max-h-44 overflow-y-auto">
              {storageInfo.models.map((m) => (
                <div key={m.name} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-secondary/30">
                  <span className="font-mono text-xs font-semibold min-w-[80px]">{m.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-background/60 border border-border/40 text-muted-foreground whitespace-nowrap">
                    {sizeFmt(m.sizeMb)}
                  </span>
                  <div className="flex-1 flex items-center gap-1.5 min-w-0">
                    <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full rounded-full bg-primary/70"
                        style={{ width: `${Math.min(100, (m.ramMb / 6200) * 100)}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      ~{sizeFmt(m.ramMb)} RAM
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No models downloaded yet</p>
          )}

          <button
            onClick={() => api.openModelFolder()}
            className="mt-auto w-full flex items-center justify-between h-9 px-3 rounded-xl border border-border/50 bg-background/50 hover:bg-primary/5 hover:border-primary/30 hover:text-primary transition-all text-sm font-medium text-muted-foreground"
          >
            <div className="flex items-center gap-2">
              <Database className="w-3.5 h-3.5" />
              Open Models Folder
            </div>
            <ChevronRight className="w-3.5 h-3.5 opacity-50" />
          </button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Unable to load storage info</p>
      )}
    </div>
  );
}

// ─── Danger Zone actions ──────────────────────────────────────────────────────
function DangerZoneActions() {
  const [deleteAppData, setDeleteAppData] = useState(true);
  const [deleteModels, setDeleteModels] = useState(false);
  const [deleteCudaLibs, setDeleteCudaLibs] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      if (deleteAppData) await api.resetAllData();
      if (deleteModels) await api.clearModelCache();
      if (deleteCudaLibs) await api.clearCudaLibs();

      const parts = [];
      if (deleteAppData) parts.push("app data");
      if (deleteModels) parts.push("models");
      if (deleteCudaLibs) parts.push("CUDA libraries");
      toast.success(`Deleted: ${parts.join(", ")} — returning to setup`);
      setTimeout(() => { window.location.hash = "/onboarding"; window.location.reload(); }, 500);
    } catch {
      toast.error("Failed to delete data");
    } finally {
      setIsDeleting(false);
    }
  };

  const canDelete = deleteAppData || deleteModels || deleteCudaLibs;

  return (
    <AlertDialog>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {/* Checkboxes */}
        <div className="flex flex-wrap gap-3 flex-1">
          {[
            { label: "App Data", desc: "History, settings, audio", checked: deleteAppData, onChange: setDeleteAppData },
            { label: "AI Models", desc: "Whisper model files", checked: deleteModels, onChange: setDeleteModels },
            { label: "CUDA Libraries", desc: "cuDNN + cuBLAS", checked: deleteCudaLibs, onChange: setDeleteCudaLibs },
          ].map(({ label, desc, checked, onChange }) => (
            <label key={label} className="flex items-start gap-2 p-3 rounded-xl bg-background/40 border border-border/40 cursor-pointer hover:border-destructive/30 transition-colors min-w-[140px]">
              <Checkbox
                checked={checked}
                onCheckedChange={(v) => onChange(v === true)}
                className="mt-0.5"
              />
              <div>
                <p className="text-xs font-medium">{label}</p>
                <p className="text-[10px] text-muted-foreground">{desc}</p>
              </div>
            </label>
          ))}
        </div>

        {/* Delete button */}
        <AlertDialogTrigger asChild>
          <button
            disabled={!canDelete}
            className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl border border-destructive/40 bg-destructive/10 hover:bg-destructive hover:text-white hover:border-destructive transition-all text-sm font-medium text-destructive disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" />
            Reset Selected
          </button>
        </AlertDialogTrigger>
      </div>

      <AlertDialogContent className="glass-strong rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm deletion</AlertDialogTitle>
          <AlertDialogDescription>
            The following will be permanently deleted:{" "}
            <strong>
              {[deleteAppData && "app data", deleteModels && "AI models", deleteCudaLibs && "CUDA libraries"]
                .filter(Boolean).join(", ")}
            </strong>. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90 rounded-xl disabled:opacity-50"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
