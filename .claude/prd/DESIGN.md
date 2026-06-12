# Shelf — Design System

Design decisions for frontend implementation. Derived from the PRD and the inspiration screenshot (`assets/app_inspiration.png`).

---

## Colour palette

| Token | Hex | Usage |
|---|---|---|
| `background` | `#F2EDE4` | App background (warm cream) |
| `surface` | `#FFFFFF` | Cards, nav bar, bottom sheets |
| `primary` | `#2D4A35` | Headings, body text, nav icons |
| `accent` | `#C4532A` | Descriptor words in titles, tab underline, badges, counts |
| `text-secondary` | `#8A8A8A` | Inactive tab labels, metadata |
| `badge-bg` | `#F2EDE4` | Time/source badge pill background (matches app background) |

---

## Typography

Two typefaces: a serif for content, a sans-serif for UI chrome.

| Role | Typeface | Weight | Size | Case |
|---|---|---|---|---|
| Screen title (e.g. "Shelf") | Playfair Display | Regular (400) | 30px | Sentence |
| Section header (e.g. "Recent") | Playfair Display | Regular (400) | 22px | Sentence |
| Card title — descriptor word | Playfair Display | Regular (400) | 13px | Sentence |
| Card title — main words | Playfair Display | Regular (400) | 13px | Sentence |
| Tab label | Inter | Medium (500) | 11px | Upper |
| Count / metadata (e.g. "20 SAVED") | Inter | Medium (500) | 11px | Upper |
| Badge label (e.g. "40m") | Inter | Regular (400) | 10px | — |

**Card title colour split:** the descriptor/tag word(s) render in `accent`, the remainder in `primary`. This requires the AI to return title parts in a structured format — e.g. `{ descriptor: "high-protein", title: "pav bhaji" }`.

**Font loading:** `expo-font` + `@expo-google-fonts/playfair-display` + `@expo-google-fonts/inter`.

---

## Spacing & layout

| Token | Value | Usage |
|---|---|---|
| `screen-h-padding` | `20px` | Left/right padding on all screens |
| `card-gap` | `12px` | Gap between cards in grid |
| `section-gap` | `28px` | Vertical space between section groups |
| `section-header-mb` | `12px` | Below section header, above cards |
| `card-radius` | `12px` | Image card border radius |
| `pill-radius` | `999px` | Badges, tag chips |

---

## Component specs

### Tag / filter tab bar (horizontal scroll)

- Tabs: `ALL` | `CUISINE` | `DIETARY` | `TIME & EFFORT` | ...
- Active tab: `accent` underline (2px), label in `accent`
- Inactive: label in `text-secondary`, no underline
- `ScrollView horizontal`, `showsHorizontalScrollIndicator: false`

### Card

- Image fills card with `borderRadius: 12`, aspect ratio ~1:1
- Badge (bottom-left, absolute): cream pill, clock icon + duration in `accent`
- Title below image: descriptor word(s) in `accent`, rest in `primary`
- No card background — sits directly on app background

### Section header row

- Left: section name in `primary` (Playfair Display 22px)
- Right: `{n} SAVED >` in `accent` (Inter 11px uppercase)
- Tapping right label navigates to full list

### Project detail header

Replaces the standard home header when inside a project:

- Left: `←` back arrow
- Centre: project name in Playfair Display 30px `primary`
- Right: search icon + pencil icon (search left of pencil), gap `16px` between them

### Bottom sheet (create project, edit project, post-processing overlay)

- Library: `@gorhom/bottom-sheet`
- Background: `surface` (`#FFFFFF`)
- Drag handle: centered, `#DEDEDE`, `40×4px`, `borderRadius: 2`
- On iOS 26+: `GlassContainer` from `expo-glass-effect` as the sheet background
- Edit project sheet: rename input (pre-filled) + "Save" button + "Delete project" in `#C0392B` below

---

## Animations & micro-interactions

| Interaction | Approach |
|---|---|
| Parallax thumbnail (link detail) | `react-native-reanimated` — interpolate `scrollY` to scale/translate header |
| Bottom sheet slide-up | `@gorhom/bottom-sheet` built-in spring animation |
| Bouncy scroll bar (projects grid) | Custom animated scroll indicator with spring at extremes via Reanimated |
| Tab switch | `scrollTo` on horizontal ScrollView, or Expo Router tab transitions |
| Post-processing overlay slide-up | Reanimated `withSpring` entering animation |

Animation library: `react-native-reanimated` (v4, bundled with Expo SDK 56).

---

## Liquid Glass (iOS 26+)

Library: **`expo-glass-effect`** (Expo SDK 56, first-party).

| Element | Treatment |
|---|---|
| Post-processing overlay | `GlassContainer` as sheet background |
| Search bar | `GlassView` wrapper |
| Everything else | Regular Views — do not over-apply |

Fallback: `GlassView` renders as a plain `View` on iOS < 26 and Android. Design the opaque fallback (white surface + shadow) first, then layer glass on top.

Use `isLiquidGlassAvailable()` to gate any glass-specific layout tweaks at runtime.

---

## Libraries summary

| Purpose | Library |
|---|---|
| Fonts | `expo-font`, `@expo-google-fonts/playfair-display`, `@expo-google-fonts/inter` |
| Liquid Glass | `expo-glass-effect` (Expo SDK 56+) |
| Animations | `react-native-reanimated` v4 |
| Bottom sheet | `@gorhom/bottom-sheet` |
| Navigation | Expo Router (file-based) |
| Icons | `@expo/vector-icons` (Ionicons / SF Symbols via `expo-symbols` on iOS) |
| Image loading | `expo-image` (better caching than core RN Image) |
