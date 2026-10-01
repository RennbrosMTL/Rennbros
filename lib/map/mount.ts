/**
 * Mounts the service-area map and wires the address check. Google Maps when
 * a key is configured; otherwise MapLibre on OpenFreeMap's light positron
 * style with the Photon geocoder. Both basemaps are real OpenStreetMap or
 * Google cartography, never a drawing.
 */
import { covered, type LngLat } from "@/lib/area";
// Served as static files from public/vendor/maplibre (copied from the
// package): the stylesheet loads only with the map, and MapLibre's worker is
// handed its own URL, since bundling moves the module it would resolve from.
const libreCss = "/vendor/maplibre/maplibre-gl.css";
const libreWorker = "/vendor/maplibre/maplibre-gl-worker.mjs";

type Config = {
  lang: "en" | "fr";
  key: string;
  center: LngLat;
  coverage: LngLat[][];
  towns: { key: string; name: string; at: LngLat }[];
  gestures: [string, string];
  text: Record<"searching" | "in" | "out" | "none" | "error" | "failed", string>;
  bookHref: string;
};

type Api = {
  /** Drop the pin (with an optional label) and fly there. */
  pin(at: LngLat, label?: string, zoom?: number): void;
  /** Back to the whole area. */
  reset(): void;
};

const TOWN_ZOOM = 12.5;
const ADDRESS_ZOOM = 14;

// The coverage area in the site's red (action colour), outline a shade deeper.
const AREA = "#c8161d";
const AREA_LINE = "#a8121a";
export const ADDRESS_KEY = "rennbros.address";

export async function mountMap(root: HTMLElement, cfg: Config) {
  const box = root.querySelector<HTMLElement>("[data-map]")!;
  const status = root.querySelector<HTMLElement>("[data-map-status]")!;
  let api: Api | null = null;
  try {
    api = cfg.key ? await google(box, cfg) : await libre(box, cfg);
    status.hidden = true;
    // The snapshot shown while loading (public/media/map) fades out now that
    // the live map has drawn its tiles underneath it.
    root.classList.add("is-live");
  } catch (e) {
    console.error("[map]", e);
    status.textContent = cfg.text.failed;
  }
  wireCheck(root, cfg, () => api);
  wireTowns(root, cfg, () => api);
}

/* --- Towns: any [data-town] button on the page focuses the map ------------ */
function wireTowns(root: HTMLElement, cfg: Config, api: () => Api | null) {
  if (!api()) return; // no map: the names stay plain text
  const buttons = [...document.querySelectorAll<HTMLButtonElement>("[data-town]")];
  let current = "";
  const select = (key: string) => {
    const town = cfg.towns.find((t) => t.key === key);
    const a = api();
    if (!town?.at || !a) return;
    // A second press on the same town returns to the whole area.
    current = current === key ? "" : key;
    buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.town === current)));
    // No label: the basemap already names the town under the pin.
    if (current) a.pin(town.at, undefined, TOWN_ZOOM);
    else a.reset();
    // On a phone the list sits below the map; bring the map into view.
    const r = root.getBoundingClientRect();
    if (r.top < 0 || r.top > innerHeight * 0.5) {
      root.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    }
  };
  buttons.forEach((b) => {
    b.disabled = false;
    b.addEventListener("click", () => select(b.dataset.town!));
  });
  root.addEventListener("smap:town", (e) => select((e as CustomEvent<string>).detail));
}

/** The pin: a red point, and a label when there is one. */
function pinElement(label?: string) {
  const el = document.createElement("div");
  el.className = "smap-pin";
  if (label) {
    const tag = document.createElement("span");
    tag.textContent = label;
    el.append(tag);
  }
  return el;
}

