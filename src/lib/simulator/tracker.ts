import type { RawDetection, Track } from "./types";

interface InternalTrack {
  id: number;
  /** Smoothed position, valid as of `lastUpdate` (ms). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Constant-velocity estimate, normalized units per second. */
  vx: number;
  vy: number;
  vw: number;
  vh: number;
  lastUpdate: number;
  /** dt (seconds) of the most recent predict() call — reused for velocity. */
  lastDt: number;
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

const MAX_V = 2.5; // normalized units / s — safety clamp against jumps

/**
 * Lightweight constant-velocity tracker ("Kalman-lite"). Greedily matches
 * detections to tracks, smooths positions with an EMA, and estimates each
 * track's velocity so positions can be *predicted* forward between
 * detection frames — boxes stay coherent even when inference runs far below
 * display rate.
 */
export class ObjectTracker {
  private tracks = new Map<number, InternalTrack>();
  private nextId = 1;
  private readonly config: {
    iouThreshold: number;
    confirmHits: number;
    maxLost: number;
    smoothing: number;
  };

  constructor(config: Partial<{ iouThreshold: number; confirmHits: number; maxLost: number; smoothing: number }> = {}) {
    this.config = {
      // Forgiving: fast-moving small figures often overlap <20% between
      // detections — strict thresholds churn track IDs and flicker the boxes.
      iouThreshold: 0.1,
      confirmHits: 2,
      maxLost: 15,
      smoothing: 0.5,
      ...config,
    };
  }

  /** Advance a track's smoothed position to time `now` using its velocity. */
  private predict(track: InternalTrack, now: number) {
    const dt = Math.min(0.25, Math.max(0, (now - track.lastUpdate) / 1000));
    track.lastDt = dt;
    track.x += track.vx * dt;
    track.y += track.vy * dt;
    track.w += track.vw * dt;
    track.h += track.vh * dt;
    track.lastUpdate = now;
  }

  /**
   * Feed raw detections from a frame that was captured `detectionAgeMs`
   * before `now` (pipeline latency); returns visible tracks predicted to
   * `now`. Matched detections are advanced by velocity × age so the smoothed
   * position targets the figure's *current* spot instead of its past one —
   * this cancels most of the visible lag of offline inference.
   */
  update(detections: RawDetection[], now: number, detectionAgeMs = 0): Track[] {
    const detList = [...detections].sort((a, b) => b.score - a.score);
    const matchedDets = new Set<number>();
    const matchedTracks = new Set<number>();

    // Predict every track forward to the current frame before matching —
    // this makes association robust during fast motion.
    for (const track of this.tracks.values()) this.predict(track, now);

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
        // Velocity from the observed displacement since the last match.
        const dt = Math.max(0.008, track.lastDt);
        const a = this.config.smoothing;
        // Latency compensation: the detection shows the figure where it was
        // `detectionAgeMs` ago — advance it along the track's own velocity
        // so the tracker chases the present, not the past.
        const age = Math.min(0.25, Math.max(0, detectionAgeMs) / 1000);
        const targetX = d.x + track.vx * age;
        const targetY = d.y + track.vy * age;
        const targetW = d.w + track.vw * age;
        const targetH = d.h + track.vh * age;
        const prevX = track.x;
        const prevY = track.y;
        const prevW = track.w;
        const prevH = track.h;
        track.x += (targetX - track.x) * a;
        track.y += (targetY - track.y) * a;
        track.w += (targetW - track.w) * a;
        track.h += (targetH - track.h) * a;
        const velA = 0.4;
        track.vx = clampVel(velA * ((track.x - prevX) / dt) + (1 - velA) * track.vx);
        track.vy = clampVel(velA * ((track.y - prevY) / dt) + (1 - velA) * track.vy);
        track.vw = clampVel(velA * ((track.w - prevW) / dt) + (1 - velA) * track.vw);
        track.vh = clampVel(velA * ((track.h - prevH) / dt) + (1 - velA) * track.vh);
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
        vx: 0,
        vy: 0,
        vw: 0,
        vh: 0,
        lastUpdate: now,
        lastDt: 0.016,
        score: d.score,
        className: d.className,
        hits: 1,
        lost: 0,
        confirmed: false,
      });
      matchedTracks.add(id);
    }

    // Age out tracks that were not matched this frame; decay their velocity
    // so prediction gently comes to rest instead of drifting.
    for (const [id, track] of this.tracks) {
      if (matchedTracks.has(id)) continue;
      track.lost += 1;
      track.vx *= 0.85;
      track.vy *= 0.85;
      track.vw *= 0.85;
      track.vh *= 0.85;
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

  reset() {
    this.tracks.clear();
  }
}

function clampVel(v: number): number {
  return Math.max(-MAX_V, Math.min(MAX_V, v));
}
