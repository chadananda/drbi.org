---
id: "0001"
title: A good content API so content is manipulable from Claude Code
state: ready
traces_to: .xswarm/GOAL.md
priority: P1
size: M
class: low
acceptance:
  - text: content can be listed, read, created and updated through the API, not by editing files blind
  - text: an agent can change a page end to end without a human touching the repository
  - text: the API refuses malformed content rather than writing it
  - text: tests pass
    check: "pnpm test"
  - text: site builds
    check: "pnpm build"
---

## Problem
Chad, 2026-09-06: DRBI needs a good content API so content can be manipulated
with Claude Code. Everything else planned for the site depends on it — events
and delegated publishing both assume content is addressable.

## Why first
This is the enabling step. Adding events without it means hand-editing; giving
Telahoun access without it means he edits files directly.

## Note
House rule already recorded elsewhere: never mutate application data with raw
SQL — extend the admin API instead. Same principle applies here.
