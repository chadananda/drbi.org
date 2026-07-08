# Admin Design System (drbi.org CMS)

Reference for migrating `src/pages/admin/**` screens to the new look. The shell
(`AdminLayout`, sidebar, top bar) is already done — you restyle the **page content**
to match: monochrome + a single **brass** accent, uniform line icons, no emoji.

All tokens/classes are defined globally in `src/layouts/AdminLayout.astro` (scoped to
`.admin-root`, which is on `<body>`). Icons come from `src/components/admin/AdminIcon.astro`.

## Golden rules
1. **No emoji** anywhere. Replace with `<AdminIcon name="..." size={16} />`.
2. **No loud Tailwind colors** (`bg-blue-500`, `text-green-600`, `bg-amber-50`, colored buttons/headings, etc.). Use the classes/tokens below.
3. **Preserve all logic**: keep every `id`, `data-*`, `<script>`, form action, and client JS exactly. Only change presentation (class names, wrapper markup, icons).
4. Keep the page wrapped in `<AdminLayout title="..." user={user}>`.
5. Do **not** run `npm run build` (the parent builds once at the end). Just edit + self-review for syntax.

## Page header (top of every screen)
```astro
<div class="a-page-head">
  <div>
    <h1 class="a-title">Events</h1>
    <p class="a-subtitle">Short description of the screen.</p>
  </div>
  <div style="display:flex; gap:.6rem;">
    <a href="..." class="a-btn a-btn-primary"><AdminIcon name="plus" size={16} /> New event</a>
  </div>
</div>
```

## Components (class names)
- **Card / panel:** `<section class="a-card a-card-pad">…</section>` (use `a-card` alone if you want custom padding). Section heading inside: `<h2 class="a-section-title">…</h2>`.
- **Buttons:** `a-btn` (neutral), `a-btn a-btn-primary` (brass, primary action), `a-btn a-btn-ghost`, `a-btn a-btn-danger`. Icons inside auto-size.
- **Badges / status pills:** `a-badge` + optional `a-badge-green|amber|red|blue|muted`. e.g. Draft→`a-badge-muted`, Published→`a-badge-green`, Synced→`a-badge-blue`, Warning→`a-badge-amber`.
- **Tables:** `<table class="a-table">` with `<thead><th>` + `<tbody><td>`; numeric cells get `class="a-num"`. Already styled (uppercase muted header, hairline rows, hover).
- **Inputs:** add class `a-input` to `input`/`textarea`/`select`. Labels: `<label class="a-eyebrow">` or small muted text.
- **Eyebrow / small label:** `a-eyebrow` (uppercase, letterspaced, muted).
- **Empty state text:** muted, e.g. `<p style="color:var(--a-muted)">No items yet.</p>`.

## Icons (AdminIcon `name`)
dashboard, analytics, content, news, memorial, events, organization, media, team,
users, settings, logout, external, chevron, chevron-down, plus, pen-square,
calendar-plus, eye, eye-off, search, bell, tag. (If you need one that isn't listed,
add its Lucide path to `AdminIcon.astro`.) Import at top of the page:
`import AdminIcon from '@components/admin/AdminIcon.astro';`

## Tokens (CSS variables, for any custom CSS in a scoped <style>)
Text: `--a-ink` (primary), `--a-ink-2` (secondary), `--a-muted`.
Surfaces: `--a-panel` (white), `--a-panel-2` (off-white), `--a-bg` (canvas).
Lines: `--a-line`, `--a-line-2`. Radius: `--a-radius`, `--a-radius-sm`.
Accent: `--a-accent` / `--a-accent-2` (brass), `--a-accent-tint` (soft bg).
Semantic (desaturated): `--a-green/amber/red/blue` and their `-bg` variants.
Shadow: `var(--a-shadow)`. Fonts: body = Hanken Grotesk (inherited); for a display
heading use `font-family:'Fraunces',Georgia,serif`.

## Typical patterns
- Grids of items → `.a-card` tiles or a `.a-table`.
- Toolbars/filters → neutral `.a-btn` + `.a-input`; active filter can use `a-btn-primary` or a brass underline.
- Section titles use `a-section-title` (Fraunces). Page title uses `a-title`.
- Prefer whitespace, hairline borders, and one brass accent over color.

Keep it restrained and precise — the goal is "high-end CMS."
