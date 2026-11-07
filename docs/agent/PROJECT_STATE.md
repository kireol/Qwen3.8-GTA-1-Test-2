# PROJECT STATE — gta1 (web remake of Grand Theft Auto 1)

Last updated: 2026-11-07, **chunk 5 verified and committed**. The game now has its first real
`requestAnimationFrame` loop and is ready for a **human browser playtest** (the one thing the
headless harness structurally cannot cover). No remote — nothing is pushed.

## Current state
- Chunks 1–5 are all written, headlessly verified, and committed. `src/gta1.html` = **6323
  lines** (`wc -l`), `node --check`-clean (`FULL_SYNTAX_OK`), tail `})();` / `</script>` /
  `</body>` / `</html>`, last src line `if(!window.__GTA_TEST__)boot();`. Chunk 4c body starts
  ~4560, chunk 5 body ~5739.
- `tests/harness/mk_smoke.js` = **1070 lines** (all 3 planned chunk-5 edits applied).
- Authoritative report: **`/tmp/run_c5c.txt`** (9663 frames). Gates:
  `missing {}` · `log []` · `errKinds {}` · `counts {errs:0, stepErrs:0, rendErrs:0, stop:false}`
  · `audit0/audit2 bad:[]` · `nanTot` all 0 · `rsScan.n:0` · `render2:"ok"` · `per 0.51 ms/frame`.
- The previous "CHECKPOINT — exact state if the session restarts right now" block (chunk 5
  unverified/uncommitted, `refs/wip/chunk5` as the recovery net, the pre-splice `/tmp` artifacts)
  is **retired**: that tree is now committed, so `git show HEAD` *is* the recovery point.
  `refs/wip/chunk5` → `0b68d96` is left in place but is fully reachable from `main` and can be
  deleted with `git update-ref -d refs/wip/chunk5`.
- **What the harness cannot prove, and only a human can:** whether the thing is *fun* and looks
  right — driving feel, spawn density, the `PtPool` `ShaderMaterial` particles, the audio graph,
  HUD legibility at real DPR, `GS.fps` and frame pacing on a real GPU.
- **Only known live bug:** on-foot travel escapes the world box south (`soak` ends at
  `z:-11.21`, deterministic across 3 runs; box `z` starts at `R0=-6.5`). Cars are held by the
  boundary colliders. Deferred deliberately — see "Outstanding".
- **Reboot-safety / scratch policy:** nothing important lives in `/tmp`. The spliced copy inside
  `src/gta1.html` is the source of truth for the game, `tests/harness/` holds the harness, and
  `git show HEAD:src/gta1.html` reproduces the committed file byte-exactly. The old chunk-5
  authoring drafts (`/tmp/c5c.js` spliced, `/tmp/c5b.js` never spliced) are now redundant.

## Current objective (unchanged)
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

## Baseline checkpoint (chunk 4c — the run that predates chunk 5; kept for comparison only)
At commit `7c03886` (5720 lines) `src/gta1.html` was `node --check`-clean (`FULL_SYNTAX_OK`) and
the last full harness run (`/tmp/run_gun.txt`) was **clean**:
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

