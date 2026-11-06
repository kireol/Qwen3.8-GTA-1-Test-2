# PROJECT STATE — gta1 (web remake of Grand Theft Auto 1)

Last updated: 2026-11-06, mid-session (saved because the user is restarting the machine).
Chunks 1–4b are written and runtime-verified. **Chunk 4c and chunk 5 are still unwritten.**

## Current objective
Deliver ONE self-contained HTML file (`src/gta1.html`) that is a playable web version of
Grand Theft Auto (1997), per `gtaprompt.png`:
- Three.js **r128** loaded from **cdnjs** — the ONLY external dependency
- **Everything else procedural at runtime** (geometry, textures, audio — no asset files)
- "Looks good: no placeholder cubes, no default UI"
- Written in one pass, no clarifying questions

Standing user instructions:
- **"start using git locally from here. keep grinding straight through"** → commit as work
  lands; do NOT stop for intermediate playtest checkpoints. Fix, write chunk 4c → 5, verify
  headlessly, keep this file current, report everything at the end in one consolidated pass
  stating plainly what passed, what failed, and what could not be run.
- **"Are you updating PROJECT_STATE.md?"** → keep this file current *as work proceeds*, not
  only at the end. (In force permanently.)

## STOP-HERE STATE (this restart)
Nothing is broken or half-edited. `src/gta1.html` is 4556 lines and `node --check`-clean
(`FULL_SYNTAX_OK` printed on the last run). The last harness run succeeded.
Working tree has **uncommitted verified work** — commit it (see "Git" for the exact command
and what is verified).

### The very next action (in order)
1. **Fix the real enter-radius bug** — `src/gta1.html` line 4327 in `tryEnterVehicle()`:
   ```js
   var best=null,bd=3.4;
   ...
   var d=dist2(u.x,u.z,P.x,P.z);
   if(d<bd){bd=d;best=v;}
   ```
   `d` is a **squared** distance compared against a **linear** 3.4 ⇒ the real radius is
   1.84 u, so a player standing 2.0–2.2 u beside a car (i.e. next to the door of a ~4 u car)
   often gets `NO CAR HERE`. Fix: `var best=null,bd=3.4*3.4;` (keep `bd=d` — it still tracks
   the minimum squared distance correctly).
2. **Fix the harness's `fxRep()` reporting** in `tests/harness/mk_smoke.js` — `p.live` is an
   **array of particle records**, so `live:s.join(',')` printed `[object Object]` ×hundreds
   (it bloated the report to 35 KB). Count instead: `p.live.reduce((n,p)=>n+(p.on?1:0),0)`.
3. Re-run the pipeline (§ "Reproduce a report") and read `crash runOver fx0 render2 probe`
   — all four are still **unread** because both scenarios reported `no-enter` (cause = bug 1).
   Expect after the fix: `crash` → hp < 100, `cu.state` wreck-ish, camShake > 0, vhp < 100;
   `runOver` → `runOver>=1`, `kills>=1`, `wanted` rises; `fx0.live` → small non-zero counts
   after the skid-producing turn; `render2:"ok"`.
4. Commit (verified work, no push — there is no remote).
5. Write **chunk 4c** at the `/*__CHUNK__*/` marker (line **4548**), then **chunk 5**.
   Runtime-confirmed contract — `R.missing` from the last run is exactly:
   `syncCase, aiDrive, aiPed, policeAlarm, tryFire, dropMoney`
   plus `populateCity` aborting on **"bullets is not defined"** (`clearActors()` reads it).
   Details in § "Chunk 4c contract" (Outstanding section).
6. Then chunk 5 (HUD/map/title/main loop/`boot()`), then the single consolidated final report.

## Reference findings
- `gta.webm` (7m18s, 1280x720 AV1) is a retrospective capture of the original engine.
  Sampled segments in `.qwen/tmp/clips/` (ffmpeg, 560x314 @2fps).
- Original is 2D top-down with a *tilted* top-down projection: sprites/buildings lean
  outward from screen centre => fake perspective. Recreated with a real perspective camera
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
- Wikipedia: DMA Design, 1997; 3 cities (Liberty City / San Andreas / Vice City);
  wanted level; original top-down 2D.

