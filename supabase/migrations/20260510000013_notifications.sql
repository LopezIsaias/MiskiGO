-- ================================================================
-- 013 — notifications
-- MVP: canal whatsapp (manual). La tabla ya soporta push e in_app
-- para migración futura a WhatsApp Business API (CLAUDE.md § 10).
-- ================================================================

CREATE TABLE public.notifications (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id   uuid        NOT NULL REFERENCES public.users(id),
  type           text        NOT NULL,
  channel        text        NOT NULL CHECK (channel IN ('push','whatsapp','in_app')),
  title          text,
  body           text        NOT NULL CHECK (body <> ''),
  reference_type text,
  reference_id   uuid,
  status         text        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','sent','failed')),
  sent_at        timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_recipient ON public.notifications(recipient_id);
CREATE INDEX idx_notifications_status    ON public.notifications(status);
CREATE INDEX idx_notifications_type      ON public.notifications(type);
CREATE INDEX idx_notifications_created   ON public.notifications(created_at DESC);

-- ─── RLS: notifications ───────────────────────────────────────────

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Cada usuario ve solo sus propias notificaciones; staff ve todas
CREATE POLICY "notifications_select"
  ON public.notifications FOR SELECT TO authenticated
  USING (
    recipient_id = auth.uid()
    OR public.get_user_role() IN ('superadmin','region_operator','operator')
  );

-- Solo staff crea notificaciones (desde servidor con admin client)
CREATE POLICY "notifications_insert"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('superadmin','operator'));

-- Staff actualiza estado de envío
CREATE POLICY "notifications_update"
  ON public.notifications FOR UPDATE TO authenticated
  USING  (public.get_user_role() IN ('superadmin','operator'))
  WITH CHECK (public.get_user_role() IN ('superadmin','operator'));