## What chunk 5 is (VERIFIED, committed)
Spliced before the unique tail anchor `\n})();\n</script>` by a python3 script with
`assert s.count(anchor)==1`. Declares `var UI={w:1280,h:720}` (safe: var
hoisting + `boot()` runs after the initialiser, so `initGL→onResize→UI.w=w` sees a real object —
this is what makes the harness's old `var UI` shim redundant), `HUDC={hi,sel,unlocked}`,
`MISSION_N=6`, a 2D kit (`hf/tx/rect/light/wrap/css/mmss/blink`), `drawHUD`, `drawMap`,
`drawTitle/Pause/Over/Complete`, `rebuildCity/newGame/selectCity/cityCleared/advanceCity/
gameOver/toTitle`, `uiStep(dt)`, `drawFrame`, `titleCam`, `tick(dt)` (clamps dt to [0,0.05]),
`frame(ts)` (the first `requestAnimationFrame` in the whole file), pointerdown audio-unlock, and
`boot()` with 6 guarded stages incl. **`initFX()`** (finally called by src) and the opt-out
`if(!window.__GTA_TEST__)boot();`.

**Four surgical src edits shipped with it** (grep anchors):
1. `4512 /* Input is diegetic to 'play' only.` — `stepWorld` now wraps
   `footMove`/`driveInput` in `if(GS.mode==='play'){…}`. Previously the title card and pause
   screen could steer the actor (raw-key readers, ungated). 'dead' is deliberately NOT gated:
   `killPlayer()` already zeroes `thr` and sets `hb`, and `stepVehicle()` brakes without input,
   so a killed car keeps coasting.
2. `5686 if(C4C.die<=0){ if(GS.lives>0)respawnPlayer(); else gameOver(); }` — in `missionStep`'s
   dead branch. `respawnPlayer()` **never inspects lives** (always sets mode 'play', ammo
   `[0,24,0,0,0]`, `C4C.job=1.2`), so without this the last life respawned forever and a run
   could never end. This is the only respawn call site.
3. `5579 say(def.brief,3.6);` in `beginMission` — the old code read `m.brief` where `m` is the
   *run record*, so the HUD banner showed the string `"undefined"`.
4. `6149 GS.cityScore=0;` in `advanceCity()` — **found by the harness, not by authoring**:
   `advanceCity` reseeded `cityScore` from the cumulative `GS.score`, so city 2's complete
   screen would print the whole run's score as the per-city tally. Discriminating evidence:
   `score:9000 → cityScore:0` (old code gave 9000).

`GS.cityScore` is the **per-city reward tally that `winMission()` accumulates**
(`GS.cityScore+=m.reward`, src 5591), NOT "score at city start". Three touchpoints must agree:
`newGame` reset (6122), `advanceCity` reset (6149), `drawComplete` print (6085).

Corrections to earlier assumptions (verified by live grep — do not re-apply the wrong ones):
**`GS.modeT` DOES exist** (GS initializer, 3497: `fade:1, modeT:0, deadT:0, …`); **`GS.mapT` does
not exist** and chunk 5 never uses it. `openBrief(ph)` takes a **phone object** and reads
`ph.mi`, so a test cannot call `openBrief(0,0)`. `missionDefs(c)` emits exactly **6** missions.
`SND.complete` (778) / `fail` (777) / `menu` (781) all exist. All three `THEMES` carry
`ground` (0x7d7f7a LIBERTY CITY / 0x9b9178 SAN ANDREAS / 0x6f6a80 VICE CITY). The map screen
draws an **opaque** `#05070a` background then `css(TH.ground)`, so the old
"`showStatics(false)` for the map screen" requirement is **moot — delete it**. Park/water blocks
come from `kindAt(i,j)` over `[i*STRIDE+CFG.R1, CFG.MAX(i)-CFG.R1]`; `PARKBOX` is parked-car
collision AABBs and is deliberately NOT used by the map.

## Chunk 5 verified evidence (`/tmp/run_c5c.txt`, authoritative)
All four green gates: `missing {}` · `log []` · `errKinds {}` ·
`counts {errs:0,stepErrs:0,rendErrs:0,frames:9663,stop:false}`. Also `audit0 {n:6,bad:[],Mesh:324,Group:3}`,
`audit2 {n:249,bad:[],Mesh:1023,Group:241}`, `nanTot {pos:0,uv:0,col:0,nrm:0,tris:0}`,
`rsScan {n:0,r0:-6.5,wx:642.5,wz:406.5}`, `render2:"ok"`,
`per {frames:9663,ms:4970,msPerFrame:0.51}` (**SwiftShader — NOT indicative of real-GPU perf**).
Note `audit2` now audits **SAN ANDREAS** (rebuilt twice by `advanceCity()`/`newGame(1)`), so it is
deliberately NOT comparable to the chunk-4c LIBERTY CITY baseline above.

`R.c5` scenario block (each scenario records its own error keys; all `{}` in the green run):
- **Input gate** — wraps `footMove`/`driveInput` with counting proxies, loops the 7 modes on foot
  then in a car (`veh_<mode>`). Result: play `[30,0,play]`, veh_play `[0,30,play]`, every other
  mode `[0,0,<mode>]`, `gateBad:[]`, `board:VAN`. Proxies are restored unconditionally.
- **Per-screen ink** — `getImageData` over the overlay canvas, sampled grid 7280 points:
  play 640 (`frac:0.088`), title/map/pause/dead/over/complete 7280, brief 1676, banner 648,
  `paintBad:[]` (no screen paints nothing, none throws).
- **Timers** — `uiStep(0.5)` decays `msgT/bigT/fade/modeT` as expected.
- **City clear** — `GS.done` filled to `MISSION_N` → `complete {mode:'complete',done:6,bonus:8000,
  score:9000,unlocked:2,wasUnlocked:1,hi:9000,newHi:1}`; then `advanceCity()` →
  `advance {mode:'play',city:1,th:'SAN ANDREAS',cityScore:0,score:9000,done:0,unlocked:2,sel:1,
  fade:1,veh:208,ped:26,phones:6,statics:303,bad:0}`.
- **Game over** — `over1 {mode:'over',lives:0,bonus:0,score:9000,hi:9000,newHi:1}`; positive
  control `over2 {mode:'play',hp:100,lives:2,ammo:'0/24/0/0/0',invP:1.98,bad:0}`.
- **Brief banner** — `briefFix {phoneWasOn:1,phoneAfter:0,frames:421,started:true,kind:'deliv',
  name:'COURIER 1',msg:'Take the package to the drop point. Do not be late.',msgIsBrief:true,
  saysUndefined:false,bad:0}` (421 frames ≈ the 7 s brief fuse, by design).
- **`newGame(1)` last** — `newgame {th:'SAN ANDREAS',city:1,mode:'play',veh:208,ped:26,box:190,
  police:0,statics:303,plots:70,spawn:848,lives:3,cityScore:0,msg:'STEAL A CAR. STAY OUT OF JAIL.',
  fade:1,bad:0,fx:0}`.

Gameplay keys stayed green through the splice: `guns {shots:10,kills:2,bulletsPeak:1,bad:0}`,
`gunProbe {gun:'UZI/spd112/dmg14/L1.2/rate0.085',poolSame:1,muzzleY:1.24}`,
`police {peakCars:3,cap:3,afterCars:0,bad:0}`, `soak {frames:2400,bad:0,x:166.46,z:-11.21,hp:95.10}`.

**Known limitation of the ink probe:** it proves an overlay painted, not *which* text. `dead` and
`deadNoContinue` both saturate at 7280 because the red wash covers the sampled grid, so the
continue-prompt branch is **not** distinguished by the harness. `frac` only covers the 7 `MODES`.

## Harness state (`tests/harness/mk_smoke.js`, 1070 lines)
- Edit 1 applied (lines 7–10): after `s=s.replace(CDN,'three128.js')` the generated smoke HTML
  injects `<script>window.__GTA_TEST__=1;</script>` so `boot()` never runs and the driver keeps
  full control (no rAF loop racing it, no double `buildCity`). Order is safe: the inserted tag
  has no newline after `<script>`, so the later `s.replace(/<script>\n/, '<script>\n"use strict";…')`
  still targets the game's inline block.
- Driver line 16 is now a **comment only**: the old `var UI={w:1280,h:720}` shim is gone because
  chunk 5 declares `UI` at game scope and the driver is spliced *inside* the game IIFE.
- **Driver text is `String.raw`** (delimiters at lines 14 and 1045) ⇒ **no backticks and no
  `${` anywhere in driver text, including comments**. A stray backtick = `SyntaxError:
  Unexpected identifier` from node's parse of `/tmp/mk_smoke.js`, and `run.sh`'s `set -e`
  means Chrome never runs — the wrapper still prints `EXIT=0`, so read the report file.
- Driver helpers: `step(n,keys)` (34) clears `KEY`, sets `KEY[k]`/`JP[k]`, `trapNew()`,
  `stepWorld(1/60)`, `endFrame()`, firstBad scan, bails at 20 stepErrs. It drives the game's own
  `KEY`/`JP` tables, so any `KMAP` name works as a `keys` key. `elog`→`EKEY`, `actorScan()` (141),
  `r1()` (212), `tp()` (240), `fxRep()` (326), plus `render/tryRender/onRoad/parkNear/
  boardIsolated/nearDbg/matProbe/audit`. Report tail writes `<pre id="out">@@{JSON}@@</pre>` after
  hiding `#boot` and `#ov`.
- **No other shims.** (grep-verified pre-chunk-5: no `PRESTUB`, no `parkedAhead`, no `R.shoot`.)
- Helpers: `tryRender()`, `audit()`, `matProbe()`, `step(n,keys)`, `fxRep()`,
  `boardIsolated(minHp)`, `nearBlocked`, `wallAhead(x,z,a,d,hh,hm)`, `vehAhead`, `clearLane`,
  `findCorridor()`, `stageCar(car)` (stages + reports `wall/pre/avail/pushed/at`),
  `liveKinds()/carOf(k)`, `tp(x,z,a)`, `onRoad()`, `enterCar(v)`, `cx()/cz()`, `r1()`.
- `stageCar` proves its own staging: `pre` is measured *before* `clearLane()` (a car parked
  by `clearLane` can itself close the corridor), `wall` after; `at` reports where the car
  actually ended up (it drifts a few metres while the probes step the world — read it, don't
  assume the lattice point).
- **Driver text is `String.raw`** (delimiters at lines 14 and 1063; the backticks on line 7 are a
  wrapper comment *outside* the raw string) ⇒ **no backticks and no
  `${` anywhere in driver text, including comments**. A stray backtick = `SyntaxError:
  Unexpected identifier` from node's parse of `/tmp/mk_smoke.js`, and `run.sh`'s `set -e`
  means Chrome never runs — the wrapper still prints `EXIT=0`, so read the report file.
- **Chunk-5 driver helpers** (`ink/samples/fr/stage/paint/MODES/ALLK`, ~821–1045): `fr(n,keys)`
  clears `KEY` and sets held keys **only** — never `JP`, so no `jp()` edge can fire and
  `newGame` cannot be triggered by the screen probes. `stage(mode)` pins `C4C.die=9,GS.hp=100,
  GS.wanted=0,GS.heat=0,GS.modeT=0,GS.fade=0`. `ALLK` deliberately holds every axis key at once:
  the axes cancel, so the probes cannot walk the player out of the spawn box.
- **`/tmp/dom.html` survives the run** ⇒ re-query keys with `python3 /tmp/rd.py <keys>`
  without re-running (saved three full runs this session). `rd.py` is **top-level only**:
  `stop`/`errs`/`stepErrs`/`rendErrs` are nested inside `counts` and read as `null`; an
  unknown key also prints `null` (that is not a game error).
- **Never `tail` the report** — earlier keys get cut and look "missing". Redirect to a file
  and read the file (`/tmp/run_gun.txt`).
- Order matters: `soak → soakDied guard → on-foot guard → guns → police → death → jobs →
  c5 block → R.audit2 → R.per`; anything that perturbs `GS.wanted`/`GS.mode`/`GS.mission` runs
  last. Inside `c5`: gate (restores its proxies unconditionally) → screens → timers → complete →
  advance → over → brief → **`newGame(1)` last** (it rebuilds the city). Nothing may call
  `removeActor()` (it corrupts `VEH.indexOf` bookkeeping) — wrecks use `dropVehicle`.
- **A positive control must re-enter the state under test.** `c5.over2` first reported `over`
  instead of `play`: `over1` had already left `dead`, and the `GS.lives` branch only runs inside
  `missionStep`'s dead handler — so the control measured nothing and would have been mis-read as
  a game bug. Fix: `GS.lives=2;GS.mode='dead';GS.fade=0;C4C.die=0.01;` before the control steps.
- **Strict-mode trap:** reading an undeclared *identifier* throws ReferenceError, but a missing
  *property* (`GS.inv`) silently yields `undefined` — `node --check` catches neither. Only
  **`P.inv`** exists (there is no `GS.inv`); the same bug class turned `briefFix.phoneWasOn` into
  a post-call sample (it read 0 because `openBrief()` consumed the phone) — snapshot *before* the
  call: `var wasOn=phb.on;`.
- **`/tmp/mk_smoke.js` may be a stale copy from before a harness edit.** Always go through
  `run.sh`, which re-`cp`s `tests/harness/{mk_smoke.js,rd.py,three128.js}` into `/tmp`.
- Run-to-run variance is real (`Math.random` in traffic/spawn/roadSnap): `soak.hp` measured
  93.9 and 38.8 on two consecutive runs of the same code, `exit veh` 208 vs 81. Only the
  *assertions* (`bad`, `stop`, NaN, ratios) are stable claims.

## Reproduce a report
```
cd $HOME/projects/gta1
sh tests/harness/run.sh log missing errKinds counts soak jobs driveFree topSpeed guns \
  gunProbe police death crash runOver enter exit audit0 audit2 nanTot rsScan render2 per c5 \
  > /tmp/run_c5c.txt 2>&1
python3 /tmp/rd.py log missing errKinds counts c5 audit2 nanTot per
```
`c5` returns the whole nested scenario object (`rd.py` is top-level-only), which is the quickest
way to re-inspect chunk-5 evidence without re-running. Use `is_background:true` — the run is
~50 s wall.
`run.sh <keys>` = awk-extract the inline script → `node --check` (prints `FULL_SYNTAX_OK`) →
`cp tests/harness/{mk_smoke.js,rd.py,three128.js} /tmp` → `node /tmp/mk_smoke.js` (pre-compiles
with `new vm.Script`, prints `smoke written, bytes=`) → Chrome `--headless=new --disable-gpu
--use-angle=swiftshader --enable-unsafe-swiftshader --window-size=1280,720
--virtual-time-budget=60000 --dump-dom` (cwd forced to `/tmp`: `three128.js` is a relative
path) → `python3 /tmp/rd.py <keys>`. ~5 s of sim, 9663 frames, ~50 s wall.
- Line mapping: harness-reported HTML line *N* == `src/gta1.html` line *N*. For
  `/tmp/gta_extract.js` the offset is ≈ +28..32 (recompute by content match).
- `audit()` dedupes by attr/itemSize/material ⇒ its `n=` is the FIRST offending tile.
- `/tmp/missing.js` **HANGS (catastrophic backtracking) — do not run.**

## Outstanding / next actions
1. **Chunk 5 — DONE, verified, committed.** All four green gates plus every `R.c5` assertion;
   evidence in "Chunk 5 verified evidence" above.
2. **The playtest is the user's, not the agent's.** Open `src/gta1.html` in a real browser
   (needs network for the cdnjs r128 tag; `boot()` runs normally there; audio unlocks on first
   `pointerdown`). **Never hand off `/tmp/gta_smoke.html`** — that copy carries the
   `__GTA_TEST__` injection and the driver, so it boots to a blank canvas. Things only a human
   can judge: driving feel, spawn density, mission flow, `crash peakShake`, and whether the HUD /
   map / title / pause / complete screens *say the right words* (the harness proves ink, not text).
3. Still open from chunk 5's list:
   - **On-foot south escape:** `soak` leaves the player at `x:166.46 z:-11.21`, outside the world
     box (`R0=-6.5`). Deterministic — the same `-11.21` in three separate runs, so bounded rather
     than runaway. `footMove` **does** call `CITY.C.resolve(_pb,0.31)` (fn at src 4306, resolve at 4317) and the south
     wall **is** registered in `CITY.C` (src 1585–1588), so this is *not* "foot ignores colliders";
     mechanism not yet diagnosed. Deliberately NOT fixed in the chunk-5 commit — physics changes
     do not belong in the same commit as a large freshly-verified chunk right before a playtest.
     Cars are fine (`edgeWest`/`edgeNorth` report `inWater:0`).
   - Perf: `populateCity` creates 208 vehicles / 190 park boxes; `maintain()` trims the active
     set to ~27 veh / 26 ped. `per msPerFrame:0.51` at 1280×720 **SwiftShader** — proves nothing
     about a real GPU. Now that a real rAF loop exists, check `GS.fps` in a browser too.

## Known issues / blockers
- `soak.hp` can drop ~60 over 2400 frames of throttle-and-turn driving (traffic damage). Not
  a correctness failure, but the soak is now the noisiest number in the report.
- `crash dmg` varies with which sturdy car `boardIsolated` finds (TRUCK 200 hp ⇒ 34 dmg;
  VAN 120 hp ⇒ 7.28) — read `vhp0` alongside it.
- Unverified still: whether `PtPool`'s `ShaderMaterial` renders *correctly* (it emits without
  error; only a screenshot pass can tell); the audio graph; **on-screen text correctness** — the
  `ink()` probe proves an overlay painted, not which words, and `dead`/`deadNoContinue` both
  saturate the sampled grid at 7280, so the continue-prompt branch is undistinguished headlessly.
  Playtest covers this.
