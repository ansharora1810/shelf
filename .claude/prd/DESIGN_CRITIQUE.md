# Shelf — Design & Product Critique

> Will people actually *love* using Shelf? An honest read, grounded in the PRD's stated goal
> ([PRD.md](PRD.md)) and how the save-it-later category behaves in the wild.

## Verdict

The **aesthetic** is genuinely lovable. The **core loop**, as currently shipped, risks
reproducing the exact problem the app set out to kill.

---

## What's genuinely strong

**The visual design is on-thesis and competitive.** Warm cream, serif wordmark, editorial
spacing, rich thumbnails — squarely in the territory people *praise* mymind for ("elegant,
visual, top-notch interface"). The PRD's "clean desk, feel relief not anxiety" philosophy is
actually visible in the UI. Most competitors feel like file managers (the standing complaint
about Raindrop). Shelf clears the bar that makes people *try* an app.

**The consume-time badge (`<1m`, `20m`) is the most underrated feature.** The biggest reason
these lists die is avoidance — a growing backlog creates guilt, so people stop opening the app.
"Do I have time for this right now?" is the question that unlocks actually consuming something,
and Shelf answers it on the card. This is more differentiating than the aesthetic.

## The core risk

The PRD names the enemy precisely: *"Nobody nudges you back to what you saved... the
saved-to-never-return problem."* The research backs this — it's **the** defining failure of the
category:

- ~90% of saved links are dead or paywalled within six months.
- The "collector's fallacy": people conflate *saving* with *knowing*.
- Apps optimize "items saved" over "knowledge gained."

But the home screen's primary organizing axis is **chronological by save date** (Today /
Yesterday / This Week). That's a feed that celebrates the act of *saving* — it surfaces what was
just added, not what should be *returned to*. As the library grows it becomes a
reverse-chronological graveyard with prettier headstones, reinforcing the very behavior the app
is trying to break.

The two features that *would* break it — **per-item reminders** and **semantic search** — are
both deferred to v2 (reminders are stored-but-don't-fire in v1; search is keyword-only). So v1
ships the *aesthetic* differentiation but not the *behavioral* one. Likely arc: users love it on
day one, quietly stop by week three.

The feature mymind users single out as their favorite is **Serendipity** — it resurfaces ~20
random old saves and asks "Keep / Forget." Cheap to build, and a direct antidote to the
graveyard. Shelf has nothing like it yet.

## Specific UX issues

1. **Two-axis navigation buries content.** Vertical sections *and* horizontal scroll within each
   row means item #4 in a week is offscreen-right and older weeks are offscreen-down. mymind and
   Raindrop use scannable grids for a reason — carousels hide the library. Fine at 20 items,
   painful at 300.
2. **The tab bar mixes two concepts.** `PROJECTS` is a *container*; `#ALL` / `#COMPUTING` are
   *filters*. Putting them on one swipe axis is a conceptual muddle users feel without naming.
3. **Chronological default fights the mission.** Consider a home that defaults to *unconsumed* or
   *resurfaced* items rather than most-recently-saved.

## Recommendations

- **Reorder v2.** Reminders + a resurfacing mechanic aren't "later" — they're the product thesis.
  The aesthetic gets people in; resurfacing is what makes them *love* it instead of abandon it.
  Pull at least a lightweight "rediscover" view forward.
- **Add a consume-oriented view** alongside the chronological one — "Quick (<5m)", "Unread", or
  "Resurfaced today." `consume_time` is already computed; the mechanic is sitting right there.
- **Pressure-test the horizontal scroll** at 200+ items before committing to it as the primary
  layout.

**Bottom line:** people will love the *look* immediately. Long-term love depends on shipping the
"nudge me back" loop the PRD itself identifies as the differentiator — currently the deferred
part.

---

## Sources

- [The 'save for later' paradox — Creativerly](https://creativerly.com/the-save-for-later-paradox-why-we-hoard-digital-content-we-never-read/)
- [Your "Read Later" list is a graveyard — DEV](https://dev.to/the_nortern_dev/your-read-later-list-is-a-graveyard-it-is-time-to-stop-hoarding-388g)
- [Pocket is shutting down — TechCrunch](https://techcrunch.com/2025/05/27/read-it-later-app-pocket-is-shutting-down-here-are-the-best-alternatives/)
- [Why people love mymind (Serendipity) — mymind reviews](https://mymind.com/reviews)
- [mymind review: search failures & pricing — saner.ai](https://blog.saner.ai/mymind-reviews/)
- [Readwise spaced-repetition resurfacing — Notionist](https://www.notionist.app/best-spaced-repetition-app)
