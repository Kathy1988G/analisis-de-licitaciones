// @napi-rs/canvas expone DOMMatrix/DOMPoint/DOMRect en JS puro vía este subpath,
// pero no trae tipos para él. Declaramos lo mínimo que usamos.
declare module '@napi-rs/canvas/geometry.js' {
  export const DOMMatrix: typeof globalThis.DOMMatrix
  export const DOMPoint: typeof globalThis.DOMPoint
  export const DOMRect: typeof globalThis.DOMRect
}
