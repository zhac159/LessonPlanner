import { findComponent, resolveTextStyle } from '@shared/deck/textStyle'
import { readableOn } from '@shared/deck/colorGuards'
import { resolveColor } from '@shared/deck/tokens'
import type { TableElement } from '@shared/deck/types'
import { useSlideContext } from '../context'
import { slideFonts } from '../bundledFonts'

/** Plain table: header row in the chip colours (text guarded for contrast), cells in body text, hairlines in the placeholder tint. */
export function TableView({ element }: { element: TableElement }) {
  const { style } = useSlideContext()
  const key = element.styleRef ?? 'table'
  const text = resolveTextStyle(
    { role: 'body', styleRef: findComponent(style, key) ? key : 'body' },
    style
  )
  const line = resolveColor('token:placeholder', style)
  const headerFill = resolveColor('token:chipBg', style)
  // Her chip text and chip fill can both be white: the header text must still read on its fill.
  const header = {
    background: headerFill,
    color: readableOn(headerFill, [resolveColor('token:chipText', style), text.color])
  }
  const columns = Math.max(0, ...element.rows.map((r) => r.length))
  return (
    <table
      className="slide-table"
      style={{
        fontFamily: slideFonts.fontFamilyCss(text.font),
        fontSize: text.sizePt * 2,
        fontWeight: text.weight,
        color: text.color
      }}
    >
      {element.colWidths && (
        <colgroup>
          {element.colWidths.map((w, i) => (
            <col key={i} style={{ width: w }} />
          ))}
        </colgroup>
      )}
      <tbody>
        {element.rows.map((row, r) => {
          const isHeader = element.headerRow && r === 0
          const Cell = isHeader ? 'th' : 'td'
          return (
            <tr key={r}>
              {Array.from({ length: columns }, (_, c) => (
                <Cell
                  key={c}
                  scope={isHeader ? 'col' : undefined}
                  style={{
                    borderColor: line,
                    ...(isHeader ? { ...header, fontWeight: 700 } : null)
                  }}
                >
                  {row[c] ?? ''}
                </Cell>
              ))}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
