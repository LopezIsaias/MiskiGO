-- ================================================================
-- 009 — delivery_routes & delivery_stops
-- Tras crear estas tablas, se recrean las políticas SELECT de
-- orders y order_items para añadir acceso filtrado por ruta al
-- rol delivery (CLAUDE.md: "delivery NUNCA ve pedidos fuera de
-- su ruta asignada").
-- ================================================================

-- ─── Table: delivery_routes ───────────────────────────────────────

CREATE TABLE public.delivery_routes (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_person_id  uuid        NOT NULL REFERENCES public.users(id),
  dispatch_cycle_id   uuid        NOT NULL REFERENCES public.dispatch_cycles(id),
  region_id           uuid        NOT NULL REFERENCES public.regions(id),
  status              text        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending','in_progress','completed')),
  optimized_route_url text,
  started_at          timestamptz,
  completed_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_delivery_routes_person_id ON public.delivery_routes(delivery_person_id);
CREATE INDEX idx_delivery_routes_cycle_id  ON public.delivery_routes(dispatch_cycle_id);
CREATE INDEX idx_delivery_routes_region_id ON public.delivery_routes(region_id);
CREATE INDEX idx_delivery_routes_status    ON public.delivery_routes(status);

-- ─── RLS: delivery_routes ─────────────────────────────────────────

ALTER TABLE public.delivery_routes ENABLE ROW LEVEL SECURITY;

-- Repartidor ve solo sus propias rutas
CREATE POLICY "delivery_routes_select"
  ON public.delivery_routes FOR SELECT TO authenticated
  USING (
    delivery_person_id = auth.uid()
    OR public.get_user_role() IN ('superadmin','region_operator','operator')
  );

-- Solo staff asigna rutas
CREATE POLICY "delivery_routes_insert"
  ON public.delivery_routes FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('superadmin','operator'));

-- Repartidor actualiza estado de su propia ruta; staff gestiona todo
CREATE POLICY "delivery_routes_update"
  ON public.delivery_routes FOR UPDATE TO authenticated
  USING (
    (delivery_person_id = auth.uid() AND public.get_user_role() = 'delivery')
    OR public.get_user_role() IN ('superadmin','operator')
  )
  WITH CHECK (
    (delivery_person_id = auth.uid() AND public.get_user_role() = 'delivery')
    OR public.get_user_role() IN ('superadmin','operator')
  );

-- ─── Table: delivery_stops ────────────────────────────────────────

CREATE TABLE public.delivery_stops (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id       uuid        NOT NULL REFERENCES public.delivery_routes(id),
  order_id       uuid        NOT NULL REFERENCES public.orders(id),
  stop_order     integer     NOT NULL CHECK (stop_order > 0),
  status         text        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','arrived','delivered','failed')),
  arrived_at     timestamptz,
  completed_at   timestamptz,
  failure_reason text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_delivery_stops_route_id ON public.delivery_stops(route_id);
CREATE INDEX idx_delivery_stops_order_id ON public.delivery_stops(order_id);
CREATE INDEX idx_delivery_stops_status   ON public.delivery_stops(status);

-- ─── RLS: delivery_stops ──────────────────────────────────────────

ALTER TABLE public.delivery_stops ENABLE ROW LEVEL SECURITY;

-- Repartidor ve las paradas de sus rutas; staff ve todas
CREATE POLICY "delivery_stops_select"
  ON public.delivery_stops FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.delivery_routes dr
      WHERE dr.id = delivery_stops.route_id
      AND (
        dr.delivery_person_id = auth.uid()
        OR public.get_user_role() IN ('superadmin','region_operator','operator')
      )
    )
  );

CREATE POLICY "delivery_stops_insert"
  ON public.delivery_stops FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('superadmin','operator'));

-- Repartidor marca llegada/entrega de sus propias paradas
CREATE POLICY "delivery_stops_update"
  ON public.delivery_stops FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.delivery_routes dr
      WHERE dr.id = delivery_stops.route_id
      AND (
        dr.delivery_person_id = auth.uid()
        OR public.get_user_role() IN ('superadmin','operator')
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.delivery_routes dr
      WHERE dr.id = delivery_stops.route_id
      AND (
        dr.delivery_person_id = auth.uid()
        OR public.get_user_role() IN ('superadmin','operator')
      )
    )
  );

-- ─── Actualizar SELECT de orders: añadir acceso de delivery ───────
-- Recrear la política definida en migración 006 para incluir el
-- filtro por ruta asignada que requería estas tablas.

DROP POLICY IF EXISTS "orders_select" ON public.orders;

CREATE POLICY "orders_select"
  ON public.orders FOR SELECT TO authenticated
  USING (
    customer_id = auth.uid()
    OR public.get_user_role() IN ('superadmin','region_operator')
    OR (public.get_user_role() = 'operator' AND region_id = public.get_user_region_id())
    OR (
      public.get_user_role() = 'delivery'
      AND EXISTS (
        SELECT 1 FROM public.delivery_stops ds
        JOIN public.delivery_routes dr ON dr.id = ds.route_id
        WHERE ds.order_id = orders.id
        AND dr.delivery_person_id = auth.uid()
      )
    )
  );

-- ─── Actualizar SELECT de order_items: añadir acceso de delivery ──

DROP POLICY IF EXISTS "order_items_select" ON public.order_items;

CREATE POLICY "order_items_select"
  ON public.order_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
      AND (
        o.customer_id = auth.uid()
        OR public.get_user_role() IN ('superadmin','region_operator')
        OR (public.get_user_role() = 'operator' AND o.region_id = public.get_user_region_id())
        OR (
          public.get_user_role() = 'delivery'
          AND EXISTS (
            SELECT 1 FROM public.delivery_stops ds
            JOIN public.delivery_routes dr ON dr.id = ds.route_id
            WHERE ds.order_id = o.id
            AND dr.delivery_person_id = auth.uid()
          )
        )
      )
    )
  );
