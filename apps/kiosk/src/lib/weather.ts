import type { IconName } from '../components/Icon'

export type Weather = {
  temp: number
  high: number
  condition: string
  icon: IconName
  fetchedAt: number
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
