# PROJECT STATE — gta1 (web remake of Grand Theft Auto 1)

Last updated: 2026-11-07, end of the **chunk-4c** pass (written, spliced, hooked, shims
deleted, runtime-verified, committed). **Chunk 5 is the only unwritten chunk.**

## Current objective
Deliver ONE self-contained HTML file (`src/gta1.html`) that is a playable web version of
Grand Theft Auto (1997), per `gtaprompt.png`:
- Three.js **r128** loaded from **cdnjs** — the ONLY external dependency
- **Everything else procedural at runtime** (geometry, textures, audio — no asset files)
- "Looks good: no placeholder cubes, no default UI"

Standing user instructions:
- **"start using git locally from here. keep grinding straight through"** → commit as work
  lands; do NOT stop for intermediate playtest checkpoints. Fix, write the next chunk, verify
  headlessly, keep this file current, report everything at the end in one consolidated pass
  stating plainly what passed, what failed, and what could not be run.
- **"Are you updating PROJECT_STATE.md?"** → keep this file current *as work proceeds*, not
  only at the end. (In force permanently.)

## Checkpoint state (all verified)
Nothing is broken or half-edited. `src/gta1.html` is **5720 lines**, `node --check`-clean
(`FULL_SYNTAX_OK`), and the last full harness run (`/tmp/run_gun.txt`) is **clean**:
```
missing {}   log []   errKinds {}
counts {errs:0, stepErrs:0, rendErrs:0, frames:8748, stop:false}
audit0/1/2 bad:[]   nanTot {pos:0,uv:0,col:0,nrm:0,tris:0}   render0/1/2:"ok"
probe 43/43 materials ok   rsScan.n:0   vkBad []   city {stat:314,plots:70,spawn:844,bad:0}
pop {veh:208,ped:26,box:190,bad:0}   walk dz:5.03 dx:0   run dz:6.1   per 8748f/3414ms (0.39)
```
Every **harness shim is gone** (grep-verified: no `PRESTUB`, no `parkedAhead`, no `R.shoot`);
the chunk-4c assertions below run against the real game code.

## What chunk 4c is
Spliced at the old `/*__CHUNK__*/` marker; body from `/* ==== chunk 4c */` to the tail, which
now reads `})();` / `</script>` / `</body>` / `</html>`. It supplies the names the engine
already reached for (`syncCase, aiDrive, aiPed, policeAlarm, tryFire, dropMoney, killPlayer`)
plus `policeTick`, `spawnCityPickups`, pickups/markers/bullet pools, `resetCityJobs` and the
mission machine.

**Five `stepWorld` hooks** (in this exact order, after `maintain(dt)`, before `camUpdate(dt)`):
```js
coolWanted(dt); maintain(dt);
/* chunk 4c hooks */ bulletsStep(dt); policeTick(dt); missionStep(dt);
pickupsStep(dt); markersStep(dt);
syncPlayer(dt); camUpdate(dt);
```
and one extra call at the end of `populateCity()`:
```js
  spawnTraffic(CROWD.veh); spawnPeds(CROWD.ped);
  spawnCityPickups();
  resetCityJobs();
}
```

## Chunk-4c bugs found and fixed (each verified by a re-run)
1. **`BulletPool.count` undeclared loop var** — `var c=0,j` missing; strict mode ⇒
   ReferenceError the moment any test touched `count()`.
2. **`P.fireCd=1/d.rate` inverted** — `WDEF.rate` is already *seconds between shots*
   (uzi 0.085), so the uzi crawled at 1 shot / 11.8 s. Now `Math.max(0.05,d.rate)` (src 4860).
3. **Bullet tunnelling** — a 112 m/s bolt covers 0.93 m per substep (SUB=2) so an
   endpoint-only ped test walked straight through a ped. `step()` now samples the **mid and
   end** of each substep and the ped hitbox is `hypot<0.42` (was 0.10).
4. **`pickups.list()` ×2** — `PickupPool` returns `list:list` (the live ARRAY) while
   `BulletPool` exposes `list` as a *function*. `clearEnvelopeFlags()`/`nearestEnvelope()`
   threw `pickups.list is not a function`. Now `pickups.list` (src 5576, 5611).
5. **`resetCityJobs()` rejected every phone** — `roadSnap()` snaps to the nearest street
   **centre line**, and a plot centre is `STRIDE/2` (29.5 m) from one, so the old `>12` guard
   threw away all 6 candidates ⇒ `PHONES.length===0` ⇒ **no mission in the city was
   reachable**. Now `maxd=CFG.STRIDE*0.5+CFG.LANE` (src 5524).
