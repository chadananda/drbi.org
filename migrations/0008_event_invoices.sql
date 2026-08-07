-- Per-event accommodation invoices sent via PayPal. DRBI-internal (never touches Humanitix/sync).
-- amount stored in cents to avoid float drift; status mirrors PayPal invoice status (DRAFT/SENT/PAID/…).
CREATE TABLE IF NOT EXISTS event_invoices (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  accommodation TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  paypal_invoice_id TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  payment_url TEXT,
  paid_cents INTEGER NOT NULL DEFAULT 0,
  sent_at TEXT,
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_event_invoices_event ON event_invoices(event_id, created_at);
CREATE INDEX IF NOT EXISTS idx_event_invoices_status ON event_invoices(status);
