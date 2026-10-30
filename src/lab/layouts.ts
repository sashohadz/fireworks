// The 12 layouts in Business Portal's "Add to Site", in the portal's order, and the web element plus attributes
// each one is. Validated against Firework's public SDK, which holds the same list (WIDGET_CONFIG_LAYOUTS) and turns
// each layout into attributes on one of four elements. Used by the lab component pages and /lab/layouts.
// Safe to import from client code: no filesystem access.
import type { PlaylistSlot } from '../site.config';

export type LayoutTag = 'fw-embed-feed' | 'fw-storyblock' | 'fw-player-deck' | 'fw-herounit' | 'fw-player';

export interface PortalLayout {
  /** Unique id in this site. Matches the SDK's layout id, except player_deck_grid. */
  id: string;
  /** Name in Business Portal's Add to Site. */
  name: string;
  /** Layout id inside the SDK. */
  sdkId: string;
  /** Suffix of a Business Portal managed embed, <fw-widget widget_config_id="…_xx">. */
  configSuffix: string;
  tag: LayoutTag;
  /** Attributes that make this layout, on top of channel and playlist. */
  attrs: Record<string, string>;
  /** The attributes that tell it apart from its siblings on the same element. Highlighted in the UI. */
  key: string[];
  /** Inline style the embed needs, e.g. the horizontal player's aspect ratio. */
  style?: string;
  slot: PlaylistSlot;
  labSlug: string;
  summary: string;
  note?: string;
  /** Where the attributes are documented: the developer docs, the help center, or only the SDK and Business Portal code. */
  source: 'docs' | 'help' | 'sdk';
  /** Floating layouts are only shown on request, so two players never float at once. */
  onDemand?: boolean;
}

export const HORIZONTAL_PLAYER_STYLE = 'width: 100%; aspect-ratio: 16/9';

