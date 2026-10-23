import { Dices, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  COLOR_SWATCHES,
  DEFAULT_SETTINGS,
  MODEL_PRESETS,
  type SimulatorSettings,
} from "@/lib/simulator/types";
import { resetSettings, settingsStore, useStore } from "@/lib/simulator/store";
import type { DetectionEngine } from "@/lib/simulator/engine";

interface SettingsPanelProps {
  engine: DetectionEngine;
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div>
        <Label className="text-xs font-medium">{label}</Label>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      <Switch checked={value} onCheckedChange={onChange} className="cursor-pointer" />
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="py-1.5">
      <div className="mb-1.5 flex items-center justify-between">
        <Label className="text-xs font-medium">{label}</Label>
        <span className="font-mono text-[11px] text-muted-foreground">
          {format ? format(value) : value}
        </span>
      </div>
      <Slider
        className="cursor-pointer"
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(vals) => onChange(vals[0])}
      />
    </div>
  );
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="py-1.5">
      <Label className="mb-1.5 block text-xs font-medium">{label}</Label>
      <div className="flex flex-wrap items-center gap-1.5">
        {COLOR_SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Color ${c}`}
            onClick={() => onChange(c)}
            className={`size-5 cursor-pointer rounded-full border transition ${
              value.toLowerCase() === c.toLowerCase()
                ? "border-foreground ring-2 ring-ring/60"
                : "border-border/60 hover:scale-110"
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
        <label className="ml-1 flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="size-5 cursor-pointer appearance-none rounded-full border border-border/60 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0"
          />
          custom
        </label>
      </div>
    </div>
  );
}

