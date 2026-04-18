# Tests

Pure-function tests for the dashboard's core logic. No dependencies — uses
Node's built-in test runner (Node 18+).

## Running

```bash
node --test tests/app.test.js
```

Or under a specific timezone, to verify the date-handling fix holds outside UTC:

```bash
TZ=America/New_York node --test tests/app.test.js
TZ=Asia/Tokyo       node --test tests/app.test.js
```

## What's covered

The suite exists specifically to guard against regressions in the three
functional bugs that were fixed during the code review:

1. **`toLocalDate`** parses `YYYY-MM-DD` strings as local dates, not UTC.
   Prevents US-timezone users from seeing every date rendered as the day
   before.

2. **Daily-delta computation** yields non-zero values on the first day of any
   filtered range. Prevents the chart from reporting 0 on the start day just
   because the slice has no predecessor.

3. **Slider clamp** keeps the two handles correctly ordered regardless of
   which one the user is dragging. Prevents the chart from going blank when
   the user drags the end handle past the start handle.

A fourth block sanity-checks `data.json` itself — series lengths align,
cumulative values are non-decreasing, Oct 7 sub-categories sum to the
headline, governorate shares sum to ~100%, and every field the renderer
reads is present.
