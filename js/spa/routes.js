// Canonical SPA route map
// Defines all sections, items, and per-item metadata.
// Attached to window so all SPA modules can read it without ES module imports.

window.__INDROLEND_ROUTES__ = {

  // Ordered list of top-level sections (horizontal swipe axis)
  sectionOrder: ['home', 'social', 'music', 'games', 'about'],

  sections: {
    home:   { label: 'Home',   items: ['swarm'] },
    social: { label: 'Social', items: ['tiktok', 'instagram', 'youtube'] },
    music:  { label: 'Music',  items: ['spotify', 'appleMusic', 'bandcamp', 'soundcloud'] },
    games:  { label: 'Games',  items: ['asymptote'] },
    about:  { label: 'About',  items: ['spotifyAnalytics', 'discography', 'devHistory', 'journal'] }
  },

  // Per-item metadata keyed by "sectionId/itemId"
  items: {
    'home/swarm': {
      label: 'swarm',
      transitionSource: 'canvasLive',
      scroll: { mode: 'none', edgeGatedSwipe: false },
      clickAction: 'none'
    },

    'social/tiktok': {
      label: 'tiktok',
      transitionSource: 'canvasPoster',
      scroll: { mode: 'none', edgeGatedSwipe: false },
      clickAction: 'https://www.tiktok.com/@indrolend'
    },
    'social/instagram': {
      label: 'instagram',
      transitionSource: 'canvasPoster',
      scroll: { mode: 'none', edgeGatedSwipe: false },
      clickAction: 'https://www.instagram.com/indrolend.us'
    },
    'social/youtube': {
      label: 'youtube',
      transitionSource: 'canvasPoster',
      scroll: { mode: 'none', edgeGatedSwipe: false },
      clickAction: 'https://www.youtube.com/@indrolend'
    },

    'music/spotify': {
      label: 'spotify',
      transitionSource: 'canvasPoster',
      scroll: { mode: 'none', edgeGatedSwipe: false },
      clickAction: 'https://open.spotify.com/artist/59X3431NBfd6xWMc3Zlh0v'
    },
    'music/appleMusic': {
      label: 'apple music',
      transitionSource: 'canvasPoster',
      scroll: { mode: 'none', edgeGatedSwipe: false },
      clickAction: 'https://music.apple.com/us/artist/onliner/1663334902'
    },
    'music/bandcamp': {
      label: 'bandcamp',
      transitionSource: 'canvasPoster',
      scroll: { mode: 'none', edgeGatedSwipe: false },
      clickAction: 'https://indrolend.bandcamp.com'
    },
    'music/soundcloud': {
      label: 'soundcloud',
      transitionSource: 'textPoster',
      scroll: { mode: 'none', edgeGatedSwipe: false },
      clickAction: 'overlay:soundcloudArchiveMenu'
    },

    'games/asymptote': {
      label: 'asymptote engine',
      transitionSource: 'textPoster',
      scroll: { mode: 'none', edgeGatedSwipe: false },
      clickAction: 'asymptote/index.html'
    },

    'about/spotifyAnalytics': {
      label: 'spotify analytics',
      transitionSource: 'textPoster',
      scroll: { mode: 'vertical', edgeGatedSwipe: true },
      clickAction: 'none'
    },
    'about/discography': {
      label: 'discography',
      transitionSource: 'textPoster',
      scroll: { mode: 'vertical', edgeGatedSwipe: true },
      clickAction: 'none'
    },
    'about/devHistory': {
      label: 'development history',
      transitionSource: 'textPoster',
      scroll: { mode: 'vertical', edgeGatedSwipe: true },
      clickAction: 'none'
    },
    'about/journal': {
      label: 'journal',
      transitionSource: 'textPoster',
      scroll: { mode: 'vertical', edgeGatedSwipe: true },
      clickAction: 'none'
    }
  }
};
