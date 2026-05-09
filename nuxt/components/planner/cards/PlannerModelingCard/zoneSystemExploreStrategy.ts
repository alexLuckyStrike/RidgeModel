// Конфигурация четырёхзонной системы

export type ZoneNumber = 1 | 2 | 3 | 4

export type ZoneInfo = {
  number: ZoneNumber
  name: string
  center: number // целевое PC₁ (центр зоны)
  drivingMarker: string // маркер, определяющий границу зоны
}

// Центры зон — целевые значения PC₁ для каждой зоны
// Зоны 2 и 3 — середины (между порогами)
// Зоны 1 и 4 — условные центры (зоны открыты с одной стороны)
export const ZONE_INFO: Record<ZoneNumber, ZoneInfo> = {
  1: {
    number: 1,
    name: 'Норма',
    center: -2.5,
    drivingMarker: 'креатинин',
  },
  2: {
    number: 2,
    name: 'Умеренный отклик',
    center: -0.66,
    drivingMarker: 'креатинин',
  },
  3: {
    number: 3,
    name: 'Выраженный отклик',
    center: 1.04,
    drivingMarker: 'миоглобин',
  },
  4: {
    number: 4,
    name: 'Критический отклик',
    center: 1.7,
    drivingMarker: 'креатинин',
  },
}

export const ZONE_NUMBERS: ZoneNumber[] = [1, 2, 3, 4]