export function SettingsPanel({ engine }: SettingsPanelProps) {
  const s = useStore(settingsStore);
  const update = (patch: Partial<SimulatorSettings>) =>
    settingsStore.set((prev) => ({ ...prev, ...patch }));

  const handleReset = () => {
    resetSettings();
    engine.resetTracking();
    toast.success("All settings reset to defaults.");
  };

  const handleDemoToggle = (v: boolean) => {
    update({ demoMode: v });
    engine.resetTracking();
    if (v) {
      toast.info("Demo mode on — synthetic targets, clearly labeled. No real detection.");
    } else {
      toast.info("Demo mode off — back to real model inference.");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <section>
        <h3 className="mb-1 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          Overlays
        </h3>
        <Toggle
          label="ESP boxes"
          hint="Bounding boxes around detected figures"
          value={s.showEspBoxes}
          onChange={(v) => update({ showEspBoxes: v })}
        />
        <Toggle
          label="Center dot"
          value={s.showCenterDot}
          onChange={(v) => update({ showCenterDot: v })}
        />
        <Toggle
          label="Confidence labels"
          value={s.showConfidence}
          onChange={(v) => update({ showConfidence: v })}
        />
        <Toggle
          label="Distance (simulated)"
          hint="Non-real estimate derived from box height"
          value={s.showDistance}
          onChange={(v) => update({ showDistance: v })}
        />
        <Toggle
          label="Center connection lines"
          value={s.showCenterLines}
          onChange={(v) => update({ showCenterLines: v })}
        />
        <Toggle
          label="FOV circle"
          value={s.showFovCircle}
          onChange={(v) => update({ showFovCircle: v })}
        />
        <Toggle
          label="Crosshair"
          value={s.showCrosshair}
          onChange={(v) => update({ showCrosshair: v })}
        />
        <Toggle
          label="Highlight in-FOV targets"
          value={s.highlightInFov}
          onChange={(v) => update({ highlightInFov: v })}
        />
      </section>

      <Separator />

      <section>
        <h3 className="mb-1 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          Appearance
        </h3>
        <SliderRow
          label="FOV radius"
          value={s.fovRadius}
          min={0.1}
          max={1}
          step={0.01}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => update({ fovRadius: v })}
        />
        <SliderRow
          label="Box line width"
          value={s.boxThickness}
          min={1}
          max={6}
          step={1}
          onChange={(v) => update({ boxThickness: v })}
        />
        <SliderRow
          label="Box transparency"
          value={s.boxOpacity}
          min={0.1}
          max={1}
          step={0.05}
          format={(v) => `${Math.round((1 - v) * 100)}% transparent`}
          onChange={(v) => update({ boxOpacity: v })}
        />
        <SliderRow
          label="FOV circle transparency"
          value={s.fovOpacity}
          min={0.1}
          max={1}
          step={0.05}
          format={(v) => `${Math.round((1 - v) * 100)}% transparent`}
          onChange={(v) => update({ fovOpacity: v })}
        />
        <SliderRow
          label="FOV line width"
          value={s.fovThickness}
          min={1}
          max={6}
          step={1}
          onChange={(v) => update({ fovThickness: v })}
        />
        <ColorRow
          label="ESP box color"
          value={s.boxColor}
          onChange={(v) => update({ boxColor: v })}
        />
        <ColorRow
          label="FOV circle color"
          value={s.fovColor}
          onChange={(v) => update({ fovColor: v })}
        />
      </section>

      <Separator />

      <section>
        <h3 className="mb-1 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          Detection
        </h3>
        <SliderRow
          label="Confidence threshold"
          value={s.confidenceThreshold}
          min={0.05}
          max={0.9}
          step={0.05}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => update({ confidenceThreshold: v })}
        />
        <div className="py-1.5">
          <Label className="mb-1.5 block text-xs font-medium">Processing speed</Label>
          <Select
            value={String(s.targetFps)}
            onValueChange={(v) => update({ targetFps: Number(v) })}
          >
            <SelectTrigger className="w-full cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
            {[5, 10, 15, 30, 60].map((fps) => (
              <SelectItem key={fps} value={String(fps)} className="cursor-pointer">
                {fps} FPS{fps === 30 ? " (heavy)" : fps === 60 ? " (experimental)" : ""}
              </SelectItem>
            ))}
            </SelectContent>
          </Select>
        </div>
        <div className="py-1.5">
          <div className="mb-1.5 flex items-center justify-between">
            <Label className="text-xs font-medium">Detection model</Label>
            <Button
              variant="outline"
              size="sm"
              className="h-7 cursor-pointer gap-1 px-2 text-[11px]"
              onClick={() => engine.loadModel()}
            >
              Load / reload
            </Button>
          </div>
          <Select
            value={s.modelId}
            onValueChange={(v) => update({ modelId: v })}
          >
            <SelectTrigger className="w-full cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(MODEL_PRESETS).map(([id, preset]) => (
                <SelectItem key={id} value={id} className="cursor-pointer">
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {s.modelId === "custom" && (
            <input
              type="url"
              value={s.customModelUrl}
              onChange={(e) => update({ customModelUrl: e.target.value })}
              placeholder="https://…/model.onnx"
              className="mt-2 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          )}
          <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">
            The preset detects COCO “person” — an honest proxy for enemy-like
            figures, not Valorant-specific. Swap in a gameplay-trained model via
            the custom URL (see Model & Integration).
          </p>
        </div>
        <p className="text-[11px] leading-4 text-muted-foreground">
          60 FPS needs the WebGPU backend and a fast GPU. On WASM the engine
          adapts honestly below the target instead of stuttering — watch the
          “adaptive” note in the status bar.
        </p>
        <Toggle
          label="Demo mode"
          hint="Synthetic targets to test overlays without a model"
          value={s.demoMode}
          onChange={handleDemoToggle}
        />
      </section>

      <Separator />

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={handleReset}
          className="flex-1 cursor-pointer gap-2"
        >
          <RotateCcw className="size-4" />
          Reset all
        </Button>
        <Button
          variant="outline"
          size="icon"
          title="Shuffle colors"
          className="cursor-pointer"
          onClick={() => {
            const pick = () =>
              COLOR_SWATCHES[Math.floor(Math.random() * COLOR_SWATCHES.length)];
            update({ boxColor: pick(), fovColor: pick() });
          }}
        >
          <Dices className="size-4" />
        </Button>
      </div>
      <p className="text-[11px] leading-4 text-muted-foreground">
        Defaults restored on reset:{" "}
        {Math.round(DEFAULT_SETTINGS.confidenceThreshold * 100)}% confidence ·{" "}
        {DEFAULT_SETTINGS.targetFps} FPS · FOV{" "}
        {Math.round(DEFAULT_SETTINGS.fovRadius * 100)}%.
      </p>
    </div>
  );
}
