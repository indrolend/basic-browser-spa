import { defineContent } from './spa/contentModel.js';

export const CONTENT_BASE_URL = import.meta.url;

// Neutral starter content. Replace this catalog; runtime code does not change.
export const SPA_SECTIONS = defineContent([
  {
    id: 'start', label: 'Start',
    items: [
      { id: 'welcome', label: 'Welcome', hero: { kind: 'text', text: 'Hello' } },
      { id: 'edit', label: 'Edit content', hero: { kind: 'text', text: 'js/content.js' } }
    ]
  },
  {
    id: 'explore', label: 'Explore',
    items: [
      { id: 'navigate', label: 'Navigate', hero: { kind: 'text', text: 'Next · Previous · Enter · Back' } },
      { id: 'link', label: 'Example link', hero: { kind: 'text', text: 'Example' }, clickAction: 'https://example.com' }
    ]
  },
  {
    id: 'finish', label: 'Finish',
    items: [{ id: 'ship', label: 'Ship', hero: { kind: 'text', text: 'Make it yours' } }]
  }
]);
