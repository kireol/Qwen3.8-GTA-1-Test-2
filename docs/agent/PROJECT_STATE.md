# PROJECT STATE — gta1 (web remake of Grand Theft Auto 1)

Last updated: 2026-11-06, end of the chunk-4b verification pass.
Chunks 1–4b are written and runtime-verified **including the driving, boarding, crash-damage
and run-over paths** (they were unread last session because boarding failed). **Chunk 4c and
chunk 5 are still unwritten.**

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

## Checkpoint state (all verified)
Nothing is broken or half-edited. `src/gta1.html` is **4560 lines**, `node --check`-clean
(`FULL_SYNTAX_OK`), and the last full harness run is **clean**:
`counts {errs:0, stepErrs:0, rendErrs:0, frames:6263}`, `log []`, `missing {}`,
`nanTot {pos:0,uv:0,col:0,nrm:0,tris:0}`, `render0/1/2:"ok"`, `audit0.bad []`,
`audit1.bad []`, `probe` 43/43 materials ok, `rsScan.n:0`, `vkBad []`, `bad:0` everywhere.

### The very next action (in order)
1. Write **chunk 4c** at the `/*__CHUNK__*/` marker (line **4553**). Runtime-confirmed
   contract — the names the engine reaches for are exactly:
   `syncCase, aiDrive, aiPed, policeAlarm, tryFire, dropMoney`
   plus `bullets/markers/pickups` + `markersClear()/pickupsClear()` (read by `clearActors()`)
   and `killPlayer()`. Details in § "Chunk 4c contract".
   **When 4c lands, delete the harness shim block** (`grep -n "TEMPORARY chunk-4c shims"
   tests/harness/mk_smoke.js`) and the `PRESTUB` array — they are masking real bugs.
2. Then **chunk 5** (HUD/map/title/main loop/`boot()`), then the single consolidated report.

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
- `runOver(v)` @~4061 requires `Math.abs(u.speed)>=2.6`, a ped within 4 u *and* inside the
  car box (`Math.abs(lx)>u.lenr*0.74||Math.abs(lz)>u.winr*0.80` rejects it), and **credits
  only `u.role==='player'`**. `enterVehicle` sets `u.role='player'`; `exitVehicle` restores
  `'civ'/'parked'`. **VERIFIED end-to-end this session** (`runOver:1, kills:1, wanted:1`).
- `tryEnterVehicle()` @4330: `dist2()` is **squared**, so the threshold must be squared too
  (`bd=3.4*3.4`). With the old `bd=3.4` the effective radius was 1.84 u and boarding a ~4 u
  car from beside its door usually failed. **Fixed + VERIFIED this session.**
- **`tryEnterVehicle` takes the NEAREST live vehicle**, so a staging harness cannot dictate
  which car the player gets — traffic beats a parked prop car to the button (a BIKE at
  1.12 u won over a staged car at 1.41 u). Board, then read `P.veh.userData` and rebind every
  scenario local. Test a *radius* change with an isolated car instead (`boardIsolated`).
- **A chunk-4c name that throws inside a callee silently skips the caller's scoring.**
  `killPed()` does `GS.kills++;GS.score+=20;` then calls `dropMoney()` (undeclared until
  4c), so the ReferenceError escaped `runOver()` and its `GS.runOver++ / score += 25 /
  camShake / crime(1.5)` never ran — the symptom was `kills:1, runOver:0, wanted:0`.
  Symptom-driven `missing` lists can therefore *under*-report which names matter.
- **Bikes (hp 40) wreck on contact**, so a physics scenario that boards "any live car" can
  silently measure an explosion instead of a sustained deceleration. Board `hp>=85`.
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

## Completed (verified)
- Reference study (video segments + Wikipedia).
- **Chunks 1–4b** written; file is **4560 lines**, `node --check` clean:
  1. head/CSS/loader + config + seeded RNG + procedural texture factory
  2. geometry builder + city generation + colliders/spatial hash
  3. scene/lights/camera + actor factories (player, vehicles, peds)
  4a. FX core (points pools, decals, `explode`), audio (`SND`), input
  4b. vehicle physics, collisions, damage/wrecks, crowd spawn/despawn, camera, engine audio
- **Headless verification pipeline works end-to-end** (~2 s/run, 6263 frames + ~70 renders
  in 1860 ms ⇒ `msPerFrame:0.3`; SwiftShader software GL). `tests/harness/run.sh <keys>`
  now wraps the whole pipeline in one command.
