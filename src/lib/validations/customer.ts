import { z } from 'zod'

export const checkoutItemSchema = z.object({
  productId: z.string().uuid('Producto inválido'),
  quantity: z.number().int().min(1, 'La cantidad mínima es 1'),
})

export const checkoutSchema = z
  .object({
    items: z.array(checkoutItemSchema).min(1, 'El carrito está vacío'),
    delivery_address: z.string().min(5, 'Ingresa una dirección de entrega válida'),
    delivery_notes: z.string().optional(),
    customer_note: z.string().optional(),
    payment_method: z.enum(['yape', 'transfer', 'wallet']),
    use_wallet: z.boolean(),
    proof_url: z.string().url().optional(),
    // Datos de comprobante (boleta/factura)
    receipt_type: z.enum(['boleta', 'factura']),
    receipt_document: z.string().trim(),
    receipt_name: z.string().trim().min(3, 'Ingresa el nombre o razón social'),
  })
  .superRefine((data, ctx) => {
    if (data.receipt_type === 'boleta') {
      if (!/^\d{8}$/.test(data.receipt_document)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['receipt_document'],
          message: 'El DNI debe tener 8 dígitos',
        })
      }
    } else {
      if (!/^\d{11}$/.test(data.receipt_document)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['receipt_document'],
          message: 'El RUC debe tener 11 dígitos',
        })
      }
    }
  })

export type CheckoutInput = z.infer<typeof checkoutSchema>
