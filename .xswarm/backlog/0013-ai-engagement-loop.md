---
id: "0013"
title: AI engagement loop — capture, remember, re-invite, so programmes snowball
state: ready
priority: P1
size: L
acceptance:
  - text: Anis is on drbi.org and can answer real questions about the programmes
  - text: contact capture happens in conversation with explicit consent, not only via forms
  - text: what a person asked about is remembered, so the re-invitation matches their interest
  - text: the do-not-recommend flag is honoured everywhere, including email
  - text: the measure is RE-ATTENDANCE, not list size
---

## The goal
Chad, 2026-09-07: "I want to develop the AI engagement for DRBI so we get better
at collecting contact info and re-inviting so our programs can snowball."

Snowball is the right word and it names the actual mechanism: each programme
should leave behind more people who can be invited to the next one than it
started with. Today each event is promoted from a standing start.

## The loop

    arrive        search, flyer, word of mouth, a concert
      ↓
    engage        Anis answers a real question — "what is the Dawn-Breakers
                  Challenge?", "is the concert really free?", "where do we sleep?"
      ↓
    capture       consented contact, IN CONVERSATION, plus what they asked about
      ↓
    attend        RSVP or registration through Humanitix
      ↓
    re-invite     matched to what they engaged with, timed to the warm window
      ↓
    bring someone

The step currently missing entirely is **capture with memory of interest**. A
form gives an address; a conversation gives an address AND the reason.

## Why a chatbot beats a form here
A form asks before it has given anything. Anis answers a genuine question first —
what the food is like, whether children are welcome, what the Íqán study assumes
you have read — and only then offers to keep the person posted. That ordering is
the whole difference in conversion, and it also produces a better lead, because
the question is the segmentation.

## The infrastructure already exists — wire it, don't build it
* **Anis widget** — SifterSearch publishes an embeddable chat web component
  (siftersearch 0015). DRBI 0007 already proposes newsletters and Anis on the site.
* **`@ol/anis`** — the memory layer, holding "seeker identity and the
  do-not-recommend flag". That flag IS the consent and suppression mechanism,
  already designed. Nothing new is needed to respect an opt-out.
* **Humanitix** — registration and RSVP, already the system of record (0004).
* **MailerLite** — the marketing sender, SPF and DKIM live.

## Segmentation, because it is nearly free
Four programmes with different audiences:

    concerts      local, free, low commitment — the widest top of funnel
    Riazati       serious study, travel, $340 — a deep-end audience
    DB Challenge  ten-day immersion — commitment, cohort
    Bayat         February, teaching theme

Someone who came to a concert should not receive the Íqán study pitch as their
first contact. They should be invited to the next concert — and to the study
only once they have come twice.

## The measure
**Re-attendance, not list size.** The question that decides whether this works
is: what share of people who attended one thing attend a second? A list that
grows while re-attendance stays flat is a vanity metric and means the loop is
leaking at the re-invitation step.

Secondary: what share of RSVPs convert to attendance, so the room can be
predicted.

## Constraints that are not optional
* **Consent is explicit and separately stated.** An AI that captures an email as
  a side effect of being helpful will damage trust exactly in the community where
  trust is the asset. Ask plainly; accept no.
* **The do-not-recommend flag is honoured in email too**, not only in chat. One
  suppression list, respected everywhere.
* **Public-facing copy still goes through the DeepSeek humanising pass.** That
  layer does not exist yet and gates every automated send here.

## Dependencies
* DRBI 0007 — engagement plan, newsletters and Anis on the site
* siftersearch 0015 — unify on the Anis widget
* siftersearch 0011 — follow-up email after an Anis conversation
* The humanising layer — not yet built, blocks automated sending
