import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ArrowLeft, Check, Mic, AlertCircle, Lock, Gauge, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import type { Settings, Options } from "@/lib/types";

// Assets
import HeroImg from "@/assets/hero-illustration.png";
import MicImg from "@/assets/onboarding-mic.png";
import ModelImg from "@/assets/onboarding-model.png";
import ThemeImg from "@/assets/onboarding-theme.png";
import SuccessImg from "@/assets/onboarding-success.png";

export function Onboarding() {
  const navigate = useNavigate();
  const [options, setOptions] = useState<Options | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  // Form state
  const [language, setLanguage] = useState("auto");
  const [model, setModel] = useState("small");
  const [autoStart, setAutoStart] = useState(true);
  const [retention] = useState(-1);
  const [theme, setTheme] = useState<Settings["theme"]>("system");
  const [microphone, setMicrophone] = useState<number>(0);

  useEffect(() => {
    const load = async () => {
      try {
        setError(null);
        const optionsData = await api.getOptions();
        setOptions(optionsData);
        if (optionsData.microphones.length > 0) {
          setMicrophone(optionsData.microphones[0].id);
        }
      } catch (err) {
        console.error("Failed to load options:", err);
        setError("Failed to load configuration. Please restart the application.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Apply theme in real-time
  useEffect(() => {
    const root = document.documentElement;
    let isDark = theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : theme === "dark";

    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  const handleFinish = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.updateSettings({
        language,
        model,
        autoStart,
        retention,
        theme,
        microphone,
        onboardingComplete: true,
      });
      navigate("/dashboard");
    } catch (err) {
      console.error("Failed to save settings:", err);
      setError("Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const nextStep = () => setStep((s) => s + 1);
  const prevStep = () => setStep((s) => s - 1);

  // Loading state
  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden" aria-busy="true">
        <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse delay-1000" />
        </div>

        <div className="relative flex flex-col items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 backdrop-blur-xl border border-primary/20 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
          <div className="text-center space-y-2">
            <p className="text-lg font-medium text-foreground">Initializing VoiceFlow</p>
            <p className="text-sm text-muted-foreground">Preparing your experience...</p>
          </div>
        </div>
      </main>
    );
  }

  // Error state
  if (error && !options) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute top-1/3 left-1/4 w-64 h-64 bg-destructive/10 rounded-full blur-3xl" />
        </div>

        <div className="relative backdrop-blur-xl bg-card/50 border border-border/50 rounded-3xl p-8 max-w-md text-center shadow-2xl" role="alert">
          <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-7 h-7 text-destructive" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Something went wrong</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button onClick={() => window.location.reload()} className="rounded-xl">
            Try Again
          </Button>
        </div>
      </main>
    );
  }

  if (!options) return null;

  const steps = [
    {
      id: "welcome",
      title: "Welcome to VoiceFlow",
      subtitle: "Your AI-powered dictation assistant",
      image: HeroImg,
      content: (
        <div className="space-y-8">
          <p className="text-xl font-light leading-relaxed text-muted-foreground">
            Dictation designed for <span className="text-foreground font-medium">privacy</span> and <span className="text-foreground font-medium">flow</span>.
          </p>

          <div className="grid gap-4">
            {[
              { icon: Lock, label: "100% Local", desc: "Never leaves your device" },
              { icon: Gauge, label: "Lightning Fast", desc: "Real-time transcription" },
              { icon: Wand2, label: "AI Powered", desc: "State-of-the-art accuracy" },
            ].map((feature) => (
              <div key={feature.label} className="flex items-center gap-4 p-4 rounded-2xl bg-secondary/30 backdrop-blur-sm border border-border/30 transition-all hover:bg-secondary/50">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <feature.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{feature.label}</p>
                  <p className="text-sm text-muted-foreground">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    },
    {
      id: "audio",
      title: "Select Microphone",
      subtitle: "Choose your input device",
      image: MicImg,
      content: (
        <div className="space-y-6">
          <div className="p-1 rounded-2xl bg-secondary/30 backdrop-blur-sm border border-border/30">
            <Select value={String(microphone)} onValueChange={(v) => setMicrophone(Number(v))}>
              <SelectTrigger className="h-14 text-base bg-transparent border-0 rounded-xl px-4 focus:ring-0 focus:ring-offset-0">
                <SelectValue placeholder="Select a microphone" />
              </SelectTrigger>
              <SelectContent className="border-border/50 bg-popover/95 backdrop-blur-xl shadow-2xl rounded-xl">
                {options.microphones.map((mic) => (
                  <SelectItem key={mic.id} value={String(mic.id)} className="py-3 rounded-lg cursor-pointer">
                    <span className="flex items-center gap-3">
                      <Mic className="w-4 h-4 text-muted-foreground" />
                      <span>{mic.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="text-sm text-muted-foreground px-1">
            This device will capture your voice for transcription. You can change this later in settings.
          </p>
        </div>
      )
    },
    {
      id: "model",
      title: "AI Configuration",
      subtitle: "Balance speed and accuracy",
      image: ModelImg,
      content: (
        <div className="space-y-6">
          {/* Language */}
          <div className="p-1 rounded-2xl bg-secondary/30 backdrop-blur-sm border border-border/30">
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="h-14 text-base bg-transparent border-0 rounded-xl px-4 focus:ring-0 focus:ring-offset-0">
                <span className="flex items-center gap-3">
                  <span className="text-muted-foreground">Language:</span>
                  <SelectValue />
                </span>
              </SelectTrigger>
              <SelectContent className="border-border/50 bg-popover/95 backdrop-blur-xl shadow-2xl rounded-xl max-h-[280px]">
                {options.languages.map((lang) => (
                  <SelectItem key={lang} value={lang} className="py-2.5 rounded-lg cursor-pointer">
                    {lang === "auto" ? "Auto-detect" : lang.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Models */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-muted-foreground px-1 mb-3">Processing Model</legend>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Select processing model">
              {[
                { id: 'tiny', label: 'Tiny', desc: 'Fastest', detail: '39M params', tradeoff: 'Basic accuracy' },
                { id: 'base', label: 'Base', desc: 'Fast', detail: '74M params', tradeoff: 'Good for simple audio' },
                { id: 'small', label: 'Small', desc: 'Balanced', detail: '244M params', tradeoff: 'Recommended' },
                { id: 'turbo', label: 'Turbo', desc: 'Fast + Accurate', detail: '809M params', tradeoff: 'Best value' },
                { id: 'medium', label: 'Medium', desc: 'Accurate', detail: '769M params', tradeoff: 'High quality' },
                { id: 'large-v3', label: 'Large', desc: 'Most Accurate', detail: '1.5B params', tradeoff: 'Slower, best quality' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={model === m.id}
                  className={`
                    relative p-3 rounded-2xl text-left transition-all
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                    ${model === m.id
                      ? 'bg-primary/10 border-2 border-primary/50 shadow-lg shadow-primary/10'
                      : 'bg-secondary/30 border border-border/30 hover:bg-secondary/50'}
                  `}
                  onClick={() => setModel(m.id)}
                >
                  <span className="flex items-baseline justify-between">
                    <span className="font-medium text-foreground">{m.label}</span>
                    <span className="text-[10px] text-muted-foreground/70">{m.detail}</span>
                  </span>
                  <span className="block text-xs text-primary/80 mt-0.5">{m.desc}</span>
                  <span className="block text-[10px] text-muted-foreground mt-1">{m.tradeoff}</span>
                  {model === m.id && (
                    <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-primary" aria-hidden="true" />
                  )}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      )
    },
    {
      id: "theme",
      title: "Appearance",
      subtitle: "Make it yours",
      image: ThemeImg,
      content: (
        <div className="space-y-8">
          {/* Theme Selection */}
          <fieldset>
            <legend className="text-sm font-medium text-muted-foreground px-1 mb-4">Theme</legend>
            <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Theme selection">
              {[
                { val: 'light', label: 'Light' },
                { val: 'dark', label: 'Dark' },
                { val: 'system', label: 'System' },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  role="radio"
                  aria-checked={theme === opt.val}
                  className={`
                    relative p-4 rounded-2xl flex flex-col items-center gap-3 transition-all
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                    ${theme === opt.val
                      ? 'bg-primary/10 border-2 border-primary/50 shadow-lg shadow-primary/10'
                      : 'bg-secondary/30 border border-border/30 hover:bg-secondary/50'}
                  `}
                  onClick={() => setTheme(opt.val as Settings['theme'])}
                >
                  <span className={`w-8 h-8 rounded-full border-2 ${
                    opt.val === 'light' ? 'bg-background border-border' :
                    opt.val === 'dark' ? 'bg-foreground border-foreground' :
                    'bg-gradient-to-br from-background to-foreground border-border'
                  }`} aria-hidden="true" />
                  <span className="text-sm font-medium">{opt.label}</span>
                </button>
              ))}
            </div>
          </fieldset>

          {/* Auto-start */}
          <div className="p-4 rounded-2xl bg-secondary/30 backdrop-blur-sm border border-border/30">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="block font-medium text-foreground">Auto-start</span>
                <span className="block text-sm text-muted-foreground">Launch when Windows starts</span>
              </div>
              <Switch checked={autoStart} onCheckedChange={setAutoStart} />
            </label>
          </div>
        </div>
      )
    },
    {
      id: "final",
      title: "You're All Set",
      subtitle: "Start dictating anywhere",
      image: SuccessImg,
      content: (
        <div className="space-y-8">
          <div className="p-6 rounded-3xl bg-primary/5 backdrop-blur-sm border border-primary/20 text-center">
            <p className="text-sm font-medium text-primary uppercase tracking-widest mb-4">Global Shortcut</p>
            <div className="flex items-center justify-center gap-3">
              <kbd className="px-4 py-2 rounded-xl bg-background border border-border text-2xl font-bold text-foreground shadow-sm">
                Ctrl
              </kbd>
              <span className="text-xl text-muted-foreground">+</span>
              <kbd className="px-4 py-2 rounded-xl bg-background border border-border text-2xl font-bold text-foreground shadow-sm">
                Win
              </kbd>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Hold to record, release to transcribe
            </p>
          </div>

          <p className="text-center text-muted-foreground">
            Press the shortcut anytime, anywhere to start dictating.
          </p>
        </div>
      )
    },
  ];

  const currentStep = steps[step];
  const isLastStep = step === steps.length - 1;

  return (
    <main className="min-h-screen flex bg-background relative overflow-hidden selection:bg-primary/20">
      {/* Ambient background orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute -top-1/4 -left-1/4 w-[800px] h-[800px] bg-primary/8 rounded-full blur-[150px]" />
        <div className="absolute -bottom-1/4 -right-1/4 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px]" />
      </div>

      {/* Error toast */}
      {error && options && (
        <div role="alert" className="fixed top-20 left-1/2 -translate-x-1/2 z-50 backdrop-blur-xl bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-2xl flex items-center gap-3 shadow-lg animate-in slide-in-from-top-4">
          <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {/* Left side: Full-bleed image (40%) */}
      <div className="hidden lg:block w-2/5 relative">
        <img
          key={currentStep.id}
          src={currentStep.image}
          alt=""
          role="presentation"
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500 animate-in fade-in"
        />
      </div>

      {/* Right side: Content (60%) */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-16 relative overflow-hidden">
        {/* Progress indicator - centered in right container */}
        <nav aria-label="Onboarding progress" className="absolute top-6 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-2 p-2 rounded-full bg-card/80 backdrop-blur-xl border border-border/50 shadow-lg">
            {steps.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => idx < step && setStep(idx)}
                disabled={idx > step}
                aria-label={`Step ${idx + 1}: ${s.title}`}
                aria-current={idx === step ? 'step' : undefined}
                className={`
                  h-2 rounded-full transition-all duration-300
                  ${idx === step ? 'w-8 bg-primary' : idx < step ? 'w-2 bg-primary/50 hover:bg-primary/70 cursor-pointer' : 'w-2 bg-muted'}
                `}
              />
            ))}
          </div>
        </nav>

        <section className="w-full max-w-lg relative z-10" aria-labelledby="step-title">
          <article className="space-y-8">
            {/* Header */}
            <header className="space-y-3">
              <p className="text-sm font-semibold text-primary tracking-wide uppercase" aria-hidden="true">
                Step {step + 1} of {steps.length}
              </p>
              <span className="sr-only">Step {step + 1} of {steps.length}</span>
              <h1 id="step-title" className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                {currentStep.title}
              </h1>
              <p className="text-lg text-muted-foreground">
                {currentStep.subtitle}
              </p>
            </header>

            {/* Step content */}
            <div className="min-h-[300px]">
              {currentStep.content}
            </div>

            {/* Navigation */}
            <footer className="flex items-center gap-4 pt-4">
              {step > 0 && (
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={prevStep}
                  className="rounded-xl text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="mr-2 w-4 h-4" aria-hidden="true" />
                  Back
                </Button>
              )}

              <button
                type="button"
                onClick={isLastStep ? handleFinish : nextStep}
                disabled={saving}
                aria-busy={saving}
                className="
                  ml-auto group relative min-w-[180px] h-14 px-8
                  rounded-2xl font-semibold text-base
                  bg-gradient-to-b from-primary to-primary/80
                  text-primary-foreground
                  border border-white/20
                  shadow-[0_4px_20px_-4px] shadow-primary/40
                  transition-all duration-300 ease-out
                  hover:shadow-[0_8px_30px_-4px] hover:shadow-primary/50
                  hover:-translate-y-1
                  active:translate-y-0 active:shadow-[0_2px_10px_-2px] active:shadow-primary/40
                  disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background
                  overflow-hidden
                "
              >
                {/* Top highlight shine */}
                <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" aria-hidden="true" />

                {/* Hover glow effect */}
                <span className="absolute inset-0 bg-gradient-to-t from-white/0 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" aria-hidden="true" />

                {/* Button content */}
                <span className="relative flex items-center justify-center gap-2">
                  {saving ? (
                    <>
                      <span className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      Setting up...
                    </>
                  ) : isLastStep ? (
                    <>
                      Get Started
                      <Check className="w-5 h-5 transition-transform group-hover:scale-110" aria-hidden="true" />
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                    </>
                  )}
                </span>
              </button>
            </footer>
          </article>
        </section>
      </div>

      {/* Mobile image - shown below content on small screens */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-48 pointer-events-none" aria-hidden="true">
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
        <img
          src={currentStep.image}
          alt=""
          className="w-full h-full object-cover opacity-30"
        />
      </div>
    </main>
  );
}