6. **`markers()` called as a function** at `openBrief` (5548), `winMission` (5588) and
   `failMission` (5597) — the accessor is `mkp()`. Fixed at all three.

## Pool / accessor contract (read this before writing another test)
- `var bullets=null,markers=null,pickups=null;` stay **null until used**; `clearActors()`
  guards with `if(markers)markersClear()`. The ONLY legal way for a test to touch a pool is
  its **lazy accessor**: `gun()` (4737), `pkp()` (5267), `mkp()` (5373). `bullets.count()`
  on a null pool throws — that was a harness bug, not a game bug.
- **Lazy-null + TypeError ⇒ invisible to `R.missing`.** `markers()` is not "markers is not
  defined", it is *"markers is not a function"*, so it never lands in `R.missing`; it only
  shows up in `R.log` / `R.errKinds` / `counts.stepErrs`. It was also unreachable until
  bug 5 was fixed (missions could never start) — that is why it survived the whole 4c write.
- `markers` is `MarkerField()` = a single `InstancedMesh` (32 slots, 4 tags) with
  `show(tag,x,z,color,{bob,y,h})`, `hide(tag)`, `step(dt)`; per-marker state lives in the
  parallel JS array, never in the instance matrix (that is what `setMatrixAt` reads back as).
  `MKTAG=['obj','dest','bad','job']`, groups named `marker_job` etc. for
  `scene.getObjectByName()`.
- `PickupPool` caps at **220** (`spawnCityPickups` placed 201); a test that wants a
  *reachable* envelope must place its own (`spawnPickup('cash',...)`).

## Verified chunk-4c behaviour (last run)
- **Guns:** `guns {wp:2, stage:{x:30,z:354,a:0,pushed:0,wall:24}, shots:10, bulletsPeak:1,
  bulletsNow:0, kills:3, cashDelta/pickups 17→19, wanted:2, heat:6, bad:0}` and
  `gunProbe {fire:1, now:1, after1:1, poolSame:1, muzzleY:1.24, gun:"UZI/spd112/dmg14/L1.2/rate0.085"}`.
  ⚠ **The gun test must be staged on a verified-open corridor.** `blocked(...,0.15)` is
  height-gated but counts parked vehicles, so firing from wherever the soak stopped (inside
  traffic) killed every bolt on its first substep — the tell was live `spark`/`dust` FX with
  `kills:0` and `bulletsPeak:0` while ammo still dropped. Probe at **bullet** height
  (`wallAhead(x,z,a,24,0.15,0.15)`), not the 1.9 m vehicle height the drive tests use.
- **Missions end-to-end:** `jobs {phones:6, phone:"118,231", visNear.job:"on",
  dial {brief:true, briefT:6.73, phoneOn:0, jobClock:true}, mission {kind:"deliv",
  name:"COURIER 1", need:1, lim:85, obj:505.15}, visMission.obj:"on", stillRunning:true, bad:0}`.
  The scenario restores `GS.mission/brief/briefT/C4C.job` and clears envelopes/markers
  first, runs **LAST**, and `R.audit2=audit()` afterwards still reports `bad:[]`.
- **Police:** `police {peakCars:3, atPeak:{cars:3, cap:3}, afterCars:0, afterPeds:0, bad:0}`
  — wanted 3 raises the fleet to `copCap()=min(4,wanted+(wanted>=4?1:0))` and dropping the
  heat demotes every cop car (the previous symptom was the city saturating at 4 cops forever).
- **Death/respawn:** `death {dead:{mode:"dead",hp:0,lives 3→2,die:2.4}, mid:{moved:0},
  mode:"play", hp:100, moved:88.13, wp:0, ammo:"0/24/0/0/0", bad:0}` — the corpse is immobile.
- **Still green from 4a/4b:** `driveFree` SEDAN monotonic 3.12→11.95 m/s with
  `wall/pre/avail:60`; `topSpeed` ratios 0.84–0.86 of `d.top` (BIKE 20.61/24, POLICE
  17.7/21, SEDAN 14.2/17); `crash {state:"drive", dmg:7.28, minSpeed:0.14, peakShake:0.23}`;
  `runOver {runOver:1, kills:2, wanted:1, ped:"dead"}`; `enter {same:true, seq:"V:SEDAN"×8}`;
  `exit {mode:"foot", bad:0}`; `turnLeft da:-2.51 dx:-14.45`; `braked sp:0`; `reverse sp:-2.86`.

