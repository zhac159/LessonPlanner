/**
 * [B] The deck model in words (design/deck-model.md), stable text placed in the cached prefix of every call that
 * writes or edits slides. Keep it in sync with src/shared/deck/types.ts.
 */
export const DECK_MODEL = `# Deck model

Slide size is 1920×1080 units, origin top-left. 1 pt of font size = 2 units of height. A deck is a list of slides.

Slide: { id, kind, layoutId?, background?, elements[], notes?, source? }
Slide kinds: title, do-now, objectives, key-words, content, question, activity, practical, check, plenary, exit-ticket, quiz, answers, section, custom.

Every element has: id (unique in the deck), type, x, y, w, h (units), and optionally rotation, locked, styleRef (component key in the style profile), name.
Elements are painted in array order (later = on top).
- text: role (title|kicker|subtitle|heading|body|caption|label), paragraphs [{ runs [{ text, bold?, italic?, underline?, color? }], list? (none|bullet|number|checkbox), level? (0-2) }], align?, valign?, fontSizePt?
- chips: items (strings)
- callout: variant (e.g. "mini-whiteboard", "do-now", "warning", "speech-bubble"), label?, paragraphs, tail? (speech-bubble only: bottom-left|bottom-right|top-left|top-right|left|right|none)
- image: placeholder { description, kind?, query? } for a picture spot (assetId is set by the app, never by you), fit (cover|contain), alt, radius?. An image with a placeholder and no assetId is an empty picture spot the teacher fills later; an image with an assetId is a picture from her assets
- diagram: svg (viewBox required; allowed tags svg g path rect circle ellipse line polyline polygon text tspan defs marker title desc; no scripts, images or external references; under 200 KB), alt
- shape: shape (rect|roundRect|ellipse|line|arrow), fill?, stroke?, radius?
- table: rows (string[][]), headerRow, colWidths? (must sum to w)

Colours are "token:<name>" (a colour of the style profile) or "#RRGGBB". Slides never use the app's own colours or fonts.
Text is plain text, never HTML.

Operations (the ONLY way to change a deck), as the ops of apply_changes:
- { op: "insertSlides", afterSlideId: string | null (null = at the start), slides: Slide[] }
- { op: "deleteSlides", slideIds: string[] }
- { op: "moveSlide", slideId, afterSlideId: string | null }
- { op: "replaceSlide", slide }  (same id)
- { op: "updateSlide", slideId, set: { kind?, layoutId?, background?, notes? } }
- { op: "addElement", slideId, element }
- { op: "updateElement", slideId, elementId, set: partial element fields }
- { op: "removeElement", slideId, elementId }
- { op: "setMeta", title?, meta?: { subject?, yearGroup?, durationMin?, ability?, targetSlideCount?, objectives?, context? } }

Ids you create must be new and unique (for example "s9" for a slide, "s9-title" for its title). Locked elements are style decorations: do not move, change or remove them unless the teacher explicitly asked.`
