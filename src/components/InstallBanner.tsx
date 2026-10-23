import { useState } from 'react'
import { Download, Share, WifiOff, X } from 'lucide-react'
import { useInstall, useOnline } from '../hooks/useInstall'

const KEY = 'aces:install-dismissed'
const WEEK = 7 * 24 * 60 * 60 * 1000

function dismissedRecently() {
  try {
    const t = Number(localStorage.getItem(KEY) ?? 0)
    return Date.now() - t < WEEK
  } catch {
    return false
  }
}

/** Offline notice + a small "install the app" card that fits each device. */
export function InstallBanner() {
  const install = useInstall()
  const online = useOnline()
  const [hidden, setHidden] = useState(dismissedRecently)

  const showInstall =
    !hidden && !install.standalone && (install.canPrompt || install.isIOS)

  function dismiss() {
    setHidden(true)
    try {
      localStorage.setItem(KEY, String(Date.now()))
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      {!online && (
        <div className="offline-bar" role="status">
          <WifiOff size={15} /> You're offline. Chat and calls need internet.
        </div>
      )}

      {showInstall && (
        <div className="install-banner" role="dialog" aria-label="Install ACES Connect">
          <img src="/pwa-192.png" alt="" width={44} height={44} />
          <div className="install-text">
            <strong>Install ACES Connect</strong>
            {install.canPrompt ? (
              <span>Open it like an app, right from your home screen or desktop.</span>
            ) : install.iosNeedsSafari ? (
              <span>Open this page in Safari, then tap Share → Add to Home Screen.</span>
            ) : (
              <span>
                Tap <Share size={13} style={{ verticalAlign: '-2px' }} /> Share, then{' '}
                <b>Add to Home Screen</b>.
              </span>
            )}
          </div>
          {install.canPrompt && (
            <button className="btn primary small" onClick={install.prompt}>
              <Download size={15} /> Install
            </button>
          )}
          <button className="icon-btn" onClick={dismiss} aria-label="Dismiss">
            <X size={18} />
          </button>
        </div>
      )}
    </>
  )
}
