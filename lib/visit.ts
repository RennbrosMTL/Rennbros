"use client";

import { useCallback, useSyncExternalStore } from "react";
import { services, TIRE_CHOICES } from "@/lib/services";

/**
 * The visit being built: which services, in menu order. Kept in this
 * browser (a convenience, not a record: the booking itself carries the
 * services), so a service added on its own page is still there on the menu.
 * Every component using it stays in sync through one custom event.
 */
const KEY = "rennbros.visit";
const EVENT = "rennbros:visit";
const ORDER = services.map((s) => s.slug);
const EMPTY: string[] = [];

let cache: { raw: string | null; value: string[] } = { raw: null, value: EMPTY };

function read(): string[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {}
  if (raw === cache.raw) return cache.value;
  let value = EMPTY;
  try {
    const parsed = JSON.parse(raw ?? "[]");
    if (Array.isArray(parsed)) value = ORDER.filter((s) => parsed.includes(s));
  } catch {}
  cache = { raw, value };
  return value;
}

function write(next: string[]) {
  const ordered = ORDER.filter((s) => next.includes(s));
  try {
    localStorage.setItem(KEY, JSON.stringify(ordered));
  } catch {
    cache = { raw: JSON.stringify(ordered), value: ordered };
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => e.key === KEY && cb();
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** Adding a service; the two tyre services are either/or, so one replaces the other. */
const withAdded = (now: string[], slug: string) => {
  const others = (TIRE_CHOICES as readonly string[]).includes(slug) ? now.filter((s) => !(TIRE_CHOICES as readonly string[]).includes(s)) : now;
  return [...others, slug];
};

export function useVisit() {
  const slugs = useSyncExternalStore(subscribe, read, () => EMPTY);
  const toggle = useCallback((slug: string) => {
    const now = read();
    write(now.includes(slug) ? now.filter((s) => s !== slug) : withAdded(now, slug));
  }, []);
  const add = useCallback((slug: string) => {
    const now = read();
    if (!now.includes(slug)) write(withAdded(now, slug));
  }, []);
  const remove = useCallback((slug: string) => write(read().filter((s) => s !== slug)), []);
  const clear = useCallback(() => write([]), []);
  return { slugs, toggle, add, remove, clear };
}
