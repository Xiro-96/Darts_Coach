import { useSyncExternalStore } from 'react';

/**
 * Minimaler Hash-Router: funktioniert offline, als installierte PWA und auf
 * statischem Hosting (z. B. GitHub Pages) ohne Server-Konfiguration.
 */

function subscribe(cb: () => void): () => void {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

function snapshot(): string {
  return window.location.hash.replace(/^#/, '') || '/';
}

export interface Route {
  path: string;
  parts: string[];
  query: URLSearchParams;
}

export function parseRoute(hash: string): Route {
  const [path, qs] = hash.split('?');
  const clean = path.startsWith('/') ? path : `/${path}`;
  return { path: clean, parts: clean.split('/').filter(Boolean), query: new URLSearchParams(qs ?? '') };
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, snapshot, () => '/');
  return parseRoute(hash);
}

export function navigate(path: string, opts: { replace?: boolean } = {}): void {
  const target = `#${path}`;
  if (opts.replace) window.location.replace(target);
  else window.location.hash = path;
  window.scrollTo({ top: 0 });
}

export function back(fallback = '/'): void {
  if (window.history.length > 1) window.history.back();
  else navigate(fallback);
}
