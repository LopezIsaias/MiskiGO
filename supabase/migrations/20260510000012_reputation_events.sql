-- ================================================================
-- 012 — reputation_events
-- En MVP: gestión manual por superadmin. La tabla ya está preparada
-- para automatización futura (CLAUDE.md § 10).
-- ================================================================

CREATE TABLE public.reputation_events (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES public.users(id),
  role             text        NOT NULL,
  event_type       text        NOT NULL,
  reference_id     uuid,
  points_delta     integer     NOT NULL,
  notes            text,
  is_exception     boolean     NOT NULL DEFAULT false,
  exception_reason text,
  created_by       uuid        REFERENCES public.users(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reputation_user_id   ON public.reputation_events(user_id);
CREATE INDEX idx_reputation_event_type ON public.reputation_events(event_type);
CREATE INDEX idx_reputation_created   ON public.reputation_events(created_at DESC);

-- ─── RLS: reputation_events ───────────────────────────────────────

ALTER TABLE public.reputation_events ENABLE ROW LEVEL SECURITY;

-- Solo superadmin y region_operator acceden al historial de reputación
CREATE POLICY "reputation_events_select"
  ON public.reputation_events FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('superadmin','region_operator'));

-- Solo superadmin registra eventos de reputación en MVP
CREATE POLICY "reputation_events_insert"
  ON public.reputation_events FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = 'superadmin');

-- Solo superadmin puede corregir excepciones (queda en audit_log)
CREATE POLICY "reputation_events_update"
  ON public.reputation_events FOR UPDATE TO authenticated
  USING  (public.get_user_role() = 'superadmin')
  WITH CHECK (public.get_user_role() = 'superadmin');
