import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> }

export type InstallInfo = {
  /** Browser offered a native install prompt (Chrome / Edge / Android / Samsung). */
  canPrompt: boolean
  /** Already running as an installed app. */
  standalone: boolean
  isIOS: boolean
  /** iPhone/iPad but NOT Safari (Chrome/Firefox/in-app browsers can't install on iOS). */
  iosNeedsSafari: boolean
  prompt: () => Promise<void>
}

export function useInstall(): InstallInfo {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setEvt(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setEvt(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const ua = navigator.userAgent
  const standalone =
    installed ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const iosNeedsSafari = isIOS && /CriOS|FxiOS|EdgiOS|OPiOS|FBAN|FBAV|Instagram|Line\//.test(ua)

  return {
    canPrompt: Boolean(evt),
    standalone,
    isIOS,
    iosNeedsSafari,
    prompt: async () => {
      if (!evt) return
      await evt.prompt()
      setEvt(null)
    },
  }
}

/** True while the device has a network connection. */
export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])
  return online
}
