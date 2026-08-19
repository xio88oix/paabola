# TRMNL "Latest Results" plugin

Shows a player's most-recently-completed BetWeek scorecard plus the
season-cumulative standings on a TRMNL device. One private plugin per person.

## Prerequisites

- Paabola reachable over the public internet (Cloudflare tunnel, e.g.
  `https://epl.eusoof.com`), same pattern as `../siglulutamu` (`f1.eusoof.com`).
- Each player has a token: Admin → Users → **TRMNL** → **Generate**, then copy
  the shown Polling URL.

## Create the private plugin (per player)

1. In TRMNL: **Plugins → Private Plugin → Add New**.
2. **Strategy:** Polling.
3. **Polling URL:** the copied
   `https://<your-domain>/api/trmnl/results?token=tok_...` for that player.
4. **Refresh interval:** ~30 minutes (results only change when a BetWeek is
   completed or results are synced).
5. **Markup:** paste the contents of `results.liquid` (this folder). Use the
   `Full` layout. Adjust class names in TRMNL's live preview if needed — the
   payload fields are the contract; the exact framework CSS classes can be
   tweaked to taste.
6. Save, then **Force Refresh** / preview to render.

## Payload contract

`GET /api/trmnl/results?token=<TOKEN>` returns:

- `season` (string), `week` (number|null), `player` (string)
- `week_points` (number), `week_rank` (number|null)
- `fixtures[]`: `{ home, away, actual, pick, points, outcome }` where
  `outcome` ∈ `exact | result | miss | none`
- `standings[]`: `{ name, total, you }` (season-cumulative, `you` marks the
  device owner)

When no BetWeek is completed yet, `week` is `null` and `fixtures` is empty
(the template shows "No results yet").

## Keeping the template in sync

`results.liquid` here is the source of truth. If you edit the markup in the
TRMNL editor, paste it back into this file and commit so the repo stays
reproducible.
