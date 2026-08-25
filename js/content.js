import { defineContent } from './spa/contentModel.js';

// Replace this array to adapt the template. Runtime code does not need to change.
export const SPA_SECTIONS = defineContent([
  {
    id: 'home',
    label: 'Home',
    items: [
      { id: 'swipe', label: 'Swipe', hero: { kind: 'text', text: 'swipe' } }
    ]
  },
  {
    id: 'social',
    label: 'Social',
    items: [
      { id: 'tiktok', label: 'TikTok', hero: { kind: 'image', src: 'gifs/Tiktoklogospin.gif' }, clickAction: 'https://www.tiktok.com/@indrolend' },
      { id: 'instagram', label: 'Instagram', hero: { kind: 'image', src: 'gifs/Instagramlogospin.gif' }, clickAction: 'https://www.instagram.com/indrolend.us' },
      { id: 'youtube', label: 'YouTube', hero: { kind: 'image', src: 'gifs/Youtubelogospin.gif' }, clickAction: 'https://www.youtube.com/@indrolend' }
    ]
  },
  {
    id: 'music',
    label: 'Music',
    items: [
      { id: 'spotify', label: 'Spotify', hero: { kind: 'image', src: 'gifs/Spotifylogospin.gif' }, clickAction: 'https://open.spotify.com/artist/59X3431NBfd6xWMc3Zlh0v' },
      { id: 'appleMusic', label: 'Apple Music', hero: { kind: 'image', src: 'gifs/Applemusiclogospin.gif' }, clickAction: 'https://music.apple.com/us/artist/onliner/1663334902' },
      { id: 'bandcamp', label: 'Bandcamp', hero: { kind: 'image', src: 'gifs/bandcamplogospin.gif' }, clickAction: 'https://indrolend.bandcamp.com' },
      { id: 'soundcloud', label: 'SoundCloud', hero: { kind: 'image', src: 'gifs/soundcloudlogospin.gif' }, clickAction: 'overlay:soundcloudArchiveMenu' }
    ]
  },
  {
    id: 'games',
    label: 'Games',
    items: [
      {
        id: 'asymptote',
        label: 'Asymptote Engine',
        hero: { kind: 'text', text: 'Asymptote Engine' },
        adapter: {
          id: 'asymptote',
          modules: ['./spa/apps/asymptoteApp.js', './spa/views/gamesView.js']
        }
      }
    ]
  }
]);