## Architecture decisions
- Single HTML file, inline CSS/JS. Only external dep = three.js r128 cdnjs URL.
- `WebGLRenderer` + `PerspectiveCamera`, high pitch, camera never rotates (world stays
  screen-aligned, actors rotate) — matches the original. **Because the camera never
  rotates, on-foot input is screen-relative** (`up` = world +z, `left` = world −x).
- Static city: merged `BufferGeometry` buckets grouped by material (own merge routine; r128
  has no core BufferGeometryUtils) + tiling procedural canvas textures (RepeatWrapping,
  mipmaps) instead of an atlas => crisp, cheap, ~20 draw calls. Bucketed into tiles so the
  renderer frustum-culls off-screen parts of the city.
- No shadow maps (a single merged city mesh cannot be frustum-culled). Instead: strong hemi
  + directional face-shading and procedural blob-shadow decals.
- Dynamic actors merged per-actor (1–2 draw calls each): cars (body+trim one mesh, wheels a
  second so front wheels steer), peds (upper+lower so legs swing), player.
- FX: `THREE.Points` pools with procedurally generated sprites (fire/spark additive, smoke
  normal); decals on an instanced pool; bullets via `InstancedMesh` (chunk 4c).
- HUD/title/map/mission text on a separate 2D canvas overlay (crisp pixel control), styled
  from the reference frames. No DOM / three.js default UI.
- Seeded RNG => city layout deterministic across reloads.

## Hard-won invariants (do not re-break these)
- **`"use strict"` inside one IIFE ⇒ reading an undeclared name throws ReferenceError.**
  `if(bullets)` throws when `bullets` is not yet declared. `node --check` cannot see this;
  only the runtime does. `/tmp/undeclared.js` catches implicit-global *assignments*.
- **r128 texture invariant:** `refreshUniformsCommon` does
  `if(map.matrixAutoUpdate===true)map.updateMatrix(); uniforms.uvTransform.value.copy(map.matrix)`
  ⇒ a raw `<canvas>` passed as `material.map` has no `.matrix` ⇒
  `Matrix3.copy(undefined)` → *"Cannot read properties of undefined (reading 'elements')"*.
  Convention enforced in code: **`TEX.*` are canvases; every GPU map goes through `spr(k)`**
  (one cached `THREE.Texture` per sheet). Pools (`PtPool`, `DecalPool`) take a Texture.
- **`FX` pools do not exist until `initFX()` runs.** `initFX()` is defined at line 3638 and
  is **never called anywhere in the file** — chunk 5 must call it after `buildCity`. Until
  then `skid()/bloodSplat()` throw *"Cannot read properties of undefined (reading 'put')"*.
  Hit for real this session; the harness now calls `initFX()` explicitly.
- **`Builder.prototype.tri(ax..c2, c0,c1,c2, nx,ny,nz)` takes normals LAST** and
  auto-normalises when `nx === undefined`. Colours are 3-element arrays.
- **Colour contract:** `col(hex)` → `[r,g,b]`; `cmul/cmul3/cmix/cshade` operate on those
  arrays and **produce NaN on an undefined or non-array multiplier**; `C(hex)` is the raw
  variant. `cols4(col)` accepts **exactly one `[r,g,b]` or an array of 4** — a raw hex
  number or a 2-colour array silently becomes NaN vertex colour.
- `flat(x1,z1,x2,z2,y,c,tile)` takes **7 args**; passing 8 shifts y/colour/tile and yields
  NaN colours + NaN uvs (that was the `lotGarage` bug, now fixed).
- `T.BLOCKWall:52` (T table line 129) is **legitimate**, used by `makeFacade` @539 and
  others — NOT a typo. Grep a symbol's definition before "correcting" it.
- **`integrateVeh` must commit the integrated local velocity to world space BEFORE the yaw
  re-decomposition** (`u.vx=fwd*f-lat*g; u.vz=fwd*g+lat*f;`) — otherwise each frame's
  throttle is discarded. **VERIFIED this session** (see driveFree).
