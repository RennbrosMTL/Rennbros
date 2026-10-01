"use client";

import { Fragment, useEffect, useRef } from "react";
import { ArrowLeft, ArrowRight, CalendarBlank, Camera, Image as ImageIcon, CaretLeft, CaretRight, Check, MapPin, ShieldCheck, WarningCircle } from "@phosphor-icons/react";
import { business } from "@/lib/business";
import { dict, href, money, price, duration, servicesIn, type Lang } from "@/lib/i18n";
import { MOUNT } from "@/lib/services";
import { mountFlow } from "@/lib/book/flow";

/**
 * Booking. One form, two ways to use it.
 *
 * As rendered on the server it is a single honest form: every field visible,
 * a date and an arrival time, posted to /api/book, which answers with a
 * redirect to the confirmation page or back here to #send-error.
 *
 * Once the page is live, lib/book/flow.ts turns the same fields into five
 * steps: several services with a running total, live availability on a month
 * calendar, a soft address check, and a deposit card field when a deposit is
 * configured. It runs once; this component never re-renders its markup.
 */
export function BookingForm({ lang }: { lang: Lang }) {
  const t = dict(lang);
  const b = t.book;
  const services = servicesIn(lang);
  const form = useRef<HTMLFormElement>(null);
  const started = useRef(false);
  const cancel = business.booking.cancellationHours;
  const clock = (h: number) => new Intl.DateTimeFormat(t.locale, { timeZone: "UTC", hour: "numeric", minute: "2-digit" }).format(new Date(Date.UTC(2026, 0, 5, h)));

  useEffect(() => {
    if (started.current || !form.current) return;
    started.current = true;
    mountFlow(form.current, {
        lang,
        googleKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "",
        square: {
          appId: process.env.NEXT_PUBLIC_SQUARE_APP_ID ?? "",
          locationId: process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID ?? "",
          production: process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT === "production",
        },
      });
  }, [lang]);

  return (
    <>
      <div id="send-error" className="alert" role="alert" tabIndex={-1}>
        <WarningCircle size={22} weight="light" aria-hidden />
        <div>
          <p className="alert__t">{b.confirm.errorTitle}</p>
          <p data-error-text>{b.confirm.errorBody}</p>
        </div>
      </div>

      <div className="book__grid">
        <form ref={form} className="flow" method="post" action="/api/book">
          <input type="hidden" name="lang" value={lang} />
          <ol className="progress" aria-hidden="true">
            {b.steps.map((s, i) => <li key={s} data-progress={i}><span className="num">{i + 1}</span><em>{s}</em></li>)}
          </ol>
          <p className="sr-only" aria-live="polite" data-step-announce />
          <p className="remembered" data-remembered aria-live="polite" hidden>{b.remember.welcome} <button type="button" className="link" data-forget>{b.remember.forget}</button></p>

          {/* 1 · Service */}
          <fieldset className="step" data-step="0">
            <legend className="step__title d3" tabIndex={-1}>{b.titles[0]}</legend>
            <p className="help step__help">{b.service.help}</p>
            <div className="choices">
              {services.map((s) => (
                <Fragment key={s.slug}>
                <label className="choice">
                  <input type="checkbox" name="service" value={s.slug} />
                  <span className="choice__name">{s.name}{s.sub && <em className="choice__sub">{s.sub}</em>}</span>
                  <span className="choice__meta num">{price(lang, s)} · {duration(lang, s.minutes)}</span>
                  <span className="choice__tick" aria-hidden="true"><Check size={14} weight="bold" /></span>
                </label>
                {s.slug === "tire-install" && (
                  <>
                  {/* Tyres mounted on their rims: priced by rim size, like the price list. */}
                  <div className="tireopts" data-tire-opts>
                    <div className="field">
                      <span id="rim-label">{b.tire.legend}</span>
                      <div className="pills" role="radiogroup" aria-labelledby="rim-label">
                        {MOUNT.tiers.map((r) => (
                          <label key={r.rim} className="pill"><input type="radio" name="rim" value={r.rim} /><span>{`${t.fmt.rims[r.rim]} · ${money(lang, r.price)}`}</span></label>
                        ))}
                      </div>
                    </div>
                    <label className="remember tireopts__rf"><input type="checkbox" name="runflat" /><span>{b.tire.runFlat}</span></label>
                    <p className="help">{b.tire.help}</p>
                    <p className="err" data-err="rim">{b.tire.err}</p>
                  </div>
                  </>
                )}
                </Fragment>
              ))}
            </div>
            <p className="total" data-total aria-live="polite" />
            <p className="err" data-err="service">{b.invalid.service}</p>
          </fieldset>

          {/* 2 · Where */}
          <fieldset className="step" data-step="1">
            <legend className="step__title d3" tabIndex={-1}>{b.titles[1]}</legend>
            <label className="field">
              <span>{b.where.address}</span>
              <input className="input" name="address" type="text" autoComplete="street-address" required />
              <span className="help">{b.where.addressHelp}</span>
              <span className="cover" data-cover aria-live="polite" />
            </label>
            <p className="err" data-err="address">{b.invalid.address}</p>
            <label className="field field--short">
              <span>{b.where.postal}</span>
              <input className="input" name="postal" type="text" autoComplete="postal-code" autoCapitalize="characters" inputMode="text" maxLength={7} placeholder="H9W 5L6" required />
            </label>
            <p className="err" data-err="postal">{b.invalid.postal}</p>
            <div className="field">
              <span id="parking-label">{b.where.parking}</span>
              <div className="pills" role="radiogroup" aria-labelledby="parking-label">
                {b.where.parkingOptions.map((o) => (
                  <label key={o} className="pill"><input type="radio" name="parking" value={o} required /><span>{o}</span></label>
                ))}
              </div>
              <span className="help">{b.where.parkingHelp}</span>
            </div>
            <p className="err" data-err="parking">{b.invalid.parking}</p>
          </fieldset>

          {/* 3 · When */}
          <fieldset className="step" data-step="2">
            <legend className="step__title d3" tabIndex={-1}>{b.titles[2]}</legend>
            <div className="when" data-when hidden>
              <p className="when__status" data-when-status>{b.when.loading}</p>
              <div className="pick" data-cal hidden>
                <div className="cal">
                  <div className="cal__head">
                    <button className="cal__nav" type="button" data-cal-prev aria-label={b.when.prevMonth}><CaretLeft size={18} weight="light" aria-hidden /></button>
                    <p className="cal__month" data-cal-month aria-live="polite" />
                    <button className="cal__nav" type="button" data-cal-next aria-label={b.when.nextMonth}><CaretRight size={18} weight="light" aria-hidden /></button>
                  </div>
                  <div className="cal__grid" data-cal-grid role="group" aria-label={b.plain.date} />
                </div>
                <div className="pick__side">
                  <p className="pick__day" data-day-label />
                  <div className="windows" data-windows role="radiogroup" aria-label={b.plain.window} />
                </div>
              </div>
              <p className="when__preview" data-preview hidden><span className="tag">{t.draft}</span> {b.when.preview}</p>
              <p className="when__long" data-longjob hidden />
              <input type="hidden" name="startAt" />
              <input type="hidden" name="segments" />
            </div>
            {/* Plain: a date and an arrival time. Disabled once enhanced. */}
            <fieldset className="plain" data-plain>
              <p className="help">{b.plain.help}</p>
              <label className="field">
                <span>{b.plain.date}</span>
                <input className="input" name="date" type="date" required />
              </label>
              <div className="pills" role="radiogroup" aria-label={b.plain.window}>
                {business.booking.arrivals.map((h, i) => (
                  <label key={h} className="pill"><input type="radio" name="window" value={h} defaultChecked={i === 0} /><span className="num">{clock(h)}</span></label>
                ))}
              </div>
            </fieldset>
            <p className="help">{b.when.notice}</p>
            <p className="err" data-err="slot">{b.invalid.slot}</p>
            <p className="err" data-err="taken">{b.confirm.taken}</p>
          </fieldset>

          {/* 4 · You */}
          <fieldset className="step" data-step="3">
            <legend className="step__title d3" tabIndex={-1}>{b.titles[3]}</legend>
            <div className="grid2">
              <label className="field span2"><span>{b.you.name}</span><input className="input" name="name" autoComplete="name" required /></label>
              <p className="err span2" data-err="name">{b.invalid.name}</p>
              <label className="field"><span>{b.you.phone}</span><input className="input" name="phone" type="tel" autoComplete="tel" inputMode="tel" required /></label>
              <label className="field"><span>{b.you.email}</span><input className="input" name="email" type="email" autoComplete="email" required /></label>
              <p className="err" data-err="phone">{b.invalid.phone}</p>
              <p className="err" data-err="email">{b.invalid.email}</p>
            </div>
            <div className="grid3">
              <label className="field"><span>{b.you.year} <em className="opt">({b.you.optional})</em></span><input className="input" name="year" inputMode="numeric" maxLength={4} /></label>
              <label className="field"><span>{b.you.make}</span><input className="input" name="make" required /></label>
              <label className="field"><span>{b.you.model}</span><input className="input" name="model" required /></label>
              <p className="err" data-err="make">{b.invalid.make}</p>
              <p className="err" data-err="model">{b.invalid.model}</p>
            </div>
            <label className="field">
              <span>{b.you.vin} <em className="opt">({b.you.optional})</em></span>
              <input className="input" name="vin" maxLength={17} autoCapitalize="characters" spellCheck={false} />
              <span className="help">{b.you.vinHelp}</span>
            </label>
            <div className="scan" data-vin-scan hidden>
              <label className="btn btn--ghost btn--sm scan__btn">
                <Camera size={18} weight="light" aria-hidden />
                {b.you.vinScan}
                <input className="sr-only" type="file" accept="image/*" capture="environment" data-vin-photo />
              </label>
              <span className="help scan__status" data-vin-status aria-live="polite" />
            </div>
            <label className="field">
              <span>{b.you.notes} <em className="opt">({b.you.optional})</em></span>
              <textarea className="input" name="notes" rows={3} />
              <span className="help">{b.you.notesHelp}</span>
            </label>
            <div className="field photos" data-photos hidden>
              <span id="photos-label">{b.you.photos} <em className="opt">({b.you.optional})</em></span>
              <ul className="photos__list" data-photo-list aria-labelledby="photos-label" />
              <label className="btn btn--ghost btn--sm scan__btn photos__add">
                <ImageIcon size={18} weight="light" aria-hidden />
                {b.you.photosAdd}
                <input className="sr-only" type="file" accept="image/*" multiple data-photo-input />
              </label>
              <span className="help">{b.you.photosHelp}</span>
              <span className="help" data-photo-status aria-live="polite" />
              <input type="hidden" name="photos" />
            </div>
            <label className="remember" data-remember hidden>
              <input type="checkbox" name="remember" defaultChecked />
              <span>{b.remember.label}<span className="help">{b.remember.help}</span></span>
            </label>
          </fieldset>

          {/* 5 · Confirm */}
          <fieldset className="step" data-step="4">
            <legend className="step__title d3" tabIndex={-1}>{b.titles[4]}</legend>
            <dl className="review" data-review hidden>
              {b.confirm.summary.map((k, i) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd data-review-v={i} />
                  <dd><button className="edit link" type="button" data-goto={[0, 1, 2, 3, 3][i]}>{b.edit}</button></dd>
                </div>
              ))}
            </dl>
            <p className="note">{b.confirm.requestNote}</p>
            {business.booking.depositPercent ? (
              <div className="note deposit" data-deposit>
                <p className="deposit__due num" data-deposit-due>{b.confirm.depositSet(`${business.booking.depositPercent}%`)}</p>
                <p>{b.confirm.depositRest} <a className="link" href={href(lang, "/legal/terms")} target="_blank">{b.confirm.policy}</a></p>
              </div>
            ) : (
              <p className="note">{b.confirm.depositUnset}</p>
            )}
            <div className="card" data-card hidden>
              <p className="field"><span>{b.confirm.card}</span></p>
              <div id="card-field" className="card__field" />
              <p className="help">{b.confirm.cardSecure}</p>
            </div>
            {!business.booking.depositPercent && (
              <p className="note">{cancel ? b.confirm.cancelSet(cancel) : b.confirm.cancelUnset} <a className="link" href={href(lang, "/legal/terms")} target="_blank">{b.confirm.terms}</a></p>
            )}
          </fieldset>

          <div className="nav">
            <button className="btn btn--ghost" type="button" data-back hidden><ArrowLeft size={16} weight="bold" aria-hidden />{b.back}</button>
            <button className="btn btn--red" type="button" data-next hidden>{b.next}<ArrowRight size={16} weight="bold" className="arrow" aria-hidden /></button>
            <button className="btn btn--red" type="submit" data-submit>{b.confirm.submit}</button>
          </div>
        </form>

        <aside className="summary" aria-label={b.summary}>
          <div className="summary__card">
            <p className="label">{b.summary}</p>
            <p className="summary__service d4" data-sum-service>—</p>
            <p className="summary__price num" data-sum-price />
            <ul className="summary__facts">
              <li><MapPin size={18} weight="light" aria-hidden /><span data-sum-where>{b.travel}</span></li>
              <li><CalendarBlank size={18} weight="light" aria-hidden /><span data-sum-when>{b.when.notice}</span></li>
              <li><ShieldCheck size={18} weight="light" aria-hidden /><span>{t.business.warranty}</span></li>
            </ul>
          </div>
          <div className="summary__talk">
            <p>{b.ratherTalk}</p>
            <a className="link num" href={`tel:${business.phone.tel}`}>{business.phone.display}</a>
          </div>
        </aside>
      </div>
    </>
  );
}