- The harness numbers are **SwiftShader** numbers. `per msPerFrame` is not a real-GPU claim.
- No git remote. Nothing is pushed anywhere.

## Git
Branch `main`, identity `kireol / 3438792+kireol@users.noreply.github.com`, **no remote**.
Recent: `450d6c3` **chunk 5** (HUD, map, screens, main loop, `boot()`, plus the 4 surgical
src fixes), `7c03886` chunk 4c (weapons/wanted police/pickups/markers/missions), `53f78fc`
boarding radius + throttle drag, `ba13cd0` NaN geometry + driving physics, `add6241`
foot-velocity fix + island walls, `a4f538c` chunk 4b, `254dbcc` baseline (chunks 1–4a).
`refs/wip/chunk5` → `0b68d96` is a now-redundant recovery net from before verification; safe to
delete.
Every chunk staged **explicit paths only**: `src/gta1.html`, `tests/harness/mk_smoke.js`,
`docs/agent/PROJECT_STATE.md`. **Never stage `tmp/` or `.qwen/skill-curator.json`**
(pre-existing untracked scratch), never `git add -A`.

## Important files
- `src/gta1.html` — the entire deliverable (**6323 lines** with chunk 5; tail is `})();`,
  `</script>`, `</body>`, `</html>`). Chunk 4c body starts ~4560, chunk 5 body ~5739.
