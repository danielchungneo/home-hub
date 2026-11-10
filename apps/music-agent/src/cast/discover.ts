import Bonjour from 'bonjour-service'
import { config } from '../config'

export type CastDevice = {
  name: string
  host: string
  port: number
  model: string
}

/** Browse `_googlecast._tcp` on the LAN for a short window. */
export function discoverCastDevices(timeoutMs = config.castDiscoverMs): Promise<CastDevice[]> {
  return new Promise((resolve) => {
    const bonjour = new Bonjour()
    const found = new Map<string, CastDevice>()
    const browser = bonjour.find({ type: 'googlecast' })

    browser.on('up', (service) => {
      const host = service.referer?.address || service.addresses?.find((a) => a.includes('.')) || service.host
      if (!host) return
      const txt = (service.txt ?? {}) as Record<string, string>
      const name = txt.fn || service.name || host
      const model = txt.md || 'Google Cast'
      found.set(`${host}:${service.port}`, {
        name,
        host,
        port: service.port,
        model,
      })
    })

    setTimeout(() => {
      try { browser.stop() } catch { /* ignore */ }
      try { bonjour.destroy() } catch { /* ignore */ }
      resolve([...found.values()])
    }, timeoutMs)
  })
}

export function matchCastDevice(devices: CastDevice[], name: string) {
  const wanted = name.trim().toLowerCase()
  return (
    devices.find((d) => d.name.trim().toLowerCase() === wanted) ??
    devices.find((d) => d.name.trim().toLowerCase().includes(wanted) || wanted.includes(d.name.trim().toLowerCase())) ??
    null
  )
}
