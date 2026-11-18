import { useMemo } from 'react'
import { qrDataUrl } from '../lib/qr'

type Props = {
  value: string
  size?: number
  className?: string
  alt?: string
}

/** Client-side QR image — works offline on the Pi (no api.qrserver.com). */
export function QrCode({ value, size = 360, className, alt = '' }: Props) {
  const src = useMemo(() => qrDataUrl(value), [value])
  return <img className={className} src={src} alt={alt} width={size} height={size} />
}
