import { z } from 'zod'

// Percentages received as 0–100 from the form; the API divides by 100 before writing to DB.
// DB stores 0.0–1.0 (e.g. 25% → 0.25). CHECK constraint: > 0 AND < 1.
// Number fields use z.number() (not coerce) + valueAsNumber: true in the form register.

export const categorySchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres').max(60, 'Máximo 60 caracteres'),
  operational_cost_pct: z
    .number()
    .min(0.01, 'Debe ser mayor a 0')
    .max(99.99, 'Debe ser menor a 100'),
  suggested_margin_pct: z
    .number()
    .min(0.01, 'Debe ser mayor a 0')
    .max(99.99, 'Debe ser menor a 100'),
  estimated_waste_pct: z.number().min(0, 'Mínimo 0').max(99.99, 'Debe ser menor a 100'),
  is_active: z.boolean(),
})

export type CategoryInput = z.infer<typeof categorySchema>

export const productSchema = z.object({
  category_id: z.string().uuid('Selecciona una categoría válida'),
  name: z.string().min(2, 'Mínimo 2 caracteres').max(120, 'Máximo 120 caracteres'),
  description: z.string().max(500, 'Máximo 500 caracteres').optional(),
  unit: z.enum(['kg', 'unit', 'liter', 'bunch'], {
    message: 'Selecciona una unidad válida',
  }),
  image_url: z.string().url('URL inválida').optional().or(z.literal('')),
  is_active: z.boolean(),
})

export type ProductInput = z.infer<typeof productSchema>