## Hard-won invariants (do not re-break these)
- **`"use strict"` inside one IIFE ⇒ reading an undeclared name throws ReferenceError** and
  `node --check` cannot see it. `/tmp/undeclared.js` (kept at `tests/harness/undeclared.js`)
  catches implicit-global *assignments*; its `var` regex is line-scoped, so it flags
  multi-declarator continuations (`pv=` / `sv=` on a wrapped `var mm=…, q=…,` line) — the
  current **18 suspects are all that false-positive shape**; verify by reading the line above.
- **`markers()`/`pickups`/`bullets` are variables** ⇒ calling them raises TypeError, which
  `R.missing` never reports (see above).
- **`roadSnap(x,z)` is `Math.random()`-driven AND snaps ~29.5 m** to the nearest street
  centre line. Any deterministic staging must avoid it (harness `findCorridor()` scans the
  lattice instead: street centre lines are `x = i*CFG.STRIDE`, `z = j*CFG.STRIDE`).
- **`wallAhead()` returns `r1(dist)` on a hit and `0` for "nothing blocked within d"** —
  so "clear" is the *maximum*, and comparisons must be `(w||d)` or they steer the actor into
  the wall. It takes optional `(hh,hm)` (default 1.9/0.2) because `blocked()` is height-gated.
- **`blocked(x,z,h,m)` counts parked vehicles and PARKBOX, not only buildings** (proven by
  the gun staging). `clearLane()` pushes cars 11 m / peds 9 m out of the ±4.5 m corridor and
  marks them `state='parked', hb=1`.
- `dist2(ax,az,bx,bz)` returns **linear** distance despite the name ⇒ all radii are metres.
- CFG: `BLOCK:46 ROAD:13 SW:3.6 FLOOR:3.4 NX:11 NZ:7`, `STRIDE:59`, `R0:-6.5`,
  `WX:642.5 WZ:406.5`, `LANE:3.25`, `CFG.CT(t)=t*59+29.5`. World box `[R0,WX]×[R0,WZ]`.
- WDEF (3502): 0 FIST(dmg14/rate .40), 1 PISTOL(26/.30/spd104), 2 UZI(14/.085/spd112/L1.2),
  3 SHOTGUN(26/.85/pellets 6). Money field is **`GS.cash`** (not `GS.money`).
- **Bikes (hp 40) wreck on contact** — board `hp>=85`. The live fleet varies per run
  (`liveKinds()`/`carOf(k)` now pick the kinds; the old hardcoded `[VSPORT,VCOP,VTAXI]`
  silently measured 3 empty runs when the fleet had no cop cars).
- **r128 texture invariant:** raw `<canvas>` as `material.map` has no `.matrix` ⇒
  `Matrix3.copy(undefined)`. Convention: `TEX.*` are canvases, every GPU map goes through `spr(k)`.
- `runOver(v)` needs `|speed|>=2.6`, a ped inside the car box, and credits only
  `u.role==='player'`. `tryEnterVehicle` takes the NEAREST live car, so a harness must board
  then rebind locals from `P.veh.userData` (`boardIsolated(minHp)` is the radius test).
- While `P.mode==='veh'`, `P.x/P.z` do NOT follow the car — chunk 4c's `bulletsStep` now
  syncs them (that is why `camUpdate`/pickups/missions work from a car).
- `killPlayer()` must NOT call `clearActors()` mid-step; `syncCase()` is the once/frame hook
  and must stay queue-only (it can be reached from inside the VEH loop via `explode`).
- Wanted system (`GS.wanted` float 0..6 from `GS.heat`, `crime()`, `coolWanted()`) is 4b's —
  4c only added `policeAlarm()`. Do not redefine it.

## Harness state (`tests/harness/mk_smoke.js`, 806 lines)
- **No shims.** `var UI={w:1280,h:720};` stays (game-scope, chunk 5 must supply a real `UI`).
- Helpers: `tryRender()`, `audit()`, `matProbe()`, `step(n,keys)`, `fxRep()`,
  `boardIsolated(minHp)`, `nearBlocked`, `wallAhead(x,z,a,d,hh,hm)`, `vehAhead`, `clearLane`,
  `findCorridor()`, `stageCar(car)` (stages + reports `wall/pre/avail/pushed/at`),
  `liveKinds()/carOf(k)`, `tp(x,z,a)`, `onRoad()`, `enterCar(v)`, `cx()/cz()`, `r1()`.
