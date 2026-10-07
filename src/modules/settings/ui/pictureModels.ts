/**
 * The two picture-maker choices as the A7 Select shows them. The prices are the 2K list prices (the size the maker
 * asks for) rounded to cents; `pictureModels.test.ts` checks them against `PICTURE_PRICES_USD` in main, the one
 * place that holds model ids and prices, because the renderer cannot import main code.
 */
import type { PictureMakerModel } from '@shared/contracts/settings'

export interface PictureModelOption {
  value: PictureMakerModel
  label: string
  /** US dollars per picture at 2K, rounded to cents. */
  priceUsd: number
}

export const PICTURE_MODEL_OPTIONS: readonly PictureModelOption[] = [
  {
    value: 'gemini-3-pro-image',
    label: 'Nano Banana Pro — best quality (recommended)',
    priceUsd: 0.13
  },
  { value: 'gemini-nano-banana-2.1', label: 'Nano Banana 2.1 — faster and cheaper', priceUsd: 0.05 }
]

export const isPictureModel = (value: string): value is PictureMakerModel =>
  PICTURE_MODEL_OPTIONS.some((option) => option.value === value)

/** "About $0.13 a picture". */
export const priceNote = (model: PictureMakerModel): string => {
  const price = PICTURE_MODEL_OPTIONS.find((option) => option.value === model)?.priceUsd ?? 0
  return `About $${price.toFixed(2)} a picture`
}
