"use client"

import Image from "next/image"
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { gsap } from "gsap"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { REDUCED_MOTION_QUERY, SCROLL_STAGE_QUERY, useMediaQuery } from "@/hooks/use-media-query"

/*
 * Dish Orbit Carousel
 *
 * A plated dish sits on a coloured placemat inside a slowly turning ring of
 * its ingredients. Changing dish swings the plate out along a wide arc while
 * the next one swings in from the other side, the title wipes word by word,
 * and the placemat takes the new dish's colour.
 *
 * Two interaction models, chosen by media query rather than device sniffing:
 *  - Large screens with motion allowed: the section pins and the page scroll
 *    steps through the dishes. It is finite: past the last dish the page simply
 *    carries on. No snapping, no wheel hijacking, no loop.
 *  - Everywhere else (phones, tablets, short windows, reduced motion): a normal
 *    section with swipe, arrow buttons and a thumbnail rail.
 *
 * Rapid changes never cut an animation off mid-swing: the running transition
 * is sped up and the newest target plays as soon as it lands.
 */

export type OrbitDish = {
  id: string
  title: string
  tagline: string
  image: string | null
  imageAlt: string
  /** Hex colour for the placemat. */
  accent: string
  /** Words for the slowly turning ring, e.g. the ingredients. */
  ring: string[]
}

export type DishOrbitCarouselProps = {
  dishes: OrbitDish[]
  /** Price, chips and buttons for a dish; rendered under the title. */
  renderDetails?: (dish: OrbitDish, index: number) => ReactNode
  eyebrow?: string
  /** Where the "skip" link should jump to, so nobody is trapped in the section. */
  skipTo?: string
  onChange?: (index: number) => void
  className?: string
  id?: string
}

const SCROLL_PER_DISH_SVH = 62
const SWING = 62 // degrees around the pivot below the plate
const SPIN = 110 // degrees the plate turns on itself while it swings

function ringText(words: string[]) {
  const base = (words.length ? words : ["Seasonal", "Cooked over fire"]).join("  ·  ").toUpperCase()
  // Repeat until it comfortably wraps the full circle.
  let out = base
  while (out.length < 90) out += "  ·  " + base
  return out + "  ·  "
}

