import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Menu, Mic } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { HomePage } from "@/components/HomePage";
import { HistoryPage } from "@/components/HistoryPage";
import { SettingsTab } from "@/components/SettingsTab";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";

export function Dashboard() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar - hidden on mobile */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-sidebar border-b border-sidebar-border px-4 py-3 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="text-sidebar-foreground"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center">
            <Mic className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-sidebar-foreground">VoiceFlow</span>
        </div>
      </div>

      {/* Mobile Sidebar Sheet */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="p-0 w-64 bg-sidebar border-sidebar-border">
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <Sidebar onNavigate={() => setMobileMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      <main className="flex-1 overflow-auto pt-14 md:pt-0">
        <Routes>
          <Route index element={<HomePage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="settings" element={<SettingsTab />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}
