import '@fontsource-variable/figtree'
import '../styles/tokens.css'
import { createRoot } from 'react-dom/client'
import { RenderApp } from './RenderApp'
import { getRenderBridge } from './bridge'

// No StrictMode here: effects must run exactly once per job or the report would be sent twice.
createRoot(document.getElementById('root')!).render(<RenderApp bridge={getRenderBridge()} />)
