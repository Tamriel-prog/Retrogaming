# Void Corsair

> A 1987-style deep-space horizontal shooter — playable in any modern browser, no install required.

Void Corsair is an original arcade prototype built entirely with vanilla HTML5 Canvas and JavaScript. Pilot your fighter through an enemy-filled sector, collect weapon upgrades, and bring down the Leviathan boss to clear the zone.

---

## Gameplay

Navigate from left to right through procedurally spawned enemy waves. Your distance through the sector is shown by the progress bar in the HUD. At 3800 units the **Leviathan boss** appears — defeat it to win.

### Controls

| Action | Keyboard | Touch |
|---|---|---|
| Move | WASD or Arrow keys | D-pad |
| Fire | Space | Fire button (●) |
| Charged shot | Hold X, release | Hold X, release |
| Precision movement | Hold Shift | — |
| Pause | P | — |

### Player stats (HUD)

| Indicator | Description |
|---|---|
| SCORE | Points accumulated |
| LIVES | Reserve ships remaining (starts at 3) |
| POWER | Weapon level 1–4 (affects shot count and spread) |
| SHIELD | Charges that absorb one hit each (max 3) |
| HP bar | Five hit points, resets on extra life |
| Progress bar | Sector distance — turns red when boss is near |

---

## Enemy roster

| Enemy | Behaviour |
|---|---|
| Drifter | Fast straight-line pass |
| Sine | Sinusoidal vertical oscillation |
| Seeker | Tracks player vertically, fires aimed shots |
| Turret | Slow drift, high aimed fire rate |
| Mine | Rapid oscillation, rushes when close |
| **Leviathan** (boss) | 120 HP, three rotating attack phases |

---

## Power-ups

Enemies have a 22 % chance to drop a power-up on death.

| Icon | Effect |
|---|---|
| `+` Repair | Restores 1 HP |
| `P` Power | Raises weapon level by 1 (max 4) |
| `S` Shield | Adds 1 shield charge (max 3) |
| `>` Speed | Increases movement speed by 28 px/s (max 340) |

---

## Running the game

No build step. No dependencies.

```
git clone https://github.com/Giovanni/Retrogaming.git
cd Retrogaming
# Open index.html in any modern browser
open index.html
```

The game also works by simply double-clicking `index.html` on macOS/Windows, or by serving the folder with any static HTTP server:

```
npx serve .
# or
python3 -m http.server
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Rendering | HTML5 Canvas 2D API (960x540, pixel-rendered) |
| Logic | Vanilla JavaScript — single IIFE, strict mode |
| Styling | Plain CSS with custom properties, CSS Grid |
| Audio | Web Audio API (oscillator-based, procedural) |
| Assets | None — all graphics are procedural polygons |

---

## Project structure

```
Retrogaming/
├── index.html   # Page shell, canvas element, touch controls
├── game.js      # All game logic (~860 lines)
├── styles.css   # Arcade cabinet UI, CRT scanline overlay, mobile layout
└── README.md
```

---

## Browser compatibility

Requires Canvas 2D, Web Audio API, and pointer events — supported by all evergreen browsers (Chrome, Firefox, Safari, Edge). Audio may be silenced until the first user interaction, per browser autoplay policy; use the **Audio On/Off** toggle in the footer if needed.

---

## License

All rights reserved — original prototype by Axe and revised by Deg.
