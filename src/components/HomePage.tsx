import { useEffect, useState } from "react";
import { Copy, Trash2 } from "lucide-react";
import EmptyStateImg from "@/assets/empty-state.png";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatsHeader } from "@/components/StatsHeader";
import { api } from "@/lib/api";
import type { HistoryEntry } from "@/lib/types";

export function HomePage() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setError(null);
        const data = await api.getHistory(20, 0);
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
  }, []);

  const handleCopy = async (text: string) => {
    try {
      await api.copyToClipboard(text);
      toast.success("Copied to clipboard");
    } catch (error) {
      try {
        await navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard");
      } catch {
        toast.error("Failed to copy to clipboard");
      }
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.deleteHistory(id);
      setHistory((prev) => prev.filter((h) => h.id !== id));
      toast.success("Transcription deleted");
    } catch (error) {
      console.error("Failed to delete:", error);
      toast.error("Failed to delete transcription");
    }
  };

  // Group history by date
  const groupedHistory = groupByDate(history);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <h1 className="text-3xl font-bold mb-8 tracking-tight text-foreground/90">Welcome back</h1>

      {/* Stats Cards */}
      {/* StatsHeader now contains the "Hero" card design */}
      <StatsHeader />

      {/* Recent History */}
      <div className="space-y-8 mt-12">
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : error ? (
          <div className="text-center py-12 border-2 border-dashed border-destructive/30 rounded-xl bg-destructive/5" role="alert">
            <p className="text-destructive font-medium">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => window.location.reload()}
            >
              Try again
            </Button>
          </div>
        ) : Object.keys(groupedHistory).length === 0 ? (
          <div className="text-center py-12 rounded-xl">
             <img 
               src={EmptyStateImg} 
               alt="No notes yet" 
               className="w-48 h-auto mx-auto mb-6 opacity-90 hover:scale-105 transition-transform duration-500" 
             />
             <p className="text-muted-foreground font-medium">No transcriptions yet</p>
             <p className="text-muted-foreground/60 text-sm mt-1">Try pressing <kbd className="font-mono bg-muted px-2 py-0.5 rounded text-foreground border border-border">Ctrl+Win</kbd> to capture a thought</p>
          </div>
        ) : (
          Object.entries(groupedHistory).map(([dateLabel, entries]) => (
            <div key={dateLabel}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-4 pl-1">
                {dateLabel}
              </h3>
              <div className="space-y-4">
                {entries.map((entry) => (
                  <Card
                    key={entry.id}
                    className="group border-none shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 bg-card hover:bg-white dark:hover:bg-card/80 overflow-hidden"
                  >
                    <CardContent className="p-6 flex items-start gap-6">
                        <div className="flex flex-col items-center gap-1 min-w-[3rem] pt-1.5">
                             <div className="text-xs font-bold text-muted-foreground/60 font-mono">
                                {formatTime(entry.created_at)}
                             </div>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                            <p className="text-[16px] leading-relaxed text-foreground font-medium">
                                {entry.text}
                            </p>
                            <div className="flex items-center gap-3 mt-4">
                                <span className="text-xs uppercase tracking-wider font-semibold text-primary/60 bg-primary/5 px-2 py-1 rounded-md">
                                    {entry.word_count} words
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-4 group-hover:translate-x-0">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full"
                            onClick={() => handleCopy(entry.text)}
                            aria-label="Copy transcription to clipboard"
                          >
                            <Copy className="h-4 w-4" aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                            onClick={() => handleDelete(entry.id)}
                            aria-label="Delete transcription"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
      label = entryDate.toLocaleDateString([], { month: "short", day: "numeric" });
    }

    if (!groups[label]) {
      groups[label] = [];
    }
    groups[label].push(entry);
  }

  return groups;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}
