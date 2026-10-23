import type { RawDetection, Track } from "./types";

interface InternalTrack {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  score: number;
  className: string;
  hits: number;
  lost: number;
  confirmed: boolean;
}

function iou(
  a: RawDetection | InternalTrack,
  b: RawDetection | InternalTrack,
): number {
  const ax2 = a.x + a.w;
  const ay2 = a.y + a.h;
  const bx2 = b.x + b.w;
  const by2 = b.y + b.h;
  const ix = Math.max(0, Math.min(ax2, bx2) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(ay2, by2) - Math.max(a.y, b.y));
  const inter = ix * iy;
  const union = a.w * a.h + b.w * b.h - inter;
  return union > 0 ? inter / union : 0;
}

/**
 * Lightweight IoU tracker. Greedily matches detections to existing tracks,
 * smooths box positions with an exponential moving average, and promotes
 * tracks to "confirmed" after several consecutive sightings so single-frame
 * noise shows up as dashed "suspected" boxes instead.
 */
interface TrackerConfig {
  /** Minimum IoU to associate a detection with a track. */
  iouThreshold: number;
  /** Consecutive sightings needed before a track is confirmed. */
  confirmHits: number;
  /** Frames a track survives without a matching detection. */
  maxLost: number;
  /** EMA factor: higher = snappier, lower = smoother. */
  smoothing: number;
}

export class ObjectTracker {
  private tracks = new Map<number, InternalTrack>();
  private nextId = 1;
  private readonly config: TrackerConfig;

  constructor(
    config: Partial<TrackerConfig> = {},
  ) {
    this.config = {
      iouThreshold: 0.2,
      confirmHits: 3,
      maxLost: 10,
      smoothing: 0.45,
      ...config,
    };
  }

  /** Feed raw detections from the newest processed frame; returns visible tracks. */
  update(detections: RawDetection[]): Track[] {
    const detList = [...detections].sort((a, b) => b.score - a.score);
    const matchedDets = new Set<number>();
    const matchedTracks = new Set<number>();

    for (const track of this.tracks.values()) {
      let bestIdx = -1;
      let bestIou = this.config.iouThreshold;
      for (let i = 0; i < detList.length; i++) {
        if (matchedDets.has(i)) continue;
        const d = detList[i];
        if (d.className !== track.className) continue;
        const v = iou(track, d);
        if (v > bestIou) {
          bestIou = v;
          bestIdx = i;
        }
      }
      if (bestIdx >= 0) {
        const d = detList[bestIdx];
        matchedDets.add(bestIdx);
        matchedTracks.add(track.id);
        const a = this.config.smoothing;
        track.x += (d.x - track.x) * a;
        track.y += (d.y - track.y) * a;
        track.w += (d.w - track.w) * a;
        track.h += (d.h - track.h) * a;
        track.score = d.score;
        track.hits += 1;
        track.lost = 0;
        if (!track.confirmed && track.hits >= this.config.confirmHits) {
          track.confirmed = true;
        }
      }
    }

    // New tracks from unmatched detections.
    for (let i = 0; i < detList.length; i++) {
      if (matchedDets.has(i)) continue;
      const d = detList[i];
      const id = this.nextId++;
      this.tracks.set(id, {
        id,
        x: d.x,
        y: d.y,
        w: d.w,
        h: d.h,
        score: d.score,
        className: d.className,
        hits: 1,
        lost: 0,
        confirmed: false,
      });
      matchedTracks.add(id);
    }

    // Age out tracks that were not matched this frame.
    for (const [id, track] of this.tracks) {
      if (matchedTracks.has(id)) continue;
      track.lost += 1;
      if (track.lost > this.config.maxLost) this.tracks.delete(id);
    }

    return this.snapshot();
  }

  snapshot(): Track[] {
    const out: Track[] = [];
    for (const t of this.tracks.values()) {
      out.push({
        id: t.id,
        x: t.x,
        y: t.y,
        w: t.w,
        h: t.h,
        score: t.score,
        className: t.className,
        confirmed: t.confirmed,
        insideFov: false,
      });
    }
    return out;
  }

  /** Drop confirmed tracks whose box has drifted completely out of frame. */
  prune(offscreen: (t: Track) => boolean) {
    for (const [id, t] of this.tracks) {
      const view: Track = { ...t, confirmed: t.confirmed, insideFov: false };
      if (offscreen(view)) this.tracks.delete(id);
    }
  }

  reset() {
    this.tracks.clear();
  }
}
