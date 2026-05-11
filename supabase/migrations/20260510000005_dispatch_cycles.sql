-- ================================================================
-- 005 — dispatch_cycles
-- Ciclos: martes y viernes. Corte: día anterior 12:00 PM Lima.
-- UNIQUE(region_id, dispatch_date) evita duplicados por región/fecha.
-- ================================================================

CREATE TABLE public.dispatch_cycles (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id     uuid        NOT NULL REFERENCES public.regions(id),
  dispatch_date date        NOT NULL,
  cutoff_at     timestamptz NOT NULL,
  status        text        NOT NULL DEFAULT 'open'
                            CHECK (status IN ('open','closed','in_progress','completed')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (region_id, dispatch_date)
);

CREATE INDEX idx_dispatch_cycles_region_id     ON public.dispatch_cycles(region_id);
CREATE INDEX idx_dispatch_cycles_status        ON public.dispatch_cycles(status);
CREATE INDEX idx_dispatch_cycles_dispatch_date ON public.dispatch_cycles(dispatch_date DESC);

-- ─── RLS: dispatch_cycles ─────────────────────────────────────────

ALTER TABLE public.dispatch_cycles ENABLE ROW LEVEL SECURITY;

-- Todos los usuarios autenticados ven los ciclos (necesario para checkout)
CREATE POLICY "dispatch_cycles_select"
  ON public.dispatch_cycles FOR SELECT TO authenticated
  USING (true);

-- Operadores y superadmin crean y gestionan ciclos
CREATE POLICY "dispatch_cycles_insert"
  ON public.dispatch_cycles FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('superadmin','operator'));

CREATE POLICY "dispatch_cycles_update"
  ON public.dispatch_cycles FOR UPDATE TO authenticated
  USING  (public.get_user_role() IN ('superadmin','operator'))
  WITH CHECK (public.get_user_role() IN ('superadmin','operator'));
