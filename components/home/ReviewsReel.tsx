"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Star } from "@phosphor-icons/react";
import type { ReviewSummary } from "@/lib/reviews";
import { dict, type Lang } from "@/lib/i18n";

/**
 * Reviews as a reel: a compact graphite panel over a slow WebGL "machined
 * silk" shader, with review cards drifting right to left. Each card fades in
 * at one edge, lifts toward the centre and fades out at the other, driven
 * by its distance from the centre (transform and opacity only).
 *
 * The reel pauses on hover, focus and drag (Tashii asked for no pause
 * button, 2026-09-27); the shader pauses off-screen and in background tabs; with
 * reduced motion nothing drifts and the row is simply scrollable.
 */
export function ReviewsReel({ lang, data }: { lang: Lang; data: ReviewSummary }) {
  const reviews = data.reviews;
  const t = dict(lang);
  const v = t.home.voices;
  const r = t.home.reel;
  const canvas = useRef<HTMLCanvasElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLUListElement>(null);
  const [still, setStill] = useState(false);

  // --- The shader ---------------------------------------------------------
  useEffect(() => {
    const c = canvas.current!;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const gl = c.getContext("webgl", { antialias: false, premultipliedAlpha: false, powerPreference: "low-power" });
    if (!gl) return; // the CSS gradient behind it stands in
    const vs = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
    const fs = `precision mediump float;
uniform vec2 r; uniform float t;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1.,0.)),u.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),u.x),u.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p*=2.02;a*=.5;}return v;}
void main(){
  vec2 uv=gl_FragCoord.xy/r;
  vec2 p=uv*vec2(r.x/r.y,1.)*1.5;
  float s=t*.045;
  vec2 q=vec2(fbm(p+vec2(0.,s)),fbm(p+vec2(5.2,1.3)-s));
  float f=fbm(p+2.2*q+vec2(1.7,9.2)+s*.6);
  vec3 base=vec3(.110,.122,.141);
  vec3 steel=vec3(.255,.268,.298);
  vec3 red=vec3(.784,.086,.114);
  vec3 col=mix(base,steel,smoothstep(.42,.95,f));
  col+=vec3(.9)*.05*smoothstep(.78,1.,f);
  col+=red*.20*smoothstep(.5,1.,q.x)*smoothstep(.9,.1,uv.y);
  col*=.86+.14*uv.y;
  gl_FragColor=vec4(col,1.);
}`;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uR = gl.getUniformLocation(prog, "r");
    const uT = gl.getUniformLocation(prog, "t");

    // Low resolution is plenty for a soft field, and keeps it cheap.
    const size = () => {
      const scale = Math.min(window.devicePixelRatio, 1.25) * 0.6;
      c.width = Math.max(1, Math.round(c.clientWidth * scale));
      c.height = Math.max(1, Math.round(c.clientHeight * scale));
      gl.viewport(0, 0, c.width, c.height);
      gl.uniform2f(uR, c.width, c.height);
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(c);

    let raf = 0;
    let visible = false;
    const t0 = performance.now();
    const draw = (now: number) => {
      gl.uniform1f(uT, reduce ? 12 : (now - t0) / 1000);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!reduce && visible && !document.hidden) raf = requestAnimationFrame(draw);
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible) raf = requestAnimationFrame(draw);
    });
    io.observe(c);
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (visible && !document.hidden) raf = requestAnimationFrame(draw);
    };
    document.addEventListener("visibilitychange", onVis);
    c.classList.add("is-live");
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // --- The reel ------------------------------------------------------------
  useEffect(() => {
    const vp = viewport.current!;
    const tr = track.current!;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    setStill(reduce);
    if (reduce) return; // a plain scrollable row

    const cards = [...tr.children] as HTMLElement[];
    const half = cards.length / 2; // the list is rendered twice for a seamless loop
    let loop = 0; // width of one copy
    const measure = () => {
      loop = cards[half].offsetLeft - cards[0].offsetLeft;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(tr);

    let x = 0;
    let last = performance.now();
    let hover = false;
    let drag: { id: number; start: number; from: number } | null = null;
    let raf = 0;
    let visible = false;
    const SPEED = 19; // px per second: slow enough to read

    const frame = (now: number) => {
      const dt = Math.min(64, now - last) / 1000;
      last = now;
      if (!hover && !drag) x -= SPEED * dt;
      if (loop > 0) {
        while (x <= -loop) x += loop;
        while (x > 0) x -= loop;
      }
      tr.style.transform = `translate3d(${x}px,0,0)`;
      // Fade and lift by distance from the centre of the window.
      const vw = vp.clientWidth;
      const mid = vw / 2;
      for (const card of cards) {
        const cx = card.offsetLeft + x + card.offsetWidth / 2;
        const d = Math.min(1, Math.abs(cx - mid) / (vw / 2 + card.offsetWidth * 0.2));
        const k = 1 - d * d;
        card.style.opacity = String(0.18 + 0.82 * k);
        card.style.transform = `translateY(${(1 - k) * 10}px) scale(${0.94 + 0.06 * k})`;
      }
      if (visible) raf = requestAnimationFrame(frame);
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    });
    io.observe(vp);

    const enter = () => (hover = true);
    const leave = () => (hover = false);
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      drag = { id: e.pointerId, start: e.clientX, from: x };
      vp.setPointerCapture(e.pointerId);
      vp.classList.add("is-dragging");
    };
    const move = (e: PointerEvent) => {
      if (drag && e.pointerId === drag.id) x = drag.from + (e.clientX - drag.start);
    };
    const up = (e: PointerEvent) => {
      if (drag && e.pointerId === drag.id) {
        drag = null;
        vp.classList.remove("is-dragging");
        if (vp.hasPointerCapture(e.pointerId)) vp.releasePointerCapture(e.pointerId);
      }
    };
    vp.addEventListener("pointerenter", enter);
    vp.addEventListener("pointerleave", leave);
    vp.addEventListener("focusin", enter);
    vp.addEventListener("focusout", leave);
    vp.addEventListener("pointerdown", down);
    vp.addEventListener("pointermove", move);
    vp.addEventListener("pointerup", up);
    vp.addEventListener("pointercancel", up);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      vp.removeEventListener("pointerenter", enter);
      vp.removeEventListener("pointerleave", leave);
      vp.removeEventListener("focusin", enter);
      vp.removeEventListener("focusout", leave);
      vp.removeEventListener("pointerdown", down);
      vp.removeEventListener("pointermove", move);
      vp.removeEventListener("pointerup", up);
      vp.removeEventListener("pointercancel", up);
    };
  }, []);

  const card = (rv: (typeof reviews)[number], copy: number, i: number) => (
    <li key={`${copy}-${i}`} className="rv__card" aria-hidden={copy > 0 ? true : undefined}>
      <span className="rv__stars" role="img" aria-label={r.stars(rv.rating)}>
        {[0, 1, 2, 3, 4].map((s) => <Star key={s} size={12} weight={s < rv.rating ? "fill" : "regular"} aria-hidden />)}
      </span>
      <blockquote className="rv__quote">{rv.text}</blockquote>
      <p className="rv__who"><span>{rv.author}</span>{rv.when && <> · {rv.when}</>}</p>
    </li>
  );

  return (
    <section className="rv page" aria-labelledby="rv-title" aria-roledescription={r.role}>
      <div className="rv__panel">
        <canvas ref={canvas} className="rv__shader" aria-hidden="true" />
        <div className="rv__head">
          <div className="rv__title">
            <p className="label">{v.label}</p>
            <h2 className="d3" id="rv-title">{v.title}</h2>
          </div>
          <div className="rv__meta">
            <span className="rv__stars rv__stars--big" role="img" aria-label={r.stars(data.rating)}>
              {[0, 1, 2, 3, 4].map((s) => <Star key={s} size={18} weight={s < Math.round(data.rating) ? "fill" : "regular"} aria-hidden />)}
            </span>
            <span className="rv__score num">{r.summary(data.rating.toFixed(1), data.count)}</span>
            {data.url && (
              <a className="rv__google" href={data.url} target="_blank" rel="noopener noreferrer">
                {r.onGoogle}<ArrowUpRight size={14} weight="bold" aria-hidden />
              </a>
            )}
          </div>
        </div>
        <div ref={viewport} className={`rv__viewport${still ? " is-still" : ""}`} tabIndex={0} aria-label={v.title}>
          <ul ref={track} className="rv__track">
            {reviews.map((rv, i) => card(rv, 0, i))}
            {!still && reviews.map((rv, i) => card(rv, 1, i))}
          </ul>
        </div>
      </div>
    </section>
  );
}
