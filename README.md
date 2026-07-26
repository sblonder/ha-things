# HA Things

A collection of custom Home Assistant Lovelace elements, bundled together and
distributed as a single HACS resource (`ha-things.js`).

## Elements

- [**Climate Defaults Tile Card**](#climate-defaults-tile-card) — a Tile card for
  climate entities that commands a configured target hvac mode/temperature/fan
  mode directly when the entity is turned on.

More elements can be added over time; see [Repository structure](#repository-structure).

## Installation

### HACS (recommended)

1. In Home Assistant, open **HACS**.
2. Click the **⋮** menu (top right) → **Custom repositories**.
3. Add:
   - **Repository**: `https://github.com/sblonder/ha-things`
   - **Type**: `Dashboard`
4. Find **HA Things** in HACS (search for it if it doesn't appear immediately) and
   click **Download**.
5. Home Assistant should prompt you to add the resource automatically. If it
   doesn't, go to **Settings → Dashboards → ⋮ → Resources** and confirm
   `/hacsfiles/ha-things/ha-things.js` is listed as a **JavaScript Module**. Add it
   manually if it's missing.
6. Reload the browser tab (hard refresh, e.g. Ctrl/Cmd+Shift+R) so it picks up the
   new resource.
7. Add a card with `type: custom:climate-defaults-tile-card` (see below), either
   via YAML or by searching for "Climate Defaults Tile Card" in the card picker.

### Manual (no HACS)

1. Download `ha-things.js` from the [Releases](../../releases) page.
2. Copy it into `config/www/`.
3. In **Settings → Dashboards → Resources**, add `/local/ha-things.js` as a
   resource of type **JavaScript Module**.

---

## Climate Defaults Tile Card

Looks and behaves exactly like the built-in **Tile** card, with one addition: you
can configure the hvac mode, temperature, and fan mode that the card should
command the climate entity to directly, the instant it's switched on from the
card.

It works by subclassing HA's own running `hui-tile-card` element at runtime, so
everything you already know about the stock Tile card (icon, name, state text,
color, feature rows, tap/hold/double-tap actions, `vertical`, etc.) works exactly
the same. Nothing about the rendering or styling is reimplemented.

### Configuration

```yaml
type: custom:climate-defaults-tile-card
entity: climate.living_room
target_hvac_mode: cool
target_temperature: 21
target_fan_mode: auto
```

| Name                  | Type   | Description                                                     |
| --------------------- | ------ | ----------------------------------------------------------------|
| `entity`              | string | **Required.** A `climate.*` entity.                             |
| `target_hvac_mode`    | string | HVAC mode to command directly when the entity is turned on.     |
| `target_temperature`  | number | Target temperature to command after the HVAC mode.              |
| `target_fan_mode`     | string | Fan mode to command after the temperature.                      |

All other [Tile card options](https://www.home-assistant.io/dashboards/tile/) are
supported unchanged (`name`, `icon`, `color`, `features`, `tap_action`, etc.).

The card's icon defaults to a toggle action for climate entities (the stock Tile
card doesn't offer this, since `climate` isn't turned on/off as simply as a
switch or light). Tapping the icon while the entity is off does **not** call
`climate.turn_on` — instead it commands `climate.set_hvac_mode` straight to your
configured `target_hvac_mode`, then `climate.set_temperature` and
`climate.set_fan_mode` if configured. This is deliberate: `climate.turn_on`
resumes whatever hvac mode the device last used, and briefly passing through
that mode (e.g. heat) before switching to your target (e.g. cool) is a real,
harmful transition on some integrations. If `target_hvac_mode` isn't configured,
the card falls back to `heat_cool` or `cool` (whichever the entity supports), and
only if neither is supported does it fall back to the stock toggle (`turn_on`),
still applying `target_temperature`/`target_fan_mode` afterward if set. Tapping
while on turns it off, same as the stock card.

You can also add this card via the UI card picker — the visual editor is the same
one used by the stock Tile card, with an extra "Target values" section for
climate entities.

### Limitations

- This card subclasses Home Assistant's built-in `hui-tile-card` and
  `hui-tile-card-editor` elements at runtime (there's no published package that
  exports them, since they're internal to the frontend bundle). This gives exact
  visual/behavioral parity with the stock card, but ties the card to HA's current
  internal method names. A future frontend refactor could break it; if that
  happens you'll see a clear console error rather than a silent failure.
- The direct-command path (used whenever a target hvac mode is resolved) fires
  `set_hvac_mode` → `set_temperature` → `set_fan_mode` back-to-back without
  waiting for the entity's state to update between calls. This is what avoids
  racing `climate.turn_on`, but on integrations that reject a service call while
  a previous one is still being processed, back-to-back calls could be dropped.
- Only in the rare case where no target hvac mode could be resolved (none
  configured, and the entity supports neither `heat_cool` nor `cool`) does the
  card fall back to the stock toggle. In that fallback path, it waits for the
  entity's state to actually leave `off` (polling, capped at 4 seconds) before
  applying `target_temperature`/`target_fan_mode`, since `climate.turn_on` can
  take real time on IR/cloud-controlled devices. If your device takes longer
  than 4 seconds to report as on, those values are still applied afterward, but
  may race with a slow-to-settle device.

---

## Repository structure

```
src/
├── ha-things.ts                              # entry point — imports every element below;
│                                               # this is what gets bundled into dist/ha-things.js
└── cards/
    └── climate-defaults-tile-card/
        ├── climate-defaults-tile-card.ts
        ├── climate-defaults-tile-card-editor.ts
        └── types.ts
```

Everything is built into **one** file (`dist/ha-things.js`) so the whole
collection is a single HACS resource — HACS's "plugin/dashboard" repository type
only tracks one asset per repo. To add a new element:

1. Create a new folder under `src/cards/<your-card-name>/` with its own
   `.ts`/`types.ts` files, following the same self-registering pattern as
   `climate-defaults-tile-card` (define the custom element, push an entry to
   `window.customCards`).
2. Add one import line for it to `src/ha-things.ts`.
3. Rebuild — it now ships as part of `ha-things.js`.

## Development

```sh
npm install
npm run build   # outputs dist/ha-things.js
npm run watch   # rebuild on change
```
