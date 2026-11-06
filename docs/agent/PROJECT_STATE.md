# PROJECT STATE — gta1 (web remake of Grand Theft Auto 1)

## Current objective
Deliver ONE self-contained HTML file (`src/gta1.html`) that is a playable web version of
Grand Theft Auto (1997), per `gtaprompt.png`:
- Three.js **r128** loaded from **cdnjs**
- **Everything procedural** (geometry + textures + audio generated at runtime, no asset files)
- Looks good: **no placeholder cubes**, **no default UI**
- Written in one pass, no clarifying questions

## Reference findings
- `gta.webm` (7m18s, 1280x720 AV1) is a retrospective capture of the original engine.
  Sampled segments in `.qwen/tmp/clips/` (ffmpeg, 560x314 @2fps).
- Original is 2D top-down with a *tilted* top-down projection: sprites/buildings lean
  outward from screen centre => fake perspective. Recreate with a real perspective camera
  at high pitch so the same lean happens naturally.
- Visual identity seen in footage:
  - Roads: dark asphalt, double-yellow centre lines, white lane dashes + edge lines,
    grey pavement strips, zebra crossings.
  - Big chunky colourful buildings (blue/red/orange/cream/brown), visible roofs, palm trees
    and round bushy trees, grass parks, water with piers/boats, railway, parked cars.
  - Vehicles: sedans, taxis, vans, green bus, police cars, fire truck, bikes, sports cars.
  - HUD: black top strip; red **GTA** logo far left; white `$` cash; row of small grey
    weapon-slot boxes (selected one highlighted orange); lives counter; **wanted stars**
    (grey -> yellow); health + armour bars at the right.
  - Mission briefings are plain **white bold centred text** over gameplay, e.g.
    "NICE DAY FOR A BANK JOB. ROBB THE BANK AND BRING THE MONEY TO THE GETAWAY CAR".
  - Level structure is time-limited missions for score, then the next city.
- Wikipedia (fetched): DMA Design, 1997; 3 cities (Liberty City / San Andreas / Vice City);
  999 years of gameplay across 3 minutes; wanted level; original top-down 2D.

## Architecture decisions
- Single HTML file. Inline CSS/JS. Only external dependency = three.js r128 cdnjs URL.
- Renderer: WebGLRenderer, PerspectiveCamera, pitch ~66-68 deg, follows player, no orbit
  (world never rotates; actors rotate) — matches the original.
- Static city: built into a handful of **merged BufferGeometries grouped by material**
  (own tiny merge routine; r128 has no core BufferGeometryUtils) + tiling procedural
  canvas textures (RepeatWrapping, mipmaps) instead of an atlas => crisp, cheap, ~20 draw calls.
- Dynamic actors merged per-actor (1-2 draw calls each): cars (body+trim one mesh, wheels a
  second so front wheels steer), peds (upper+lower so legs swing), player.
- No shadow maps (a single merged city mesh cannot be frustum-culled). Instead:
  strong hemi + directional face-shading and procedural blob-shadow decals.
- FX: `THREE.Points` with procedurally generated sprites (fire/spark additive, smoke normal);
  `InstancedMesh` for bullets.
- HUD/title/map/mission text drawn on a separate 2D canvas overlay (crisp pixel control),
  styled from the reference frames. No DOM/three.js default UI.
- Seeded RNG => city layout is deterministic across reloads.

## Completed
- Reference study (video segments + Wikipedia) done.
- `docs/agent/PROJECT_STATE.md` created (this file).

## In progress
Long single-file build via marker-appended chunks in `src/gta1.html`:
1. head/CSS/loader + config + seeded RNG + procedural texture factory  [done marker `__P2__`]
2. geometry builder + city generation + colliders/spatial hash          [done marker `__P3__`]
3. scene/lights/camera + actor factories (player, vehicles, peds)       [done marker `__P4__`]
4. systems: traffic, peds, police/wanted, weapons, FX, audio, pickups, missions [marker `__P5__`]
5. HUD + map screen + title screen + main loop + input + boot           [final]

## Outstanding
- `node --check` the extracted script; headless-Chrome smoke test if available.
- Verify no syntax/runtime errors, frame rate, and that controls/missions work.

## Important files
- `src/gta1.html` — the entire deliverable.
- `docs/agent/PROJECT_STATE.md` — this checkpoint.
- `.qwen/tmp/clips/seg*.mp4` — sampled reference footage.

## Next action
Continue appending chunk 2 (geometry builder + city generation) to `src/gta1.html`.