- **All non-finite geometry eliminated — VERIFIED:**
  `nanTot {pos:0,uv:0,col:0,nrm:0,tris:0}`, `audit0.bad []`, `audit1.bad []`, `nanSrc []`,
  `city {stat:314, plots:70, spawn:844, bad:0}`, `render0/1/2:"ok"`,
  `probe`: 43/43 materials `ok` (6 `ShaderMaterial/Points` among them),
  `counts {errs:0, stepErrs:0, rendErrs:0}`, `log []`.
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
- **Boarding VERIFIED (enter-radius fix):** `enter {car:TRUCK, iso:17.32, seq:"V:TRUCK"×8,
  same:true, bad:0}` — the player boards first try and is **not** ejected over 8 consecutive
  frames. `enterFb:null`. Earlier symptom was `NO CAR HERE` / instant re-ejection.
- **Driving physics VERIFIED while genuinely seated:**
  `pureSim` per-kind asymptotes respect `d.top`/`d.acc` — TAXI top16 → 13.06, SPORT top26 →
  22.2, BUS top12 → 9.04 (12 samples, all `fin:true`, `dA:0`, no oscillation).
  `driveFree` (BIKE top24) 4.78→17.66 m/s over 3.5 s, 39.8 u travelled.
  `turnLeft da:-4.25 dx:-11.29 dz:10.01` (real translation + yaw), `braked sp:0`,
  `driveFreeStop sp:0`, `reverse sp:-1.65`.
  `driveFreeTurn.fx {on:2, live:"fire:0,spark:1,smoke:1,…"}` ⇒ skid/impact FX really emit.
- **Crash damage VERIFIED (sturdy TRUCK, hp200, 26 m/s into real collider geometry):**
  `crash {state:"drive", vhp:173.15/200, dmg:26.85, minSpeed:0.11, gap0:16 → gapEnd:9.17,
  hp:97.64 from hp0:99.05, peakShake:0.12, wanted:0, bad:0}` — the truck is stopped dead by
  the building and the player takes collision damage. `crashBoard.wanted:1` came from the
  `CAR STEALEN` crime, i.e. the wanted system reacts to theft but **not** to a building
  hit — matches the original.
- **Run-over credit VERIFIED:** `runOver {runOver:1, kills:1, wanted:1, ped:"dead",
  gap:1.83, pedGap0:32.35}` — the full `runOver`→`killPed`→`crime` chain now credits.
- **`populateCity` completes:** `pop {veh:208, ped:26, box:190, bad:0}` (was `veh:0` when
  `clearActors()` threw on the undeclared `bullets`). `maintain` trims to ~29/26/12 by the
  end of `soak`.
- On-foot movement verified exactly: walk `dz:5.03` in 90 frames @3.35 m/s, `run dz:6.1`
  @6.1 m/s, `dx:0` for both (screen-relative). Island boundaries hold: `edgeWest` a=3.14,
  `edgeNorth` a=1.57, both `hp:100 inWater:0 bad:0`.
- `soak` 2400 frames (continuous throttle + periodic turns): veh 30 / ped 26 / box 12,
  `bad:0`, hp 96.9 — 3.1 hp of traffic damage over 40 s, no actor leaks, no NaN actors.
- `roadSnap` is NaN-free across the whole world box: `rsScan {n:0, off:[]}` over an
  45×33 lattice; `vkBad []`.
- `initFX()` exercised: `fx0 {pools:6, decals:3, skid:true, fire:true}`; the `skid`→`put`
  step error is gone.

## Harness state (`tests/harness/mk_smoke.js`, 574 lines)
- **Two TEMPORARY shim blocks exist right after `var UI={w:1280,h:720};` — they mask real
  bugs and must be deleted when chunk 4c lands:**
  1. `var bullets=null,markers=null,pickups=null;` at driver top level — because the driver
     is spliced **inside the game IIFE**, a top-level `var` there lands in *game* scope,
     which is what lets `clearActors()` finish and `populateCity()` populate.
  2. `PRESTUB=['syncCase','aiDrive','aiPed','policeAlarm','tryFire','dropMoney']` — installed
     as `window[name]` no-ops *before* the game runs, so the escaping ReferenceErrors that
     silently skipped `GS.runOver++` / `crime()` stop eating real scoring.
     **`killPlayer` is deliberately NOT pre-stubbed** — it must stay visible as a 4c
     requirement. `shoot` is consequently uninformative (`ammo0:999 ammo1:999 kills:0`)
     because `tryFire` is a no-op.