- Position integration lives at the end of `integrateVeh`: `u.x+=u.vx*dt;u.z+=u.vz*dt;`.
  `u.speed` is *only* a scalar read-out — setting it does not move a car; only `u.vx/u.vz`
  do. (Harness gotcha when faking velocity.)
- **While `P.mode==='veh'`, `P.x/P.z` do NOT follow the car.** Any measurement of car motion
  must read `P.veh.userData.x/z` (harness helpers `cx()/cz()`).
- Traffic is **right-hand**; `laneTarget(i,j,ax,dir,off)` signs were corrected for that.
- Wanted system: `GS.wanted` is a float 0..6 derived from `GS.heat` via
  `Math.min(6,Math.floor(Math.sqrt(GS.heat)/1.9)+1)`. `crime(n,x,z)` (3806) raises heat, sets
  `GS.starT=1` and calls `policeAlarm()` when wanted>0. `coolWanted(dt)` (4486) cools −10
  heat per tick once `GS.coolT >= 7+GS.wanted*3.2`, says 'YOU SHOOK THE COPS' at zero.
  **Do not redefine this system** — 4c only adds `policeAlarm()`.
- `syncPlayer()` ends with `syncCase()`, so **`syncCase()` is the once-per-frame hook**. It
  must NOT rebuild actor arrays (it can be reached from inside the VEH loop via `explode`) —
  only queue demand.
- `killPlayer()` must NOT call `clearActors()` mid-step (`hurtPlayer`→`killPlayer` runs
  inside the VEH loop).
- `runOver(v)` @4051 requires `Math.abs(u.speed)>=2.6`, a ped within 4 u *and* inside the
  car box, and **credits only `u.role==='player'`**. `enterVehicle` @4337 does set
  `u.role='player'` (verified by reading); `exitVehicle` restores `'civ'/'parked'`.
- `tryEnterVehicle()` @4325: **squared-distance vs linear-threshold bug still open** (see
  § "STOP-HERE STATE" step 1).

## Completed (verified)
- Reference study (video segments + Wikipedia).
- **Chunks 1–4b** written; file is **4556 lines**, `node --check` clean:
  1. head/CSS/loader + config + seeded RNG + procedural texture factory
  2. geometry builder + city generation + colliders/spatial hash
  3. scene/lights/camera + actor factories (player, vehicles, peds)
  4a. FX core (points pools, decals, `explode`), audio (`SND`), input
  4b. vehicle physics, collisions, damage/wrecks, crowd spawn/despawn, camera, engine audio
- **Headless verification pipeline works end-to-end** (~2 s/run; 5040 frames + ~70 renders
  in 527 ms ⇒ `msPerFrame:0.1`; SwiftShader software GL).
- **All non-finite geometry eliminated — VERIFIED this session:**
  `nanTot {pos:0,uv:0,col:0,nrm:0,tris:0}`, `audit0.bad []`, `nanSrc []`,
  321 meshes, `city {stat:314, plots:70, spawn:844, bad:0}`, `render0/1:"ok"`,
  `probe`: all 23 materials `ok`, `counts {errs:0, rendErrs:0}`, `errKinds {}`.
  The real bugs the tri-trap found and that were fixed (each verified):
  1. `Builder.extrudeP` (4 sites) passed a whole `[x,z]` pair where X belongs → NaN
     positions through `tube`→`gtube` (every pole/post/fence rail). Fixed to `b2[0]/a2[0]`.
  2. `containerAt` used a raw hex as a colour array (`cmul`→NaN). Fixed with `col(cols[…])`.
  3. `treeAt` handed a **2-colour** array to `qn` (needs 1 or 4) → NaN colour. Fixed to
     `var e=tileUV(T.LEAF),cg=cmix(c1,col(0x1c2a14),0.35),cs=[cg,cg,c1,c1];`
     (matches the project-wide bottom-shaded/top-lighter convention @1756, @2506).
  4. `lotGarage` called the 7-arg `flat()` with 8 mangled args (zero-width quad + colour
     array into `tile`) → NaN uv **and** colour. Fixed to
     `flat(x0+1.2+i*2.9,z0+2.4,x0+1.2+i*2.9+0.06,z1-2.4,top+0.013,col(0xf0efe4),T.WHITE);`
  5. (earlier sessions, already verified) `initLights()` missing from `initGL()`, `PANTS[5]`
     off-by-one, the canvas-as-`map` render crash.
