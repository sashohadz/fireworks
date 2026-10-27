// Turns a list of segments, overlays and voice clips into one 1080x1920 MP4 with ffmpeg.
// Output settings follow Firework's guidance: H.264 + AAC, 30 fps, 2-second keyframes, faststart.
import { ffmpeg } from './ffmpeg';

export type Segment =
  | { kind: 'video'; file: string; seconds: number }
  | { kind: 'still'; file: string; seconds: number }
  | { kind: 'kenburns'; file: string; seconds: number };

export interface TimedOverlay {
  file: string;
  start: number;
  end: number;
}

export interface VoiceClip {
  file: string;
  start: number;
}

export interface TimelineOptions {
  segments: Segment[];
  /** Full-length overlay (brand mark and AI label). */
  chrome?: string;
  captions: TimedOverlay[];
  voices: VoiceClip[];
  out: string;
  transition?: number;
}

const FPS = 30;
export const TRANSITION = 0.35;

/** Start time of each segment on the final timeline, accounting for crossfades. */
export function segmentStarts(segments: { seconds: number }[], transition = TRANSITION): number[] {
  const starts: number[] = [];
  let t = 0;
  segments.forEach((s, i) => {
    starts.push(t);
    t += s.seconds - (i < segments.length - 1 ? transition : 0);
  });
  return starts;
}

export function timelineDuration(segments: { seconds: number }[], transition = TRANSITION): number {
  return segments.reduce((sum, s) => sum + s.seconds, 0) - transition * Math.max(0, segments.length - 1);
}

const n = (v: number) => v.toFixed(3);

export async function renderTimeline(o: TimelineOptions): Promise<number> {
  if (o.segments.length === 0) throw new Error('A video needs at least one segment');
  const T = o.transition ?? TRANSITION;
  for (const s of o.segments) if (s.seconds <= T) throw new Error(`Segment ${s.file} is shorter than the ${T}s transition`);

  const args: string[] = [];
  const filters: string[] = [];
  let input = 0;

  o.segments.forEach((seg, i) => {
    const sec = seg.seconds;
    if (seg.kind === 'video') {
      args.push('-i', seg.file);
      filters.push(
        `[${input}:v]scale=${1080}:${1920}:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=${FPS},` +
          `tpad=stop_mode=clone:stop_duration=${n(sec)},trim=duration=${n(sec)},setpts=PTS-STARTPTS,format=yuv420p[s${i}]`,
      );
    } else if (seg.kind === 'still') {
      args.push('-loop', '1', '-framerate', String(FPS), '-t', n(sec), '-i', seg.file);
      filters.push(`[${input}:v]scale=1080:1920,setsar=1,fps=${FPS},trim=duration=${n(sec)},setpts=PTS-STARTPTS,format=yuv420p[s${i}]`);
    } else {
      const frames = Math.round(sec * FPS);
      args.push('-i', seg.file);
      filters.push(
        `[${input}:v]scale=2160:3840,zoompan=z='min(zoom+0.0006,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920:fps=${FPS},` +
          `setsar=1,trim=duration=${n(sec)},setpts=PTS-STARTPTS,format=yuv420p[s${i}]`,
      );
    }
    input++;
  });

  let last = 's0';
  let acc = o.segments[0]!.seconds;
  for (let i = 1; i < o.segments.length; i++) {
    const out = `x${i}`;
    filters.push(`[${last}][s${i}]xfade=transition=fade:duration=${n(T)}:offset=${n(acc - T)}[${out}]`);
    last = out;
    acc += o.segments[i]!.seconds - T;
  }
  const duration = acc;

  const overlays = [...(o.chrome ? [{ file: o.chrome, start: 0, end: duration }] : []), ...o.captions];
  overlays.forEach((ov, k) => {
    args.push('-loop', '1', '-framerate', String(FPS), '-t', n(duration), '-i', ov.file);
    filters.push(`[${last}][${input}:v]overlay=0:0:enable='between(t,${n(ov.start)},${n(ov.end)})'[o${k}]`);
    last = `o${k}`;
    input++;
  });
  filters.push(`[${last}]format=yuv420p[vout]`);

  if (o.voices.length > 0) {
    const labels = o.voices.map((v, k) => {
      args.push('-i', v.file);
      const ms = Math.round(v.start * 1000);
      filters.push(`[${input}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${ms}|${ms}[a${k}]`);
      input++;
      return `[a${k}]`;
    });
    filters.push(
      `${labels.join('')}amix=inputs=${labels.length}:normalize=0:dropout_transition=0,apad,atrim=0:${n(duration)},` +
        `loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[aout]`,
    );
  } else {
    args.push('-f', 'lavfi', '-t', n(duration), '-i', 'anullsrc=r=48000:cl=stereo');
    filters.push(`[${input}:a]anull[aout]`);
    input++;
  }

  args.push(
    '-filter_complex', filters.join(';'),
    '-map', '[vout]', '-map', '[aout]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-r', String(FPS), '-g', String(FPS * 2), '-keyint_min', String(FPS * 2), '-sc_threshold', '0',
    '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2',
    '-movflags', '+faststart', '-t', n(duration), o.out,
  );
  await ffmpeg(args);
  return duration;
}

export function toVtt(cues: { start: number; end: number; text: string }[]): string {
  const ts = (t: number) => {
    const ms = Math.round(t * 1000);
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
  };
  return `WEBVTT\n\n${cues.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.text}\n`).join('\n')}`;
}
