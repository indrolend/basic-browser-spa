// Generic validation and immutability boundary for template content.
function assertIdentifier(value, location) {
  if (typeof value !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]*$/.test(value)) {
    throw new TypeError(`${location} must be a non-empty identifier`);
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export function defineContent(sections) {
  if (!Array.isArray(sections) || sections.length === 0) {
    throw new TypeError('content must define at least one section');
  }

  const sectionIds = new Set();
  for (const [sectionIndex, section] of sections.entries()) {
    assertIdentifier(section?.id, `section ${sectionIndex} id`);
    if (sectionIds.has(section.id)) throw new TypeError(`duplicate section id: ${section.id}`);
    sectionIds.add(section.id);
    if (typeof section.label !== 'string' || !section.label.trim()) {
      throw new TypeError(`section ${section.id} must have a label`);
    }
    if (!Array.isArray(section.items) || section.items.length === 0) {
      throw new TypeError(`section ${section.id} must define at least one item`);
    }

    const itemIds = new Set();
    for (const item of section.items) {
      assertIdentifier(item?.id, `item id in ${section.id}`);
      if (itemIds.has(item.id)) throw new TypeError(`duplicate item id: ${section.id}/${item.id}`);
      itemIds.add(item.id);
      if (typeof item.label !== 'string' || !item.label.trim()) {
        throw new TypeError(`item ${section.id}/${item.id} must have a label`);
      }
      if (!item.hero || !['text', 'image'].includes(item.hero.kind)) {
        throw new TypeError(`item ${section.id}/${item.id} must define a text or image hero`);
      }
      if (item.hero.kind === 'text' && typeof item.hero.text !== 'string') {
        throw new TypeError(`text hero ${section.id}/${item.id} must define text`);
      }
      if (item.hero.kind === 'image' && typeof item.hero.src !== 'string') {
        throw new TypeError(`image hero ${section.id}/${item.id} must define src`);
      }
      if (item.adapter) {
        assertIdentifier(item.adapter.id, `adapter id for ${section.id}/${item.id}`);
        if (!Array.isArray(item.adapter.modules) || item.adapter.modules.length === 0 ||
            item.adapter.modules.some((path) => typeof path !== 'string' || !path.startsWith('./'))) {
          throw new TypeError(`adapter ${item.adapter.id} must define relative module paths`);
        }

        const expectedKey = `${section.id}/${item.id}`;
        if (item.adapter.key !== undefined && item.adapter.key !== expectedKey) {
          throw new TypeError(`adapter ${item.adapter.id} key must be ${expectedKey}`);
        }
        if (item.adapter.contractVersion !== undefined &&
            (!Number.isInteger(item.adapter.contractVersion) || item.adapter.contractVersion < 1)) {
          throw new TypeError(`adapter ${item.adapter.id} contractVersion must be a positive integer`);
        }
        if ((item.adapter.key === undefined) !== (item.adapter.contractVersion === undefined)) {
          throw new TypeError(`adapter ${item.adapter.id} must declare key and contractVersion together`);
        }
      }
    }
  }

  return deepFreeze(sections);
}
