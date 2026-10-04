/**
 * The booking form, enhanced: five steps, live availability, a soft address
 * check, a deposit card field when one is configured, and a JSON submit.
 * Everything here is an upgrade of a form that already works without it.
 */
import { dict, href, money, price as priceText, duration, serviceIn, type Lang } from "@/lib/i18n";
import { business } from "@/lib/business";
import { TIRE_CHOICES, isRim, mountPrice } from "@/lib/services";
import { center, covered } from "@/lib/area";
import { geocodePhoton, ADDRESS_KEY } from "@/lib/map/mount";
import { VISIT_KEY, type LastVisit } from "@/lib/book/calendar";
import { depositCents, estimateOf } from "@/lib/booking/deposit";
import { cleanVin, decodeVin, isValidVin, readVin } from "@/lib/book/vin";
import { MAX_PHOTOS } from "@/lib/booking/photos";

type Slot = { startAt: string; minutes: number; segments?: unknown[] };
type Config = {
  lang: Lang;
  googleKey: string;
  square: { appId: string; locationId: string; production: boolean };
};

const TZ = "America/Toronto";
const LAST = 4;

export function mountFlow(form: HTMLFormElement, cfg: Config) {
  const t = dict(cfg.lang);
  const b = t.book;
  const $ = <T extends Element = HTMLElement>(s: string, root: ParentNode = form) => root.querySelector<T>(s)!;
  const $$ = <T extends Element = HTMLElement>(s: string, root: ParentNode = form) => [...root.querySelectorAll<T>(s)];
  const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement | RadioNodeList | null;
  const value = (name: string) => {
    const f = field(name);
    return f ? (f as HTMLInputElement).value.trim() : "";
  };

  /** The ticked services, in menu order. */
  const picked = () => $$<HTMLInputElement>('input[name="service"]:checked').map((i) => i.value);
  const travel = business.booking.travelMinutes;
  /** "from $578 · about 4 hr on site, travel included" for a set of services. */
  // Tyres mounted on the customer's rims are priced by rim size (price list).
  const rim = () => { const v = value("rim"); return isRim(v) ? v : undefined; };
  const runFlat = () => !!form.querySelector<HTMLInputElement>('[name="runflat"]')?.checked;
  const priceOf = (s: NonNullable<ReturnType<typeof serviceIn>>) =>
    s.slug === "tire-install" ? mountPrice(rim(), runFlat()) : s.priceFrom;
  const totals = (list: NonNullable<ReturnType<typeof serviceIn>>[]) => {
    const sum = list.reduce((n, s) => n + priceOf(s), 0);
    const minutes = list.reduce((n, s) => n + s.minutes, 0) + travel;
    const p = list.every((s) => s.exact) ? money(cfg.lang, sum) : `${b.service.totalFrom} ${money(cfg.lang, sum)}`;
    return b.service.total(p, duration(cfg.lang, minutes));
  };
  const totalLine = $("[data-total]");

  const steps = $$<HTMLFieldSetElement>("[data-step]");
  const progress = $$("[data-progress]");
  const back = $<HTMLButtonElement>("[data-back]");
  const next = $<HTMLButtonElement>("[data-next]");
  const submit = $<HTMLButtonElement>("[data-submit]");
  const announce = $("[data-step-announce]");
  const alert = document.getElementById("send-error")!;
  const alertText = $("[data-error-text]", alert);

  // --- Take over from the plain form -------------------------------------
  form.noValidate = true;
  $<HTMLFieldSetElement>("[data-plain]").disabled = true;
  $("[data-when]").hidden = false;
  next.hidden = false;

  let at = 0;
  const go = (n: number, focus = true) => {
    const dir = n < at ? "back" : "forward";
    at = Math.max(0, Math.min(LAST, n));
    steps.forEach((s, i) => {
      s.hidden = i !== at;
      s.dataset.dir = dir;
    });
    progress.forEach((p, i) => (p.dataset.state = i < at ? "done" : i === at ? "now" : "todo"));
    back.hidden = at === 0;
    next.hidden = at === LAST;
    // The last step is a checkout: its own back link and pay button; the side
    // summary steps aside (its content is in the receipt).
    $("[data-nav]").hidden = at === LAST;
    form.closest(".book__grid")?.classList.toggle("is-checkout", at === LAST);
    announce.textContent = b.stepOf(at + 1, LAST + 1, b.steps[at]);
    if (at === 2) loadSlots();
    if (at === LAST) fillReview();
    if (focus) {
      const top = form.getBoundingClientRect().top + scrollY - 110;
      if (scrollY > top) scrollTo({ top, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      $<HTMLElement>(".step__title", steps[at]).focus({ preventScroll: true });
    }
  };

  // --- Validation, one step at a time ------------------------------------
  const rules: Record<number, [string, (v: string) => boolean][]> = {
    0: [["service", () => picked().length > 0], ["rim", () => !picked().includes("tire-install") || !!rim()]],
    1: [["address", (v) => v.length > 4], ["postal", (v) => /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(v.trim())], ["parking", (v) => !!v]],
    2: [["slot", () => !!value("startAt")]],
    3: [
      ["name", (v) => v.length > 1],
      ["phone", (v) => v.replace(/\D/g, "").length >= 10],
      ["email", (v) => /^\S+@\S+\.\S+$/.test(v)],
      ["make", (v) => !!v],
      ["model", (v) => !!v],
    ],
  };
  const check = (n: number) => {
    let first: HTMLElement | null = null;
    for (const [name, ok] of rules[n] ?? []) {
      const good = ok(name === "slot" || name === "service" ? "" : value(name));
      $(`[data-err="${name}"]`).classList.toggle("on", !good);
      const input = form.querySelector<HTMLInputElement>(`[name="${name}"]`);
      if (input && input.type !== "radio") input.setAttribute("aria-invalid", String(!good));
      if (!good && !first) first = input ?? $<HTMLElement>(`[data-err="${name}"]`);
    }
    if (first) {
      (first as HTMLElement).focus?.();
      return false;
    }
    return true;
  };
  form.addEventListener("input", (e) => {
    const name = (e.target as HTMLInputElement).name;
    const err = form.querySelector(`[data-err="${name}"]`);
    if (err?.classList.contains("on")) {
      err.classList.remove("on");
      (e.target as HTMLElement).removeAttribute("aria-invalid");
    }
  });

  next.addEventListener("click", () => check(at) && go(at + 1));
  back.addEventListener("click", () => go(at - 1));
  $$<HTMLButtonElement>("[data-goto]").forEach((btn) => btn.addEventListener("click", () => go(Number(btn.dataset.goto))));
  // Enter in a text field moves forward instead of submitting half a form.
  form.addEventListener("keydown", (e) => {
    const el = e.target as HTMLElement;
    if (e.key === "Enter" && at < LAST && el.tagName === "INPUT") {
      e.preventDefault();
      next.click();
    }
  });

  // --- Summary card --------------------------------------------------------
  const sum = {
    service: $("[data-sum-service]", document),
    price: $("[data-sum-price]", document),
    where: $("[data-sum-where]", document),
    when: $("[data-sum-when]", document),
  };
  const whereDefault = sum.where.textContent;
  const whenDefault = sum.when.textContent;
  const refreshSummary = () => {
    const list = picked().map((slug) => serviceIn(cfg.lang, slug)!);
    const label = (s: (typeof list)[number]) =>
      s.slug === "tire-install" && rim() ? `${s.name} (${t.fmt.rims[rim()!]}${runFlat() ? `, ${b.tire.runFlat.replace(/\s*\(.*\)$/, "")}` : ""})` : s.name;
    sum.service.textContent = list.length ? list.map(label).join(" + ") : "—";
    sum.price.textContent = list.length ? totals(list) : "";
    totalLine.textContent = list.length ? totals(list) : "";
    sum.where.textContent = value("address") || whereDefault;
    sum.when.textContent = value("startAt") ? when(value("startAt")) : whenDefault;
  };
  form.addEventListener("change", refreshSummary);

  // --- Service: preselect from ?service=, else from the visit being built ---
  let asked = (new URLSearchParams(location.search).get("service") ?? "").split(",").filter(Boolean);
  if (!asked.length) {
    try {
      asked = JSON.parse(localStorage.getItem("rennbros.visit") ?? "[]");
    } catch {}
  }
  // Either/or: if a link or an older saved visit asks for both tyre services, keep the first.
  const firstTire = asked.find((s) => (TIRE_CHOICES as readonly string[]).includes(s));
  asked = asked.filter((s) => !(TIRE_CHOICES as readonly string[]).includes(s) || s === firstTire);
  for (const pre of asked) {
    if (!serviceIn(cfg.lang, pre)) continue;
    const box = form.querySelector<HTMLInputElement>(`input[name="service"][value="${CSS.escape(pre)}"]`);
    if (box) box.checked = true;
  }
  // The two tyre services are either/or (Costco's question: are the other
  // tyres already on their own rims?). Mounting asks for the rim size.
  const tireOpts = $("[data-tire-opts]");
  const showTireOpts = () => tireOpts.classList.toggle("on", picked().includes("tire-install"));
  form.addEventListener("change", (e) => {
    const el = e.target as HTMLInputElement;
    if (el.name === "service" && el.checked && (TIRE_CHOICES as readonly string[]).includes(el.value)) {
      for (const other of TIRE_CHOICES) {
        if (other === el.value) continue;
        const box = form.querySelector<HTMLInputElement>(`input[name="service"][value="${other}"]`);
        if (box) box.checked = false;
      }
    }
    if (el.name === "service") showTireOpts();
    if (el.name === "rim") $('[data-err="rim"]').classList.remove("on");
  });
  showTireOpts();
  form.addEventListener("change", (e) => {
    if ((e.target as HTMLInputElement).name === "service") {
      slotsFor = "";
      setSlot(null);
    }
  });

  // --- Returning customers: details remembered on this device ------------
  // Saved only in this browser (localStorage), only after a booking goes
  // through with "Remember my details" ticked; never sent anywhere else.
  const REMEMBER_KEY = "rennbros.details";
  const REMEMBERED = ["name", "phone", "email", "address", "postal", "parking", "year", "make", "model", "vin"];
  const rememberBox = form.querySelector<HTMLInputElement>('[name="remember"]');
  const welcome = form.querySelector<HTMLElement>("[data-remembered]");
  const rememberRow = form.querySelector<HTMLElement>("[data-remember]");
  if (rememberRow) rememberRow.hidden = false;
  // Choices (parking) are kept by position, since their labels are the
  // language's own words: a booking made in French still fills in English.
  const setField = (name: string, v: string) => {
    const f = field(name);
    if (!f || !v) return;
    if (f instanceof RadioNodeList) {
      const r = f[Number(v)] as HTMLInputElement | undefined;
      if (/^\d+$/.test(v) && r) r.checked = true;
    } else if (!f.value) f.value = v;
  };
  const stored = (name: string) => {
    const f = field(name);
    return f instanceof RadioNodeList ? String([...f].findIndex((r) => (r as HTMLInputElement).checked)).replace("-1", "") : value(name);
  };
  try {
    const saved = JSON.parse(localStorage.getItem(REMEMBER_KEY) ?? "null") as Record<string, string> | null;
    if (saved && typeof saved === "object") {
      let fresh = "";
      try { fresh = sessionStorage.getItem(ADDRESS_KEY) ?? ""; } catch {}
      // An address just checked on the map wins over the remembered one.
      for (const k of REMEMBERED) if (!(k === "address" && fresh)) setField(k, String(saved[k] ?? ""));
      if (welcome) welcome.hidden = false;
    }
  } catch {}
  welcome?.querySelector("[data-forget]")?.addEventListener("click", () => {
    try { localStorage.removeItem(REMEMBER_KEY); } catch {}
    for (const k of REMEMBERED) {
      const f = field(k);
      if (f instanceof RadioNodeList) for (const r of f) (r as HTMLInputElement).checked = false;
      else if (f) f.value = "";
    }
    if (rememberBox) rememberBox.checked = false;
    welcome.textContent = b.remember.forgotten;
    refreshSummary();
  });

  // --- Where: address prefill and a soft coverage check -------------------
  const address = form.querySelector<HTMLInputElement>('[name="address"]')!;
  try {
    const saved = sessionStorage.getItem(ADDRESS_KEY);
    if (saved && !address.value) address.value = saved;
  } catch {}
  const cover = $("[data-cover]");
  let lookup = 0;
  const coverCheck = async () => {
    const q = address.value.trim();
    const mine = ++lookup;
    if (q.length < 6) return (cover.textContent = "");
    cover.dataset.state = "checking";
    cover.textContent = b.coverage.checking;
    try {
      const hit = await geocodePhoton(q, { center, lang: cfg.lang });
      if (mine !== lookup) return;
      if (!hit) return (cover.textContent = "");
      const inside = covered(hit.at);
      cover.dataset.state = inside ? "in" : "out";
      cover.textContent = inside ? b.coverage.in : b.coverage.out;
    } catch {
      if (mine === lookup) cover.textContent = "";
    }
  };
  let pause = 0;
  address.addEventListener("input", () => {
    clearTimeout(pause);
    pause = window.setTimeout(coverCheck, 900);
  });
  if (address.value) coverCheck();

  // --- When: live availability -------------------------------------------
  const status = $("[data-when-status]");
  const cal = $("[data-cal]");
  const grid = $("[data-cal-grid]");
  const monthLabel = $("[data-cal-month]");
  const prevMonth = $<HTMLButtonElement>("[data-cal-prev]");
  const nextMonth = $<HTMLButtonElement>("[data-cal-next]");
  const dayLabel = $("[data-day-label]");
  const windows = $("[data-windows]");
  const preview = $("[data-preview]");
  const longJob = $("[data-longjob]");
  let slotsFor = "";
  let byDay = new Map<string, Slot[]>();
  let view = ""; // the month on screen, "YYYY-MM"
  let chosen = ""; // the chosen day, "YYYY-MM-DD"


  const ymd = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));
  const hourOf = (iso: string) => Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(new Date(iso)));
  const clock = (iso: string) => new Intl.DateTimeFormat(t.locale, { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
  const windowName = (h: number) => (h < 12 ? b.when.morning : b.when.afternoon);
  const when = (iso: string) =>
    `${new Intl.DateTimeFormat(t.locale, { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(new Date(iso))} · ${windowName(hourOf(iso))} (${clock(iso)})`;

  function setSlot(slot: Slot | null) {
    (form.querySelector('[name="startAt"]') as HTMLInputElement).value = slot?.startAt ?? "";
    (form.querySelector('[name="segments"]') as HTMLInputElement).value = slot?.segments ? JSON.stringify(slot.segments) : "";
    refreshSummary();
  }

  async function loadSlots(force = false) {
    const svc = picked().join(",");
    if (!svc || (slotsFor === svc && !force)) return;
    slotsFor = svc;
    status.textContent = b.when.loading;
    cal.hidden = true;
    windows.replaceChildren();
    try {
      const r = await fetch(`/api/availability?services=${encodeURIComponent(svc)}&days=31`);
      if (!r.ok) throw new Error(String(r.status));
      const data: { live: boolean; slots: Slot[] } = await r.json();
      if (slotsFor !== svc) return;
      preview.hidden = data.live;
      const total = data.slots[0]?.minutes ?? 0;
      longJob.hidden = total <= 180;
      longJob.textContent = b.when.longJob(duration(cfg.lang, total));
      byDay = new Map();
      for (const s of data.slots) {
        const d = ymd(s.startAt);
        byDay.set(d, [...(byDay.get(d) ?? []), s]);
      }
      if (!byDay.size) {
        status.textContent = b.when.none;
        return;
      }
      status.textContent = "";
      const keep = value("startAt") && byDay.has(ymd(value("startAt"))) ? ymd(value("startAt")) : [...byDay.keys()][0];
      view = keep.slice(0, 7);
      cal.hidden = false;
      pickDay(keep);
    } catch (e) {
      console.error("[availability]", e);
      slotsFor = "";
      status.textContent = b.when.error;
    }
  }

  // --- The month calendar ---------------------------------------------------
  const utc = (d: string) => new Date(`${d}T12:00:00Z`);
  const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(t.locale, { timeZone: "UTC", ...o }).format(utc(d));
  const plus = (d: string, n: number) => new Date(utc(d).getTime() + n * 86400000).toISOString().slice(0, 10);
  const months = () => [...new Set([...byDay.keys()].map((d) => d.slice(0, 7)))].sort();
  const todayYmd = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());

  function renderMonth() {
    const [y, m] = view.split("-").map(Number);
    const first = `${view}-01`;
    const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const lead = utc(first).getUTCDay(); // weeks start on Sunday, as in Canada
    monthLabel.textContent = fmt(first, { month: "long", year: "numeric" });

    // 2023-01-01 was a Sunday.
    const head = Array.from({ length: 7 }, (_, i) => {
      const el = document.createElement("span");
      el.className = "cal__dow";
      el.setAttribute("aria-hidden", "true");
      el.textContent = fmt(`2023-01-0${i + 1}`, { weekday: "short" }).replace(".", "");
      return el;
    });
    const blanks = Array.from({ length: lead }, () => Object.assign(document.createElement("span"), { className: "cal__blank" }));
    const cells = Array.from({ length: count }, (_, i) => {
      const d = `${view}-${String(i + 1).padStart(2, "0")}`;
      const open = byDay.has(d);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cal__day";
      btn.dataset.day = d;
      btn.textContent = String(i + 1);
      btn.disabled = !open;
      btn.tabIndex = d === chosen || (!byDay.has(chosen) && d === [...byDay.keys()][0]) ? 0 : -1;
      btn.setAttribute("aria-label", fmt(d, { weekday: "long", day: "numeric", month: "long" }));
      btn.setAttribute("aria-pressed", String(d === chosen));
      if (d === todayYmd) btn.classList.add("is-today");
      if (open) btn.addEventListener("click", () => pickDay(d));
      return btn;
    });
    grid.replaceChildren(...head, ...blanks, ...cells);
    const list = months();
    prevMonth.disabled = list.indexOf(view) <= 0;
    nextMonth.disabled = list.indexOf(view) >= list.length - 1;
  }

  prevMonth.addEventListener("click", () => {
    const list = months();
    view = list[Math.max(0, list.indexOf(view) - 1)];
    renderMonth();
  });
  nextMonth.addEventListener("click", () => {
    const list = months();
    view = list[Math.min(list.length - 1, list.indexOf(view) + 1)];
    renderMonth();
  });

  // Arrow keys move between open days; up and down move by a week.
  grid.addEventListener("keydown", (e) => {
    const from = (e.target as HTMLElement).dataset?.day;
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 }[e.key];
    if (!from || !step) return;
    e.preventDefault();
    const open = [...byDay.keys()];
    let target = plus(from, step);
    if (!byDay.has(target)) {
      // The nearest open day in the direction of travel.
      target = (step > 0 ? open.find((d) => d > target) : [...open].reverse().find((d) => d < target)) ?? from;
    }
    if (target.slice(0, 7) !== view) {
      view = target.slice(0, 7);
      renderMonth();
    }
    grid.querySelector<HTMLButtonElement>(`[data-day="${target}"]`)?.focus();
  });

  function pickDay(d: string) {
    // The grid is rebuilt; keep keyboard focus on the day that was picked.
    const hadFocus = grid.contains(document.activeElement);
    chosen = d;
    if (d.slice(0, 7) !== view) view = d.slice(0, 7);
    renderMonth();
    if (hadFocus) grid.querySelector<HTMLButtonElement>(`[data-day="${d}"]`)?.focus();
    dayLabel.textContent = fmt(d, { weekday: "long", day: "numeric", month: "long" });
    const current = value("startAt");
    windows.replaceChildren(
      ...(byDay.get(d) ?? []).map((s) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "win";
        btn.setAttribute("role", "radio");
        btn.setAttribute("aria-checked", String(s.startAt === current));
        btn.textContent = clock(s.startAt);
        btn.setAttribute("aria-label", `${windowName(hourOf(s.startAt))}, ${clock(s.startAt)}`);
        btn.addEventListener("click", () => {
          setSlot(s);
          $$(".win", windows).forEach((w) => w.setAttribute("aria-checked", String(w === btn)));
          $('[data-err="slot"]').classList.remove("on");
        });
        return btn;
      }),
    );
  }


  // --- Confirm ---------------------------------------------------------------
  function fillReview() {
    const list = picked().map((slug) => serviceIn(cfg.lang, slug)!);
    const car = [value("year"), value("make"), value("model")].filter(Boolean).join(" ");
    // The receipt: appointment first, then the services, car and contact.
    const mins = list.reduce((n, s) => n + s.minutes, 0) + travel;
    const at = value("startAt");
    const day = at ? new Intl.DateTimeFormat(t.locale, { timeZone: TZ, weekday: "long", month: "long", day: "numeric" }).format(new Date(at)) : "";
    $("[data-co-items]").replaceChildren(
      ...list.map((s) => {
        const li = document.createElement("li");
        const name = Object.assign(document.createElement("span"), { textContent: s.name + (s.slug === "tire-install" && rim() ? ` · ${t.fmt.rims[rim()!]}${runFlat() ? ` · ${b.tire.runFlatShort}` : ""}` : "") });
        const cost = Object.assign(document.createElement("span"), {
          className: "num",
          textContent: s.slug === "tire-install" && rim() ? money(cfg.lang, priceOf(s)) : priceText(cfg.lang, s),
        });
        li.append(name, cost);
        return li;
      }),
    );
    const rows = [
      list.length ? b.confirm.duration(duration(cfg.lang, mins)) : "",
      `${[value("address"), value("postal").toUpperCase()].filter(Boolean).join(", ")} · ${value("parking")}`,
      at ? `${day.charAt(0).toUpperCase()}${day.slice(1)} · ${clock(at)}` : "",
      car + (value("vin") ? ` · ${value("vin").toUpperCase()}` : ""),
      [value("name"), value("phone"), value("email")].filter(Boolean).join(" · "),
    ];
    rows.forEach((v, i) => ($(`[data-review-v="${i}"]`).textContent = v));
    // The deposit, by the same rule the server charges with.
    const pct = business.booking.depositPercent;
    try { paymentRequest?.update({ total: total() }); } catch {}
    if (pct && form.querySelector("[data-pay-amount]")) {
      const cents = depositCents(picked(), pct, rim(), runFlat());
      const due = money(cfg.lang, cents / 100, true);
      $("[data-pay-amount]").textContent = due;
      $("[data-pay-deposit]").textContent = due;
      $("[data-co-due-mini]").textContent = b.confirm.dueMini(due);
      $("[data-pay-estimate]").textContent = money(cfg.lang, estimateOf(picked(), rim(), runFlat()), true);
      // The button says what happens: pay, then send.
      if (cfg.square.appId && cents > 0) submit.textContent = b.confirm.payAndSend(due);
    }
  }

  /** One id per booking attempt. Unchanged booking = same id = Square hands
   *  back the same payment and booking on a resend, never a second charge.
   *  Any change to what's booked makes a new attempt. The card token is kept
   *  with its attempt so a resend reuses it instead of authorizing again. */
  const formId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}${Math.random().toString(16).slice(2)}`;
  let attempt: { sig: string; id: string; token?: string } | null = null;
  const attemptFor = () => {
    const sig = JSON.stringify([picked(), value("startAt"), value("rim"), runFlat(), value("email").toLowerCase()]);
    if (!attempt || attempt.sig !== sig) {
      let h = 0;
      for (const c of sig) h = (h * 31 + c.charCodeAt(0)) | 0;
      attempt = { sig, id: `${formId.replace(/-/g, "").slice(0, 20)}-${(h >>> 0).toString(36)}` };
    }
    return attempt;
  };

  // --- Deposit: card, Google Pay, Apple Pay (Square Web Payments SDK) -------
  // The card field takes credit and debit cards (Visa Debit, Debit Mastercard).
  // Google Pay and Apple Pay appear where the device supports them (Apple Pay
  // also needs the domain registered with Square). A wallet button checks the
  // form, gets a token for the deposit amount, then sends the booking.
  type Tokenizer = { tokenize(): Promise<{ status: string; token?: string }> };
  let card: Tokenizer | null = null;
  let paymentRequest: { update(o: unknown): void } | null = null;
  const pct = business.booking.depositPercent;
  const depositNow = () => (pct ? depositCents(picked(), pct, rim(), runFlat()) : 0);
  const total = () => ({ amount: (depositNow() / 100).toFixed(2), label: b.confirm.card });
  /** After a wallet tokenizes, send the booking with that token. */
  const payWith = async (w: Tokenizer) => {
    for (let n = 0; n < LAST; n++) if (!check(n)) return go(n);
    try {
      const tok = await w.tokenize();
      if (tok.status !== "OK" || !tok.token) return; // closed or cancelled the wallet sheet
      attemptFor().token = tok.token;
      form.requestSubmit();
    } catch (e) {
      console.error("[wallet]", e);
    }
  };
  if (pct && cfg.square.appId && cfg.square.locationId) {
    const box = $("[data-card]");
    box.hidden = false;
    const s = document.createElement("script");
    s.src = cfg.square.production ? "https://web.squarecdn.com/v1/square.js" : "https://sandbox.web.squarecdn.com/v1/square.js";
    s.onload = async () => {
      let payments: any;
      try {
        payments = (window as any).Square.payments(cfg.square.appId, cfg.square.locationId);
        const c = await payments.card();
        await c.attach("#card-field");
        card = c;
      } catch (e) {
        console.error("[card]", e);
        box.hidden = true;
        return;
      }
      try {
        paymentRequest = payments.paymentRequest({ countryCode: "CA", currencyCode: "CAD", total: total() });
      } catch (e) {
        console.error("[wallet]", e);
        return;
      }
      const wallets = $("[data-wallets]");
      try {
        const g = await payments.googlePay(paymentRequest);
        const el = document.getElementById("google-pay")!;
        el.hidden = false;
        await g.attach("#google-pay", { buttonColor: "black", buttonSizeMode: "fill", buttonType: "pay" });
        el.addEventListener("click", () => payWith(g));
        wallets.hidden = false;
      } catch {
        /* Google Pay not available on this device or browser */
      }
      try {
        const a = await payments.applePay(paymentRequest);
        const el = document.getElementById("apple-pay")!;
        el.hidden = false;
        el.addEventListener("click", () => payWith(a));
        wallets.hidden = false;
      } catch {
        /* Apple Pay: not Safari, no card in Wallet, or domain not registered */
      }
    };
    document.head.append(s);
  }

  // --- VIN from a photo ---------------------------------------------------
  const vinInput = form.querySelector<HTMLInputElement>('[name="vin"]')!;
  const vinStatus = $("[data-vin-status]");
  $("[data-vin-scan]").hidden = false;
  /** Fill year, make and model from a good VIN, without overwriting what's typed. */
  const fillFromVin = async (vin: string) => {
    const car = await decodeVin(vin);
    const set = (name: string, v?: string) => {
      const f = form.querySelector<HTMLInputElement>(`[name="${name}"]`);
      if (f && v && !f.value.trim()) { f.value = v; f.dispatchEvent(new Event("input", { bubbles: true })); }
    };
    set("year", car.year);
    set("make", car.make);
    set("model", car.model);
    return [car.year, car.make, car.model].filter(Boolean).join(" ");
  };
  $<HTMLInputElement>("[data-vin-photo]").addEventListener("change", async (e) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    vinStatus.textContent = b.you.vinReading;
    try {
      const got = await readVin(file);
      if (!got) { vinStatus.textContent = b.you.vinNone; return; }
      vinInput.value = got.vin;
      vinInput.dispatchEvent(new Event("input", { bubbles: true }));
      let msg = got.checked ? b.you.vinRead(got.vin) : b.you.vinUnsure(got.vin);
      if (got.checked) {
        const car = await fillFromVin(got.vin);
        if (car) msg += ` ${b.you.vinDecoded(car)}`;
      }
      vinStatus.textContent = msg;
    } catch (err) {
      console.error("[vin]", err);
      vinStatus.textContent = b.you.vinNone;
    }
  });
  // Typed or pasted: decode once it's a valid VIN.
  let decodedVin = "";
  vinInput.addEventListener("input", async () => {
    const v = cleanVin(vinInput.value);
    if (v !== decodedVin && isValidVin(v)) {
      decodedVin = v;
      await fillFromVin(v);
    }
  });

  // --- Photos ---------------------------------------------------------------
  const photoBox = $("[data-photos]");
  const photoList = $("[data-photo-list]");
  const photoStatus = $("[data-photo-status]");
  const photoField = form.querySelector<HTMLInputElement>('[name="photos"]')!;
  const photos: { id: string; url: string }[] = [];
  let uploading = 0;
  photoBox.hidden = false;
  /** Phone photos are 3–8 MB; shrink to 1600 px JPEG (~300 KB) before upload. */
  const shrink = async (file: File): Promise<Blob> => {
    const img = await createImageBitmap(file);
    const k = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return new Promise((res, rej) => c.toBlob((bl) => (bl ? res(bl) : rej(new Error("encode"))), "image/jpeg", 0.82));
  };
  const drawPhotos = () => {
    photoField.value = photos.map((p) => p.id).join(",");
    photoList.replaceChildren(
      ...photos.map((p, i) => {
        const li = document.createElement("li");
        li.className = "photos__item";
        const img = Object.assign(document.createElement("img"), { src: p.url, alt: "" });
        const rm = Object.assign(document.createElement("button"), { type: "button", className: "photos__rm", textContent: "×" });
        rm.setAttribute("aria-label", b.you.photoRemove(i + 1));
        rm.addEventListener("click", () => { URL.revokeObjectURL(p.url); photos.splice(i, 1); drawPhotos(); });
        li.append(img, rm);
        return li;
      }),
    );
  };
  $<HTMLInputElement>("[data-photo-input]").addEventListener("change", async (e) => {
    const input = e.currentTarget as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = "";
    const room = MAX_PHOTOS - photos.length - uploading;
    if (files.length > room) photoStatus.textContent = b.you.photosMax;
    for (const file of files.slice(0, Math.max(0, room))) {
      uploading++;
      if (!photoStatus.textContent) photoStatus.textContent = b.you.photoUploading;
      try {
        const blob = await shrink(file);
        const r = await fetch("/api/photo", { method: "POST", headers: { "content-type": "image/jpeg" }, body: blob });
        const data = await r.json().catch(() => ({}));
        if (!r.ok || !data.id) throw new Error(data.error ?? String(r.status));
        photos.push({ id: data.id, url: URL.createObjectURL(blob) });
        drawPhotos();
        if (photoStatus.textContent === b.you.photoUploading) photoStatus.textContent = "";
      } catch (err) {
        console.error("[photo]", err);
        photoStatus.textContent = b.you.photoFailed;
      } finally {
        uploading--;
      }
    }
  });

  // Updates by email / text: the error clears as soon as one is ticked.
  form.addEventListener("change", (e) => {
    const n = (e.target as HTMLInputElement).name;
    if (n === "notifyEmail" || n === "notifyText") $('[data-err="notify"]').classList.remove("on");
  });

  // Phones: the receipt folds into one line above the payment panel.
  const coBooking = $("[data-co-booking]");
  const coToggle = $<HTMLButtonElement>("[data-co-toggle]");
  const openReceipt = (open: boolean) => {
    coBooking.classList.toggle("is-open", open);
    coToggle.setAttribute("aria-expanded", String(open));
  };
  coToggle.addEventListener("click", () => openReceipt(!coBooking.classList.contains("is-open")));

  // --- Send ---------------------------------------------------------------
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    for (let n = 0; n < LAST; n++) if (!check(n)) return go(n);
    // Updates: at least one of email or text.
    const notifyErr = $('[data-err="notify"]');
    const anyNotify = ["notifyEmail", "notifyText"].some((k) => form.querySelector<HTMLInputElement>(`[name="${k}"]`)?.checked);
    notifyErr.classList.toggle("on", !anyNotify);
    if (!anyNotify) {
      openReceipt(true);
      form.querySelector<HTMLElement>(".notify")?.scrollIntoView({ block: "center" });
      return;
    }
    alert.classList.remove("on");
    $('[data-err="taken"]').classList.remove("on");
    submit.setAttribute("aria-busy", "true");
    submit.disabled = true;
    const label = submit.innerHTML;
    submit.textContent = b.confirm.sending;
    try {
      // Let photo uploads finish (up to 20 s) so their links reach the booking.
      for (let i = 0; uploading > 0 && i < 40; i++) await new Promise((r) => setTimeout(r, 500));
      const body: Record<string, unknown> = {};
      new FormData(form).forEach((v, k) => typeof v === "string" && k !== "service" && k !== "remember" && (body[k] = v));
      body.services = picked();
      body.notifyEmail = !!form.querySelector<HTMLInputElement>('[name="notifyEmail"]')?.checked;
      body.notifyText = !!form.querySelector<HTMLInputElement>('[name="notifyText"]')?.checked;
      const a = attemptFor();
      body.attempt = a.id;
      if (pct && cfg.square.appId && depositNow() > 0) {
        if (!card && !a.token) {
          alertText.textContent = b.confirm.cardMissing;
          alert.classList.add("on");
          alert.focus();
          return;
        }
        if (!a.token && card) {
          const tok = await card.tokenize();
          if (tok.status !== "OK" || !tok.token) {
            // Square's field shows what's wrong with the card details itself.
            document.getElementById("card-field")?.scrollIntoView({ block: "center" });
            return;
          }
          a.token = tok.token;
        }
        body.sourceId = a.token;
      }
      const r = await fetch("/api/book", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await r.json().catch(() => ({}));
      if (r.ok && data.ok) {
        try { sessionStorage.removeItem(ADDRESS_KEY); } catch {}
        try {
          if (rememberBox?.checked) localStorage.setItem(REMEMBER_KEY, JSON.stringify(Object.fromEntries(REMEMBERED.map((k) => [k, stored(k)]))));
          else localStorage.removeItem(REMEMBER_KEY);
        } catch {}
        // For "Add to calendar" on the next page (this tab only).
        try {
          const list = picked().map((slug) => serviceIn(cfg.lang, slug)!);
          const visit: LastVisit = {
            ref: String(data.ref),
            startAt: value("startAt"),
            minutes: list.reduce((n, s) => n + s.minutes, 0) + travel,
            title: list.map((s) => s.name).join(" + "),
            address: [value("address"), value("postal").toUpperCase()].filter(Boolean).join(", "),
          };
          sessionStorage.setItem(VISIT_KEY, JSON.stringify(visit));
        } catch {}
        location.assign(`${href(cfg.lang, "/book/received")}?ref=${encodeURIComponent(data.ref)}`);
        return;
      }
      if (data.error === "card_declined" || data.error === "card_required") {
        // Declined: that token is spent. A new card entry is a new authorization.
        if (attempt) attempt.token = undefined;
        alertText.textContent = b.confirm.cardDeclined;
        alert.classList.add("on");
        alert.focus();
        return;
      }
      if (data.error === "taken" || data.error === "lead_time") {
        $('[data-err="taken"]').classList.add("on");
        setSlot(null);
        slotsFor = "";
        go(2);
        return;
      }
      throw new Error(data.error ?? String(r.status));
    } catch (err) {
      console.error("[book]", err);
      alertText.textContent = b.confirm.errorBody;
      alert.classList.add("on");
      alert.focus();
    } finally {
      submit.removeAttribute("aria-busy");
      submit.disabled = false;
      submit.innerHTML = label;
    }
  });

  refreshSummary();
  go(0, false);
}
