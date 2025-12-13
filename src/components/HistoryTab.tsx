import { useEffect, useState } from "react";
import { Search, Copy, Trash2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { HistoryEntry } from "@/lib/types";

export function HistoryTab() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const loadHistory = async (searchQuery?: string) => {
    setLoading(true);
    try {
      const data = await api.getHistory(100, 0, searchQuery || undefined);
      setHistory(data);
    } catch (error) {
      console.error("Failed to load history:", error);
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

  const groupedHistory = groupByDate(history);

  return (
    <div className="space-y-6 p-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-10 rounded-xl bg-muted/40 border-none shadow-sm focus-visible:ring-primary/20"
        />
      </div>

      {/* History Cards */}
      <div className="space-y-6">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>
        ) : Object.keys(groupedHistory).length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {search ? "No results found" : "No transcriptions yet"}
          </div>
        ) : (
          Object.entries(groupedHistory).map(([dateLabel, entries]) => (
            <div key={dateLabel}>
               <div className="flex items-center gap-2 mb-3 px-1">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {dateLabel}
                  </h3>
               </div>
              <div className="space-y-3">
                {entries.map((entry) => (
                  <Card key={entry.id} className="border-none shadow-sm hover:shadow-md transition-all group bg-card hover:bg-white dark:hover:bg-card/80">
                    <CardContent className="p-4 flex gap-4">
                       <span className="text-xs font-mono text-muted-foreground pt-0.5 min-w-[3rem]">
                          {formatTime(entry.created_at)}
                       </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-relaxed text-foreground/90 whitespace-pre-wrap break-words">
                          {entry.text}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                             <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                                {entry.word_count} words
                             </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                          onClick={() => handleCopy(entry.text)}
                          aria-label="Copy transcription to clipboard"
                        >
                          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(entry.id)}
                          aria-label="Delete transcription"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
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
