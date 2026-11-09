"use client"

/**
 * Resize and re-encode a photo in the browser before upload: phones produce
 * 5–12 MB images, and the site never shows dishes larger than ~1600px.
 * Square-crops dish photos around the centre so they sit well on the plate.
 */
export async function resizeImage(
  file: File,
  { max = 1600, square = false, quality = 0.84 }: { max?: number; square?: boolean; quality?: number } = {},
): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.")
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("That image couldn't be read. Try a JPG or PNG.")
  })
  let sx = 0
  let sy = 0
  let sw = bitmap.width
  let sh = bitmap.height
  if (square) {
    const side = Math.min(sw, sh)
    sx = (sw - side) / 2
    sy = (sh - side) / 2
    sw = sh = side
  }
  const scale = Math.min(1, max / Math.max(sw, sh))
  const w = Math.round(sw * scale)
  const h = Math.round(sh * scale)
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Your browser couldn't process the image.")
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, w, h)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality))
  if (blob && blob.type === "image/webp") return blob
  // Safari < 16 can't encode WebP.
  const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality))
  if (!jpeg) throw new Error("Your browser couldn't process the image.")
  return jpeg
}
