import { useEffect, useRef, useState } from 'react'
import { ArrowUp, File as FileIcon, MessageCircle, Paperclip, X } from 'lucide-react'
import { formatBytes } from '../lib/files'

function PendingFile({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [preview, setPreview] = useState<string | null>(null)
  useEffect(() => {
    if (!file.type.startsWith('image/')) return
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  return (
    <div className="pending">
      {preview ? <img src={preview} alt="" /> : <FileIcon size={22} />}
      <span className="pending-text">
        <strong>{file.name}</strong>
        <small>{formatBytes(file.size)}</small>
      </span>
      <button className="icon-btn small" onClick={onRemove} aria-label={`Remove ${file.name}`}>
        <X size={16} />
      </button>
    </div>
  )
}

type Props = {
  roomName: string
  files: File[]
  sending: boolean
  onAddFiles: (files: File[]) => void
  onRemoveFile: (index: number) => void
  onSend: (text: string, files: File[]) => Promise<void>
}

/** Bottom bar from the wireframe: chat bubble, media, and the up-arrow send button. */
export function Composer({ roomName, files, sending, onAddFiles, onRemoveFile, onSend }: Props) {
  const [text, setText] = useState('')
  const taRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const canSend = (text.trim().length > 0 || files.length > 0) && !sending

  function resize() {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
  }

  async function submit() {
    if (!canSend) return
    const draft = text
    setText('')
    requestAnimationFrame(resize)
    try {
      await onSend(draft, files)
    } catch {
      setText(draft)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const touch = window.matchMedia('(pointer: coarse)').matches
    if (e.key === 'Enter' && !e.shiftKey && !touch) {
      e.preventDefault()
      submit()
    }
  }

  function onPaste(e: React.ClipboardEvent) {
    const pasted = Array.from(e.clipboardData.files)
    if (pasted.length) {
      e.preventDefault()
      onAddFiles(pasted)
    }
  }

  return (
    <div className="composer-wrap">
      {files.length > 0 && (
        <div className="pending-row">
          {files.map((f, i) => (
            <PendingFile key={`${f.name}-${i}`} file={f} onRemove={() => onRemoveFile(i)} />
          ))}
        </div>
      )}

      <div className="composer">
        <button
          className="icon-btn"
          onClick={() => taRef.current?.focus()}
          aria-label="Write a message"
        >
          <MessageCircle size={22} />
        </button>
        <button
          className="icon-btn"
          onClick={() => fileRef.current?.click()}
          aria-label="Attach photos, videos or files"
        >
          <Paperclip size={22} />
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            onAddFiles(Array.from(e.target.files ?? []))
            e.target.value = ''
          }}
        />

        <textarea
          ref={taRef}
          value={text}
          rows={1}
          placeholder={`Message ${roomName}`}
          onChange={(e) => {
            setText(e.target.value)
            resize()
          }}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          maxLength={4000}
        />

        <button className="send-btn" onClick={submit} disabled={!canSend} aria-label="Send">
          {sending ? <span className="spinner" /> : <ArrowUp size={22} />}
        </button>
      </div>
    </div>
  )
}
