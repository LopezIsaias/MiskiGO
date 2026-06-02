-- ================================================================
-- 032 — Coordenadas de entrega por pedido (chinchetas en ruta)
-- ================================================================
-- Permite mostrar pines precisos en el mapa del repartidor en vez de
-- geocodificar la dirección de texto (CLAUDE.md §10). Se capturan en el
-- checkout vía geolocalización del navegador. Opcionales: si faltan,
-- la ruta cae al texto de delivery_address.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_lat numeric(10,7),
  ADD COLUMN IF NOT EXISTS delivery_lng numeric(10,7);
