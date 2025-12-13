import { useEffect, useState } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Onboarding } from "@/pages/Onboarding";
import { Dashboard } from "@/pages/Dashboard";
import { Popup } from "@/pages/Popup";
import { Toaster } from "@/components/ui/sonner";
import type { Settings } from "@/lib/types";

// Apply theme to document
function applyTheme(theme: Settings["theme"]) {
  const root = document.documentElement;
  let isDark = false;

  if (theme === "system") {
    isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  } else {
    isDark = theme === "dark";
  }

  if (isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

function AppRouter() {
  const [loading, setLoading] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  // Check if this is the popup route - render immediately without loading state
  const isPopupRoute = window.location.hash === "#/popup";

  useEffect(() => {
    // Skip settings check for popup - it doesn't need it
    if (isPopupRoute) {
      setLoading(false);
      return;
    }

    const checkOnboarding = async () => {
      try {
        const settings = await api.getSettings();
        setOnboardingComplete(settings.onboardingComplete);
        // Apply theme on app load
        applyTheme(settings.theme);
      } catch (error) {
        console.error("Failed to check onboarding:", error);
        // Default to showing onboarding if we can't check
        setOnboardingComplete(false);
      } finally {
        setLoading(false);
      }
    };
    checkOnboarding();
  }, [isPopupRoute]);

  // For popup, render immediately with no loading state
  if (isPopupRoute) {
    return (
      <Routes>
        <Route path="/popup" element={<Popup />} />
      </Routes>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/popup" element={<Popup />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/dashboard/*" element={<Dashboard />} />
      <Route
        path="/"
        element={
          <Navigate to={onboardingComplete ? "/dashboard" : "/onboarding"} replace />
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AppRouter />
      <Toaster position="bottom-right" />
    </HashRouter>
  );
}
