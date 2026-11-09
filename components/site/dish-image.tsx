import Image from "next/image"
import { cn } from "@/lib/utils"

/** A dish photo cropped to a plate-like circle. Works with any square-ish photo. */
export function DishImage({
  src,
  alt,
  sizes,
  className,
  priority,
}: {
  src: string | null
  alt: string
  sizes: string
  className?: string
  priority?: boolean
}) {
  return (
    <div className={cn("plate relative aspect-square bg-paper", className)}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          loading={priority ? "eager" : undefined}
          fetchPriority={priority ? "high" : undefined}
          unoptimized={src.startsWith("data:")}
          className="object-cover"
        />
      ) : (
        <div aria-hidden className="absolute inset-[18%] rounded-full border border-dashed border-ink/20" />
      )}
    </div>
  )
}