- `stageCar` proves its own staging: `pre` is measured *before* `clearLane()` (a car parked
  by `clearLane` can itself close the corridor), `wall` after; `at` reports where the car
  actually ended up (it drifts a few metres while the probes step the world — read it, don't
  assume the lattice point).
- **Driver text is `String.raw`** (delimiters at lines 10 and 783) ⇒ **no backticks and no
  `${` anywhere in driver text, including comments**. A stray backtick = `SyntaxError:
  Unexpected identifier` from node's parse of `/tmp/mk_smoke.js`, and `run.sh`'s `set -e`
  means Chrome never runs — the wrapper still prints `EXIT=0`, so read the report file.
- **`/tmp/dom.html` survives the run** ⇒ re-query keys with `python3 /tmp/rd.py <keys>`
  without re-running (saved three full runs this session). `rd.py` is **top-level only**:
  `stop`/`errs`/`stepErrs`/`rendErrs` are nested inside `counts` and read as `null`; an
  unknown key also prints `null` (that is not a game error).
- **Never `tail` the report** — earlier keys get cut and look "missing". Redirect to a file
  and read the file (`/tmp/run_gun.txt`).
- Order matters: `soak → soakDied guard → on-foot guard → guns → police → death → jobs →
  R.audit2 → R.per`; anything that perturbs `GS.wanted`/`GS.mode`/`GS.mission` runs last.
  Nothing may call `removeActor()` (it corrupts `VEH.indexOf` bookkeeping) — wrecks use
  `dropVehicle`.
- Run-to-run variance is real (`Math.random` in traffic/spawn/roadSnap): `soak.hp` measured
  93.9 and 38.8 on two consecutive runs of the same code, `exit veh` 208 vs 81. Only the
  *assertions* (`bad`, `stop`, NaN, ratios) are stable claims.

## Reproduce a report
```
cd $HOME/projects/gta1
sh tests/harness/run.sh log missing errKinds counts soak jobs driveFree topSpeed guns \
  gunProbe police death crash runOver enter exit audit0 audit2 nanTot rsScan render2 per \
  > /tmp/run_gun.txt 2>&1
python3 /tmp/rd.py probe city pop vkBad fx0 gl idle parkKind turnLeft braked reverse \
  driveFreeTurn driveFreeStop driveFreeBoard crashBoard walk run edgeWest edgeNorth audit1
```
`run.sh <keys>` = awk-extract the inline script → `node --check` (prints `FULL_SYNTAX_OK`) →
`cp tests/harness/{mk_smoke.js,rd.py,three128.js} /tmp` → `node /tmp/mk_smoke.js` (pre-compiles
with `new vm.Script`, prints `smoke written, bytes=`) → Chrome `--headless=new --disable-gpu
--use-angle=swiftshader --enable-unsafe-swiftshader --window-size=1280,720
--virtual-time-budget=60000 --dump-dom` (cwd forced to `/tmp`: `three128.js` is a relative
path) → `python3 /tmp/rd.py <keys>`. ~4.5 s of sim, ~8750 frames, ~35 s wall.
- Line mapping: harness-reported HTML line *N* == `src/gta1.html` line *N*. For
  `/tmp/gta_extract.js` the offset is ≈ +28..32 (recompute by content match).
- `audit()` dedupes by attr/itemSize/material ⇒ its `n=` is the FIRST offending tile.
- `/tmp/missing.js` **HANGS (catastrophic backtracking) — do not run.**

## Outstanding / next actions
1. **Chunk 5** — HUD + map screen + title screen + main loop + `boot()`. Must declare
   **`var UI`** (`onResize` writes `UI.w/UI.h`) and then the harness's game-scope
   `var UI={w:1280,h:720};` must go. Must call **`initFX()`** (defined ~3638, still never
   called by src — the harness calls it). Needs `boot()` wired with a test guard
   (`if(!window.__GTA_TEST__)boot();`), `GS.t`/`GS.clock`/`GS.fps` increments, and
   `stepWorld(dt)` only while `GS.mode==='play'`, then `endFrame()` + `renderer.render`.
   HUD per reference: black top strip, red GTA logo far left, white `$` cash, grey weapon
   slots (selected orange), lives, wanted stars grey→yellow, health+armour bars right, white
   bold centred mission text. 3-city progression via `buildCity(ti)` + `THEMES`,
   `showStatics(false)` for the map screen, `#boot` splash (`bootStep`/`bootFail` exist).
