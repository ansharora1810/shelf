# Shelf — Product Overview

*A guide for product & design. For the engineering source of truth, see [`.claude/prd/PRD.md`](.claude/prd/PRD.md) and the design system in [`.claude/prd/DESIGN.md`](.claude/prd/DESIGN.md).*

---

## 1. What Shelf is

**Shelf** — *"Save anything. Find everything."*

A unified content-saving app for iOS. Share any link from any app, and Shelf parses it, auto-tags it with AI, and makes it findable again — even if you search with different words than you saved it under. A per-item reminder keeps saved content from rotting in a pile you never revisit.

**Platform:** iOS only for v1 (validate on one platform before Android).

---

## 2. The problem & the vision

### The problem

Content consumption is fragmented. YouTube Watch Later, Instagram Collections, browser bookmarks, Pinterest boards — every save ends up in a different silo, and most are never found again. The two failure modes:

1. **Fragmentation** — saves scatter across a dozen apps with no common home.
2. **Save-to-never-return** — the thing you saved rots. Nothing brings you back to it.

Existing tools are either dumb (bookmark managers) or have poor UX. Nobody nudges you back to what you saved.

### The vision

> The app should feel like a **clean desk** — calm, organised, never cluttered. The user should feel *relief* when opening it, not anxiety.

Shelf closes the loop: **Save → Find → Consume.** It's not just storage; it's the system that makes saved content actually re-findable and actually re-consumed.

### Who it's for

People who actively consume content across multiple platforms and suffer from the "saved to never return" problem — learners, researchers, content creators, and professionals building knowledge in a domain.

---

## 3. Competitive landscape

