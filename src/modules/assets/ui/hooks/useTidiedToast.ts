import { useEffect, useRef } from 'react'
import { useClient } from '@renderer/sdk'
import { useToast } from '@ui/overlays'
import { MODULE_ID, type AssetsFullApi } from '../../shared'

/** "Your library was tidied up. 3 assets recovered." once, the first time the page is open after a repair. */
export function useTidiedToast(active: boolean): void {
  const client = useClient<AssetsFullApi>(MODULE_ID)
  const toast = useToast()
  const asked = useRef(false)
  useEffect(() => {
    if (!active || asked.current) return
    asked.current = true
    client['library:tidied']()
      .then((tidied) => {
        if (!tidied) return
        const recovered = `${tidied.recovered} ${tidied.recovered === 1 ? 'asset' : 'assets'} recovered.`
        const setAside =
          tidied.setAside > 0
            ? ` ${tidied.setAside} could not be read and ${tidied.setAside === 1 ? 'was' : 'were'} set aside.`
            : ''
        toast.show({
          message: `Your library was tidied up. ${recovered}${setAside}`,
          durationMs: 8000
        })
      })
      .catch(() => undefined)
  }, [active, client, toast])
}