2. Known gaps chunk 5 must close (all measured, none are 4c regressions):
   - `footMove`/`driveInput` still run when `GS.mode!=='play'`; `GS.lives=0` does not stop
     respawning; the mission countdown and brief dismissal are not drawn or gated; nothing
     decays `GS.msgT`/`GS.bigT`/`GS.fade`.
   - **`soak` leaves the player at `x:170.87 z:-11.21` — outside the world box (z starts at
     −6.5).** The boundary colliders hold for cars (`edgeWest`/`edgeNorth` are `inWater:0`)
     but on-foot/soak travel escapes south. Check the island bounds while wiring the loop.
   - Perf: `populateCity` creates 208 vehicles / 190 park boxes; `audit1` counts 1019 meshes
     + 236 groups, `audit2` 486 meshes. `maintain()` trims the active set to ~27 veh / 26 ped.
     `per msPerFrame:0.39` at 1280×720 SwiftShader — fine, but confirm on a real GPU.
3. Playtest pass (driving feel, spawn density, mission flow, `crash peakShake` feel) folded
   into the final report — no intermediate checkpoint.

## Known issues / blockers
- `soak.hp` can drop ~60 over 2400 frames of throttle-and-turn driving (traffic damage). Not
  a correctness failure, but the soak is now the noisiest number in the report.
- `crash dmg` varies with which sturdy car `boardIsolated` finds (TRUCK 200 hp ⇒ 34 dmg;
  VAN 120 hp ⇒ 7.28) — read `vhp0` alongside it.
- Unverified still: whether `PtPool`'s `ShaderMaterial` renders *correctly* (it emits without
  error; only a screenshot pass can tell); the audio graph; anything in chunk 5.
- No git remote. Nothing is pushed anywhere.

## Git
Branch `main`, identity `kireol / 3438792+kireol@users.noreply.github.com`, **no remote**.
Recent: `<new>` chunk 4c, `53f78fc` boarding radius + throttle drag, `ba13cd0` NaN geometry +
driving physics, `add6241` foot-velocity fix + island walls, `a4f538c` chunk 4b,
`254dbcc` baseline (chunks 1–4a).
Chunk 4c staged **explicit paths only**: `src/gta1.html`, `tests/harness/mk_smoke.js`,
`docs/agent/PROJECT_STATE.md`. **Never stage `tmp/` or `.qwen/skill-curator.json`**
(pre-existing untracked scratch), never `git add -A`.

## Important files
- `src/gta1.html` — the entire deliverable (5720 lines; tail is `})();`, `</script>`,
  `</body>`, `</html>`). Chunk 4c body starts ~4560.
- `docs/agent/PROJECT_STATE.md` — this checkpoint.
- `tests/harness/run.sh` — **one-command pipeline**; args are report keys. Read before
  re-running anything by hand.
- `tests/harness/mk_smoke.js` — the harness builder (806 lines). Reads `three128.js` relative
  to cwd, writes `/tmp/gta_smoke.html`. Driver is spliced **inside the game IIFE** (before
  `})();`), so its top-level `var`/`function` land in *game* scope (that is what lets the
  driver call `tp()`, `spawnPickup()`, `gun()`, `setWpn()`, `resetCityJobs()` directly).
- `tests/harness/rd.py` — report key selector (reads the persisted `/tmp/dom.html`).
- `tests/harness/undeclared.js` — strict-mode undeclared-assignment heuristic; run it **after**
  `run.sh` (it reads `/tmp/gta_extract.js`).
- `tests/harness/three128.js` — three.js r128 min (603445 B), gitignored; refetch from the
  cdnjs r128 URL in `src/gta1.html` if missing.
- `.qwen/tmp/clips/seg*.mp4` — sampled reference footage. `docs/images/` — empty.
- Scratch in `/tmp` (may not survive reboot): `gta_extract.js`, `gta_smoke.html`, `dom.html`,
  `chrome.err`, `run_gun.txt` (last full report), `run_keys.txt`, `mk_smoke.js`, `rd.py`,
  `three128.js`.

## Next action
Write **chunk 5** (HUD/map/title/main loop/`boot()`) at the current tail, honouring the
chunk-4c hook order, then re-run the harness and require `missing {}` / `log []` again — per
"start using git locally from here. keep grinding straight through".
