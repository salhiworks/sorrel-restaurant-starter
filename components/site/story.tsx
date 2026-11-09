"use client"

import Image from "next/image"
import { useStore } from "@/components/providers/store-provider"

export function Story() {
  const { settings } = useStore()
  if (!settings.storyTitle && !settings.storyBody) return null
  const paragraphs = settings.storyBody.split(/\n{2,}/).filter(Boolean)

  return (
    <section id="story" className="scroll-mt-16 bg-moss text-moss-ink">
      <div className="mx-auto grid max-w-[1440px] gap-12 px-4 py-20 sm:px-8 md:py-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20 lg:px-12">
        <div className="relative order-2 lg:order-1">
          <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem]">
            <Image
              src="/images/story/counter.webp"
              alt="The counter at night, lamps lit over the bar"
              fill
              sizes="(min-width: 1024px) 45vw, 92vw"
              className="object-cover"
            />
          </div>
          <div className="absolute -right-2 -bottom-8 w-[46%] overflow-hidden rounded-[1.5rem] ring-8 ring-moss sm:-right-6">
            <div className="relative aspect-[3/4]">
              <Image
                src="/images/story/dining-room.webp"
                alt="Hanging plants over the dining tables"
                fill
                sizes="(min-width: 1024px) 20vw, 44vw"
                className="object-cover"
              />
            </div>
          </div>
        </div>

        <div className="order-1 flex flex-col justify-center lg:order-2">
          <p className="eyebrow text-moss-ink/60">Our story</p>
          <h2 className="mt-4 font-display text-[clamp(2.4rem,6vw,4.25rem)] leading-[0.98] tracking-[-0.02em] text-balance">
            {settings.storyTitle}
          </h2>
          <div className="mt-8 max-w-xl space-y-5 text-[1.0625rem] leading-relaxed text-moss-ink/80">
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-moss-ink/15 pt-8">
            {[
              ["3", "boats we buy from"],
              ["1", "page of menu"],
              ["0", "freezers"],
            ].map(([n, label]) => (
              <div key={label}>
                <dt className="sr-only">{label}</dt>
                <dd>
                  <span className="block font-display text-5xl leading-none">{n}</span>
                  <span className="mt-2 block text-sm text-moss-ink/65">{label}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  )
}