- Scenario hardening this session: `boardIsolated(minHp)` (scores live cars by isolation,
  `+10` if parked, skips `hp<minHp`, teleports to the door, samples 8 × 1-frame steps) is the
  radius regression test and the boarder for `crash`/`runOver`; `nearBlocked(x,z)` replaced
  the dead `insideBuilding()` (it returned the first `CITY.plots` entry *anywhere*, so the
  crash test never reached geometry); `enterCar` now returns `null` whenever
  `P.mode==='veh'` (boarding *a* car is success — `tryEnterVehicle` picks the nearest);
  `R.enterTrace` logs every candidate within 10 u plus the mode transition; every scenario
  rebinds its locals to `P.veh.userData` after boarding.
- `runOver` pins the nearest live ped **2.5 u ahead with a 9 m/s standing start** — a truck
  needs ~2 s just to reach the 2.6 m/s `runOver` threshold, so the throttle-only version
  spent the whole window accelerating and measured nothing.
- `tests/harness/run.sh` encapsulates extract → `node --check` → build → Chrome → `rd.py`;
  args pass straight through as report keys. `three128.js` is gitignored (refetch from the
  cdnjs r128 URL). `tmp/rd.py` and `.qwen/skill-curator.json` are pre-existing untracked
  scratch — left alone, not staged.

## Outstanding / next actions
1. **Chunk 4c** at the `/*__CHUNK__*/` marker (line **4553**). Contract from real call sites
   *and* the runtime names the engine reaches for (`syncCase, aiDrive, aiPed, policeAlarm,
   tryFire, dropMoney` + `killPlayer`):
   - `syncCase()` — once/frame hook (end of `syncPlayer`); queue-only, never rebuilds arrays
   - `aiDrive(v,dt)` — lane following via `roadSnap`/`nextLeg`/`laneTarget`, right-hand
     traffic, stop-for-obstacle, honk
   - `aiPed(q,dt)` — drives `u.tx/u.tz`, uses `u.flee`, panics on nearby gunfire/crashes
   - `tryFire(dt)` — uses `GS.wp`, `GS.ammo[]`, `WDEF`/`WNAME`, `GS.fireCd`, `GS.firing`;
     called from both `footMove` and `driveInput`; bullets via `InstancedMesh`
   - `killPlayer()` — busted vs wasted, `GS.lives`, respawn at `P.safe`; no `clearActors()`
   - `policeAlarm()` — called from `crime()` when wanted>0; spawn/queue cop cars (POLICE
     kind exists, `lightbar`)
   - `dropMoney(x,z,money)` — called from `killPed`
   - declare `var bullets,markers,pickups` and define `markersClear()`, `pickupsClear()`
     (all referenced in `clearActors()`)
   Plus: cop behaviour by wanted level (ram 1–2, shoot 3+, flashing `userData.lights`,
   siren if `SND` exposes it — check the API), pickups over `CITY.plots`/`CITY.marks`, and
   the per-city mission chain in GTA1 briefing wording using `GS.mission/brief/missionIdx/done`,
   `say()`/`bigMsg()`.
   **Then delete both harness shim blocks + `PRESTUB` and re-run** — with them gone,
   `R.missing`/`R.log` must stay empty for the chunk to count as done. Add a `shoot`
   assertion that bullets actually leave the pool and a cop actually spawns at wanted≥1.
2. **Chunk 5** — HUD + map screen + title screen + main loop + `boot()`. Must declare
   `var UI` (`onResize` writes `UI.w/UI.h`) — and then the harness driver's temporary
   game-scope `var UI={w:1280,h:720};` must be deleted. Must call `initFX()`. Owns
   `GS.clock/GS.t/GS.fps`; calls `stepWorld(dt)` only while `GS.mode==='play'`, then
   `endFrame()` + `renderer.render(scene,camera)`. 3-city progression via `buildCity(ti)` +
   `THEMES`, `showStatics(false)` for the map screen, `#boot` splash (a `bootStep`/`bootFail`
   already exist — check before redefining). HUD per reference frames: black top strip, red
   GTA logo far left, white `$` cash, grey weapon-slot boxes (selected orange), lives,
   wanted stars grey→yellow, health+armour bars right, white bold centred mission text.
   After chunk 5, repoint the harness at the real `boot`/`main`.
3. Perf check before finishing: `populateCity` creates **208 vehicles / 190 park boxes**
   (`audit1` counts 1019 meshes + 236 groups live); `maintain` trims to ~29 active vehicles,
   but the parked fleet is still 190 groups of draw calls. Confirm the frustum culling /
   `maintain` behaviour is enough or park-box visibility needs hiding.
4. Playtest pass (driving feel, spawn density, mission flow) folded into the final report —
   no intermediate checkpoint.