- **fix6 (`integrateVeh` throttle commit) VERIFIED this session:**
  `driveFree` (TAXI, `top:16`) `sp` = 2.36, 3.82, 4.72, 5.28, 5.63, 5.84, 5.97 over 0.5 s
  steps → smooth asymptote, τ≈1 s, no oscillation. `braked sp:0`, `driveFreeStop sp:0`,
  `reverse sp:-2.64`, `drive sp:5.28`, `turnLeft da:-0.62 dx:0.62 dz:-1.97` (the car now
  actually translates and turns — earlier `d=0`/`dx=0` readings were the harness measuring
  the seated player, see § In progress).
- On-foot movement verified exactly: walk `dz:5.03` in 90 frames @3.35 m/s, `run dz:6.1`
  @6.1 m/s, `dx:0` for both (screen-relative). Island boundaries hold: `edgeWest` a=3.14
  ends x=235.06, `edgeNorth` a=1.57 ends z=230.07, both `hp:100 inWater:0 bad:0` (they
  previously shared one frozen coordinate — that was the harness key-leak bug).
- `idle {veh:9,ped:12}` from `maintain`; `soak` 2400 frames: veh 19 / ped 26 / box 1,
  `bad:0`, hp 100 — no actor leaks, no NaN actors over 40 s of driving-with-turns.
- `initFX()` now exercised: `fx0 {pools:6, decals:3, skid:true, fire:true}` and the
  `skid`→`put` step error is gone (`errKinds {}`).

## In progress
- **Harness corrections made this session (all harness, not game):**
  - `step()` clears **all** of `KEY` every frame (old version leaked `left`/`run` into the
    next scenario; that is why `edgeWest`/`edgeNorth` once shared `(261.73,245.94) a:2.36`).
  - `crash`/`runOver` no longer teleport into building interiors; they road-snap via
    `roadSnap()`+`headingOf()`. `crash` now enters on open road and *then* aims the car at
    `insideBuilding()`; `runOver` drags one live ped 9 u ahead of the car so the test is
    deterministic (`ppu.st='idle';ppu.flee=0;ppu.tx/tz` pinned).
  - `cx()/cz()` measure the car, not the seated player (see invariant).
  - `initFX()` is called after `buildCity`, and `fxRep()` reports pool contents (currently
    over-prints — needs the `p.on` count fix, step 2 above).
  - New report keys: `fx0`, `render2`, `nanTot`, `nanSrc`, `driveFree*`.
- Both `crash` and `runOver` reported `no-enter` on the last run purely because of the
  open `tryEnterVehicle` squared-distance bug. Unread: `crash`, `runOver`, `render2`,
  `fx0.live`. (`enter` and `parkKind:"parked:TAXI"` were fine.)

## Outstanding / next actions
1. `tryEnterVehicle` radius fix + `fxRep` counting fix → re-run → read `crash runOver
   render2 fx0` (see STOP-HERE).
2. Commit the verified work.
3. **Chunk 4c** at the `/*__CHUNK__*/` marker (line **4548**). Contract from real call sites
   *and* the runtime `R.missing` list (`syncCase, aiDrive, aiPed, policeAlarm, tryFire,
   dropMoney`):
   - `syncCase()` — once/frame hook (end of `syncPlayer`); queue-only, never rebuilds arrays
   - `aiDrive(v,dt)` — lane following via `roadSnap`/`nextLeg`/`laneTarget`, right-hand
     traffic, stop-for-obstacle, honk
   - `aiPed(q,dt)` — drives `u.tx/u.tz`, uses `u.flee`, panics on nearby gunfire/crashes
   - `tryFire(dt)` — uses `GS.wp`, `GS.ammo[]`, `WDEF`/`WNAME`, `GS.fireCd`, `GS.firing`;
     called from both `footMove` (4319) and `driveInput`; bullets via `InstancedMesh`
   - `killPlayer()` — busted vs wasted, `GS.lives`, respawn at `P.safe`; no `clearActors()`
   - `policeAlarm()` — called from `crime()` when wanted>0; spawn/queue cop cars (POLICE
     kind exists, `lightbar`)
   - `dropMoney(x,z,money)` — called from `killPed`
   - declare `var bullets,markers,pickups` and define `markersClear()`, `pickupsClear()`
     (all referenced in `clearActors()`; this is what kills `populateCity` today)
   Plus: cop behaviour by wanted level (ram 1–2, shoot 3+, flashing `userData.lights`,
   siren if `SND` exposes it — check the API), pickups over `CITY.plots`/`CITY.marks`, and
   the per-city mission chain in GTA1 briefing wording using `GS.mission/brief/missionIdx/done`,
   `say()`/`bigMsg()`.
