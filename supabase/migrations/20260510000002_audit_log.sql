-- ================================================================
-- 002 — audit_log (append-only)
-- UPDATE y DELETE prohibidos a nivel de BD mediante triggers,
-- no solo a nivel de RLS, para garantizar la integridad del registro.
-- ================================================================

CREATE TABLE public.audit_log (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp      timestamptz NOT NULL DEFAULT now(),
  user_id        uuid        REFERENCES public.users(id),
  role_at_time   text        NOT NULL,
  action         text        NOT NULL,
  module         text        NOT NULL,
  region_id      uuid        REFERENCES public.regions(id),
  entity_type    text,
  entity_id      uuid,
  previous_value jsonb,
  new_value      jsonb,
  ip_address     inet,
  notes          text
);

CREATE INDEX idx_audit_log_user_id    ON public.audit_log(user_id);
CREATE INDEX idx_audit_log_timestamp  ON public.audit_log(timestamp DESC);
CREATE INDEX idx_audit_log_action     ON public.audit_log(action);
CREATE INDEX idx_audit_log_module     ON public.audit_log(module);
CREATE INDEX idx_audit_log_entity     ON public.audit_log(entity_type, entity_id)
  WHERE entity_type IS NOT NULL;

-- Inmutabilidad a nivel de BD: los triggers disparan incluso para service role
CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.raise_immutable_error();

CREATE TRIGGER audit_log_no_delete
  BEFORE DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.raise_immutable_error();

-- ─── RLS: audit_log ───────────────────────────────────────────────

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- INSERT: cualquier rol autenticado puede registrar eventos de auditoría
-- En la práctica, las escrituras se hacen desde el servidor con admin client
CREATE POLICY "audit_log_insert"
  ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (true);

-- SELECT: solo superadmin y region_operator pueden consultar el log
CREATE POLICY "audit_log_select"
  ON public.audit_log FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('superadmin','region_operator'));

-- Sin política UPDATE ni DELETE → prohibidos por RLS + reforzados por triggers
