# Renn Bros — website

The website of **Renn Bros Pneus et Mécanique**, a mobile mechanic serving the
West Island and Vaudreuil-Soulanges (Québec). Customers see the services and
prices, build a visit, check that their address is covered, and request a
booking that lands in the business's Square calendar, with an optional deposit
paid by card.

- **Live:** RennBros.com *(preview until launch: rennbros-driveway-fall.netlify.app)*
- **Languages:** English at clean URLs (`/services`), French under `/fr` (`/fr/services`)
- **Built and maintained by:** Tashii White · LeadByMotion

---

## At a glance

| | |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router, Turbopack), React 19, TypeScript |
| Styling | Tailwind CSS v4 tokens + plain CSS (`app/*.css`), light and dark themes |
| Fonts | Clash Display (headings) + General Sans (text), self-hosted via `next/font` |
| Icons | [Phosphor](https://phosphoricons.com) |
| Bookings and payments | [Square](https://developer.squareup.com) Bookings API + Web Payments SDK (deposit) |
| Map | [MapLibre](https://maplibre.org) on [OpenFreeMap](https://openfreemap.org) tiles, [Photon](https://photon.komoot.io) address search (no API keys) |
| Hosting | [Netlify](https://netlify.com), deployed from this repository |
| Tests | Puppeteer scripts in `scripts/` driving real Chrome, plus axe-core for accessibility |

No database and no content-management system: the content lives in a few
plain TypeScript files (see **Editing content**), and bookings live in Square.

---

## Run it locally

Requires **Node.js 20.9 or newer** (Netlify builds with Node 22).

```bash
npm install
npm run dev
```

Open http://localhost:3000. With no Square settings, the booking calendar runs
on a **stand-in** (made-up availability, nothing is sent), and the pages that
show it say "preview".

To try real settings locally, copy `.env.example` to `.env.local` and fill it
in. `.env.local` is git-ignored; never commit real keys.

---

## Project layout

```
app/
  [lang]/                 every page, once, for both languages (en | fr)
    page.tsx              home: hero, service menu, how it works, map, reviews, FAQ
    services/             the list, and one page per service ([slug])
    how-it-works/  area/  faq/
    book/                 the booking form, and book/received (confirmation)
    legal/                privacy, warranty, booking terms
  api/
    availability/         open arrival windows for a set of services (GET)
    book/                 create the booking (+ deposit) in Square (POST)
  globals.css             design tokens (colours, type, spacing), base styles
  site.css  sections.css  pages.css    header/footer, home sections, inner pages
  fonts.ts  fonts/        Clash Display + General Sans
  sitemap.ts  robots.ts  global-not-found.tsx

components/
  site/                   header, footer, phone bar, theme toggle, logo, SEO data
  home/                   hero (seasonal video), reviews reel, home sections
  menu/                   service cards, "Add to visit", visit panel, worn/new slider
  book/                   the booking form and the confirmation
  map/                    the service-area map (+ address check)

lib/
  business.ts             name, phone, email, socials, service area, hours, booking rules
  services.ts             the services: prices, durations, pictures (the price list)
  i18n/en.ts  i18n/fr.ts  every word on the site, English and French
  area.ts                 the coverage polygon and town map points
  reviews.ts              customer reviews
  season.ts               which seasonal hero is shown
  booking/                Square integration (square.ts) and its settings (config.ts)
  book/flow.ts            the booking form's steps, calendar, tyre options, deposit field
  map/mount.ts            map + address lookup
  visit.ts                the "visit" being built (kept in the visitor's browser)

public/
  media/                  photos (life/ = home menu, d-*.jpg = service pages),
                          seasons/<season>/ hero loop + poster + still,
                          map/ instant map snapshots
  brand/  icons, og.jpg   logo, app icons (home-screen), share image
  vendor/maplibre/        map worker files served as static files

scripts/                  tests and maintenance tools (see below)
```

**How the two languages work:** every page lives once under `app/[lang]/`.
`next.config.ts` rewrites clean English URLs (`/services`) to the `en` branch
and redirects `/en/…` back to the clean URL, so each page has exactly one
English and one French address. All text comes from `lib/i18n/en.ts` and
`lib/i18n/fr.ts`, which share one shape: TypeScript flags any line missing
from either language.

---

## Editing content

| To change… | Edit |
|---|---|
| A price, a duration, or add a service | `lib/services.ts`, then its name/description in both `lib/i18n/*.ts` |
| Any wording (both languages) | `lib/i18n/en.ts` and `lib/i18n/fr.ts` |
| Phone, email, social links, hours, arrival windows, deposit % | `lib/business.ts` |
| Service area towns / outline | `lib/business.ts` (town list) and `lib/area.ts` (polygon, points). Then run `npm run map:snapshot` |
| Reviews | `lib/reviews.ts` (set `reviewsArePlaceholder = false` once they are real) |
| Photos | replace files in `public/media/` with the same names and sizes |
| Seasonal hero | build with `NEXT_PUBLIC_HERO_SEASON=fall` or `winter` (see `lib/season.ts`) |

**Prices** follow the business's own price list and are shown the way it
writes them (`$125/h + parts`, `$150–$220 + refrigerant`, prices by rim size).
Each service has a `pricing` (how it's written) and a `priceFrom` (the lowest
figure, used for estimates and the deposit).

**Tyre services** work like Costco's: *Seasonal wheel swap* (the other set is
already on its own rims: 8 wheels / 8 tires) or *Tire change and balancing*
(tires changed on the customer's rims: 4 wheels / 8 tires, or new tires,
priced by rim size, run-flat +$20). The two are either/or everywhere.

---

## Bookings, Square and the deposit

1. The booking form asks for the services, the address (with a live coverage
   check), an arrival window (8, 11, 2, 5) from a month calendar, and the
   customer's details. Several services add up; visits that run long only
   offer windows that leave time to finish.
2. `GET /api/availability` asks Square for open windows; `POST /api/book`
   creates the booking in Square (with the tyre rim size and notes in the
   booking note) and, if a deposit is set, charges it with Square's card field.
3. The customer sees a confirmation; the business confirms the visit in Square.

All of this switches on from settings alone. In **Netlify → Project
configuration → Environment variables** (the full list, with where each value
comes from, is in `.env.example`):

| Setting | Secret? | Notes |
|---|---|---|
| `SQUARE_ACCESS_TOKEN` | **yes** | Production access token from Square Developer |
| `SQUARE_ENVIRONMENT` | no | `production` |
| `SQUARE_LOCATION_ID` | no | from Square Developer → Locations |
| `SQUARE_SERVICES` | no | JSON map of site service → Square service variation ID |
| `SQUARE_TEAM_MEMBER_ID` | no | optional |
| `NEXT_PUBLIC_SQUARE_APP_ID` | no | Application ID (card field) |
| `NEXT_PUBLIC_SQUARE_LOCATION_ID` | no | same Location ID |
| `NEXT_PUBLIC_SQUARE_ENVIRONMENT` | no | `production` |
| `NEXT_PUBLIC_HERO_SEASON` | no | `fall` or `winter` |

`NEXT_PUBLIC_*` settings are read when the site is built: **redeploy** after
changing them. The deposit percentage is `booking.depositPercent` in
`lib/business.ts` (no online charge while it is `null`).

The access token opens the Square account, payments included. It only ever
lives in Netlify's settings: never in the code, a commit, a chat or an email.

---

## Deploying

Netlify builds from this repository (`netlify.toml`: `npm run build`, Node 22,
Next.js runtime). Every push to the main branch deploys automatically.

**Before going live on RennBros.com**, run the launch check:

```bash
npm run launch-check
```

It lists what still blocks launch (placeholder reviews, unconfirmed area,
Square not connected…). When it's clear, also remove the preview
`X-Robots-Tag: noindex` header in `next.config.ts` (`headers()`), and the
`[[headers]]` block in `netlify.toml`, so search engines can index the site.

---

## Tests and tools

Start the site (`npm run dev`), then in another terminal:

| Command | What it checks |
|---|---|
| `npm run typecheck` | TypeScript, both languages complete |
| `npm run test:book` | the whole booking form, English and French, with and without JavaScript, plus the API rules |
| `npm run test:visit` | building a visit, the map, a town pin |
| `npm run test:devices` | every page fits phone, tablet and desktop widths |
| `npm run test:matrix` | iPhone, Android, iPad, laptop, desktop sizes in Chrome (and Edge if it can start) |
| `npm run test:textzoom` | nothing breaks at 200% text size |
| `npm run test:crawl` | every page in the sitemap: errors, broken links, titles, image descriptions |
| `npm run map:snapshot` | re-captures the instant map pictures (after changing the area) |
| `npm run launch-check` | what's left before launch |

Other scripts: `a11y-audit.mjs` (axe-core accessibility in light and dark),
`map-timing.mjs` (map speed on a throttled phone), `hero.mjs`, `shot.mjs`
(screenshots). Any test can target the live site with `SITE_URL=https://…`.
Screenshots go to `shots/` (git-ignored). Tests use the Chrome installed on
the machine (`CHROME_PATH` to override).

---

## Design notes

- **Light by default**, with a dark theme toggle (remembered per visitor).
- **Accessible:** WCAG 2.2 AA checked with axe-core in both themes; keyboard
  friendly; respects "reduce motion"; works with enlarged text.
- **Fast on phones:** the hero video loads after the page, the map shows an
  instant snapshot while the interactive map loads, and images are served as
  AVIF/WebP at the right size.
- **Saves to a phone's home screen** like an app (`public/site.webmanifest`,
  app icons in `public/`).
- **No car brand logos** anywhere in the imagery: photos are generated
  stand-ins until the Renn Bros photo shoot, with every badge removed.

---

## Ownership

This website and its content belong to **Renn Bros**. Fonts: Clash Display
and General Sans by Indian Type Foundry (Fontshare, free for commercial use).
Map data © OpenStreetMap contributors, tiles by OpenFreeMap.
