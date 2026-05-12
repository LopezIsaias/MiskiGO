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
        const clamped = Math.min(Math.max(Math.round(quantity), 1), Math.floor(itemData.maxQuantity))
        const existing = items.find(i => i.productId === itemData.productId)
        if (existing) {
          const newQty = Math.min(existing.quantity + clamped, Math.floor(itemData.maxQuantity))
          set({ items: items.map(i => i.productId === itemData.productId ? { ...i, quantity: newQty } : i) })
        } else {
          set({ items: [...items, { ...itemData, quantity: clamped }] })
        }
      },

      updateQuantity(productId, quantity) {
        const { items } = get()
        const rounded = Math.round(quantity)
        if (rounded < 1) {
          set({ items: items.filter(i => i.productId !== productId) })
        } else {
          set({
            items: items.map(i =>
              i.productId === productId
                ? { ...i, quantity: Math.min(rounded, Math.floor(i.maxQuantity)) }
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
