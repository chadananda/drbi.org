-- Local-only fixtures for the /events listing e2e tests.
--
-- Applied to the LOCAL miniflare D1, never to production:
--   wrangler d1 execute drbi-db --local -c wrangler.jsonc --file tests/fixtures/events-listing.sql
--
-- Backlog 0005 asks that *each* event on /events offers a direct path to its
-- tickets. That cannot be proved against an empty database — a loop over zero
-- cards passes while asserting nothing, which is exactly how the criterion came
-- to be reported as met while a whole branch of the card still rendered no
-- action at all.
--
-- So one row per branch of the action bar:
--   1. external ticket URL           -> Get Tickets
--   2. full (capacity reached)       -> Join the Waitlist
--   3. no registration URL           -> Registration (the branch that was missing)
--   4. registration URL that is not http(s) -> also the fallback branch
--
-- Dates are far future so they never fall out of the upcoming filter.

DELETE FROM events WHERE id LIKE 'fixture-%';

INSERT INTO events (id, title, short_description, full_description, start_date, end_date,
                    location, price, registration_url, visible, capacity, registered_count)
VALUES
  ('fixture-tickets', 'Fixture: Ticketed Retreat',
   'Has a real Humanitix link, so the card should sell on the spot.',
   'A weekend retreat used to exercise the Get Tickets branch of the listing.',
   '2099-03-01T17:00:00Z', '2099-03-03T21:00:00Z',
   '{"venue":"Desert Rose","address":"Eloy, AZ","online":0}',
   '$340 adult / $200 minor', 'https://events.humanitix.com/fixture-retreat', 1, 50, 3),

  ('fixture-full', 'Fixture: Sold Out Intensive',
   'Capacity reached, so the card should offer the waitlist instead of tickets.',
   'Used to exercise the waitlist branch: registered_count meets capacity.',
   '2099-04-10T16:00:00Z', '2099-04-12T20:00:00Z',
   '{"venue":"Eleanor Hadden Hall","address":"Eloy, AZ","online":0}',
   '$275 adult', 'https://events.humanitix.com/fixture-intensive', 1, 20, 20),

  ('fixture-no-url', 'Fixture: Community Gathering',
   'No registration URL at all — the case that previously rendered no action.',
   'Used to exercise the fallback branch: the card must still point at the detail page.',
   '2099-05-05T18:00:00Z', NULL,
   '{"venue":"The Round House","address":"Eloy, AZ","online":0}',
   '$40 suggested', '', 1, NULL, 0),

  ('fixture-bad-url', 'Fixture: Enquire By Email',
   'Registration is not an http(s) link, so no checkout URL can be built.',
   'Used to exercise the fallback branch via a non-http registration value.',
   '2099-06-20T18:00:00Z', NULL,
   '{"venue":"Casa Suites","address":"Eloy, AZ","online":0}',
   NULL, 'mailto:info@drbi.org', 1, NULL, 0);
