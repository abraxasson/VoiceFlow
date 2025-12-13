import { useEffect, useState } from "react";
import { Search, Copy, Trash2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { HistoryEntry } from "@/lib/types";

export function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = async (searchQuery?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getHistory(100, 0, searchQuery || undefined);
      setHistory(data);
    } catch (error) {
      console.error("Failed to load history:", error);
      setError("Failed to load history. Please try again.");
      toast.error("Failed to load history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      loadHistory(search);
    }, 300);
    return () => clearTimeout(debounce);
  }, [search]);

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
    <div className="p-4 md:p-8 max-w-5xl mx-auto h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground/90">History</h1>
            <p className="text-muted-foreground mt-1">Manage your voice notes</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
        <Input
          type="search"
          placeholder="Search transcriptions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-11 h-12 text-base rounded-xl bg-card border-none shadow-sm focus-visible:ring-primary/20"
        />
      </div>

      {/* History List */}
      <div className="flex-1 space-y-8 pb-10">
        {loading ? (
          <div className="text-center py-20 text-muted-foreground">Loading...</div>
        ) : error ? (
          <div className="text-center py-20 border-2 border-dashed border-destructive/30 rounded-xl bg-destructive/5" role="alert">
            <p className="text-destructive font-medium">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => loadHistory(search)}
            >
              Try again
            </Button>
          </div>
        ) : Object.keys(groupedHistory).length === 0 ? (
           <div className="text-center py-20 border-2 border-dashed rounded-xl">
             <div className="w-16 h-16 bg-muted/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="h-6 w-6 text-muted-foreground/50" aria-hidden="true" />
             </div>
             <p className="text-muted-foreground font-medium">
               {search ? "No results found for your search" : "No transcriptions yet"}
             </p>
          </div>
        ) : (
          Object.entries(groupedHistory).map(([dateLabel, entries]) => (
            <div key={dateLabel}>
               <div className="flex items-center gap-2 mb-4 pl-1">
                  <Calendar className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    {dateLabel}
                  </h3>
               </div>
              
              <div className="grid gap-4">
                {entries.map((entry) => (
                  <Card
                    key={entry.id}
                    className="group border-none shadow-sm hover:shadow-md transition-all duration-200 bg-card hover:bg-white dark:hover:bg-card/80"
                  >
                    <CardContent className="p-5 flex gap-5">
                       {/* Time Column */}
                        <div className="flex flex-col items-center pt-1 min-w-[4rem]">
                             <span className="text-sm font-bold text-foreground/80 font-mono">
                                {formatTime(entry.created_at)}
                             </span>
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] leading-relaxed text-foreground/90 font-medium whitespace-pre-wrap break-words">
                              {entry.text}
                          </p>
                          <div className="flex items-center gap-3 mt-3">
                            <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                                {entry.word_count} words
                            </span>
                             <span className="text-xs text-muted-foreground/70">
                                {entry.char_count} chars
                            </span>
                          </div>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
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
