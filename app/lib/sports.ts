import {
  BarbellIcon,
  BasketballIcon,
  BicycleIcon,
  BoatIcon,
  CricketIcon,
  FeatherIcon,
  FirstAidIcon,
  FlameIcon,
  FlowerLotusIcon,
  FootprintsIcon,
  GolfIcon,
  HandGrabbingIcon,
  HeartbeatIcon,
  LightningIcon,
  MonitorPlayIcon,
  MountainsIcon,
  MusicNotesIcon,
  PathIcon,
  PersonSimpleBikeIcon,
  PersonSimpleHikeIcon,
  PersonSimpleIcon,
  PersonSimpleRunIcon,
  PersonSimpleSkiIcon,
  PersonSimpleSnowboardIcon,
  PersonSimpleSwimIcon,
  PersonSimpleTaiChiIcon,
  PersonSimpleWalkIcon,
  PingPongIcon,
  PulseIcon,
  RacquetIcon,
  SailboatIcon,
  SneakerIcon,
  SneakerMoveIcon,
  SnowflakeIcon,
  SoccerBallIcon,
  StairsIcon,
  TennisBallIcon,
  TimerIcon,
  TreeEvergreenIcon,
  VolleyballIcon,
  WavesIcon,
  WheelchairIcon,
  WheelchairMotionIcon,
  WindIcon,
  type Icon,
} from "@phosphor-icons/react"

import { adaptToTheme } from "~/lib/color"
import type { Theme } from "~/lib/theme"

export type SportCategory =
  | "pie"
  | "ciclismo"
  | "agua"
  | "nieve"
  | "ruedas"
  | "gimnasio"
  | "raqueta"
  | "equipo"
  | "otros"

export interface Sport {
  /** Strava `sport_type`. */
  type: string
  label: string
  category: SportCategory
  /** Default color, tuned to glow on the night map. */
  color: string
  icon: Icon
}

export const CATEGORIES: { id: SportCategory; label: string }[] = [
  { id: "pie", label: "A pie" },
  { id: "ciclismo", label: "Ciclismo" },
  { id: "agua", label: "Agua" },
  { id: "nieve", label: "Nieve y hielo" },
  { id: "ruedas", label: "Patines y ruedas" },
  { id: "gimnasio", label: "Gimnasio y bienestar" },
  { id: "raqueta", label: "Raqueta" },
  { id: "equipo", label: "Equipo y otros" },
  { id: "otros", label: "Otras" },
]

