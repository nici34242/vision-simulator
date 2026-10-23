import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  Crosshair,
  Cpu,
  Eye,
  LogOut,
  MonitorPlay,
  Radar,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { DetectionLog } from "@/components/simulator/DetectionLog";
import { ModelInfoPanel, PrivacyPanel } from "@/components/simulator/InfoPanels";
import { PerformanceMonitor } from "@/components/simulator/PerformanceMonitor";
import { ScreenCapture } from "@/components/simulator/ScreenCapture";
import { SettingsPanel } from "@/components/simulator/SettingsPanel";
import { VideoPreview } from "@/components/simulator/VideoPreview";
import { detectionEngine } from "@/lib/simulator/engine";

type View = "simulator" | "model" | "privacy";

const NAV_ITEMS: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: "simulator", label: "Live Simulator", icon: <MonitorPlay className="size-4" /> },
  { id: "model", label: "Model & Integration", icon: <Cpu className="size-4" /> },
  { id: "privacy", label: "Privacy & Security", icon: <ShieldCheck className="size-4" /> },
];

function Brand() {
  return (
    <div className="flex items-center gap-2 px-4 py-4">
      <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <Radar className="size-4.5" />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-bold tracking-tight">AI Vision Simulator</p>
        <p className="text-[11px] text-muted-foreground">ESP · FOV · tracking</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<View>("simulator");

  const videoRef = useRef<HTMLVideoElement>(null);
  // Module singleton: StrictMode remounts must never fork the pipeline state.
  const engine = detectionEngine;

  useEffect(() => {
    engine.attachVideo(videoRef.current);
    engine.loadModel();
    engine.start();
    return () => {
      // Detaching stops processing; the model and worker stay warm for the
      // tab's lifetime so remounts reconnect instantly.
      engine.attachVideo(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Left sidebar — hidden on mobile, replaced by the tab bar below */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border/70 bg-sidebar md:flex">
        <Brand />
        <nav className="flex flex-col gap-1 px-2">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              className={`flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm transition ${
                view === item.id
                  ? "bg-primary/15 font-medium text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto px-4 pb-4">
          <p className="flex items-start gap-1.5 text-[11px] leading-4 text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
            Visual simulation only. No game input, no memory access, no uploads.
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="flex items-center gap-3 border-b border-border/70 px-4 py-3">
          <div className="md:hidden">
            <Brand />
          </div>
          <h1 className="hidden items-center gap-2 text-sm font-semibold tracking-tight md:flex">
            <Eye className="size-4 text-primary" />
            Vision Console
          </h1>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:block">
              {user?.name ?? user?.email ?? "Signed in"}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer gap-1.5"
              onClick={() => void handleSignOut()}
            >
              <LogOut className="size-3.5" />
              Sign out
            </Button>
          </div>
        </header>

        {/* Mobile nav tabs */}
        <div className="flex gap-1 border-b border-border/70 px-3 py-2 md:hidden">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition ${
                view === item.id
                  ? "bg-primary/15 font-medium text-primary"
                  : "text-muted-foreground"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>

        <div className="grid flex-1 gap-5 p-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          {/* Center column */}
          <main className="flex min-w-0 flex-col gap-4">
            {view === "simulator" && (
              <>
                <ScreenCapture videoRef={videoRef} />
                <VideoPreview videoRef={videoRef} engine={engine} />
                <PerformanceMonitor />
                <DetectionLog />
              </>
            )}
            {view === "model" && <ModelInfoPanel engine={engine} />}
            {view === "privacy" && <PrivacyPanel />}
          </main>

          {/* Right settings sidebar */}
          <aside className="min-w-0">
            <div className="rounded-lg border border-border/70 bg-card/50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Crosshair className="size-4 text-primary" />
                <h2 className="text-sm font-semibold tracking-tight">
                  Detection settings
                </h2>
              </div>
              <SettingsPanel engine={engine} />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
