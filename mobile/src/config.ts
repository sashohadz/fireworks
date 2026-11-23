/**
 * Firework and store settings for the workshop app. Everything here is public by nature: channel and playlist IDs
 * appear in every app and page that embeds Firework. The App ID is not here: it lives in
 * android/firework.local.properties (gitignored).
 */
export const firework = {
  /**
   * Encoded channel ID of the sandbox business, from the Business Portal URL. Mobile SDKs need this ID, not the
   * channel handle (sashoo_business) that web embeds use.
   */
  channel: 'GjkwJJX',
  playlists: {
    /** "Watch & shop": the store's home page carousel. */
    feed: 'o9XklW',
    /** "Morning ritual": the store's home page Storyblock. */
    storyblock: 'gkkORx',
  },
};

/**
 * The store's mock commerce API (src/pages/api in the website), per country: /api/{market}/products/{id}.json. Same
 * product and unit IDs as Firework's catalog. To try API changes before they're merged, point this at a deploy
 * preview (https://deploy-preview-N--fjordbloom.netlify.app/api) and rebuild the app.
 */
export const store = {
  api: 'https://fjordbloom.netlify.app/api',
};

export const colors = {
  ink: '#14212B',
  inkSoft: '#46545E',
  paper: '#F7F5F0',
  mist: '#E6EBE8',
  fjord: '#2F5D73',
  cloudberry: '#E8913A',
  white: '#FFFFFF',
  danger: '#A23B2A',
};
