/**
 * Firework settings for the Fjordbloom demo store.
 *
 * Everything in this file is public by nature: channel names and playlist IDs appear in the HTML
 * of any page that embeds Firework. Never put API credentials here. Those live in .env and are
 * only read by the scripts in /scripts.
 *
 * Teammates can point the deployed site at their own sandbox without editing this file:
 * use the Settings dialog (gear icon) or URL parameters such as ?channel=my_channel&playlist=abc123.
 */

export type PlaylistSlot = 'hero' | 'storyblock' | 'carousel' | 'grid' | 'deck' | 'floating' | 'live' | 'showroom' | 'howto';

export interface FireworkConfig {
  /** Channel name (handle) of the sandbox business, as in the `channel` attribute of Business Portal embed code. */
  channel: string;
  /** Playlist ID per page slot. An empty slot falls back to the whole channel. */
  playlists: Record<PlaylistSlot, string>;
  /** Script URLs from the Firework web docs. */
  scripts: { module: string; nomodule: string; lazy: string };
  /** Purchase events are only sent when the page uses this sandbox channel. */
  trackPurchases: boolean;
}

export const firework: FireworkConfig = {
  channel: 'sashoo_business',
  playlists: {
    hero: '5bJdVa', // livestream playlist for the Hero unit on the home and live pages
    storyblock: 'gkkORx', // home page Storyblock ("morning ritual")
    carousel: 'o9XklW', // home page carousel ("Watch & shop")
    grid: 'o8NbVX', // shop page grid
    deck: 'o30J7Z', // product page Player Deck
    floating: 'ojEpYM', // floating player on the home page
    live: '5x69le', // replays on the live page
    showroom: 'vZb4Mw', // daily restream with AI Copilot on the showroom page
    howto: '', // how-to videos on the help pages (Week 2)
  },
  scripts: {
    module: 'https://asset.fwcdn3.com/js/module/fwn.js',
    nomodule: 'https://asset.fwcdn3.com/js/fwn.js',
    lazy: 'https://asset.fwcdn3.com/js/fwn-async.js',
  },
  trackPurchases: true,
};

/**
 * AVA, Firework's AI shopping assistant, from Business Portal's Embed code. Both IDs are public: they
 * appear in the HTML of every page with AVA. Leave assistantId empty to turn AVA off.
 */
export const ava = {
  businessId: 'gYx0PO',
  assistantId: 'oBWN2g',
  script: 'https://asset.fwscripts.com/js/ava.js',
};

/**
 * The showroom's restream program in Business Portal (Livestreams > + Create New > Restream).
 * Shown to visitors in their own time zone. Keep it in step with the program's time slot.
 */
export const showroomSchedule = {
  dailyAt: '21:00',
  timeZone: 'Europe/Sofia',
  /** Length of one session, so the page can say "on now". The live show runs about 2.5 minutes. */
  minutes: 3,
};

export const playlistSlots: { slot: PlaylistSlot; label: string; usedOn: string }[] = [
  { slot: 'hero', label: 'Hero unit (livestream playlist)', usedOn: 'Home, Live' },
  { slot: 'storyblock', label: 'Storyblock', usedOn: 'Home' },
  { slot: 'carousel', label: 'Carousel', usedOn: 'Home' },
  { slot: 'grid', label: 'Grid', usedOn: 'Shop' },
  { slot: 'deck', label: 'Player Deck', usedOn: 'Product pages' },
  { slot: 'floating', label: 'Floating player', usedOn: 'Home' },
  { slot: 'live', label: 'Live replays', usedOn: 'Live' },
  { slot: 'showroom', label: 'Showroom restream', usedOn: 'Showroom' },
  { slot: 'howto', label: 'How-to videos', usedOn: 'Help' },
];

export const repoUrl = 'https://github.com/sashohadz/fireworks';
