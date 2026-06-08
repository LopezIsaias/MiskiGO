// Validación de la fecha de captura (EXIF DateTimeOriginal) de la foto de
// reclamo contra la ventana de entrega. Pura e isomórfica (cliente y servidor).
//
// La hora EXIF no tiene zona horaria: es la hora local de la cámara. Por eso se
// aplican tolerancias generosas en vez de comparaciones exactas.

export type PhotoVerification = 'valid' | 'too_old' | 'future' | 'unknown'

// La foto puede haberse tomado hasta 30 min antes de marcar la entrega (desfase
// de reloj / foto justo al recibir) y hasta 10 min "en el futuro".
export const PHOTO_BEFORE_TOLERANCE_MIN = 30
export const PHOTO_FUTURE_SKEW_MIN = 10

export interface PhotoCheck {
  verification: PhotoVerification
  takenAt:      string | null // ISO; null si la fecha es desconocida o ilegible
}

export function checkPhotoCaptureWindow(
  takenAtRaw:     string | Date | null | undefined,
  deliveredAtRaw: string | Date | null | undefined,
  now:            Date = new Date(),
): PhotoCheck {
  if (!takenAtRaw) return { verification: 'unknown', takenAt: null }
  const taken = takenAtRaw instanceof Date ? takenAtRaw : new Date(takenAtRaw)
  if (isNaN(taken.getTime())) return { verification: 'unknown', takenAt: null }

  const takenIso = taken.toISOString()

  if (taken.getTime() > now.getTime() + PHOTO_FUTURE_SKEW_MIN * 60_000) {
    return { verification: 'future', takenAt: takenIso }
  }

  if (deliveredAtRaw) {
    const delivered = deliveredAtRaw instanceof Date ? deliveredAtRaw : new Date(deliveredAtRaw)
    if (!isNaN(delivered.getTime())) {
      const floor = delivered.getTime() - PHOTO_BEFORE_TOLERANCE_MIN * 60_000
      if (taken.getTime() < floor) {
        return { verification: 'too_old', takenAt: takenIso }
      }
    }
  }

  return { verification: 'valid', takenAt: takenIso }
}

/** ¿La verificación debe impedir el envío del reclamo? */
export function blocksClaim(v: PhotoVerification): boolean {
  return v === 'too_old' || v === 'future'
}

export function photoVerificationMessage(v: PhotoVerification): string {
  switch (v) {
    case 'too_old':
      return 'La foto parece haber sido tomada antes de la entrega del pedido. Sube una foto del producto que acabas de recibir.'
    case 'future':
      return 'La fecha de la foto es inválida (posterior a la hora actual). Revisa la fecha y hora de tu dispositivo.'
    case 'unknown':
      return 'No se pudo leer la fecha de captura de la foto; el operador la revisará manualmente.'
    case 'valid':
      return ''
  }
}
