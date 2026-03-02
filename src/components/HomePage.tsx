import { useEffect, useState, useCallback, memo } from "react";
import { Copy, Trash2, Clock, CalendarDays, Search, Mic, FileAudio } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatsHeader } from "@/components/StatsHeader";
import { api } from "@/lib/api";
import type { HistoryEntry } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { base64ToBlobUrl, revokeUrl, isInvalidAudioPayload } from "@/lib/audio";
import { formatHotkey } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function HomePage() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showPlayer, setShowPlayer] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioMeta, setAudioMeta] = useState<{ fileName?: string; mime?: string; durationMs?: number } | null>(null);
  const [loadingAudioFor, setLoadingAudioFor] = useState<number | null>(null);
  const [activeHotkey, setActiveHotkey] = useState<string>("Ctrl+Win");

  useEffect(() => {
    const load = async () => {
      try {
        setError(null);
        const data = await api.getHistory(50, 0, undefined, false);
        setHistory(data);
      } catch (error) {
        console.error("Failed to load history:", error);
        setError("Failed to load history. Please try again.");
        toast.error("Failed to load history");
      } finally {
        setLoading(false);
      }
    };
    load();

    api.getSettings().then((s) => {
      if (s.holdHotkeyEnabled && s.holdHotkey) {
        setActiveHotkey(formatHotkey(s.holdHotkey));
      } else if (s.toggleHotkeyEnabled && s.toggleHotkey) {
        setActiveHotkey(formatHotkey(s.toggleHotkey));
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    return () => revokeUrl(audioUrl);
  }, [audioUrl]);

  const handleCopy = useCallback(async (text: string) => {
    try {
      await api.copyToClipboard(text);
      toast.success("Copied to clipboard");
    } catch {
      try {
        await navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard");
      } catch {
        toast.error("Failed to copy to clipboard");
      }
    }
  }, []);

  const handleDelete = useCallback(async (id: number) => {
    try {
      await api.deleteHistory(id);
      setHistory((prev) => prev.filter((h) => h.id !== id));
      toast.success("Transcription deleted");
    } catch {
      toast.error("Failed to delete transcription");
    }
  }, []);

  const handlePlayAudio = useCallback(async (historyId: number) => {
    setLoadingAudioFor(historyId);
    try {
      const response = await api.getHistoryAudio(historyId);
      revokeUrl(audioUrl);
      const url = base64ToBlobUrl(response.base64, response.mime);
      setAudioUrl(url);
      setAudioMeta({ fileName: response.fileName, mime: response.mime, durationMs: response.durationMs });
      setShowPlayer(true);
    } catch (error) {
      console.error("Failed to load audio recording:", error);
      toast.error(isInvalidAudioPayload(error) ? "Audio file is corrupted" : "Audio file not found");
      revokeUrl(audioUrl);
      setAudioUrl(null);
      setShowPlayer(false);
      setAudioMeta(null);
    } finally {
      setLoadingAudioFor(null);
    }
  }, [audioUrl]);

  const filteredHistory = history.filter((entry) =>
    entry.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedHistory = groupByDate(filteredHistory);
  const durationMs = audioMeta?.durationMs;

  return (
    <>
    <div className="min-h-screen w-full bg-background/50 relative overflow-x-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 bg-grid opacity-20 pointer-events-none overflow-hidden" />
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="orb orb-primary w-[500px] h-[500px] absolute -top-60 -right-60 opacity-20" />
        <div className="orb orb-secondary w-[400px] h-[400px] absolute bottom-0 -left-40 opacity-15" />
      </div>

      <div className="w-full max-w-[1600px] mx-auto p-6 md:p-10 space-y-10 relative z-10">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tighter text-foreground mb-2">
              Dash<span className="headline-serif text-primary">board</span>
            </h1>
            <p className="text-lg text-muted-foreground/80 font-light max-w-2xl">
              Your voice, organized. Manage your recent transcriptions and insights.
            </p>
          </div>
          <div className="w-full md:w-auto flex items-center gap-3">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                placeholder="Search transcriptions..."
                className="pl-11 w-full md:w-[320px] h-12 bg-background/50 border-border/50 rounded-xl focus:bg-background focus:border-primary/30 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Stats / Hero Section */}
        <section>
          <StatsHeader />
        </section>

        {/* Divider */}
        <div className="divider-gradient" />

        {/* Recent History Table */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Clock className="w-5 h-5" />
              </div>
              Recent{" "}
              <span className="headline-serif text-muted-foreground">History</span>
            </h2>
            <span className="badge-glow">{filteredHistory.length} entries</span>
          </div>

          {loading ? (
            <div className="glass-card rounded-2xl overflow-hidden">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-12 border-b border-border/20 bg-muted/10 animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-20 glass-card rounded-2xl">
              <p className="text-destructive font-medium mb-4">{error}</p>
              <Button variant="outline" onClick={() => window.location.reload()} className="rounded-xl">
                Try again
              </Button>
            </div>
          ) : Object.keys(groupedHistory).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center space-y-6 glass-card rounded-2xl">
              <div className="relative">
                <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center">
                  <Mic className="w-12 h-12 text-primary/40" />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center">
                  <Search className="w-4 h-4 text-muted-foreground/50" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xl font-medium">
                  No transcriptions{" "}
                  <span className="headline-serif text-muted-foreground">yet</span>
                </p>
                <p className="text-muted-foreground">
                  {searchQuery
                    ? "Try adjusting your search terms."
                    : `Press ${activeHotkey} to start your first dictation.`}
                </p>
              </div>
            </div>
          ) : (
            <div className="glass-card rounded-2xl overflow-hidden">
              {Object.entries(groupedHistory).map(([dateLabel, entries]) => (
                <div key={dateLabel}>
                  {/* Date group header */}
                  <div className="flex items-center gap-2 px-5 py-2.5 bg-secondary/30 border-b border-border/30">
                    <CalendarDays className="w-3.5 h-3.5 text-primary/60" />
                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      {dateLabel}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground/50">{entries.length}</span>
                  </div>
                  {/* Rows */}
                  {entries.map((entry) => (
                    <HistoryRow
                      key={entry.id}
                      entry={entry}
                      onCopy={handleCopy}
                      onDelete={handleDelete}
                      onPlayAudio={handlePlayAudio}
                      isLoadingAudio={loadingAudioFor === entry.id}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>

    <Dialog
      open={showPlayer}
      onOpenChange={(open) => {
        setShowPlayer(open);
        if (!open) { revokeUrl(audioUrl); setAudioUrl(null); setAudioMeta(null); }
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Audio Recording</DialogTitle>
          <DialogDescription>Playback of the recorded audio for this transcription</DialogDescription>
        </DialogHeader>
        {audioUrl ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <FileAudio className="w-4 h-4 text-primary" />
                <span>{audioMeta?.fileName || "history_audio.wav"}</span>
              </div>
              {durationMs ? <span>{Math.round(durationMs / 1000)}s</span> : null}
            </div>
            {/* biome-ignore lint/a11y/useMediaCaption: transcript text is already displayed */}
            <audio controls autoPlay className="w-full">
              <source src={audioUrl} type={audioMeta?.mime || "audio/wav"} />
            </audio>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No audio loaded.</p>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}

const HistoryRow = memo(function HistoryRow({
  entry,
  onCopy,
  onDelete,
  onPlayAudio,
  isLoadingAudio,
}: {
  entry: HistoryEntry;
  onCopy: (text: string) => void;
  onDelete: (id: number) => void;
  onPlayAudio: (id: number) => void;
  isLoadingAudio: boolean;
}) {
  const hasAudio = !!entry.has_audio;
  return (
    <div className="group flex items-center gap-4 px-5 py-3 border-b border-border/20 hover:bg-primary/5 transition-colors duration-100">
      {/* Time */}
      <span className="shrink-0 text-xs font-mono text-muted-foreground/70 w-12 text-right">
        {formatTime(entry.created_at)}
      </span>

      {/* Text */}
      <p className="flex-1 text-sm text-foreground/80 group-hover:text-foreground transition-colors line-clamp-1 min-w-0">
        {entry.text}
      </p>

      {/* Audio badge */}
      {hasAudio && (
        <Badge variant="secondary" className="shrink-0 text-[10px] gap-1 py-0.5">
          <FileAudio className="w-3 h-3" />
          Audio
        </Badge>
      )}

      {/* Word count */}
      <span className="shrink-0 text-xs text-muted-foreground/50 w-16 text-right">
        {entry.word_count} words
      </span>

      {/* Actions */}
      <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost" size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg"
          onClick={() => onCopy(entry.text)}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
        {hasAudio && (
          <Button
            variant="ghost" size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg"
            onClick={() => onPlayAudio(entry.id)}
            disabled={isLoadingAudio}
          >
            <FileAudio className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button
          variant="ghost" size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
          onClick={() => onDelete(entry.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
});

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function groupByDate(entries: HistoryEntry[]): Record<string, HistoryEntry[]> {
  const groups: Record<string, HistoryEntry[]> = {};
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  for (const entry of entries) {
    const entryDate = new Date(entry.created_at);
    let label: string;
    if (isSameDay(entryDate, today)) {
      label = "Today";
    } else if (isSameDay(entryDate, yesterday)) {
      label = "Yesterday";
    } else {
      label = entryDate.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
    }
    if (!groups[label]) groups[label] = [];
    groups[label].push(entry);
  }
  return groups;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}
