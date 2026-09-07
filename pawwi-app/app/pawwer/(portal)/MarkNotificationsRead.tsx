"use client";

import { useEffect } from "react";
import { useNotifications, type NotifType } from "./NotificationsProvider";

/**
 * Marca notificaciones como leídas al montar — se cae en una página/sección.
 * Ej: <MarkNotificationsRead type="cuidado" /> en la lista de Cuidados.
 * Render-null: solo dispara el efecto.
 */
export default function MarkNotificationsRead({
  type,
  bookingId,
}: {
  type?: NotifType;
  bookingId?: string;
}) {
  const { markRead } = useNotifications();

  useEffect(() => {
    markRead({ type, bookingId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, bookingId]);

  return null;
}