4. **Chunk 5** — HUD + map screen + title screen + main loop + `boot()`. Must declare
   `var UI` (`onResize` writes `UI.w/UI.h`) — and then the harness driver's temporary
   game-scope `var UI={w:1280,h:720};` must be deleted. Must call `initFX()`. Owns
   `GS.clock/GS.t/GS.fps`; calls `stepWorld(dt)` only while `GS.mode==='play'`, then
   `endFrame()` + `renderer.render(scene,camera)`. 3-city progression via `buildCity(ti)` +
   `THEMES`, `showStatics(false)` for the map screen, `#boot` splash (a `bootStep`/`bootFail`
   already exist — check before redefining). HUD per reference frames: black top strip, red
   GTA logo far left, white `$` cash, grey weapon-slot boxes (selected orange), lives,
   wanted stars grey→yellow, health+armour bars right, white bold centred mission text.
   After chunk 5, repoint the harness at the real `boot`/`main`.
5. Playtest pass (driving feel, spawn density, mission flow) folded into the final report —
   no intermediate checkpoint.

## Known issues / blockers
- **`tryEnterVehicle` effective radius 1.84 u** — open real bug, blocks the two harness
  scenarios (`crash`, `runOver`) from even starting.
- `populateCity()` aborts early on **"bullets is not defined"** (chunk-4c name read in
  `clearActors()`) ⇒ `R.pop {veh:0,ped:0,box:0}` is unreliable; `idle` later shows veh:9
  /ped:12 from `maintain`. Resolves when 4c declares those names.
- `stepErrs:5` on the last run are the 5 `MISSING` chunk-4c stubs — expected, not new.
- Unverified still: whether `PtPool`'s `ShaderMaterial` (custom attrs position/aC/aS/aA)
  actually *renders* correctly (it exists and emits without error; a screenshot pass is the
  only real check); the audio graph.
- `soak hp:100` — the soak never took damage; `crash` will be the damage-path test.
- No git remote. Nothing is pushed anywhere.

## Git
Branch `main`, identity `kireol / 3438792+kireol@users.noreply.github.com`, **no remote**.
Commits so far: `254dbcc` baseline (chunks 1–4a), `a4f538c` chunk 4b, `add6241`
foot-velocity fix + boundary walls.
**Uncommitted, all harness-verified this session:** `extrudeP` 4 sites, `containerAt`
`col()`, `treeAt` 4-corner `cs`, `lotGarage` `flat()` arity, plus earlier `initLights()`
wiring, dead-`EO` removal, `makePed` palette indices, `spr()` texture routing, fix6
`integrateVeh` throttle commit, this PROJECT_STATE.md, and `tests/harness/` (the harness
moved out of `/tmp` so it survives a reboot).
Commit command (do **not** push, there is no remote):
`git add -A && git commit -m "fix NaN geometry (extrudeP/containerAt/treeAt/lotGarage), commit integrateVeh throttle; verified headless"`

## Important files
- `src/gta1.html` — the entire deliverable (4556 lines; tail is `/*__CHUNK__*/` at 4548,
  then `})();`, `</script>`, `</body>`, `</html>`).
