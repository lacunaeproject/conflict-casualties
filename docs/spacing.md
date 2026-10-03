# Spacing and line-height

Every margin, padding and gap on the site comes from one scale. Every line-height comes from one role token. Both are defined once, at the top of `styles.css`. A visual specimen lives at `docs/spacing.html`.

## The scale

4px base, eleven steps:

| Token | 4 | 8 | 12 | 16 | 24 | 32 | 48 | 64 | 96 | 128 | 160 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| | `--s-4` | `--s-8` | `--s-12` | `--s-16` | `--s-24` | `--s-32` | `--s-48` | `--s-64` | `--s-96` | `--s-128` | `--s-160` |

## Named spacings

Use these before reaching for a raw step. They're measured **ink to ink**: text leading is trimmed (see below), so a 16px gap is 16px between the baseline above and the cap height below.

| Token | Value | Use |
|---|---|---|
| `--inline` | 8 | Icon to label, chip to chip |
| `--stack-tight` | 8 | A source line under its breakdown; items in a short list |
| `--stack-related` | 16 | Kicker to title; small heading to its text; figure to breakdown |
| `--stack-block` | 24 | Block to block in a card; a large title (h2, step and era titles) to its dek; a label to a large figure |
| `1lh` | one line | Paragraph to paragraph in prose |
| `--pad-control` | 12 | Inline padding of pills and controls |
| `--pad-tile` | 24 | Tiles and small cards |
| `--pad-card` | 24 → 48 | Chapter cards |
| `--gap-tile` | 24 | Tile to tile in one grid |
| `--gap-card` | 32 | Chapter card to chapter card |
| `--gap-section` | 64 → 128 | A change of subject: part breaks, the history, the pull quote, sources, the coda, book sections |
| `--page-margin` | 16 → 24 | Page edge to content; never less than the safe-area inset |
| `--page-top` | 32 → 64 | Header to the first block |

Fluid values run between 375 and 1440px wide and hold outside that range.

### Grouping

Closer means more related, and each level is clearly larger than the one inside it:

```
8  (inside a line group)  <  16  (related)  <  24  (blocks, tiles)  <  32  (cards)  <  64–128  (sections)
```

If two things look equally far apart, they'll read as equally related. Check before adding a gap.

### Optical rule

Space grows with the size of the type above it. A 47px title needs 24px to its dek where a 20px heading needs 16, because a large title's ascenders and its sheer weight make the same gap look smaller.

## Ownership

- **Parents own the space between children.** Use `gap`, or the page stack. Components carry no outer margins.
- **The page stack** (`ui.css`, "Layout primitives"): `<main>` spaces its top-level blocks with `--gap-card`, and switches to `--gap-section` for the blocks listed there. A new top-level block gets card spacing automatically; add it to that list only if it starts a new subject.
- Use `margin-block` and `margin-inline` for new rules.

## Layout

| | Phone ≤640 | Tablet 641–1023 | Desktop ≥1024 |
|---|---|---|---|
| Container | full width | full width | `--container` (1240px), centred |
| Page margin | 16 | 16–24 | 24 |
| Card padding | 24 | 24–48 | 48 |
| Content edge | `--edge` is the page's text edge at every width; full-bleed elements use it to line up their insides |

Long-form text is held to `--measure` (66ch, about 60–75 characters). The In brief column sets its own `--lede-column` (640px, about 60 characters at its larger size).

## Line-height

Unitless, set once with the type role, never overridden locally.

| Token | Value | Role | Resolves to |
|---|---|---|---|
| `--lh-figure` | 1 | Large numerals | — |
| `--lh-display` | 1.05 | Display headlines | — |
| `--lh-title` | 1.15 | Section titles | — |
| `--lh-label` | 1.3 | Labels, short multi-line headings | — |
| `--lh-caption` | 1.54 | Captions, sources | 20px at 13px |
| `--lh-ui` | 1.6 | Interface text | 24px at 15px |
| `--lh-body` | 1.647 | Body prose | 28px at 17px |

## Measuring to the ink

Text blocks in `<main>` and the footer use `text-box: trim-both cap alphabetic`, which removes the leading above the cap height and below the baseline. Padding and gaps therefore measure to the visible text, and a card looks evenly padded on all sides.

- Firefox doesn't support `text-box` yet. It keeps the leading, so spacing there is slightly looser, never cramped.
- Excluded: the opening headline (its lines are clip boxes for the entrance animation) and figures painted with `background-clip: text` (trimming would clip the paint under a comma's tail).
- Flex and grid containers don't trim their own text. If a kicker or label needs trimming, make it `display: block`.

## Touch targets

On coarse pointers every control is at least 44×44px. Text controls grow their own box. Pills keep their look and get an invisible hit area (`::before`).

## Allowed raw values

- `0`, and `1px` for hairline compensation
- `em` for optical offsets tied to glyph size (a separator's spacing, a figure's overhang)
- percentages, `vw`, `vh`, and `lh`
- named geometry: column widths an element aligns to (`--tl-date`, `--label-w`, `--lede-column`, `--container`)

## Tools

- **Lint:** `npm install`, then `npm run lint:css`. It rejects raw spacing values in margin, padding and gap, and any line-height not taken from a role token.
- **Debug overlay:** add `?debug=space` to any page, or press Alt+Shift+G. It shows every box, a 4px baseline grid and the 12-column grid. It stays on for the session.
