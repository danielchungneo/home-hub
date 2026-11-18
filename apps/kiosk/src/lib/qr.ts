import { renderSVG } from 'uqr'

/** Build a data-URL QR for kiosk modals — no external image host needed. */
export function qrDataUrl(value: string, border = 2): string {
  const svg = renderSVG(value, { border, ecc: 'M' })
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
