'use client'

export interface ExifData {
  DateTimeOriginal?: string
  Make?: string
  Model?: string
  GPSLatitude?: number
  GPSLongitude?: number
  [key: string]: unknown
}

/** Extract EXIF from a File. Returns null if exifr fails or is unavailable. */
export async function extractExif(file: File): Promise<ExifData | null> {
  try {
    const exifr = await import('exifr')
    const data = await exifr.parse(file, {
      pick: ['DateTimeOriginal', 'Make', 'Model', 'GPSLatitude', 'GPSLongitude'],
    }) as ExifData | null
    return data ?? null
  } catch {
    return null
  }
}

/**
 * Returns how many hours ago the photo was taken, or null if unknown.
 * Uses DateTimeOriginal EXIF tag.
 */
export function photoAgeDiffHours(exif: ExifData | null): number | null {
  if (!exif?.DateTimeOriginal) return null
  const taken = new Date(exif.DateTimeOriginal)
  if (isNaN(taken.getTime())) return null
  return (Date.now() - taken.getTime()) / (1000 * 60 * 60)
}
