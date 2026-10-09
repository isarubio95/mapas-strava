/**
 * Google encoded polyline algorithm (precision 5), the format Strava uses for
 * `map.summary_polyline`. Coordinates are [lat, lng] in the encoding but this
 * module speaks [lng, lat] to match deck.gl and MapLibre.
 */

export function decodePolyline(encoded: string): Float64Array {
  const coords: number[] = []
  let index = 0
  let lat = 0
  let lng = 0

  while (index < encoded.length) {
    let result = 0
    let shift = 0
    let byte: number
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20 && index < encoded.length)
    lat += result & 1 ? ~(result >> 1) : result >> 1

    result = 0
    shift = 0
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20 && index < encoded.length)
    lng += result & 1 ? ~(result >> 1) : result >> 1

    coords.push(lng / 1e5, lat / 1e5)
  }

  return Float64Array.from(coords)
}

function encodeValue(value: number) {
  let v = value < 0 ? ~(value << 1) : value << 1
  let output = ""
  while (v >= 0x20) {
    output += String.fromCharCode((0x20 | (v & 0x1f)) + 63)
    v >>= 5
  }
  return output + String.fromCharCode(v + 63)
}

/** Encodes interleaved [lng, lat, lng, lat, ...] coordinates. */
export function encodePolyline(coords: ArrayLike<number>): string {
  let output = ""
  let prevLat = 0
  let prevLng = 0
  for (let i = 0; i < coords.length; i += 2) {
    const lat = Math.round(coords[i + 1] * 1e5)
    const lng = Math.round(coords[i] * 1e5)
    output += encodeValue(lat - prevLat) + encodeValue(lng - prevLng)
    prevLat = lat
    prevLng = lng
  }
  return output
}
