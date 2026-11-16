import type { IconName } from '../components/Icon'

export type Weather = {
  temp: number
  high: number
  condition: string
  icon: IconName
  fetchedAt: number
}

export type GeoPlace = {
  id: number
  name: string
  label: string
  zip: string | null
  lat: number
  lon: number
  timezone: string | null
  detail: string
}

type GeocodeHit = {
  id: number
  name: string
  latitude: number
  longitude: number
  timezone?: string
  country_code?: string
  admin1?: string
  postcodes?: string[]
}

/** WMO weather interpretation codes → short copy. */
export function fromWeatherCode(code: number): { condition: string; icon: IconName } {
  if (code === 0) return { condition: 'Clear', icon: 'sun' }
  if (code <= 3) return { condition: 'Partly cloudy', icon: 'sun' }
  if (code <= 48) return { condition: 'Foggy', icon: 'sun' }
  if (code <= 67) return { condition: 'Rain', icon: 'sun' }
  if (code <= 77) return { condition: 'Snow', icon: 'sun' }
  if (code <= 82) return { condition: 'Showers', icon: 'sun' }
  if (code <= 86) return { condition: 'Snow showers', icon: 'sun' }
  if (code <= 99) return { condition: 'Thunderstorm', icon: 'sun' }
  return { condition: 'Outside', icon: 'sun' }
}

export async function fetchOpenMeteo(lat: number, lon: number, units: 'f' | 'c' = 'f'): Promise<Weather> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: 'temperature_2m,weather_code',
    daily: 'temperature_2m_max',
    temperature_unit: units === 'c' ? 'celsius' : 'fahrenheit',
    timezone: 'auto',
    forecast_days: '1',
  })
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
  if (!res.ok) throw new Error(`Weather request failed (${res.status})`)
  const data = await res.json() as {
    current?: { temperature_2m?: number; weather_code?: number }
    daily?: { temperature_2m_max?: number[] }
  }
  const temp = Math.round(data.current?.temperature_2m ?? 0)
  const high = Math.round(data.daily?.temperature_2m_max?.[0] ?? temp)
  const { condition, icon } = fromWeatherCode(data.current?.weather_code ?? 0)
  return { temp, high, condition, icon, fetchedAt: Date.now() }
}

/** City or US ZIP → places for the forecast. */
export async function searchPlaces(query: string): Promise<GeoPlace[]> {
  const name = query.trim()
  if (name.length < 2) return []
  const zipMatch = name.match(/^(\d{5})(?:-\d{4})?$/)
  if (zipMatch) return searchUsZip(zipMatch[1])
  return searchOpenMeteo(name)
}

/** Open-Meteo’s geocoder is weak on US ZIPs; Zippopotam is reliable for 5-digit codes. */
async function searchUsZip(zip: string): Promise<GeoPlace[]> {
  const res = await fetch(`https://api.zippopotam.us/us/${zip}`)
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`ZIP lookup failed (${res.status})`)
  const data = await res.json() as {
    places?: { 'place name': string; state: string; 'state abbreviation': string; latitude: string; longitude: string }[]
  }
  return (data.places ?? []).map((place, i) => {
    const abbrev = place['state abbreviation']
    const label = `${place['place name']}, ${abbrev}`
    return {
      id: Number(`${zip}${i}`),
      name: place['place name'],
      label,
      zip,
      lat: Number(place.latitude),
      lon: Number(place.longitude),
      timezone: null,
      detail: `${place.state} · ${zip}`,
    }
  })
}

async function searchOpenMeteo(name: string): Promise<GeoPlace[]> {
  const params = new URLSearchParams({
    name,
    count: '6',
    language: 'en',
    format: 'json',
  })
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`)
  if (!res.ok) throw new Error(`Location search failed (${res.status})`)
  const data = await res.json() as { results?: GeocodeHit[] }
  return (data.results ?? []).map((hit) => {
    const zip = hit.postcodes?.[0] ?? null
    const region = [hit.admin1, hit.country_code === 'US' ? null : hit.country_code].filter(Boolean).join(', ')
    const label = hit.admin1 ? `${hit.name}, ${hit.admin1}` : hit.name
    return {
      id: hit.id,
      name: hit.name,
      label,
      zip,
      lat: hit.latitude,
      lon: hit.longitude,
      timezone: hit.timezone ?? null,
      detail: [region, zip].filter(Boolean).join(' · ') || 'Match',
    }
  })
}