- `docs/agent/PROJECT_STATE.md` — this checkpoint.
- `tests/harness/mk_smoke.js` — **the harness builder** (was `/tmp/mk_smoke.js`; copy it
  back to `/tmp` or adjust paths — it reads `three128.js` relative to cwd and writes
  `/tmp/gta_smoke.html`).
- `tests/harness/rd.py` — report pretty-printer with optional key filter (was `/tmp/rd.py`).
- `tests/harness/three128.js` — three.js r128 min (603445 B), gitignored; refetch from the
  cdnjs r128 URL in `src/gta1.html` if missing.
- `.qwen/tmp/clips/seg*.mp4` — sampled reference footage. `docs/images/`, `tests/` — empty.
- Scratch in `/tmp` (may not survive reboot): `gta_extract.js`, `gta_smoke.html`,
  `dom.html`, `chrome.err`, `undeclared.js` (RUN, clean), `depth.js`, `fix2/3/5/6.js`
  (all RUN; **fix4 was wrong, never run**), `/tmp/missing.js` **HANGS (catastrophic
  backtracking) — do not run.**

## Reproduce a report
```
cd $HOME/projects/gta1 \
 && awk '/^<script>/{f=1;next}/^<\/script>/{f=0}f' src/gta1.html > /tmp/gta_extract.js \
 && node --check /tmp/gta_extract.js && echo FULL_SYNTAX_OK
cp tests/harness/mk_smoke.js tests/harness/rd.py tests/harness/three128.js /tmp/
node /tmp/mk_smoke.js     # builds /tmp/gta_smoke.html (cdnjs URL -> three128.js; driver
                          # spliced in before the final })(); )
cd /tmp && "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --use-angle=swiftshader --enable-unsafe-swiftshader \
  --window-size=1280,720 --virtual-time-budget=60000 --dump-dom file:///tmp/gta_smoke.html \
  2>/tmp/chrome.err > /tmp/dom.html
python3 /tmp/rd.py gl city pop render0 render1 audit0 nanTot nanSrc probe idle walk run \
  epre edgeWest edgeNorth parkKind enter drive turnLeft braked reverse driveFree \
  driveFreeTurn driveFreeStop crash exit shoot runOver soak per fx0 render2 missing log \
  errKinds counts
```
Chrome **must** run with cwd=`/tmp` (relative `three128.js`). `/tmp/rd.py` parses
`<pre id="out">` → `html.unescape` → `json.loads(t.strip()[2:-2])`, and filters top-level
keys when argv is given.
- `audit()` **dedupes** by attr/itemSize/material ⇒ its `n=` is only the FIRST offending
  tile, not a total. `R.nanTot` (trap totals) is authoritative.
- **Line mapping:** harness-reported HTML line *N* == `src/gta1.html` line *N*. For
  `/tmp/gta_extract.js` the offset is ≈ +28..32 — recompute by content match.
- Harness diagnostics that paid off: `stubMissing()` auto-stubs `X is not defined` into
  `R.missing`; `elog()` dedupes by message + first stack frame; staged `tryRender()`;
  `audit()`; `matProbe()`; the `Builder.prototype.tri` NaN trap (`R.nanSrc`, per-class
  totals + per-class stack chains + the offending arg values, installed before `buildCity`
  — **no deliverable edit needed**, the driver has closure access).

## Trust boundary (do not extend from these)
An earlier incoming snapshot contained claims that were never tool output — a
`roadLanePoint`-based spawn, "patch H", a chunk-5 HUD insert with `renderStatus`/`hudFont`/
`panel`, `/tmp/gta_src.html`, and fabricated harness numbers (`P.x=-961.8`, `maxdx=875.5`,
"buildCity is not defined"). Every number in this file came from real tool output. The real
file *does* contain `roadSpawnPoint` (confirmed by the function inventory) — that name is
legitimate; only the fabricated *results* were untrustworthy.

## Next action
Steps 1–6 of § "STOP-HERE STATE": fix `tryEnterVehicle`, fix `fxRep()`, re-run and read
`crash runOver render2 fx0`, commit, then write chunk 4c at line 4548 and continue into
chunk 5 — per "start using git locally from here. keep grinding straight through".
