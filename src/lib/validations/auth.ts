import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Ingresa tu contraseña'),
})

const registerBaseSchema = z.object({
  role: z.enum(['supplier', 'customer']),
  full_name: z
    .string()
    .min(2, 'Nombre completo requerido')
    .max(100)
    .regex(/^[^\d]+$/, 'El nombre no debe contener números'),
  email: z.string().email('Email inválido'),
  phone: z
    .string()
    .min(9, 'Mínimo 9 dígitos')
    .max(15, 'Máximo 15 dígitos')
    .regex(/^\d+$/, 'Solo números, sin espacios ni caracteres especiales'),
  dni: z.string().regex(/^\d{8}$/, 'DNI debe tener 8 dígitos'),
  ruc: z
    .string()
    .optional()
    .refine(v => !v || /^\d{11}$/.test(v), { message: 'RUC debe tener 11 dígitos (solo números)' }),
  region_id: z.string().min(1, 'Selecciona una región'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  confirm_password: z.string().min(1, 'Confirma tu contraseña'),
})

export const registerSchema = registerBaseSchema.refine(
  data => data.password === data.confirm_password,
  { message: 'Las contraseñas no coinciden', path: ['confirm_password'] },
)

export const registerApiSchema = registerBaseSchema.omit({ confirm_password: true })

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type RegisterApiInput = z.infer<typeof registerApiSchema>
