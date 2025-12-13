import { useEffect, useState } from "react";
import { Flame, FileText, Type } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { Stats } from "@/lib/types";
import HeroImg from "@/assets/hero-illustration.png";
import AiImg from "@/assets/ai-processing.png";

export function StatsHeader() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.getStats();
        setStats(data);
      } catch (error) {
        console.error("Failed to load stats:", error);
        setStats({ totalTranscriptions: 0, totalWords: 0, totalCharacters: 0, streakDays: 0 });
      }
    };
    load();
  }, []);

  if (!stats) {
    return <div className="animate-pulse h-48 rounded-xl bg-muted/20 w-full mb-8"></div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {/* Hero Card - Words */}
      <Card className="md:col-span-2 overflow-hidden relative border-none shadow-2xl bg-zinc-950">
        <div className="absolute inset-0 z-0">
            <img src={HeroImg} alt="Voice Flow" className="w-full h-full object-cover opacity-80" />
            <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/90 via-zinc-950/40 to-transparent" />
        </div>
        <div className="absolute top-0 right-0 p-32 bg-primary/20 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none mix-blend-screen" />
        <CardContent className="p-8 relative z-10 flex flex-col h-full justify-between">
            <div>
                <p className="text-zinc-400 font-medium mb-1 flex items-center gap-2">
                    <Type className="w-4 h-4 text-primary" /> Total Words Dictated
                </p>
                <h2 className="text-5xl font-bold text-white tracking-tight mt-2">
                    {stats.totalWords.toLocaleString()}
                </h2>
            </div>
            
            <div className="mt-8 flex gap-6">
                 <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-2.5 backdrop-blur-md border border-white/10 transition-transform hover:scale-105 duration-200">
                    <div className="p-1.5 bg-white/20 rounded-lg">
                        <Flame className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <p className="text-xs text-white/70 font-bold uppercase tracking-wider">Streak</p>
                        <p className="text-white font-bold leading-none">{stats.streakDays} days</p>
                    </div>
                 </div>
                 
                 <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-2.5 backdrop-blur-md border border-white/10 transition-transform hover:scale-105 duration-200">
                    <div className="p-1.5 bg-white/20 rounded-lg">
                        <FileText className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <p className="text-xs text-white/70 font-bold uppercase tracking-wider">Notes</p>
                        <p className="text-white font-bold leading-none">{stats.totalTranscriptions}</p>
                    </div>
                 </div>
            </div>
        </CardContent>
      </Card>
      
      <Card className="bg-card/50 backdrop-blur-sm border-border shadow-lg relative overflow-hidden group">
        <div className="absolute -right-8 -bottom-8 w-40 h-40 z-0 opacity-20 group-hover:opacity-40 transition-opacity duration-500">
             <img src={AiImg} alt="AI" className="w-full h-full object-cover animate-pulse" />
        </div>
        <CardContent className="p-6 h-full flex flex-col justify-center relative z-10">
             <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/10 rounded-full blur-2xl" />
            <div className="mb-4 p-3 bg-primary/10 w-fit rounded-xl relative z-10">
                <Flame className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2 relative z-10">Productivity Pulse</h3>
            <p className="text-muted-foreground text-sm leading-relaxed relative z-10">
                {getMotivationalMessage(stats.totalWords)}
            </p>
        </CardContent>
      </Card>
    </div>
  );
}

function getMotivationalMessage(words: number): string {
    if (words === 0) return "Your voice is your most powerful tool. Start recording to see your stats grow!";
    if (words < 1000) return "You're just getting started! Dictating is 3x faster than typing. Keep going.";
    if (words < 5000) return "You're building a great habit. Imagine how much time you've saved by speaking instead of typing.";
    return "You are a power user! Your productivity logic is efficiently flowing from thought to text.";
}
