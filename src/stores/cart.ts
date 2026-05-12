import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CartItem {
  productId: string
  name: string
  unit: string
  imageUrl: string | null
  quantity: number
  maxQuantity: number
  nearestCutoff: string
  deliveryLabel: string
  estimatedPrice: number
}

interface CartState {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'quantity'>, quantity: number) => void
  updateQuantity: (productId: string, quantity: number) => void
  removeItem: (productId: string) => void
  clearCart: () => void
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem(itemData, quantity) {
        const { items } = get()
        const clamped = Math.min(quantity, itemData.maxQuantity)
        const existing = items.find(i => i.productId === itemData.productId)
        if (existing) {
          const newQty = Math.min(existing.quantity + clamped, itemData.maxQuantity)
          set({ items: items.map(i => i.productId === itemData.productId ? { ...i, quantity: newQty } : i) })
        } else {
          set({ items: [...items, { ...itemData, quantity: clamped }] })
        }
      },

      updateQuantity(productId, quantity) {
        const { items } = get()
        if (quantity <= 0) {
          set({ items: items.filter(i => i.productId !== productId) })
        } else {
          set({
            items: items.map(i =>
              i.productId === productId
                ? { ...i, quantity: Math.min(quantity, i.maxQuantity) }
                : i
            ),
          })
        }
      },

      removeItem(productId) {
        set({ items: get().items.filter(i => i.productId !== productId) })
      },

      clearCart() {
        set({ items: [] })
      },
    }),
    { name: 'miski-cart' }
  )
)
