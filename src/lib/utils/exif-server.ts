// Extracción de EXIF en el servidor: descarga el archivo ya subido y lee su
// fecha real de captura. Es la fuente de verdad (el cliente puede manipular la
// metadata que envía). Solo debe importarse desde código de servidor.

export interface ServerExif {
  takenAt: string | null                  // ISO de DateTimeOriginal/CreateDate
  raw:     Record<string, unknown> | null // metadata cruda para auditoría
}

export async function extractExifFromUrl(url: string): Promise<ServerExif> {
  try {
    const res = await fetch(url)
    if (!res.ok) return { takenAt: null, raw: null }

    const buf = Buffer.from(await res.arrayBuffer())
    const exifr = await import('exifr')
    const data = (await exifr.parse(buf, {
      pick: ['DateTimeOriginal', 'CreateDate', 'Make', 'Model', 'GPSLatitude', 'GPSLongitude'],
    })) as Record<string, unknown> | null

    if (!data) return { takenAt: null, raw: null }

    const dto = (data.DateTimeOriginal ?? data.CreateDate) as Date | string | undefined
    let takenAt: string | null = null
    if (dto) {
      const d = dto instanceof Date ? dto : new Date(dto)
      if (!isNaN(d.getTime())) takenAt = d.toISOString()
    }

    return { takenAt, raw: data }
  } catch {
    return { takenAt: null, raw: null }
  }
}
