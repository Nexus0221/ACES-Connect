import { useRef, useState } from 'react'
import { Download, LogOut, X } from 'lucide-react'
import { Avatar } from './Avatar'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'

export type InstallInfo = {
  canPrompt: boolean
  standalone: boolean
  isIOS: boolean
  prompt: () => Promise<void>
}

type Props = {
  me: Profile
  email: string
  install: InstallInfo
  onClose: () => void
  onSaved: () => Promise<void>
  onSignOut: () => Promise<void>
}

export function ProfileModal({ me, email, install, onClose, onSaved, onSignOut }: Props) {
  const [name, setName] = useState(me.display_name)
  const [avatar, setAvatar] = useState(me.avatar_url)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function uploadAvatar(file: File) {
    setBusy(true)
    setError(null)
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `${me.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { contentType: file.type, cacheControl: '31536000' })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      setAvatar(data.publicUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not upload picture')
    } finally {
      setBusy(false)
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setBusy(true)
    setError(null)
    const { error: err } = await supabase
      .from('profiles')
      .update({ display_name: trimmed, avatar_url: avatar })
      .eq('id', me.id)
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    await onSaved()
    onClose()
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <header className="modal-head">
          <h2>Your profile</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </header>

        <div className="profile-pic">
          <Avatar name={name || me.display_name} src={avatar} size={88} />
          <button type="button" className="btn" onClick={() => fileRef.current?.click()} disabled={busy}>
            Change picture
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) uploadAvatar(f)
              e.target.value = ''
            }}
          />
        </div>

        <label>
          Display name
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required />
        </label>

        <p className="dim">Signed in as {email}</p>

        {!install.standalone && (
          <div className="install-box">
            <strong>Install ACES Connect</strong>
            {install.canPrompt ? (
              <button type="button" className="btn" onClick={install.prompt}>
                <Download size={16} />
                Install on this device
              </button>
            ) : install.isIOS ? (
              <p className="dim">
                In Safari, tap the Share button, then Add to Home Screen.
              </p>
            ) : (
              <p className="dim">
                Open your browser menu and choose Install app or Add to Home Screen.
              </p>
            )}
          </div>
        )}

        {error && <p className="form-error" role="alert">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn danger-outline" onClick={onSignOut}>
            <LogOut size={16} />
            Sign out
          </button>
          <button className="btn primary" disabled={busy}>
            Save changes
          </button>
        </div>
      </form>
    </div>
  )
}