/* --- MapLibre + OpenFreeMap --------------------------------------------- */
async function libre(box: HTMLElement, cfg: Config): Promise<Api> {
  const css = new Promise<void>((res) => {
    const link = Object.assign(document.createElement("link"), { rel: "stylesheet", href: libreCss });
    link.onload = link.onerror = () => res();
    document.head.append(link);
  });
  const [mod] = await Promise.all([import("maplibre-gl"), css]);
  // The package is CommonJS in some builds and ESM in others.
  const maplibregl = ((mod as any).default ?? mod) as typeof import("maplibre-gl");
  maplibregl.setWorkerUrl(libreWorker);
  const map = new maplibregl.Map({
    container: box,
    style: "https://tiles.openfreemap.org/styles/positron",
    bounds: bounds(cfg.coverage),
    fitBoundsOptions: { padding: 36 },
    attributionControl: { compact: true },
    cooperativeGestures: true,
    locale: {
      "CooperativeGesturesHandler.WindowsHelpText": cfg.gestures[0],
      "CooperativeGesturesHandler.MacHelpText": cfg.gestures[0].replace("Ctrl", "⌘"),
      "CooperativeGesturesHandler.MobileHelpText": cfg.gestures[1],
    },
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    // 3x phone screens draw at 2x: a third less work for a slow phone, and
    // the difference can't be seen at that density.
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    fadeDuration: 0,
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
  // The stylesheet arrives with the module; size the canvas to the frame
  // once it has, and whenever the frame changes.
  new ResizeObserver(() => map.resize()).observe(box);

  await new Promise<void>((res, rej) => {
    map.once("load", () => res());
    map.once("error", (e) => rej(e.error));
  });

  map.resize();
  map.fitBounds(bounds(cfg.coverage), { padding: 36, duration: 0 });
  map.addSource("area", {
    type: "geojson",
    data: { type: "Feature", properties: {}, geometry: { type: "MultiPolygon", coordinates: cfg.coverage.map((r) => [r]) } },
  });
  // Under the labels, so town names stay readable through the tint.
  const firstSymbol = map.getStyle().layers.find((l) => l.type === "symbol")?.id;
  map.addLayer({ id: "area-fill", type: "fill", source: "area", paint: { "fill-color": AREA, "fill-opacity": ["interpolate", ["linear"], ["zoom"], 9, 0.1, 12, 0.04] } }, firstSymbol);
  map.addLayer({ id: "area-line", type: "line", source: "area", paint: { "line-color": AREA_LINE, "line-width": 1.6, "line-opacity": 0.85 } }, firstSymbol);

  for (const t of cfg.towns) {
    if (!t.at) continue;
    const el = document.createElement("button");
    el.type = "button";
    el.className = "smap-town";
    el.title = t.name;
    // Mouse-only shortcut: the town list beside the map is the accessible
    // equivalent, so the dots stay out of the tab order and the reading order.
    el.tabIndex = -1;
    el.setAttribute("aria-hidden", "true");
    el.addEventListener("click", () => box.closest(".smap")!.dispatchEvent(new CustomEvent("smap:town", { detail: t.key })));
    new maplibregl.Marker({ element: el }).setLngLat(t.at).addTo(map);
  }

  // Ready once the tiles are actually drawn (or after a few seconds regardless).
  await Promise.race([new Promise<void>((res) => map.once("idle", () => res())), new Promise((res) => setTimeout(res, 6000))]);

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let pin: InstanceType<typeof maplibregl.Marker> | null = null;
  return {
    pin(at, label, zoom = ADDRESS_ZOOM) {
      pin?.remove();
      pin = new maplibregl.Marker({ element: pinElement(label), anchor: "left", offset: [-9, 0] }).setLngLat(at).addTo(map);
      map.flyTo({ center: at, zoom, speed: 1.4, curve: 1.3, essential: false, animate: !reduce });
    },
    reset() {
      pin?.remove();
      pin = null;
      map.fitBounds(bounds(cfg.coverage), { padding: 36, animate: !reduce, duration: 1000 });
    },
  };
}

/* --- Google Maps -------------------------------------------------------- */
declare global { interface Window { google?: any; __gmReady?: () => void } }

async function google(box: HTMLElement, cfg: Config): Promise<Api> {
  if (!window.google?.maps) {
    await new Promise<void>((res, rej) => {
      window.__gmReady = () => res();
      const s = document.createElement("script");
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(cfg.key)}&language=${cfg.lang}&region=CA&callback=__gmReady&loading=async`;
      s.async = true;
      s.onerror = () => rej(new Error("google maps failed to load"));
      document.head.append(s);
    });
  }
  const g = window.google.maps;
  const map = new g.Map(box, {
    center: { lng: cfg.center[0], lat: cfg.center[1] },
    zoom: 10,
    disableDefaultUI: true,
    zoomControl: true,
    gestureHandling: "cooperative",
    clickableIcons: false,
    styles: LIGHT,
  });
  const b = new g.LatLngBounds();
  cfg.coverage.flat().forEach(([lng, lat]) => b.extend({ lng, lat }));
  map.fitBounds(b, 36);
  new g.Polygon({
    map, paths: cfg.coverage.map((r) => r.map(([lng, lat]) => ({ lng, lat }))),
    fillColor: AREA, fillOpacity: 0.1, strokeColor: AREA_LINE, strokeOpacity: 0.85, strokeWeight: 1.6, clickable: false,
  });
  for (const t of cfg.towns) {
    if (!t.at) continue;
    const m = new g.Marker({
      map, position: { lng: t.at[0], lat: t.at[1] }, title: t.name, clickable: true, cursor: "pointer",
      icon: { path: g.SymbolPath.CIRCLE, scale: 4, fillColor: "#191918", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 },
    });
    m.addListener("click", () => box.closest(".smap")!.dispatchEvent(new CustomEvent("smap:town", { detail: t.key })));
  }
  let pin: any = null;
  return {
    pin([lng, lat], label, zoom = ADDRESS_ZOOM) {
      pin?.setMap(null);
      pin = new g.Marker({
        map, position: { lng, lat },
        icon: { path: g.SymbolPath.CIRCLE, scale: 8, fillColor: "#b01f24", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 },
        label: label ? { text: label, className: "smap-glabel", color: "#191918", fontSize: "12px", fontWeight: "500" } : undefined,
      });
      map.panTo({ lng, lat });
      map.setZoom(Math.round(zoom));
    },
    reset() {
      pin?.setMap(null);
      pin = null;
      map.fitBounds(b, 36);
    },
  };
}

/** A quiet light style: grey land, white roads, pale water, few labels. */
const LIGHT = [
  { elementType: "geometry", stylers: [{ color: "#f3f3f1" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#696965" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#fafaf9" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#e3e3e0" }] },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "simplified" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#dfe6e8" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#4a4a47" }] },
];

/* --- Address check ------------------------------------------------------ */
function wireCheck(root: HTMLElement, cfg: Config, api: () => Api | null) {
  const form = root.querySelector<HTMLFormElement>("[data-check]");
  if (!form) return;
  const out = form.querySelector<HTMLElement>("[data-result]")!;
  const text = form.querySelector<HTMLElement>("[data-result-text]")!;
  const say = (state: keyof Config["text"]) => {
    out.hidden = false;
    out.dataset.state = state;
    text.textContent = cfg.text[state];
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = (new FormData(form).get("q") ?? "").toString().trim();
    if (!q) return;
    say("searching");
    try {
      const hit = cfg.key ? await geocodeGoogle(q) : await geocodePhoton(q, cfg);
      if (!hit) return say("none");
      // Label with what the visitor typed: the geocoder may land on a
      // neighbouring street, which is fine for coverage but wrong as a label.
      api()?.pin(hit.at, q.split(",")[0].trim());
      say(covered(hit.at) ? "in" : "out");
      // Carried to the booking form in this tab only, never in a URL.
      try { sessionStorage.setItem(ADDRESS_KEY, hit.label || q); } catch {}
    } catch (err) {
      console.error("[check]", err);
      say("error");
    }
  });
}

export async function geocodePhoton(q: string, cfg: Pick<Config, "center" | "lang">) {
  const u = new URL("https://photon.komoot.io/api/");
  u.searchParams.set("q", expand(q));
  // Greater Montréal only: without it, "Lakeshore Rd" resolves to Ontario
  // and "Beaconsfield Blvd" to Australia.
  u.searchParams.set("bbox", "-74.9,45.0,-73.3,45.8");
  u.searchParams.set("lat", String(cfg.center[1]));
  u.searchParams.set("lon", String(cfg.center[0]));
  u.searchParams.set("limit", "1");
  u.searchParams.set("lang", cfg.lang === "fr" ? "fr" : "en");
  // Photon is a free public service and now and then drops a request or
  // rate-limits; one quiet retry saves the visitor from an error.
  let r: Response;
  try {
    r = await fetch(u);
    if (!r.ok) throw new Error(`photon ${r.status}`);
  } catch {
    await new Promise((res) => setTimeout(res, 700));
    r = await fetch(u);
    if (!r.ok) throw new Error(`photon ${r.status}`);
  }
  const f = (await r.json()).features?.[0];
  if (!f) return null;
  const p = f.properties ?? {};
  const label = [[p.housenumber, p.street].filter(Boolean).join(" "), p.city ?? p.name].filter(Boolean).join(", ");
  return { at: f.geometry.coordinates as LngLat, label };
}

/** Street abbreviations Photon doesn't read, in both languages. */
const ABBR: [RegExp, string][] = [
  [/\bblvd\b\.?|\bboul\b\.?|\bbd\b\.?/gi, "Boulevard"],
  [/\brd\b\.?/gi, "Road"],
  [/\bave?\b\.?/gi, "Avenue"],
  [/\bst\b\.?(?=\s*,|\s*$)/gi, "Street"],
  [/\bch\b\.?/gi, "Chemin"],
  [/\bmtl\b/gi, "Montréal"],
];
const expand = (q: string) => ABBR.reduce((s, [re, to]) => s.replace(re, to), q);

async function geocodeGoogle(q: string) {
  const g = window.google.maps;
  const res = await new g.Geocoder().geocode({ address: q, region: "CA", componentRestrictions: { country: "CA" } });
  const r = res.results?.[0];
  if (!r) return null;
  const l = r.geometry.location;
  return { at: [l.lng(), l.lat()] as LngLat, label: r.formatted_address as string };
}

function bounds(rings: LngLat[][]): [LngLat, LngLat] {
  const ring = rings.flat();
  const xs = ring.map((p) => p[0]);
  const ys = ring.map((p) => p[1]);
  return [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]];
}
