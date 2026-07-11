import type { MouseEvent } from 'react';

export function navigate(path: string, options: { replace?: boolean } = {}) {
  if (window.location.pathname === path) return;
  const method = options.replace ? 'replaceState' : 'pushState';
  window.history[method]({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({ top: 0 });
}

export function handleInternalNavigation(
  event: MouseEvent<HTMLAnchorElement>,
  path: string,
) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }
  event.preventDefault();
  navigate(path);
}
