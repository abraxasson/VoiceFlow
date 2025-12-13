import { NavLink } from "react-router-dom";
import { Mic, Home, History, Settings, HelpCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", icon: Home, label: "Home" },
  { to: "/dashboard/history", icon: History, label: "History" },
  { to: "/dashboard/settings", icon: Settings, label: "Settings" },
];

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  return (
    <aside className="w-64 h-screen bg-sidebar flex flex-col border-r border-sidebar-border shadow-2xl z-20">
      {/* Logo Area */}
      <div className="p-6 pb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
            <Mic className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-sidebar-foreground tracking-tight leading-none">
              VoiceFlow
            </h1>
            <p className="text-xs text-sidebar-foreground/50 font-medium mt-0.5">
              AI Dictation
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/dashboard"}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "group flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-primary/15 text-primary shadow-sm" // Active State: Green background tint + Green Text
                  : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={cn(
                    "h-5 w-5 transition-colors",
                    isActive ? "text-primary" : "text-sidebar-foreground/60 group-hover:text-primary" // Hover: Icon turns Green
                  )}
                />
                <span className="flex-1">{item.label}</span>
                {isActive && (
                  <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_currentColor]" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Promo / Footer */}
      <div className="p-4 mt-auto">
        <div className="bg-gradient-to-br from-primary/10 to-transparent border border-primary/10 rounded-2xl p-4 mb-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 bg-primary/10 rounded-full blur-2xl -mr-4 -mt-4 transition-all group-hover:bg-primary/20" />
            <div className="relative z-10">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center mb-3 text-primary">
                    <Sparkles className="w-4 h-4" />
                </div>
                <h4 className="text-sidebar-foreground font-semibold text-sm mb-1">Pro Tip</h4>
                <p className="text-xs text-sidebar-foreground/60 leading-relaxed mb-3">
                    Use <span className="text-primary font-bold font-mono bg-primary/10 px-1.5 py-0.5 rounded">Ctrl+Win</span> to capture thoughts instantly.
                </p>
            </div>
        </div>

        <button
          className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-sm font-medium text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
          aria-label="Get help and support"
          type="button"
        >
          <HelpCircle className="h-5 w-5" aria-hidden="true" />
          Help & Support
        </button>
      </div>
    </aside>
  );
}
