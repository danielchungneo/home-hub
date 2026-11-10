import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { inherits } from 'node:util'
import { EventEmitter } from 'node:events'
import { getCastAccessToken } from '../spotify/castToken'
import { config } from '../config'
import { discoverCastDevices, matchCastDevice, type CastDevice } from './discover'

const require = createRequire(import.meta.url)
const castv2 = require('castv2-client') as {
  Client: new () => CastClient
  Application: new (...args: unknown[]) => AppBase
  JsonController: new (...args: unknown[]) => JsonController
}

type CastClient = {
  connect: (opts: { host: string; port: number }, cb: () => void) => void
  launch: (app: unknown, cb: (err: Error | null, app: SpotifySession) => void) => void
  close: () => void
  on: (event: string, cb: (err: Error) => void) => void
}

type JsonController = EventEmitter & {
  send: (data: object) => void
  close: () => void
}

type AppBase = {
  createController: (Ctor: unknown) => SpotifyController
}

type SpotifyController = JsonController & {
  authenticate: (opts: { accessToken: string; deviceName: string }) => Promise<void>
}

type SpotifySession = {
  spotify: SpotifyController
}

const SPOTIFY_APP_ID = 'CC32E753'
const SPOTIFY_NS = 'urn:x-cast:com.spotify.chromecast.secure.v1'
const DEFAULT_CAST_PORT = 8009

function waitForMessage(
  controller: JsonController,
  types: string[],
  timeoutMs: number,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      controller.removeListener('message', onmessage)
      reject(new Error(`Timeout waiting for ${types.join('|')} (${timeoutMs}ms)`))
    }, timeoutMs)

    function onmessage(data: Record<string, unknown>) {
      const type = String(data.type ?? '')
      if (!types.includes(type)) return
      clearTimeout(timer)
      controller.removeListener('message', onmessage)
      resolve(data)
    }

    controller.on('message', onmessage)
  })
}

async function deviceAuthToken(castAccessToken: string, clientId: string, deviceId: string) {
  const res = await fetch('https://spclient.wg.spotify.com/device-auth/v1/refresh', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${castAccessToken}`,
      'Content-Type': 'text/plain;charset=UTF-8',
    },
    body: JSON.stringify({ clientId, deviceId }),
  })
  const text = await res.text()
  if (!text.trim().startsWith('{')) {
    throw new Error(`device-auth returned non-JSON (${res.status}): ${text.slice(0, 120)}`)
  }
  const data = JSON.parse(text) as { accessToken?: string; error?: string }
  if (!res.ok || !data.accessToken) {
    throw new Error(`device-auth failed: ${data.error ?? res.status}`)
  }
  return data.accessToken
}

function spotifyDeviceId(name: string) {
  return createHash('md5').update(name).digest('hex')
}

/**
 * Spotify Cast namespace uses typed messages (getInfoResponse / addUserResponse),
 * not castv2 requestId pairing — so we use JsonController + event waits.
 */
function SpotifyController(this: SpotifyController, client: unknown, sourceId: string, destinationId: string) {
  castv2.JsonController.call(this, client, sourceId, destinationId, SPOTIFY_NS)

  this.authenticate = async ({ accessToken, deviceName }) => {
    const deviceId = spotifyDeviceId(deviceName)
    console.log(`[music-agent] cast getInfo → ${deviceName}`)

    const infoWait = waitForMessage(this, ['getInfoResponse'], 10_000)
    this.send({
      type: 'getInfo',
      payload: {
        remoteName: deviceName,
        deviceID: deviceId,
        deviceAPI_isGroup: false,
      },
    })
    const infoMsg = await infoWait
    const payload = (infoMsg.payload as Record<string, unknown> | undefined) ?? infoMsg
    const clientId = String(payload.clientID ?? payload.clientId ?? '')
    const resolvedDeviceId = String(payload.deviceID ?? payload.deviceId ?? deviceId)
    if (!clientId) throw new Error('Cast getInfoResponse had no clientID')
    console.log(`[music-agent] cast getInfo ok deviceId=${resolvedDeviceId.slice(0, 8)}…`)

    const deviceToken = await deviceAuthToken(accessToken, clientId, resolvedDeviceId)
    console.log(`[music-agent] cast device-auth ok`)

    const addWait = waitForMessage(this, ['addUserResponse', 'addUserError'], 10_000)
    this.send({
      type: 'addUser',
      payload: {
        blob: deviceToken,
        token: deviceToken,
        tokenType: 'accesstoken',
      },
    })
    const addMsg = await addWait
    if (addMsg.type === 'addUserError') {
      throw new Error(`Cast addUserError: ${JSON.stringify(addMsg.payload ?? addMsg)}`)
    }
    console.log(`[music-agent] cast addUser ok`)
  }
}
inherits(SpotifyController, castv2.JsonController)

function SpotifyApplication(this: AppBase & { spotify: SpotifyController }, client: unknown, session: unknown) {
  castv2.Application.call(this, client, session)
  this.spotify = this.createController(SpotifyController)
}
inherits(SpotifyApplication, castv2.Application)
;(SpotifyApplication as unknown as { APP_ID: string }).APP_ID = SPOTIFY_APP_ID

function connectAndLaunch(host: string, port = DEFAULT_CAST_PORT): Promise<{ client: CastClient; app: SpotifySession }> {
  return new Promise((resolve, reject) => {
    const client = new castv2.Client()
    const timer = setTimeout(() => {
      try { client.close() } catch { /* ignore */ }
      reject(new Error(`Timed out connecting to Cast device at ${host}:${port}`))
    }, config.wakeTimeoutMs)

    client.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })

    client.connect({ host, port }, () => {
      client.launch(SpotifyApplication, (err, app) => {
        clearTimeout(timer)
        if (err) {
          try { client.close() } catch { /* ignore */ }
          reject(err)
          return
        }
        resolve({ client, app })
      })
    })
  })
}

async function resolveCastDevice(target: { name?: string; host?: string; port?: number }): Promise<CastDevice> {
  if (target.host) {
    const discovered = await discoverCastDevices(1500).catch(() => [] as CastDevice[])
    const match =
      discovered.find((d) => d.host === target.host) ||
      (target.name ? matchCastDevice(discovered, target.name) : null)
    return {
      name: match?.name ?? target.name ?? target.host,
      host: target.host,
      port: match?.port ?? target.port ?? DEFAULT_CAST_PORT,
      model: match?.model ?? 'Google Cast',
    }
  }

  const devices = await discoverCastDevices()
  const device = target.name ? matchCastDevice(devices, target.name) : null
  if (!device) {
    const names = devices.map((d) => d.name).join(', ') || 'none'
    throw new Error(`Cast speaker not found on the LAN (looking for "${target.name}"). Seen: ${names}`)
  }
  return device
}

/** Launch Spotify on a Cast speaker so it appears in Spotify Connect. */
export async function wakeCastSpeaker(target: { name?: string; host?: string; port?: number }): Promise<CastDevice> {
  const device = await resolveCastDevice(target)
  console.log(`[music-agent] cast connect ${device.name} @ ${device.host}:${device.port}`)

  const castToken = await getCastAccessToken()
  const { client, app } = await connectAndLaunch(device.host, device.port)
  console.log(`[music-agent] cast Spotify app launched on ${device.name}`)

  try {
    await app.spotify.authenticate({ accessToken: castToken, deviceName: device.name })
  } finally {
    try { client.close() } catch { /* ignore */ }
  }

  return device
}
