/** Stateful wrappers for the gallery: the kit's components are controlled, the gallery has no screen. */
import { useState } from 'react'
import { CorrectionBox, type CorrectionBoxProps } from './CorrectionBox/CorrectionBox'

/** A CorrectionBox that owns its text, starting from `initial`. */
export function CorrectionDemo({
  initial = '',
  ...rest
}: Partial<CorrectionBoxProps> & { initial?: string }) {
  const [value, setValue] = useState(initial)
  return <CorrectionBox value={value} onChange={setValue} onSubmit={() => {}} {...rest} />
}
