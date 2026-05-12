import { z } from 'zod'

export const publicationSchema = z.object({
  product_id: z.string().uuid('Selecciona un producto válido'),
  region_id: z.string().uuid('Selecciona una región válida'),
  available_quantity: z
    .number()
    .min(0.001, 'La cantidad debe ser mayor a 0'),
  minimum_price: z
    .number()
    .min(0.01, 'El precio mínimo debe ser mayor a 0'),
  expires_at: z.string().min(1, 'Selecciona el ciclo de despacho'),
})

export type PublicationInput = z.infer<typeof publicationSchema>
