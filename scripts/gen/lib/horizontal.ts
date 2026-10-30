// 16:9 versions of a few rendered videos, for the Horizontal Carousel and Horizontal Player examples.
import path from 'node:path';
import { dirs } from './paths';

/** Video spec IDs that get a 16:9 version. */
export const HORIZONTAL_SOURCES = ['fjb-09-brand-hero', 'fjb-10-morning-routine', 'fjb-01-cloudberry-serum', 'fjb-06-daylight-spf'];

export const horizontalVideoFile = (id: string) => path.join(dirs.videos, `${id}.16x9.mp4`);
export const horizontalPosterFile = (id: string) => path.join(dirs.videos, `${id}.16x9.jpg`);
export const horizontalSubtitleFile = (id: string) => path.join(dirs.videos, `${id}.16x9.vtt`);