/** The 56 `sport_type` values of the Strava API, grouped by category. */
export const SPORTS: Sport[] = [
  // A pie
  { type: "Run", label: "Carrera", category: "pie", color: "#ff7a6b", icon: PersonSimpleRunIcon },
  { type: "TrailRun", label: "Trail", category: "pie", color: "#ffa45c", icon: SneakerMoveIcon },
  { type: "VirtualRun", label: "Carrera virtual", category: "pie", color: "#ff9fa0", icon: MonitorPlayIcon },
  { type: "Walk", label: "Caminata", category: "pie", color: "#ffc95c", icon: PersonSimpleWalkIcon },
  { type: "Hike", label: "Senderismo", category: "pie", color: "#e9d45e", icon: PersonSimpleHikeIcon },

  // Ciclismo
  { type: "Ride", label: "Ciclismo", category: "ciclismo", color: "#5ef2a6", icon: PersonSimpleBikeIcon },
  { type: "MountainBikeRide", label: "Bici de montaña", category: "ciclismo", color: "#a9f25e", icon: MountainsIcon },
  { type: "GravelRide", label: "Gravel", category: "ciclismo", color: "#d2e86a", icon: PathIcon },
  { type: "EBikeRide", label: "Bici eléctrica", category: "ciclismo", color: "#5ef2d8", icon: LightningIcon },
  { type: "EMountainBikeRide", label: "BTT eléctrica", category: "ciclismo", color: "#7df2c0", icon: LightningIcon },
  { type: "VirtualRide", label: "Ciclismo virtual", category: "ciclismo", color: "#8de8be", icon: MonitorPlayIcon },
  { type: "Velomobile", label: "Velomóvil", category: "ciclismo", color: "#5ef27c", icon: BicycleIcon },
  { type: "Handcycle", label: "Handbike", category: "ciclismo", color: "#8ef2a2", icon: WheelchairMotionIcon },

  // Agua
  { type: "Swim", label: "Natación", category: "agua", color: "#4fd8f0", icon: PersonSimpleSwimIcon },
  { type: "Rowing", label: "Remo", category: "agua", color: "#5ab8ff", icon: BoatIcon },
  { type: "VirtualRow", label: "Remo virtual", category: "agua", color: "#82c6ff", icon: MonitorPlayIcon },
  { type: "Kayaking", label: "Kayak", category: "agua", color: "#4fa5f0", icon: BoatIcon },
  { type: "Canoeing", label: "Piragüismo", category: "agua", color: "#6d9dff", icon: BoatIcon },
  { type: "StandUpPaddling", label: "Paddle surf", category: "agua", color: "#5ed0f2", icon: WavesIcon },
  { type: "Surfing", label: "Surf", category: "agua", color: "#42e2e2", icon: WavesIcon },
  { type: "Kitesurf", label: "Kitesurf", category: "agua", color: "#7ae9ff", icon: WindIcon },
  { type: "Windsurf", label: "Windsurf", category: "agua", color: "#5cd2ff", icon: SailboatIcon },
  { type: "Sail", label: "Vela", category: "agua", color: "#8cb9ff", icon: SailboatIcon },

  // Nieve y hielo
  { type: "AlpineSki", label: "Esquí alpino", category: "nieve", color: "#b9d5ff", icon: PersonSimpleSkiIcon },
  { type: "BackcountrySki", label: "Esquí de travesía", category: "nieve", color: "#a6c2ff", icon: PersonSimpleSkiIcon },
  { type: "NordicSki", label: "Esquí nórdico", category: "nieve", color: "#c6e2ff", icon: TreeEvergreenIcon },
  { type: "Snowboard", label: "Snowboard", category: "nieve", color: "#a0b7ff", icon: PersonSimpleSnowboardIcon },
  { type: "Snowshoe", label: "Raquetas de nieve", category: "nieve", color: "#d3e4f5", icon: FootprintsIcon },
  { type: "IceSkate", label: "Patinaje sobre hielo", category: "nieve", color: "#bff0ff", icon: SnowflakeIcon },

  // Patines y ruedas
  { type: "InlineSkate", label: "Patinaje en línea", category: "ruedas", color: "#ff8ad8", icon: SneakerIcon },
  { type: "Skateboard", label: "Skate", category: "ruedas", color: "#ff6bd5", icon: SneakerIcon },
  { type: "RollerSki", label: "Roller ski", category: "ruedas", color: "#e68cff", icon: PersonSimpleSkiIcon },
  { type: "Wheelchair", label: "Silla de ruedas", category: "ruedas", color: "#ffa1e6", icon: WheelchairIcon },

  // Gimnasio y bienestar
  { type: "WeightTraining", label: "Pesas", category: "gimnasio", color: "#b38cff", icon: BarbellIcon },
  { type: "Crossfit", label: "Crossfit", category: "gimnasio", color: "#c48cff", icon: FlameIcon },
  { type: "Workout", label: "Entrenamiento", category: "gimnasio", color: "#a68cff", icon: HeartbeatIcon },
  { type: "HighIntensityIntervalTraining", label: "HIIT", category: "gimnasio", color: "#d18cff", icon: TimerIcon },
  { type: "Elliptical", label: "Elíptica", category: "gimnasio", color: "#9d9dff", icon: PulseIcon },
  { type: "StairStepper", label: "Escaladora", category: "gimnasio", color: "#b99cff", icon: StairsIcon },
  { type: "Yoga", label: "Yoga", category: "gimnasio", color: "#e1a8ff", icon: FlowerLotusIcon },
  { type: "Pilates", label: "Pilates", category: "gimnasio", color: "#d9b1ff", icon: PersonSimpleTaiChiIcon },
  { type: "PhysicalTherapy", label: "Fisioterapia", category: "gimnasio", color: "#c9b9ff", icon: FirstAidIcon },
  { type: "RockClimbing", label: "Escalada", category: "gimnasio", color: "#ffb86b", icon: HandGrabbingIcon },
  { type: "Dance", label: "Baile", category: "gimnasio", color: "#ff8cc6", icon: MusicNotesIcon },

  // Raqueta
  { type: "Tennis", label: "Tenis", category: "raqueta", color: "#dfff5e", icon: TennisBallIcon },
  { type: "Padel", label: "Pádel", category: "raqueta", color: "#c8f25e", icon: RacquetIcon },
  { type: "Badminton", label: "Bádminton", category: "raqueta", color: "#e9ff8a", icon: FeatherIcon },
  { type: "Squash", label: "Squash", category: "raqueta", color: "#f2e25e", icon: RacquetIcon },
  { type: "Racquetball", label: "Racquetball", category: "raqueta", color: "#f2c95e", icon: RacquetIcon },
  { type: "TableTennis", label: "Tenis de mesa", category: "raqueta", color: "#ffd35e", icon: PingPongIcon },
  { type: "Pickleball", label: "Pickleball", category: "raqueta", color: "#d3f28a", icon: PingPongIcon },

  // Equipo y otros
  { type: "Soccer", label: "Fútbol", category: "equipo", color: "#7cf28c", icon: SoccerBallIcon },
  { type: "Basketball", label: "Baloncesto", category: "equipo", color: "#ff9a5e", icon: BasketballIcon },
  { type: "Volleyball", label: "Voleibol", category: "equipo", color: "#ffd08a", icon: VolleyballIcon },
  { type: "Cricket", label: "Críquet", category: "equipo", color: "#e7c98a", icon: CricketIcon },
  { type: "Golf", label: "Golf", category: "equipo", color: "#9ff25e", icon: GolfIcon },
]

