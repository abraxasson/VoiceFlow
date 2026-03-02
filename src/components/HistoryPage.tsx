import { useEffect, useState, useCallback } from "react";
import { Search, Copy, Trash2, CalendarDays, Mic, FileAudio, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { base64ToBlobUrl, revokeUrl, isInvalidAudioPayload } from "@/lib/audio";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import type { HistoryEntry } from "@/lib/types";

export function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showPlayer, setShowPlayer] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioMeta, setAudioMeta] = useState<{ fileName?: string; mime?: string; durationMs?: number } | null>(null);
  const [loadingAudioFor, setLoadingAudioFor] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const loadHistory = useCallback(async (searchQuery?: string) => {
    setLoading(true);
    try {
      const data = await api.getHistory(100, 0, searchQuery || undefined, false);
      setHistory(data);
    } catch (error) {
      console.error("Failed to load history:", error);
      toast.error("Failed to load history");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    const debounce = setTimeout(() => loadHistory(search), 500);
    return () => clearTimeout(debounce);
  }, [search, loadHistory]);

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
      toast.error(isInvalidAudioPayload(error) ? "Audio file is corrupted" : "Audio file not found");
      revokeUrl(audioUrl);
      setAudioUrl(null);
      setShowPlayer(false);
      setAudioMeta(null);
    } finally {
      setLoadingAudioFor(null);
    }
  }, [audioUrl]);

  const groupedHistory = groupByDate(history);
  const durationMs = audioMeta?.durationMs;

  return (
    <>
    <div className="min-h-screen w-full bg-background/50 relative overflow-x-hidden">
      <div className="fixed inset-0 bg-grid opacity-20 pointer-events-none overflow-hidden" />
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="orb orb-secondary w-[450px] h-[450px] absolute -top-40 -left-40 opacity-15" />
        <div className="orb orb-primary w-[350px] h-[350px] absolute bottom-20 -right-40 opacity-20" />
      </div>

      <div className="w-full max-w-[1600px] mx-auto p-6 md:p-10 space-y-8 relative z-10">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tighter text-foreground mb-2">
              Full <span className="headline-serif text-primary">History</span>
            </h1>
            <p className="text-lg text-muted-foreground/80 font-light max-w-2xl">
              A complete archive of your voice notes and dictations.
            </p>
          </div>
          <div className="w-full md:w-[400px] relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Search archive..."
              className="pl-10 h-11 w-full bg-background/50 border-border/50 focus:bg-background transition-all shadow-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <section className="min-h-[500px]">
          {loading ? (
            <div className="glass-card rounded-2xl overflow-hidden">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="h-11 border-b border-border/20 bg-muted/10 animate-pulse" />
              ))}
            </div>
          ) : Object.keys(groupedHistory).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-center space-y-6 border border-dashed border-border/50 rounded-3xl bg-secondary/5">
              <div className="relative">
                <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center">
                  <Mic className="w-12 h-12 text-primary/40" />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center">
                  <Search className="w-4 h-4 text-muted-foreground/50" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xl font-medium">
                  {search ? "No matching results" : "Archive is empty"}
                </p>
                <p className="text-muted-foreground">
                  {search ? "Try searching for simpler keywords." : "Everything you transcribe will be saved here."}
                </p>
              </div>
            </div>
          ) : (
            <div className="glass-card rounded-2xl overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-[80px_1fr_60px_auto_90px] gap-0 px-5 py-2.5 bg-secondary/50 border-b border-border/40">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 text-right">Time</span>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 pl-4">Transcription</span>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 text-right">Words</span>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 text-center px-3">Audio</span>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 text-right">Actions</span>
              </div>

              {Object.entries(groupedHistory).map(([dateLabel, entries]) => (
                <div key={dateLabel}>
                  {/* Date group header */}
                  <div className="flex items-center gap-2 px-5 py-2 bg-secondary/30 border-b border-t border-border/30">
                    <CalendarDays className="w-3.5 h-3.5 text-primary/60" />
                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      {dateLabel}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground/50">{entries.length} entries</span>
                  </div>

                  {entries.map((entry) => (
                    <HistoryTableRow
                      key={entry.id}
                      entry={entry}
                      isExpanded={expandedId === entry.id}
                      onToggleExpand={() => setExpandedId(prev => prev === entry.id ? null : entry.id)}
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

function HistoryTableRow({
  entry,
  isExpanded,
  onToggleExpand,
  onCopy,
  onDelete,
  onPlayAudio,
  isLoadingAudio,
}: {
  entry: HistoryEntry;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onCopy: (text: string) => void;
  onDelete: (id: number) => void;
  onPlayAudio: (id: number) => void;
  isLoadingAudio: boolean;
}) {
  const hasAudio = !!entry.has_audio;
  return (
    <>
      <div
        className="group grid grid-cols-[80px_1fr_60px_auto_90px] gap-0 px-5 py-2.5 border-b border-border/20 hover:bg-primary/5 transition-colors duration-100 cursor-pointer items-center"
        onClick={onToggleExpand}
      >
        {/* Time */}
        <span className="text-xs font-mono text-muted-foreground/60 text-right shrink-0">
          {formatTime(entry.created_at)}
        </span>

        {/* Text */}
        <div className="pl-4 min-w-0 flex items-center gap-2">
          <p className="text-sm text-foreground/80 group-hover:text-foreground transition-colors truncate">
            {entry.text}
          </p>
          {isExpanded
            ? <ChevronUp className="shrink-0 w-3.5 h-3.5 text-muted-foreground/40" />
            : <ChevronDown className="shrink-0 w-3.5 h-3.5 text-muted-foreground/0 group-hover:text-muted-foreground/40 transition-colors" />
          }
        </div>

        {/* Words */}
        <span className="text-xs text-muted-foreground/50 text-right tabular-nums shrink-0">
          {entry.word_count}
        </span>

        {/* Audio badge */}
        <div className="flex justify-center px-3">
          {hasAudio && (
            <Badge variant="secondary" className="text-[10px] gap-1 py-0.5 cursor-pointer"
              onClick={(e) => { e.stopPropagation(); onPlayAudio(entry.id); }}
            >
              <FileAudio className="w-3 h-3" />
              {isLoadingAudio ? "..." : "Play"}
            </Badge>
          )}
        </div>

        {/* Actions */}
        <div
          className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <Button variant="ghost" size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg"
            onClick={() => onCopy(entry.text)}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
            onClick={() => onDelete(entry.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Expanded text view */}
      {isExpanded && (
        <div className="px-5 py-3 bg-secondary/20 border-b border-border/20">
          <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
            {entry.text}
          </p>
        </div>
      )}
    </>
  );
}

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
    if (isSameDay(entryDate, today)) label = "Today";
    else if (isSameDay(entryDate, yesterday)) label = "Yesterday";
    else label = entryDate.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

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
