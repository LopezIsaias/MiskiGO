import { z } from 'zod'

export const checkoutItemSchema = z.object({
  productId: z.string().uuid('Producto inválido'),
  quantity: z.number().int().min(1, 'La cantidad mínima es 1'),
})

export const checkoutSchema = z.object({
  items: z.array(checkoutItemSchema).min(1, 'El carrito está vacío'),
  delivery_address: z.string().min(5, 'Ingresa una dirección de entrega válida'),
  delivery_notes: z.string().optional(),
  customer_note: z.string().optional(),
  payment_method: z.enum(['yape', 'transfer', 'wallet']),
  use_wallet: z.boolean(),
  proof_url: z.string().url().optional(),
})

export type CheckoutInput = z.infer<typeof checkoutSchema>