export function DishOrbitCarousel({
  dishes,
  renderDetails,
  eyebrow = "On the pass tonight",
  skipTo,
  onChange,
  className,
  id,
}: DishOrbitCarouselProps) {
  const n = dishes.length
  const scrollMode = useMediaQuery(SCROLL_STAGE_QUERY)
  const reduced = useMediaQuery(REDUCED_MOTION_QUERY)
  const [index, setIndex] = useState(0)

  const trackRef = useRef<HTMLElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const discRef = useRef<HTMLDivElement>(null)
  const plates = useRef<(HTMLDivElement | null)[]>([])
  const rings = useRef<(HTMLDivElement | null)[]>([])
  const texts = useRef<(HTMLDivElement | null)[]>([])
  const details = useRef<(HTMLDivElement | null)[]>([])
  const railRef = useRef<HTMLDivElement>(null)

  const shown = useRef(0)
  const target = useRef(0)
  const tlRef = useRef<gsap.core.Timeline | null>(null)
  const lastDerived = useRef(0)
  const reducedRef = useRef(reduced)
  const onChangeRef = useRef(onChange)
  const dishesRef = useRef(dishes)
  // The swap reads the latest props through refs so its identity stays stable.
  useLayoutEffect(() => {
    reducedRef.current = reduced
    onChangeRef.current = onChange
    dishesRef.current = dishes
  })
  // Lets a finished transition start the next one without a self-referencing callback.
  const runRef = useRef<(from: number, to: number) => void>(() => {})

  /* ---------------------------------------------------------------- swap */

  const parts = useCallback((i: number) => {
    const text = texts.current[i]
    return {
      plate: plates.current[i],
      img: plates.current[i]?.querySelector<HTMLElement>("[data-plate-img]") ?? null,
      ring: rings.current[i],
      text,
      words: text ? Array.from(text.querySelectorAll<HTMLElement>("[data-word]")) : [],
      tagline: text?.querySelector<HTMLElement>("[data-tagline]") ?? null,
      detail: details.current[i],
    }
  }, [])

  const settle = useCallback(
    (to: number) => {
      for (let i = 0; i < n; i++) {
        const p = parts(i)
        const on = i === to
        gsap.set([p.plate, p.ring, p.text, p.detail], { autoAlpha: on ? 1 : 0, clearProps: "transform" })
        gsap.set(p.img, { rotation: 0 })
        gsap.set(p.words, { yPercent: 0 })
        gsap.set(p.tagline, { autoAlpha: 1, y: 0 })
      }
      const accent = dishesRef.current[to]?.accent
      if (accent) {
        gsap.set(discRef.current, { backgroundColor: accent })
        gsap.set(rootRef.current, { "--tint": accent })
      }
      shown.current = to
    },
    [n, parts],
  )

  const run = useCallback(
    (from: number, to: number) => {
      if (from === to) return
      const a = parts(from)
      const b = parts(to)
      const d = to > from ? 1 : -1
      const accent = dishesRef.current[to]?.accent ?? "#ddd"

      if (reducedRef.current) {
        // Reduced motion: a short cross-fade, nothing moves.
        const tl = gsap.timeline({
          onComplete: () => {
            tlRef.current = null
            settle(to)
            if (target.current !== to) runRef.current(to, target.current)
          },
        })
        tlRef.current = tl
        tl.to([a.plate, a.ring, a.text, a.detail], { autoAlpha: 0, duration: 0.18 }, 0)
          .to(discRef.current, { backgroundColor: accent, duration: 0.3 }, 0)
          .to(rootRef.current, { "--tint": accent, duration: 0.3 }, 0)
          .fromTo([b.plate, b.ring, b.text, b.detail], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.22 }, 0.12)
        return
      }

      gsap.set(b.words, { yPercent: 110 })
      const tl = gsap.timeline({
        defaults: { overwrite: "auto" },
        onComplete: () => {
          tlRef.current = null
          shown.current = to
          if (target.current !== to) runRef.current(to, target.current)
        },
      })
      tlRef.current = tl

      // Plate: out along the arc, spinning on itself; the next swings in from the other side.
      tl.to(a.plate, { rotation: -SWING * d, duration: 0.62, ease: "power2.in" }, 0)
        .to(a.img, { rotation: -SPIN * d, duration: 0.62, ease: "power2.in" }, 0)
        .set(a.plate, { autoAlpha: 0 }, 0.62)
        .fromTo(b.plate, { autoAlpha: 1, rotation: SWING * d }, { rotation: 0, duration: 1.05, ease: "power3.out" }, 0.3)
        .fromTo(b.img, { rotation: SPIN * d }, { rotation: 0, duration: 1.05, ease: "power3.out" }, 0.3)

      // Ring of ingredients: cross-fade with a small counter-turn.
      tl.to(a.ring, { autoAlpha: 0, rotation: -14 * d, duration: 0.4, ease: "power1.in" }, 0)
        .fromTo(b.ring, { autoAlpha: 0, rotation: 14 * d }, { autoAlpha: 1, rotation: 0, duration: 0.9, ease: "power2.out" }, 0.45)

      // Placemat and section tint take the new colour.
      tl.to(discRef.current, { backgroundColor: accent, duration: 1, ease: "power1.inOut" }, 0.1).to(
        rootRef.current,
        { "--tint": accent, duration: 1, ease: "power1.inOut" },
        0.1,
      )

      // Title: words drop out of their masks, the new ones rise in.
      tl.to(a.words, { yPercent: -110, duration: 0.42, stagger: 0.035, ease: "power2.in" }, 0)
        .to(a.tagline, { autoAlpha: 0, y: -8, duration: 0.3, ease: "power1.in" }, 0.05)
        .set(a.text, { autoAlpha: 0 }, 0.5)
        .set(b.text, { autoAlpha: 1 }, 0.5)
        .to(b.words, { yPercent: 0, duration: 0.8, stagger: 0.06, ease: "power3.out" }, 0.5)
        .fromTo(b.tagline, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: "power2.out" }, 0.7)

      // Details: out, then in with a rise.
      tl.to(a.detail, { autoAlpha: 0, y: -6, duration: 0.28, ease: "power1.in" }, 0.05).fromTo(
        b.detail,
        { autoAlpha: 0, y: 14 },
        { autoAlpha: 1, y: 0, duration: 0.6, ease: "power2.out" },
        0.72,
      )
    },
    [parts, settle],
  )
  useLayoutEffect(() => {
    runRef.current = run
  }, [run])

  // Start in a known state, and re-settle if the layout model flips (resize, rotate).
  useLayoutEffect(() => {
    tlRef.current?.kill()
    tlRef.current = null
    settle(target.current)
  }, [settle, scrollMode])

  useEffect(() => () => void tlRef.current?.kill(), [])

  // React to index changes.
  useLayoutEffect(() => {
    target.current = index
    const tl = tlRef.current
    if (tl) {
      tl.timeScale(2.6) // hurry the current swing; the onComplete picks up the newest target
      return
    }
    run(shown.current, index)
  }, [index, run])

  const select = useCallback((next: number) => setIndex(next), [])

  const firstChange = useRef(true)
  useEffect(() => {
    if (firstChange.current) {
      firstChange.current = false
      return
    }
    onChangeRef.current?.(index)
  }, [index])

  /* ---------------------------------------------------------- scroll mode */

  const geometry = useCallback(() => {
    const track = trackRef.current
    if (!track) return null
    const rect = track.getBoundingClientRect()
    const total = track.offsetHeight - window.innerHeight
    return { rect, total, top: rect.top + window.scrollY }
  }, [])

  useEffect(() => {
    if (!scrollMode || n < 2) return
    let raf = 0
    const update = () => {
      raf = 0
      const g = geometry()
      if (!g || g.total <= 0) return
      const progress = Math.min(1, Math.max(0, -g.rect.top / g.total))
      const derived = Math.min(n - 1, Math.floor(progress * n))
      // Only follow the scroll when it crosses into a new stretch, so a click
      // on the rail isn't immediately overridden by a tiny scroll.
      if (derived !== lastDerived.current) {
        lastDerived.current = derived
        select(derived)
      }
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [scrollMode, n, geometry, select])

  /** Jump to a dish. While pinned, also move the scroll to that dish's stretch (invisible: the stage is sticky). */
  const go = useCallback(
    (to: number) => {
      const next = Math.max(0, Math.min(n - 1, to))
      if (scrollMode) {
        const g = geometry()
        if (g && g.total > 0 && g.rect.top <= 1 && g.rect.bottom >= window.innerHeight - 1) {
          lastDerived.current = next
          window.scrollTo({ top: g.top + ((next + 0.5) / n) * g.total, behavior: "instant" })
        }
      }
      select(next)
    },
    [n, scrollMode, geometry, select],
  )

  // Keep the active thumbnail in view without scrolling the page.
  useEffect(() => {
    const rail = railRef.current
    const el = rail?.querySelector<HTMLElement>(`[data-rail="${index}"]`)
    if (!rail || !el) return
    const left = el.offsetLeft - rail.clientWidth / 2 + el.clientWidth / 2
    rail.scrollTo({ left, behavior: reduced ? "auto" : "smooth" })
  }, [index, reduced])

  /* -------------------------------------------------------- touch & keys */

  const swipe = useRef<{ x: number; y: number; id: number } | null>(null)
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") return
    swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
  }
  const onPointerUp = (e: React.PointerEvent) => {
    const s = swipe.current
    swipe.current = null
    if (!s || s.id !== e.pointerId) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) go(index + (dx < 0 ? 1 : -1))
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault()
      go(index + 1)
    } else if (e.key === "ArrowLeft") {
      e.preventDefault()
      go(index - 1)
    }
  }

  if (n === 0) return null
  const current = dishes[Math.min(index, n - 1)]
  const trackStyle = { "--track-h": `calc(100svh + ${(n - 1) * SCROLL_PER_DISH_SVH}svh)` } as CSSProperties

  return (
    <section
      ref={trackRef}
      id={id}
      aria-roledescription="carousel"
      aria-label="Dishes"
      className={cn("relative [overflow-x:clip]", n > 1 && "scrolly:h-(--track-h)", className)}
      style={trackStyle}
    >
      <div
        ref={rootRef}
        className="relative scrolly:sticky scrolly:top-0 scrolly:h-svh scrolly:overflow-hidden"
        style={{ "--tint": dishes[0].accent } as CSSProperties}
      >
        {/* Section wash: a whisper of the dish colour over the paper. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[color-mix(in_oklab,var(--tint)_16%,var(--bone))]"
        />

        <div className="relative mx-auto grid max-w-[1440px] gap-y-14 px-4 pt-20 pb-12 sm:px-8 lg:h-full lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-center lg:gap-x-12 lg:px-12 lg:pt-28 lg:pb-28 scrolly:pt-24 scrolly:pb-32">
          {/* ------------------------------------------------ text column */}
          <div className="order-2 min-w-0 lg:order-1">
            <div className="mb-5 hidden items-center gap-4 lg:flex">
              <span className="eyebrow text-ink-soft">{eyebrow}</span>
              <span aria-hidden className="h-px w-10 bg-ink/25" />
              <span className="eyebrow tabular text-ink">
                {String(index + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}
              </span>
            </div>

            <div className="grid">
              {dishes.map((dish, i) => (
                <div
                  key={dish.id}
                  ref={(el) => {
                    texts.current[i] = el
                  }}
                  className="[grid-area:1/1]"
                  style={{ visibility: i === 0 ? "visible" : "hidden" }}
                  aria-hidden={i !== index}
                >
                  <h3 className="font-display text-[clamp(2.4rem,10.5vw,3.4rem)] leading-[0.95] font-[420] tracking-[-0.02em] text-balance text-ink lg:text-[clamp(3rem,5.4vw,5.75rem)]">
                    {dish.title.split(" ").map((word, w, all) => (
                      <span key={w}>
                        <span className="inline-block overflow-hidden pb-[0.08em] align-top">
                          <span data-word className="inline-block will-change-transform">
                            {word}
                          </span>
                        </span>
                        {/* A real space keeps the heading readable to screen readers and copy/paste. */}
                        {w < all.length - 1 ? " " : null}
                      </span>
                    ))}
                  </h3>
                  <p data-tagline className="mt-3 max-w-md text-base text-ink-soft sm:text-lg lg:mt-5 lg:text-xl">
                    {dish.tagline}
                  </p>
                </div>
              ))}
            </div>

            {renderDetails ? (
              <div className="mt-6 grid lg:mt-8">
                {dishes.map((dish, i) => (
                  <div
                    key={dish.id}
                    ref={(el) => {
                      details.current[i] = el
                    }}
                    className="[grid-area:1/1]"
                    style={{ visibility: i === 0 ? "visible" : "hidden" }}
                    // Inert keeps hidden buttons out of the tab order and away from screen readers.
                    inert={i !== index}
                  >
                    {renderDetails(dish, i)}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* ------------------------------------------------ stage */}
          <div className="order-1 min-w-0 lg:order-2">
            <div className="mb-[12vw] flex items-center justify-between sm:mb-16 lg:hidden">
              <span className="eyebrow text-ink-soft">{eyebrow}</span>
              <span className="eyebrow tabular text-ink">
                {String(index + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}
              </span>
            </div>

            <div
              role="group"
              aria-label={`${current.title}, dish ${index + 1} of ${n}. Use the arrow keys to change dish.`}
              tabIndex={0}
              onKeyDown={onKeyDown}
              onPointerDown={onPointerDown}
              onPointerUp={onPointerUp}
              onPointerCancel={() => (swipe.current = null)}
              className="relative mx-auto aspect-square w-[min(74vw,400px,50svh)] touch-pan-y select-none sm:w-[min(70vw,500px,58svh)] lg:w-[min(40vw,600px,58svh)] rounded-full focus-visible:outline-offset-8"
            >
              {/* Placemat */}
              <div
                ref={discRef}
                aria-hidden
                className="absolute inset-[-6%] translate-x-[4%] translate-y-[3%] rounded-full"
                style={{ backgroundColor: dishes[0].accent }}
              />
              {/* Ingredient rings */}
              {dishes.map((dish, i) => (
                <div
                  key={dish.id}
                  ref={(el) => {
                    rings.current[i] = el
                  }}
                  aria-hidden
                  className="absolute inset-[-13%]"
                  style={{ visibility: i === 0 ? "visible" : "hidden" }}
                >
                  <svg viewBox="0 0 100 100" className="size-full motion-safe:animate-ring-spin">
                    <defs>
                      <path id={`ring-${dish.id}`} d="M50,50 m-46,0 a46,46 0 1,1 92,0 a46,46 0 1,1 -92,0" />
                    </defs>
                    <text className="fill-ink/55 text-[2.55px] font-semibold tracking-[0.18em]">
                      <textPath href={`#ring-${dish.id}`} textLength={289} lengthAdjust="spacing">
                        {ringText(dish.ring)}
                      </textPath>
                    </text>
                  </svg>
                </div>
              ))}
              {/* Plates. The wrapper swings around a pivot far below; the image spins on itself. */}
              {dishes.map((dish, i) => (
                <div
                  key={dish.id}
                  ref={(el) => {
                    plates.current[i] = el
                  }}
                  className="absolute inset-0 origin-[50%_235%] will-change-transform"
                  style={{ visibility: i === 0 ? "visible" : "hidden" }}
                  aria-hidden={i !== index}
                >
                  <div data-plate-img className="plate relative size-full bg-paper">
                    {dish.image ? (
                      <Image
                        src={dish.image}
                        alt={dish.imageAlt || dish.title}
                        fill
                        sizes="(min-width: 1024px) 640px, 86vw"
                        loading={i === 0 ? "eager" : undefined}
                        unoptimized={dish.image.startsWith("data:")}
                        className="object-cover"
                        draggable={false}
                      />
                    ) : (
                      <div className="grid size-full place-items-center font-display text-2xl text-ink-soft">
                        {dish.title}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Mobile arrows sit on the placemat, away from the swipe-to-scroll gesture. */}
              {n > 1 ? (
                <div className="absolute inset-x-[-4%] bottom-[-2%] flex justify-between lg:hidden scrolly:hidden">
                  <button
                    type="button"
                    onClick={() => go(index - 1)}
                    disabled={index === 0}
                    aria-label="Previous dish"
                    className="grid size-12 place-items-center rounded-full bg-paper text-ink shadow-md ring-1 ring-ink/10 transition disabled:opacity-0"
                  >
                    <ArrowLeft className="size-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => go(index + 1)}
                    disabled={index === n - 1}
                    aria-label="Next dish"
                    className="grid size-12 place-items-center rounded-full bg-paper text-ink shadow-md ring-1 ring-ink/10 transition disabled:opacity-0"
                  >
                    <ArrowRight className="size-5" />
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* ------------------------------------------------ rail */}
        {n > 1 ? (
          <div className="relative mx-auto max-w-[1440px] px-4 pb-14 sm:px-8 lg:px-12 scrolly:absolute scrolly:inset-x-0 scrolly:bottom-0 scrolly:pb-7">
            <div className="flex items-end gap-6">
              <div
                ref={railRef}
                role="tablist"
                aria-label="Choose a dish"
                className="no-scrollbar -mx-1 flex min-w-0 flex-1 gap-1 overflow-x-auto px-1 py-1"
              >
                {dishes.map((dish, i) => (
                  <button
                    key={dish.id}
                    type="button"
                    role="tab"
                    data-rail={i}
                    aria-selected={i === index}
                    aria-label={dish.title}
                    onClick={() => go(i)}
                    className={cn(
                      "group flex shrink-0 items-center gap-2.5 rounded-full py-1.5 pr-4 pl-1.5 text-left transition-colors",
                      i === index ? "bg-ink text-paper" : "text-ink hover:bg-ink/5",
                    )}
                  >
                    <span className="relative size-9 shrink-0 overflow-hidden rounded-full bg-paper ring-1 ring-ink/10">
                      {dish.image ? (
                        <Image
                          src={dish.image}
                          alt=""
                          fill
                          sizes="36px"
                          unoptimized={dish.image.startsWith("data:")}
                          className="scale-[1.03] object-cover"
                        />
                      ) : null}
                    </span>
                    <span className="max-w-[9.5rem] truncate text-[0.8125rem] font-medium">{dish.title}</span>
                  </button>
                ))}
              </div>
              {skipTo ? (
                <a
                  href={skipTo}
                  className="hidden shrink-0 pb-3 text-[0.8125rem] font-medium text-ink-soft underline-offset-4 hover:text-ink hover:underline scrolly:inline"
                >
                  Skip to full menu
                </a>
              ) : null}
            </div>
            <div aria-hidden className="mt-3 hidden h-px w-full bg-ink/12 scrolly:block">
              <div
                className="h-px bg-ink transition-[width] duration-700 ease-out"
                style={{ width: `${((index + 1) / n) * 100}%` }}
              />
            </div>
          </div>
        ) : null}

        <p className="sr-only" aria-live="polite">
          {`Showing ${current.title}, ${index + 1} of ${n}`}
        </p>
      </div>
    </section>
  )
}

export default DishOrbitCarousel
