import { anilistRequest } from './anilist';
import { hubLinksQuery, readHubLinks, scheduleQuery, scheduleRange, readSchedule } from '../../api/_hubdata.js';

/**
 * What a hub page shows besides its grid, for React opening a hub the
 * server didn't build (client-side navigation). A served hub page hands the
 * same data over in its boot script instead (readBootList), so these run only
 * when that is missing. Both ask the same AniList queries the prerender does.
 */

export interface HubLink {
  label: string;
  path: string;
}

export interface ScheduleEntry {
  id: string;
  title: string | null;
  episode: number;
  /** Milliseconds since the epoch. */
  at: number;
}

type Hub = { kind: string; season?: string; year?: number; genre?: string };

/** The links above a hub's grid; [] if there are none or AniList can't be reached. */
export async function getHubLinks(hub: Hub): Promise<HubLink[]> {
  const query = hubLinksQuery(hub);
  // Some hubs' links need no lookup (/top's years, a genre's fellow genres).
  const data = query ? await anilistRequest<Record<string, unknown>>(query, {}, 8000) : {};
  return readHubLinks(hub, data, new Date());
}

/** This week's episodes, adult titles and excluded genres left out; [] if AniList can't be reached. */
export async function getAiringSchedule(now: Date): Promise<ScheduleEntry[]> {
  const data = await anilistRequest<Record<string, unknown>>(scheduleQuery(scheduleRange(now)), {}, 8000);
  return readSchedule(data);
}
