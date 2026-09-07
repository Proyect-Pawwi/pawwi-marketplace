# Pendientes — Portal del Cliente

> Backlog de cosas del **lado del cliente** que quedan para cuando desarrollemos
> el portal del cliente. Hoy el marketplace + reservas del cliente existen, pero
> varias features del portal pawwer aún no tienen su contraparte para el cliente.

_Última actualización: 2026-07-07_

## 💬 Chat del cliente
- **Pantalla de chat del cliente** para responderle al pawwer desde su reserva
  (`/mis-reservas` o el detalle `/booking/confirmada/[id]`). Hoy **solo el pawwer**
  tiene chat (`/pawwer/mensajes/[bookingId]`); el cliente no puede responder.
  - Molde: el `ChatRoom.tsx` del pawwer + el HTML "cliente" viejo (Railway) como referencia de diseño.
  - Reusar lo mismo del pawwer: Supabase realtime, `send_message`, `mark_messages_seen`,
    tarjeta "Resumen del cuidado", **fotos** (bucket `chat-photos`), **moderación**
    (bloquear correos/teléfonos) y **botón de soporte** (WhatsApp).
  - RLS ya lo permite (`messages_select_parties` cubre a cliente y pawwer).

## 🔔 Notificaciones del cliente (A5 del estudio de lógica)
- **Campana / feed de notificaciones del cliente** (hoy solo existe en el portal pawwer).
- **Emails (Resend)** al cliente en eventos clave:
  - Pawwer aceptó la reserva.
  - La solicitud escaló a otros pawwers.
  - No se encontró cuidador (`sin_cuidador`).
- La tabla `notifications` ya soporta al cliente; falta la UI + Resend.

## ⏱️ Timer de urgencia (lado cliente)
- Replicar el `CuidadoTimer` (que ya está en el portal pawwer) para el cliente:
  "tu cuidado comienza en / termina en", overnight-aware. Ya está decidido en producto.

## 💳 Otros (dependen de sprints futuros)
- **Pagos** (Wompi/Bold): cobro al reservar/confirmar + refund en cancelación.
- Revisar el flujo de reseña del cliente (ya existe en `booking/confirmada/[id]`) cuando
  se pula el portal.
