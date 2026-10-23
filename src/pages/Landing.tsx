import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Boxes,
  Crosshair,
  CircleDot,
  Cpu,
  Github,
  MonitorPlay,
  Radar,
  ScanEye,
  ShieldCheck,
  Target,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.55, ease: "easeOut" as const },
};

/** Animated, clearly-labeled mock of the ESP/FOV overlay for the hero. */
function OverlayMock() {
  return (
    <div className="relative mx-auto aspect-video w-full max-w-xl overflow-hidden rounded-xl border border-border/70 bg-[oklch(0.11_0.03_250)]">
      {/* scanline + vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,oklch(0.25_0.05_220/0.5),transparent_65%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

      {/* terrain hints */}
      <div className="absolute bottom-0 h-1/3 w-full bg-gradient-to-t from-primary/5 to-transparent" />
      <div className="absolute left-[12%] top-[30%] h-16 w-10 rounded-sm bg-foreground/5" />
      <div className="absolute right-[18%] top-[24%] h-24 w-14 rounded-sm bg-foreground/5" />

      {/* FOV circle */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <motion.div
          animate={{ scale: [1, 1.03, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="size-44 rounded-full border-2 border-primary/50"
        />
        <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 gap-1.5">
          <span className="h-0.5 w-2.5 bg-primary/80" />
          <span className="size-1 rounded-full bg-primary" />
          <span className="h-0.5 w-2.5 bg-primary/80" />
        </div>
      </div>

      {/* moving ESP boxes */}
      <motion.div
        animate={{ x: [0, 46, -8, 0], y: [0, -14, 10, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[36%] left-[30%]"
      >
        <div className="h-20 w-9 rounded-sm border-2 border-primary/90">
          <span className="absolute -top-5 left-0 rounded-sm bg-black/70 px-1 font-mono text-[9px] text-primary">
            87%
          </span>
        </div>
      </motion.div>
      <motion.div
        animate={{ x: [0, -30, 12, 0], y: [0, 10, -6, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[48%] right-[26%]"
      >
        <div className="h-14 w-7 rounded-sm border-2 border-dashed border-amber-400/80">
          <span className="absolute -top-5 left-0 rounded-sm bg-black/70 px-1 font-mono text-[9px] text-amber-400">
            ~61%
          </span>
        </div>
      </motion.div>

      <div className="absolute bottom-2.5 left-3 font-mono text-[10px] text-muted-foreground">
        processing 10.2 fps · webgpu · 2 tracked
      </div>
      <div className="absolute top-2.5 right-3 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[9px] font-medium text-amber-400">
        UI PREVIEW — NOT REAL DETECTION
      </div>
    </div>
  );
}

const FEATURES = [
  {
    icon: <MonitorPlay className="size-5" />,
    title: "Live screen capture",
    body: "Share a screen, window or browser tab with the Screen Capture API — a YouTube gameplay video is a perfect source. Start, pause and stop on demand.",
  },
  {
    icon: <Cpu className="size-5" />,
    title: "On-device YOLO inference",
    body: "YOLOv10n runs in a Web Worker via ONNX Runtime Web (WebGPU with WASM fallback). Frames never leave your machine.",
  },
  {
    icon: <Boxes className="size-5" />,
    title: "ESP overlay",
    body: "Configurable bounding boxes with confidence labels, center dots, simulated distance and center connection lines — all rendered on a crisp canvas.",
  },
  {
    icon: <Target className="size-5" />,
    title: "FOV circle & crosshair",
    body: "Adjustable radius, color and transparency. In-FOV targets get corner highlights. Purely a visual aid — never a targeting trigger.",
  },
  {
    icon: <Workflow className="size-5" />,
    title: "Tracking that holds still",
    body: "IoU-based multi-object tracking with temporal smoothing keeps boxes stable between frames and separates confirmed targets from suspected ones.",
  },
  {
    icon: <Activity className="size-5" />,
    title: "Honest performance metrics",
    body: "Live FPS, inference latency, backend status and track counts in a status bar — with adaptive sampling when hardware can't keep up.",
  },
];

const STEPS = [
  {
    title: "Sign in & open the console",
    body: "The vision console is your private workspace — nothing is shared or stored.",
  },
  {
    title: "Share your screen or a tab",
    body: "Pick the YouTube gameplay video window. Capture stays local, always.",
  },
  {
    title: "Tune overlays in real time",
    body: "Slide the FOV radius, pick colors, set the confidence threshold and watch the tracker work.",
  },
];

export default function Landing() {
  const { isAuthenticated } = useAuth();
  const consoleHref = isAuthenticated ? "/dashboard" : "/auth?returnTo=%2Fdashboard";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="relative min-h-screen overflow-hidden bg-background text-foreground"
    >
      {/* grid backdrop */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.13]"
        style={{
          backgroundImage:
            "linear-gradient(oklch(0.8 0.15 195 / 0.25) 1px, transparent 1px), linear-gradient(90deg, oklch(0.8 0.15 195 / 0.25) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse at 50% 0%, black 30%, transparent 75%)",
        }}
      />

      {/* Nav */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center gap-6 px-4 py-5 sm:px-6">
        <a href="/" className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg border border-primary/40 bg-primary/10 text-primary">
            <Radar className="size-5" />
          </span>
          <span className="text-sm leading-tight font-bold tracking-tight">
            AI Vision
            <br />
            Simulator
          </span>
        </a>
        <nav className="ml-auto hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <a href="#features" className="transition hover:text-foreground">Features</a>
          <a href="#how" className="transition hover:text-foreground">How it works</a>
          <a href="#privacy" className="transition hover:text-foreground">Privacy</a>
        </nav>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <Button variant="ghost" size="sm" className="cursor-pointer" onClick={() => (window.location.href = consoleHref)}>
            {isAuthenticated ? "Dashboard" : "Sign in"}
          </Button>
          <Button size="sm" className="cursor-pointer gap-1.5" onClick={() => (window.location.href = consoleHref)}>
            Open console
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 pt-10 pb-16 text-center sm:px-6 sm:pt-16">
        <motion.div {...fadeUp}>
          <Badge variant="outline" className="mb-5 gap-1.5 border-primary/40 text-primary">
            <ScanEye className="size-3.5" />
            Visual simulation · 100% local processing
          </Badge>
        </motion.div>
        <motion.h1
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.05 }}
          className="mx-auto max-w-3xl text-4xl leading-[1.1] font-black tracking-tight sm:text-6xl"
        >
          See what the{" "}
          <span className="bg-gradient-to-r from-primary via-emerald-400 to-amber-400 bg-clip-text text-transparent">
            AI sees
          </span>
          .
        </motion.h1>
        <motion.p
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.1 }}
          className="mx-auto mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg"
        >
          A browser-based aim-assist <em>simulator</em>: point it at any gameplay
          video and watch YOLO detection, ESP boxes, FOV circle and object
          tracking come alive — for training, analysis and demonstration.
        </motion.p>
        <motion.div
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.15 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
        >
          <Button size="lg" className="cursor-pointer gap-2" onClick={() => (window.location.href = consoleHref)}>
            <Crosshair className="size-4" />
            {isAuthenticated ? "Open the console" : "Start simulating"}
          </Button>
          <Button size="lg" variant="outline" className="cursor-pointer gap-2" onClick={() => (window.location.href = "#how")}>
            How it works
          </Button>
        </motion.div>
        <motion.p
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.2 }}
          className="mt-6 text-xs text-muted-foreground"
        >
          No game input · no memory access · no anti-cheat circumvention — ever.
        </motion.p>
        <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.25 }} className="mt-12">
          <OverlayMock />
        </motion.div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <motion.h2 {...fadeUp} className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
          A complete vision pipeline, in one tab
        </motion.h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: i * 0.06 }}
              className="rounded-xl border border-border/70 bg-card/50 p-5"
            >
              <div className="mb-3 flex size-10 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                {f.icon}
              </div>
              <h3 className="font-semibold tracking-tight">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{f.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="relative z-10 mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <motion.h2 {...fadeUp} className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
          Three steps to a live simulation
        </motion.h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.title}
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: i * 0.08 }}
              className="relative rounded-xl border border-border/70 bg-card/50 p-5"
            >
              <span className="absolute -top-3 left-5 rounded-full border border-primary/40 bg-background px-2.5 py-0.5 font-mono text-[11px] text-primary">
                0{i + 1}
              </span>
              <h3 className="mt-2 font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Privacy */}
      <section id="privacy" className="relative z-10 mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <motion.div
          {...fadeUp}
          className="mx-auto max-w-3xl rounded-xl border border-border/70 bg-card/50 p-6 sm:p-8"
        >
          <div className="flex items-center gap-3">
            <ShieldCheck className="size-6 text-primary" />
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
              Simulation only. By design.
            </h2>
          </div>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            The AI Vision Simulator visualizes how detection overlays work — it
            never touches a game. It does not simulate mouse or keyboard input,
            does not read process memory, does not inject into anything and does
            not attempt to bypass anti-cheat systems. Captured frames are
            analyzed locally and discarded instantly; nothing is recorded or
            uploaded. The FOV circle is an orientation aid, not a targeting
            mechanism.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {["No input simulation", "No memory access", "No uploads", "No anti-cheat evasion"].map((t) => (
              <Badge key={t} variant="outline" className="gap-1 border-emerald-500/40 text-emerald-400">
                <CircleDot className="size-3" />
                {t}
              </Badge>
            ))}
          </div>
        </motion.div>
      </section>

      {/* CTA */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 pb-20 text-center sm:px-6">
        <motion.h2 {...fadeUp} className="text-2xl font-bold tracking-tight sm:text-3xl">
          Ready to point it at your screen?
        </motion.h2>
        <motion.div {...fadeUp} className="mt-6 flex justify-center">
          <Button size="lg" className="cursor-pointer gap-2" onClick={() => (window.location.href = consoleHref)}>
            <Radar className="size-4" />
            Open the vision console
          </Button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/70 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <span className="flex items-center gap-2">
            <Radar className="size-3.5 text-primary" />
            AI Vision Simulator — educational visualization. Respect the terms
            of any content you analyze.
          </span>
          <span className="flex items-center gap-4">
            <a href="#privacy" className="transition hover:text-foreground">Privacy</a>
            <a href="#features" className="transition hover:text-foreground">Features</a>
            <Github className="size-3.5" />
          </span>
        </div>
      </footer>
    </motion.div>
  );
}
