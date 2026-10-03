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

The suite guards against regressions in two functional bugs fixed during
the code review, and checks the data the charts read:

1. **`toLocalDate`** parses `YYYY-MM-DD` strings as local dates, not UTC.
   Prevents US-timezone users from seeing every date rendered as the day
   before.

2. **Daily-delta computation** yields non-zero values on the first day of any
   filtered range. Prevents the chart from reporting 0 on the start day just
   because the slice has no predecessor.

A third block sanity-checks `data.json` itself — series lengths align,
cumulative values are non-decreasing, Oct 7 sub-categories sum to the
headline, the Ministry's daily breakdown never exceeds that day's reported
rise, and every field the renderer reads is present.
