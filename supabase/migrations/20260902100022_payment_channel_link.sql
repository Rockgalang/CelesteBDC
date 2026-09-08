-- Link a submitted payment to the channel the client says they paid
-- through. Added after the payment-flow simplification: a client no
-- longer types an amount, method, or reference — they pick which
-- configured channel (GCash, a bank, ...) they paid to and upload proof;
-- the server derives amount (remaining invoice balance) and method (the
-- channel's) itself. Nullable: existing rows predate this and staff-side
-- manual entries may still not reference a channel.

alter table public.payments
  add column channel_id uuid references public.payment_channels (id);
