// ffmpeg helpers: run a command, probe a file, and check that an MP4 is ready for Firework.
import { spawn } from 'node:child_process';
import fs from 'node:fs';

function exec(bin: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', (err) =>
      reject(
        (err as NodeJS.ErrnoException).code === 'ENOENT'
          ? new Error(`${bin} is not installed. On macOS run: brew install ffmpeg`)
          : err,
      ),
    );
    child.on('close', (code) =>
      code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`${bin} exited with ${code}:\n${stderr.split('\n').slice(-15).join('\n')}`)),
    );
  });
}

export const ffmpeg = (args: string[]) => exec('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);

export interface ProbeInfo {
  width: number;
  height: number;
  videoCodec: string;
  audioCodec: string | null;
  fps: number;
  duration: number;
}

export async function probe(file: string): Promise<ProbeInfo> {
  const { stdout } = await exec('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', file]);
  const data = JSON.parse(stdout) as {
    streams: { codec_type: string; codec_name: string; width?: number; height?: number; r_frame_rate?: string }[];
    format: { duration?: string };
  };
  const video = data.streams.find((s) => s.codec_type === 'video');
  const audio = data.streams.find((s) => s.codec_type === 'audio');
  const [num, den] = (video?.r_frame_rate ?? '0/1').split('/').map(Number);
  return {
    width: video?.width ?? 0,
    height: video?.height ?? 0,
    videoCodec: video?.codec_name ?? 'none',
    audioCodec: audio?.codec_name ?? null,
    fps: den ? num! / den : 0,
    duration: Number(data.format.duration ?? 0),
  };
}

export async function mediaDuration(file: string): Promise<number> {
  const { stdout } = await exec('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  return Number(stdout.trim());
}

/** True when the moov atom comes before mdat, i.e. the MP4 can start playing before it fully downloads. */
export function isFaststart(file: string): boolean {
  const fd = fs.openSync(file, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    const header = Buffer.alloc(16);
    let offset = 0;
    while (offset + 8 <= size) {
      fs.readSync(fd, header, 0, 16, offset);
      let boxSize = header.readUInt32BE(0);
      const type = header.toString('latin1', 4, 8);
      if (type === 'moov') return true;
      if (type === 'mdat') return false;
      if (boxSize === 1) boxSize = Number(header.readBigUInt64BE(8));
      if (boxSize < 8) return false;
      offset += boxSize;
    }
    return false;
  } finally {
    fs.closeSync(fd);
  }
}

/** Checks the output against Firework-friendly settings. Returns a list of problems (empty when fine). */
export async function verifyVideo(file: string): Promise<{ info: ProbeInfo; problems: string[] }> {
  const info = await probe(file);
  const problems: string[] = [];
  if (info.width !== 1080 || info.height !== 1920) problems.push(`size ${info.width}x${info.height}, expected 1080x1920`);
  if (info.videoCodec !== 'h264') problems.push(`video codec ${info.videoCodec}, expected h264`);
  if (info.audioCodec !== 'aac') problems.push(`audio codec ${info.audioCodec ?? 'none'}, expected aac`);
  if (Math.round(info.fps) !== 30) problems.push(`${info.fps.toFixed(2)} fps, expected 30`);
  if (info.duration < 3) problems.push(`duration ${info.duration.toFixed(1)} s, Firework needs at least 3 s`);
  if (!isFaststart(file)) problems.push('moov atom is not at the start (no faststart)');
  return { info, problems };
}
