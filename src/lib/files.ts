import { supabase } from './supabase'
import type { Attachment } from './types'

export const BUCKET = 'attachments'
export const MAX_UPLOAD_MB = Number(import.meta.env.VITE_MAX_UPLOAD_MB ?? 50)

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let v = bytes / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[i]}`
}

export type Kind = 'image' | 'video' | 'audio' | 'file'

export function kindOf(mime: string): Kind {
  if (/^image\/(heic|heif)/i.test(mime)) return 'file' // most browsers can't display HEIC
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  return 'file'
}

/** Uploads the original, untouched file (no compression) to private storage. */
export async function uploadAttachment(file: File, userId: string): Promise<Attachment> {
  const safeName = file.name.replace(/[^\w.\-]+/g, '_')
  const path = `${userId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}`
  const mime = file.type || 'application/octet-stream'
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: mime,
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) throw error
  return { path, name: file.name, mime, size: file.size }
}

const cache = new Map<string, { url: string; exp: number }>()

/** Signed URLs last 1h; we cache them for 50 min. Pass `downloadAs` to force a download. */
export async function getSignedUrl(path: string, downloadAs?: string) {
  const key = `${path}|${downloadAs ?? ''}`
  const hit = cache.get(key)
  if (hit && hit.exp > Date.now()) return hit.url
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600, downloadAs ? { download: downloadAs } : undefined)
  if (error || !data) throw error ?? new Error('Could not create link')
  cache.set(key, { url: data.signedUrl, exp: Date.now() + 50 * 60 * 1000 })
  return data.signedUrl
}

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/**
 * Save an attachment to the device.
 * - iPhone/iPad photos & videos open the share sheet (→ "Save Image" / "Save Video" goes to Photos).
 * - Everything else downloads the original file.
 */
export async function saveAttachment(a: Attachment) {
  const kind = kindOf(a.mime)
  if (isIOS() && (kind === 'image' || kind === 'video') && 'canShare' in navigator) {
    try {
      const url = await getSignedUrl(a.path)
      const blob = await (await fetch(url)).blob()
      const file = new File([blob], a.name, { type: a.mime })
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] })
        return
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
  }
  const url = await getSignedUrl(a.path, a.name)
  const el = document.createElement('a')
  el.href = url
  el.download = a.name
  document.body.appendChild(el)
  el.click()
  el.remove()
}