/** Fallback for sport types Strava adds after this list was written. */
export const OTHER_SPORT: Sport = {
  type: "Other",
  label: "Otra actividad",
  category: "otros",
  color: "#a3bdb5",
  icon: PersonSimpleIcon,
}

const BY_TYPE = new Map(SPORTS.map((sport) => [sport.type, sport]))

export function getSport(type: string): Sport {
  return BY_TYPE.get(type) ?? { ...OTHER_SPORT, type, label: humanize(type) }
}

export function isKnownSport(type: string) {
  return BY_TYPE.has(type)
}

/** The distinct sport types in `types`, most frequent first. */
export function sportsByUse(types: string[]) {
  const counts = new Map<string, number>()
  for (const type of types) counts.set(type, (counts.get(type) ?? 0) + 1)
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .map(([type]) => type)
}

/** "BackcountrySki" -> "Backcountry ski", for types this list does not know. */
function humanize(type: string) {
  const words = type.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export type SportColors = Record<string, string>

/** Color for a sport in a theme, honouring the user's overrides. */
export function sportColor(
  type: string,
  theme: Theme,
  overrides?: SportColors
) {
  return adaptToTheme(overrides?.[type] ?? getSport(type).color, theme)
}

/** Swatches offered in the color picker; all of them glow on the night map. */
export const SWATCHES = [
  "#5ef2a6",
  "#a9f25e",
  "#dfff5e",
  "#ffc95c",
  "#ffa45c",
  "#ff7a6b",
  "#ff6bd5",
  "#c48cff",
  "#8c9dff",
  "#5ab8ff",
  "#4fd8f0",
  "#e3f1ec",
]
