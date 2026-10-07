import { TitleBar as TitleBarView } from '@ui/chrome'
import { useEffect, useState } from 'react'
import { APP_CONFIG } from '@shared/appConfig'

/**
 * The window's title bar wired to the real window (`window.api.window`). The look lives in
 * `@ui/chrome`; this wrapper only tracks maximised / focused state and forwards clicks.
 */
export function TitleBar({ floating }: { floating: boolean }) {
  const [maximized, setMaximized] = useState(false)
  const [inactive, setInactive] = useState(false)

  useEffect(() => {
    let alive = true
    void window.api.window.isMaximized().then((value) => {
      if (alive) setMaximized(value)
    })
    const unsubscribe = window.api.window.onMaximizedChange(setMaximized)
    const onBlur = (): void => setInactive(true)
    const onFocus = (): void => setInactive(false)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    return () => {
      alive = false
      unsubscribe()
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  return (
    <TitleBarView
      title={APP_CONFIG.appName}
      floating={floating}
      maximized={maximized}
      inactive={inactive}
      onMinimize={() => window.api.window.minimize()}
      onToggleMaximize={() => window.api.window.toggleMaximize()}
      onClose={() => window.api.window.close()}
    />
  )
}
