import { useEffect, useState } from 'react'
import { Download, File as FileIcon, X } from 'lucide-react'
import type { Attachment } from '../lib/types'
import { formatBytes, getSignedUrl, kindOf, saveAttachment } from '../lib/files'

function useSignedUrl(path: string) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let alive = true
    getSignedUrl(path)
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [path])
  return { url, failed }
}

async function save(a: Attachment) {
  try {
    await saveAttachment(a)
  } catch {
    window.alert('Could not save this file. Check your connection and try again.')
  }
}

function SaveButton({ a }: { a: Attachment }) {
  return (
    <button className="save-btn" onClick={() => save(a)} aria-label={`Save ${a.name}`} title="Save">
      <Download size={16} />
    </button>
  )
}

function Lightbox({ a, url, onClose }: { a: Attachment; url: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="lightbox" onClick={onClose} role="dialog" aria-label={a.name}>
      <div className="lightbox-bar" onClick={(e) => e.stopPropagation()}>
        <span>{a.name}</span>
        <button className="btn primary small" onClick={() => save(a)}>
          <Download size={16} />
          Save original
        </button>
        <button className="icon-btn on-ink" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>
      </div>
      <img src={url} alt={a.name} onClick={(e) => e.stopPropagation()} />
    </div>
  )
}

export function AttachmentView({ a }: { a: Attachment }) {
  const kind = kindOf(a.mime)
  const { url, failed } = useSignedUrl(a.path)
  const [open, setOpen] = useState(false)

  if (kind === 'image') {
    return (
      <div className="att att-media">
        {url ? (
          <button className="att-image" onClick={() => setOpen(true)} aria-label={`View ${a.name}`}>
            <img src={url} alt={a.name} loading="lazy" />
          </button>
        ) : (
          <div className="att-skeleton">{failed ? 'Could not load image' : ''}</div>
        )}
        <SaveButton a={a} />
        {open && url && <Lightbox a={a} url={url} onClose={() => setOpen(false)} />}
      </div>
    )
  }

  if (kind === 'video') {
    return (
      <div className="att att-media">
        {url ? (
          <video src={`${url}#t=0.1`} controls playsInline preload="metadata" />
        ) : (
          <div className="att-skeleton">{failed ? 'Could not load video' : ''}</div>
        )}
        <SaveButton a={a} />
      </div>
    )
  }

  if (kind === 'audio') {
    return (
      <div className="att att-audio">
        {url ? <audio src={url} controls preload="metadata" /> : <div className="att-skeleton" />}
        <SaveButton a={a} />
      </div>
    )
  }

  return (
    <button className="att att-file" onClick={() => save(a)}>
      <FileIcon size={22} />
      <span className="att-file-text">
        <strong>{a.name}</strong>
        <small>{formatBytes(a.size)}</small>
      </span>
      <Download size={18} />
    </button>
  )
}
