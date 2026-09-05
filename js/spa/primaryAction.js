function parseClickAction(clickAction, baseUrl) {
  if (typeof clickAction !== 'string' || !clickAction || clickAction === 'none') return null;

  if (clickAction.startsWith('overlay:')) {
    const overlayId = clickAction.slice('overlay:'.length);
    return overlayId ? { type: 'overlay', overlayId } : null;
  }

  try {
    const href = new URL(clickAction, baseUrl).href;
    const url = new URL(href);
    const base = new URL(baseUrl);
    if (url.protocol !== 'https:' && url.origin !== base.origin) return null;
    return {
      type: 'link',
      href,
      external: url.origin !== base.origin
    };
  } catch (_) {
    return null;
  }
}

function normalizeAdapterAction(action) {
  if (!action || typeof action !== 'object') return null;
  if (action.type === 'application') {
    return {
      type: 'application',
      label: typeof action.label === 'string' && action.label.trim() ? action.label.trim() : null
    };
  }
  return null;
}

export function resolvePrimaryAction({ item, adapter = null, baseUrl }) {
  const adapterAction = normalizeAdapterAction(adapter?.getPrimaryAction?.());
  if (adapterAction) return adapterAction;
  return parseClickAction(item?.clickAction, baseUrl);
}

export function getPrimaryActionPresentation(action, itemLabel) {
  if (!action) return null;
  const label = typeof itemLabel === 'string' && itemLabel.trim() ? itemLabel.trim() : 'item';

  if (action.type === 'link') {
    return {
      role: 'link',
      ariaLabel: `Open ${label}`,
      actionable: true
    };
  }
  if (action.type === 'overlay') {
    return {
      role: 'button',
      ariaLabel: `Open ${label} menu`,
      actionable: true
    };
  }
  if (action.type === 'application') {
    return {
      role: 'button',
      ariaLabel: action.label || `Enter ${label}`,
      actionable: true
    };
  }

  return null;
}