| App | What it does well | Why it falls short |
|---|---|---|
| **Raindrop.io** | Share extension, link storage, cross-platform | No AI tagging, no semantic search, no reminders, dated "file-manager" UI |
| **Mymind** | The AI-tagging concept, clean idea | Weak semantic matching (searching "soy" won't surface "soya"), cluttered UI, expensive |
| **Pocket / Instapaper** | Read-later for articles | Articles only — no video, no AI |

### How Shelf is different

1. **Truly semantic search** — built on embeddings, not keyword matching. Searching "soy" surfaces an item tagged "soya". *(v2 — v1 ships fast keyword search; see §7.)*
2. **AI tagging from the actual content** — not just the title. It reads YouTube descriptions, Instagram captions, and full webpage text to assign tags.
3. **Per-item reminders** — the only one of these that actively nudges you back to consume what you saved.
4. **Warm, spacious, breathing-room UI** — the deliberate opposite of Raindrop's dense file-manager feel.

---

## 4. Design language

### Philosophy

A clean desk. Calm, organised, effortless. Relief, not anxiety.

### Visual identity

- **Colours** — warm, light palette. Off-whites, warm creams, soft warm accents. No dark or daunting surfaces.
- **Spacing** — generous. Cards breathe. Nothing is cramped.
- **Typography** — clean, readable, minimal weight variation.
- **Corners** — consistently rounded and friendly.

### Signature micro-interactions

- Projects-view scroll bar **shrinks with a bouncy animation** at the scroll extremes.
- Item-detail thumbnail **shrinks slightly on scroll** (parallax).
- Create-project sheet **slides up from the bottom**.
- Tab switches use a **smooth horizontal slide**.
- While an item is processing, its title shows as **shimmer text** (the source host shown muted with a left→right shine), then swaps to the real title once AI enrichment lands.

---

## 5. Core functionality

| Capability | What the user gets |
|---|---|
| **iOS share extension** | Save from *any* app (Safari, TikTok, Instagram, YouTube…) via the system share sheet — without leaving that app. |
| **Manual add** | Paste a URL inside the app via the `+` button. |
| **Content parsing** | Websites (title, thumbnail, full text for tagging), YouTube (title + thumbnail), Instagram (caption + thumbnail for public posts/reels). |
| **AI auto-tagging** | 10 tags per item, generated from the real content. Users can add their own tags too. |
| **`#all` tag** | Every item automatically belongs to `#all` — there's always a default feed. |
| **Projects** | Optional folders. Items are first-class without one — organisation is never forced. |
| **Search** | Fast keyword search across name, tags, and summary. *(Semantic search is the v2 differentiator.)* |
| **Per-item reminders** | A toggle to be nudged back to an item. *(v1 stores the setting; notification delivery is v2.)* |
| **Top-5 tag tabs** | Your five most-used tags surface as quick tabs in the tab bar. |
| **Consume-time badge** | An estimated read/watch time shown on the card (e.g. "12m"); hidden when unknown. |
| **De-duplication** | You can't save the same URL twice — re-saving surfaces the existing item. |

### The defining UX principle: **the user never waits for AI**

When you save something, the item appears in your feed **instantly** as a placeholder (shimmer), and the title, thumbnail, tags, and summary **stream in** moments later as the backend finishes processing. Saving feels immediate; enrichment fills itself in. This is the heart of the "share-and-forget" experience.

---

## 6. Information architecture

```
Shelf (app)
│
├── Onboarding (first launch only)
│     Welcome → Feature screens → Notification permission → Login → Pricing/Trial
│
├── Home  ──────────────────────────────────────────────┐
│   ├── Header:  ☰ menu  |  "Shelf"  |  🔍 search  📅 calendar
│   ├── Tab bar (horizontally scrollable, tap or swipe):
│   │     [ projects ] [ #all (default) ] [ top-5 tags by frequency … ]
│   │
│   ├── Projects tab → 2-column grid of project cards (2×2 thumbnail collage)
│   │     └── Project detail → that project's items, week-grouped
│   │
│   ├── #all / tag tabs → items grouped by week, 2.5-column horizontal rows
│   │     └── Item detail → thumbnail, name, source, summary, tags, reminder
│   │
│   ├── 🔍 Search → tag-pill browser (empty) + live results (typing)
│   ├── 📅 Calendar → filter the active feed to a chosen day
│   └── + FAB → manual add  /  create project
│
└── ☰ Sidebar drawer → Account · Subscription · Notifications · About
```

### Two organising axes

- **Tags** (automatic) — every item is tagged; `#all` is the universal feed; the top 5 tags get tab shortcuts; the rest are browsable from search.
- **Projects** (manual, optional) — user-created folders for deliberate grouping.

Everything except the raw save data is **derived on the device** from the full item list — tag filtering, the top-5 computation, project membership, and the project collages. There's no separate "folder count" to drift out of sync.

---

## 7. Screens

### 7.1 Onboarding *(first launch)*
Welcome → 2–3 feature-highlight animation screens (notification permission requested on the 3rd) → Login (Continue with Apple / Continue with Google) → Pricing (5-day free trial, or buy: $3/mo or $30/yr) → Home.

### 7.2 Home
- **Header:** `☰` (left, opens sidebar) · "Shelf" (centre) · `🔍` + `📅` (right; calendar hidden on Projects tab).
- **Tab bar:** `projects` · `#all` (default) · top-5 tags. Switch by tap or swipe.
- **Projects tab:** 2-column grid; each card is a 2×2 collage of its first four item thumbnails (fallback: warm gradient + name); bouncy custom scroll bar.
- **Tag tabs:** items grouped by week (newest first); each week is a 2.5-column horizontal scroll row; each card shows thumbnail + name + source icon + consume-time badge.
- **`+` FAB:** bottom-right → manual add.

### 7.3 Add-link popup *(manual add)*
Single-phase and instant: paste a URL → optionally pick a project → **Add** → the sheet dismisses immediately. The card appears in the feed as a placeholder and enriches itself. No waiting, no editing metadata here — name/tags/summary are edited later on the item detail screen.

### 7.4 Item detail
- **Header:** large thumbnail with a subtle parallax shrink on scroll; tapping it opens the original URL in Safari.
- **Body:** name (tap to edit; first two words in accent colour) · source icon + domain · consume-time line · summary (read-only) · tags (editable) · reminder toggle.
- **Footer:** persistent **Open** button, with **Delete** beneath it.

### 7.5 Search
- **Empty state:** auto-focused search bar + "Browse by tag" — all tags as a wrap of tappable pill chips (this is also how you reach tags not in the top-5 tabs).
- **Results:** debounced, updating as you type. *v1:* keyword match over name/tags/summary. *v2:* semantic results.

### 7.6 Create / edit project
Bottom sheet that slides up: drag handle · label · single text input (auto-focused, **20-char limit**) · Create/Save button. Names are stored and shown in Title Case. Edit mode adds a red **Delete project** option that asks whether to also delete the items inside, or keep them (they become project-less).

### 7.7 Project detail
Back arrow · project name (centre) · `✏️` edit + `📅` calendar. Same week-grouped feed and card format as the tag feeds. Tapping a tag here jumps to that tag's **global** view (search is global, not project-scoped). `+` FAB pre-selects this project.

### 7.8 Sidebar drawer
Slides in from the left via `☰`. Sections: Account (photo, name, email) · Subscription (plan, manage via Apple) · Notifications (global toggle) · About (version, privacy, terms).

### 7.9 Empty states
- **Home, nothing saved:** bookmark icon + "Nothing saved yet" + "Share any link to Shelf from any app, or tap + to add one manually."
- **Empty project:** "No items in this project yet." + add button.

### 7.10 Share extension sheet
A compact sheet over the host app (it never opens the full app). Shows the shared URL (read-only) + an optional project picker. **Save** fires the item to the backend and dismisses (~200ms). It does **no** parsing or AI itself — all of that happens on the backend afterward, and the item appears in the app live. If the user has never signed in, it shows "Open Shelf to sign in first".

---

## 8. Key user flows

### 8.1 First-time open
`Welcome → Feature animation → Feature animation + notifications → Login (Apple/Google) → Trial / Pricing → Home (#all)`

### 8.2 Share from an external app
`External app → iOS share sheet → tap Shelf → compact sheet (URL + optional project) → Save → item dismisses back to the host app → backend parses & tags in the background → item appears in Shelf live`

### 8.3 Manual add
`Home → tap + → enter URL → Add (sheet dismisses instantly) → card appears in feed as a placeholder → AI title/tags/summary stream in`

### 8.4 Search
`Home → tap 🔍 → browse all tags as pills, or type a query → tap a result → item detail`

---

## 9. Monetisation

| | |
|---|---|
| **Free trial** | 5 days, full access |
| **Monthly** | $3.00 / month |
| **Annual** | $30.00 / year |
| **Payment** | Apple In-App Purchase |
| **Auth** | Apple Sign In + Google Sign In (no email/password in v1) |

---

## 10. What's in v1 vs. later

### In v1
Share extension · manual add · website/YouTube/Instagram parsing · AI auto-tagging (10/item) · `#all` tag · optional projects · **keyword** search · per-item reminder *toggle* · top-5 tag tabs · per-user de-dup · the warm, spacious UI.

### Deferred to v2+
| Feature | Why it waits |
|---|---|
| **Semantic search** (embeddings) | The headline differentiator, but v1 ships cheap keyword search first. |
| **Reminder notification delivery** | v1 stores the toggle; actually firing notifications comes later. |
| **Image & PDF items** | URL items first; the data model is already named generically so files slot in without a rename. |
| **YouTube transcript & video length** | Blocked server-side (YouTube blocks the server's network); v1 ships title + thumbnail only. |
| **Failure retry** | v1: a failed item offers *Remove* (re-add manually). A one-tap *Try again* is v2. |
| **Global de-dup, collaborative collections, Android, notes** | Scope / platform-validation reasons. |

---

## 11. Current build status *(snapshot: 2026-06-14)*

**Done:** Auth (Apple/Google), full design system, Home, tab-switch animation, projects grid + detail, calendar filter, item detail, add/create/edit flows, shimmer processing state, keyword search, the real Supabase data layer with live fill-in, AI tagging (active), content parsing, per-user de-dup.

**Partial:** reminder toggle (UI built, delivery is v2), Liquid Glass styling (FAB only), settings drawer (sections present but static).

**Pending:** iOS share extension, push-notification reminders, onboarding screens (only Login exists today), pricing / trial / Apple IAP, and all v2 items.

> **For design:** the share extension, onboarding (welcome + feature + permission screens), and the pricing/paywall screens are the largest unbuilt surfaces — likely the highest-leverage places for design attention next.

---

*Wireframes referenced in the PRD live in [`.claude/prd/assets/`](.claude/prd/assets/): `wireframe-home.png`, `wireframe-link-detail.png`, `wireframe-post-processing.png`, `wireframe-full-flow.png`, plus an `app_screens/` folder.*