export const portalLayouts: PortalLayout[] = [
  {
    id: 'player_deck',
    name: 'Player Deck',
    sdkId: 'player_deck',
    configSuffix: 'pd',
    tag: 'fw-player-deck',
    attrs: {},
    key: [],
    slot: 'deck',
    labSlug: 'player-deck',
    summary: 'A row of playing tiles, each with its product card underneath.',
    note: 'Under the hood it is the embed feed with a player-deck layout forced on, captions off and product tags off.',
    source: 'docs',
  },
  {
    id: 'carousel_row',
    name: 'Carousel',
    sdkId: 'carousel_row',
    configSuffix: 'efc',
    tag: 'fw-embed-feed',
    attrs: { mode: 'row' },
    key: ['mode'],
    slot: 'carousel',
    labSlug: 'carousel-grid',
    summary: 'A scrollable row of vertical thumbnails. Clicking one opens the player.',
    note: 'mode="row" is the default. The SDK also accepts <fw-carousel> as an alias.',
    source: 'docs',
  },
  {
    id: 'dynamic_carousel',
    name: 'Dynamic Carousel',
    sdkId: 'dynamic_carousel',
    configSuffix: 'dc',
    tag: 'fw-embed-feed',
    attrs: { mode: 'row', thumbnail_style: 'dynamic' },
    key: ['thumbnail_style'],
    slot: 'carousel',
    labSlug: 'carousel-grid',
    summary: 'Interactive cards whose number of columns follows the container width, with larger product cards when there is room.',
    note: 'Firework suggests it for product pages.',
    source: 'sdk',
  },
  {
    id: 'storyblock',
    name: 'Story Block',
    sdkId: 'storyblock',
    configSuffix: 'sb',
    tag: 'fw-storyblock',
    attrs: { height: '520px' },
    key: [],
    slot: 'storyblock',
    labSlug: 'storyblock',
    summary: 'An inline player that plays one video at a time inside the page.',
    source: 'docs',
  },
  {
    id: 'floating_player',
    name: 'Floating Player',
    sdkId: 'floating_player',
    configSuffix: 'fp',
    tag: 'fw-storyblock',
    attrs: { mode: 'pinned' },
    key: ['mode'],
    slot: 'floating',
    labSlug: 'storyblock',
    summary: 'A small player that floats in a corner while the shopper scrolls.',
    note: 'Business Portal builds it from the Storyblock element. The docs show the same result with <fw-player mode="pinned">.',
    source: 'sdk',
    onDemand: true,
  },
  {
    id: 'hero_unit',
    name: 'Hero Unit',
    sdkId: 'hero_unit',
    configSuffix: 'hu',
    tag: 'fw-herounit',
    attrs: { height: '480px' },
    key: [],
    slot: 'hero',
    labSlug: 'hero-unit',
    summary: 'A large unit for livestreams: countdown, the live show, then the replay.',
    source: 'docs',
  },
  {
    id: 'carousel_grid',
    name: 'Grid',
    sdkId: 'carousel_grid',
    configSuffix: 'efg',
    tag: 'fw-embed-feed',
    attrs: { mode: 'grid' },
    key: ['mode'],
    slot: 'grid',
    labSlug: 'carousel-grid',
    summary: 'A responsive grid of thumbnails, with optional infinite scroll or a Load more button.',
    note: 'The SDK also accepts <fw-grid> as an alias.',
    source: 'docs',
  },
  {
    id: 'player_deck_grid',
    name: 'Player Deck Grid',
    sdkId: 'player_deck',
    configSuffix: 'pd',
    tag: 'fw-player-deck',
    attrs: { mode: 'grid' },
    key: ['mode'],
    slot: 'deck',
    labSlug: 'player-deck',
    summary: 'Player Deck tiles in a responsive grid instead of a row.',
    source: 'docs',
  },
  {
    id: 'horizontal_player',
    name: 'Horizontal Player',
    sdkId: 'horizontal_player',
    configSuffix: 'hp',
    tag: 'fw-player',
    attrs: {},
    key: ['style'],
    style: HORIZONTAL_PLAYER_STYLE,
    slot: 'horizontal',
    labSlug: 'floating-player',
    summary: 'An inline 16:9 player for horizontal videos.',
    note: 'The same <fw-player> element floats with mode="pinned". Inline, it takes the size of its box, so give it a 16:9 aspect ratio.',
    source: 'docs',
  },
  {
    id: 'horizontal_carousel',
    name: 'Horizontal Carousel',
    sdkId: 'horizontal_carousel',
    configSuffix: 'hc',
    tag: 'fw-embed-feed',
    attrs: { mode: 'row', thumbnail_orientation: 'horizontal' },
    key: ['thumbnail_orientation'],
    slot: 'horizontal',
    labSlug: 'carousel-grid',
    summary: 'A row of 16:9 thumbnails for horizontal videos.',
    source: 'sdk',
  },
  {
    id: 'circle_stories',
    name: 'Circle Stories',
    sdkId: 'circle_stories',
    configSuffix: 'cs',
    tag: 'fw-embed-feed',
    attrs: { mode: 'row', thumbnail_shape: 'circle' },
    key: ['thumbnail_shape'],
    slot: 'carousel',
    labSlug: 'carousel-grid',
    summary: 'Round, Instagram-style story bubbles with a pulsing ring.',
    note: 'Shortcuts: mode="stories", or the <fw-stories> alias, which also defaults to small, no captions and no product tag. Tune it with size (small, medium, large), pulse_animation and --fw-thumbnail-pulse-animation-color. A site-wide --fw-thumbnail-border-radius turns the circles into rounded squares, so reset it on this element.',
    source: 'help',
  },
  {
    id: 'vertical_stories',
    name: 'Vertical Stories',
    sdkId: 'vertical_stories',
    configSuffix: 'vs',
    tag: 'fw-embed-feed',
    attrs: { mode: 'row', thumbnail_shape: 'rectangle' },
    key: ['thumbnail_shape'],
    slot: 'carousel',
    labSlug: 'carousel-grid',
    summary: 'Story bubbles as small rounded rectangles instead of circles.',
    source: 'help',
  },
];

/**
 * Which portal layout an element with these attributes renders, following the SDK's precedence:
 * dynamic, then horizontal, then player deck, then a stories shape, then grid or carousel.
 */
export function detectLayout(tag: string, attrs: Record<string, string>): string | null {
  switch (tag) {
    case 'fw-player-deck':
      return attrs.mode === 'grid' ? 'player_deck_grid' : 'player_deck';
    case 'fw-storyblock':
      return attrs.mode === 'pinned' ? 'floating_player' : attrs.mode === 'fullscreen' ? null : 'storyblock';
    case 'fw-player':
      return attrs.mode ? null : 'horizontal_player';
    case 'fw-herounit':
      return 'hero_unit';
    case 'fw-embed-feed': {
      if (attrs.thumbnail_style === 'dynamic') return 'dynamic_carousel';
      if (attrs.thumbnail_orientation === 'horizontal') return 'horizontal_carousel';
      const shape = attrs.thumbnail_shape ?? (attrs.mode === 'stories' ? 'circle' : undefined);
      if (shape === 'rectangle') return 'vertical_stories';
      if (shape === 'circle' || shape === 'square') return 'circle_stories';
      if (attrs.mode === 'grid') return 'carousel_grid';
      if (attrs.mode === 'pinned') return null;
      return 'carousel_row';
    }
    default:
      return null;
  }
}

export const elementFamilies: { tag: LayoutTag; layouts: PortalLayout[] }[] = (
  ['fw-embed-feed', 'fw-player-deck', 'fw-storyblock', 'fw-player', 'fw-herounit'] as LayoutTag[]
).map((tag) => ({ tag, layouts: portalLayouts.filter((l) => l.tag === tag) }));