## Known issues / blockers
- **The harness currently lies in two places** (the shim block + `PRESTUB`, see § Harness
  state): `pop`/`runOver` pass *because of* the shims, and `shoot` cannot fail. Both are
  chunk-4c placeholders, not green tests.
- Unverified still: whether `PtPool`'s `ShaderMaterial` (custom attrs position/aC/aS/aA)
  actually *renders* correctly (it exists and emits without error; a screenshot pass is the
  only real check); the audio graph; anything involving chunk 4c/5 code.
- `peakShake:0.12` on a full-speed building hit looks small — worth a sanity look when 4c
  touches camera (`camUpdate`), but not a correctness failure.
- No git remote. Nothing is pushed anywhere.

## Git
Branch `main`, identity `kireol / 3438792+kireol@users.noreply.github.com`, **no remote**.
Commits: `254dbcc` baseline (chunks 1–4a), `a4f538c` chunk 4b, `add6241` foot-velocity fix +
boundary walls, `ba13cd0` NaN-geometry fixes + driving physics.
The pass that ends at this checkpoint commits: `tryEnterVehicle` squared-radius fix and the
`integrateVeh` throttle-vs-drag retune (both game, both verified), the harness hardening
(`boardIsolated`/`nearBlocked`/`enterTrace`/scenario rebinding + the two temporary shim
blocks), `tests/harness/run.sh`, and this file. **Never stage `tmp/` or
`.qwen/skill-curator.json`** — pre-existing scratch that is not mine. Stage explicit paths
(`src/gta1.html tests/harness/… docs/agent/PROJECT_STATE.md`), never `git add -A`.

## Important files
- `src/gta1.html` — the entire deliverable (4560 lines; tail is `/*__CHUNK__*/` at 4553,
  then `})();`, `</script>`, `</body>`, `</html>`).
- `docs/agent/PROJECT_STATE.md` — this checkpoint.
- `tests/harness/run.sh` — **one-command pipeline**; args are report keys. Read it before
  re-running anything by hand.
- `tests/harness/mk_smoke.js` — the harness builder (574 lines). Reads
  `three128.js` relative to cwd, writes `/tmp/gta_smoke.html`. The driver is spliced **inside
  the game IIFE** (before `})();`), so its top-level `var`/`function` land in game scope and
  can reassign `tryEnterVehicle`/`UI`/`bullets`. It is a `String.raw` template ⇒ **no
  backticks and no `${` in driver text** (a stray backtick = `SyntaxError: Unexpected
  identifier` in the builder).
- `tests/harness/rd.py` — report pretty-printer with optional key filter.
- `tests/harness/three128.js` — three.js r128 min (603445 B), gitignored; refetch from the
  cdnjs r128 URL in `src/gta1.html` if missing.
- `.qwen/tmp/clips/seg*.mp4` — sampled reference footage. `docs/images/` — empty.
- Scratch in `/tmp` (may not survive reboot): `gta_extract.js`, `gta_smoke.html`,
  `dom.html`, `chrome.err`, `rep1.json` (last full report), `undeclared.js` (RUN, clean),
  `/tmp/missing.js` **HANGS (catastrophic backtracking) — do not run.**

## Reproduce a report
```
cd $HOME/projects/gta1
sh tests/harness/run.sh counts log missing nanTot render0 render1 render2 pop audit0 audit1 \
  probe rsScan vkBad pureSim per idle soak enter enterFb parkKind drive turnLeft braked \
  reverse driveFree driveFreeTurn driveFreeStop driveFreeBoard crashBoard crash \
  runOverBoard runOver runPre shoot exit fx0 gl city walk run edgeWest edgeNorth
```
That is the current full key set; the script does extract → `node --check` (prints
`FULL_SYNTAX_OK`) → build → Chrome (`--headless=new --use-angle=swiftshader
--enable-unsafe-swiftshader --virtual-time-budget=60000 --dump-dom`, cwd forced to `/tmp`
because `three128.js` is a relative path there) → `python3 /tmp/rd.py <keys>`.
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
"buildCity is not defined"). Every number in this file came from real tool output (`/tmp/rep1.json`
is the last full report). The real file *does* contain `roadSpawnPoint` (confirmed by the
function inventory) — that name is legitimate; only the fabricated *results* were
untrustworthy.

## Next action
Write **chunk 4c** at line 4553, delete the two harness shim blocks + `PRESTUB`, re-run
`sh tests/harness/run.sh …` and require `missing {}` / `log []` with the shims gone, then
continue into chunk 5 — per "start using git locally from here. keep grinding straight
through".
