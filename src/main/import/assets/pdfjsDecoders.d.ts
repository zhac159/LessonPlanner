/** pdfjs-dist ships its stand-alone image decoders without type declarations; only the JPEG decoder is used. */
declare module 'pdfjs-dist/legacy/image_decoders/pdf.image_decoders.mjs' {
  export const JpegImage: new () => {
    parse(data: Uint8Array): void
    width: number
    height: number
    getData(options: { width: number; height: number; forceRGBA: boolean }): Uint8ClampedArray
  }
}
