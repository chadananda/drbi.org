-- Per-event dedicated "Sponsor a Youth for <event>" page URL.
-- Read by the sponsor-invite cron (src/pages/api/cron/sponsor-invites.ts) and editable in admin.
ALTER TABLE events ADD COLUMN sponsor_page_url TEXT;

UPDATE events SET sponsor_page_url = 'https://events.humanitix.com/sponsor-youth-thanksgiving-2026'
  WHERE external_id = '6a26e3ad013e63d5e979aa70';  -- Division, Unity, and the Lord of Books

UPDATE events SET sponsor_page_url = 'https://events.humanitix.com/sponsor-youth-dawnbreakers-2026'
  WHERE external_id = '6a37116e8b21db3aca1c8a2e';  -- The Dawn-Breakers Challenge 2026
