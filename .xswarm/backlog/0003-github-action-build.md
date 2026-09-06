---
id: "0003"
title: Move the build into a GitHub Action so Telahoun can publish
state: refined
proposal: true
traces_to: .xswarm/GOAL.md
priority: P1
size: S
depends_on: ["0001"]
class: never
acceptance:
  - text: pushing to the default branch builds and deploys without a local toolchain
  - text: Telahoun can publish a change with GitHub access alone — no Cloudflare account
  - text: the token is least-privilege, scoped to this project only
  - text: a failed build does not deploy
---

## Problem
Chad, 2026-09-06: get a Cloudflare key so the build step moves into a GitHub
Action, letting Telahoun push changes. He has GitHub access only.

## Blocked on Chad
**Creating the Cloudflare API token is Chad's action** — it needs account
access and it is a credential. Nothing here proceeds until that exists. The
token should be scoped to this project, not account-wide.

## Why it matters beyond convenience
It is the difference between one person being able to publish and two. Right
now every change routes through Chad's machine.
