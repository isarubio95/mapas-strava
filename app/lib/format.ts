const ES = "es-ES"

export function formatKm(meters: number, digits = meters >= 10_000 ? 0 : 1) {
  return (meters / 1000).toLocaleString(ES, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  })
}

export function formatHours(seconds: number) {
  const hours = seconds / 3600
  return hours.toLocaleString(ES, {
    maximumFractionDigits: hours >= 10 ? 0 : 1,
  })
}

export function formatCount(n: number) {
  return n.toLocaleString(ES)
}