- `docs/agent/PROJECT_STATE.md` — this checkpoint.
- `tests/harness/run.sh` — **one-command pipeline**; args are report keys. Read before
  re-running anything by hand.
- `tests/harness/mk_smoke.js` — the harness builder (**1070 lines**; chunk-5 scenario block
  ~821–1045, `R.c5` set at 1045). Reads `three128.js` relative
  to cwd, writes `/tmp/gta_smoke.html`. The driver is spliced **at the end of the game script**
  (before `})();`), and the whole file is one strict-mode *classic script*, so game
  `var`/`function` declarations are real global-object properties — that is what lets the driver
  call `tp()`, `spawnPickup()`, `gun()`, `setWpn()`, `resetCityJobs()` directly, and equally lets
  a scenario monkey-patch a global function binding such as `footMove`/`driveInput` (writable,
  so strict mode does not throw) to count calls.
- `tests/harness/rd.py` — report key selector (reads the persisted `/tmp/dom.html`).
- `tests/harness/undeclared.js` — strict-mode undeclared-assignment heuristic; run it **after**
  `run.sh` (it reads `/tmp/gta_extract.js`).
- `tests/harness/three128.js` — three.js r128 min (603445 B), gitignored; refetch from the
  cdnjs r128 URL in `src/gta1.html` if missing.
- `.qwen/tmp/clips/seg*.mp4` — sampled reference footage. `docs/images/` — empty.
- Scratch in `/tmp` (may not survive reboot): `gta_extract.js`, `gta_smoke.html`, `dom.html`,
  `chrome.err`, `run_c5c.txt` (**authoritative chunk-5 report**), `run_c5b.txt` / `run_c5.txt` /
  `run_gun.txt` (earlier reports), `run_keys.txt`, `mk_smoke.js`, `rd.py`,
  `three128.js`.

## Next action
**Handoff — waiting on the user's browser playtest.** Chunk 5 is verified and committed; nothing
in the repo is mid-flight. When playtest feedback arrives, triage it against the deferred list in
"Outstanding" (on-foot south escape, real-GPU perf / `GS.fps`, `PtPool` ShaderMaterial look,
audio graph, on-screen wording). For any fix that touches physics or the world sim, re-run
`sh tests/harness/run.sh … c5` and require the four green gates before committing.
