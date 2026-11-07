# PROJECT STATE — Metro Mayhem (web remake of Grand Theft Auto 1)

Last updated: 2026-11-07, **playtest-feedback round verified and ready to commit**. The user
played the chunk-5 build and reported three things (A/D swapped — already fixed; "I see other
people now, but not the main character"; camera tilted / too far out) plus three feature requests
(rename `gta1.html`→`index.html` + de-GTA the strings, straight-down zoomed camera, a controls
overlay). All are implemented and headlessly verified, including **the invisible-player bug, which
was a real game bug** — see "Playtest-feedback round". No remote — nothing is pushed.

## Current state
- `src/index.html` (renamed from `src/gta1.html`, rename is STAGED) = **6507 lines** (`wc -l`),
  `node --check`-clean (`FULL_SYNTAX_OK`), tail `})();` / `</script>` / `</body>` / `</html>`,
  last src line `if(!window.__GTA_TEST__)boot();`.
- `tests/harness/mk_smoke.js` = **1470 lines** (PLAY-PROBE, HELP-PROBE, `?shot=1`/`?help=1`
  screenshot hook and the scene-graph gates added since chunk 5).
- Authoritative report: **`/tmp/run_ply.txt`** (9984 frames, post-fix). Gates:
  `missing {}` · `log []` · `errKinds {}` · `counts {errs:0, stepErrs:0, rendErrs:0, stop:false}`
  · `c5.play.ok:true` (with `c5.play.ply.attach:1`, `inAct:1`) · `c5.help.ok:true`
  · `c5.newgame {plyAttach:1, plyInAct:1, bad:0}` · `audit2 bad:[]` · `per 0.53 ms/frame`.
- Previous authoritative report `/tmp/run_c5c.txt` (9663 frames) still documents chunk 5; it
  **predates** the camera, rebrand, help-sheet and `clearActors` changes, so its `audit2 n:249`
  and its city names (LIBERTY CITY / SAN ANDREAS) are historical.
- The previous "CHECKPOINT — exact state if the session restarts right now" block (chunk 5
  unverified/uncommitted, `refs/wip/chunk5` as the recovery net, the pre-splice `/tmp` artifacts)
  is **retired**: that tree is now committed (`0229719` chunk 5, `871b51c` docs follow-up), so
  `git show HEAD:src/index.html` *is* the last committed game. `refs/wip/chunk5` → `0b68d96` is
  left in place; see "Git" for what it still uniquely holds.
- **What the harness cannot prove, and only a human can:** whether the thing is *fun* and looks
  right — driving feel, spawn density, the `PtPool` `ShaderMaterial` particles, the audio graph,
  HUD legibility at real DPR, `GS.fps` and frame pacing on a real GPU.
- **Only known live bug:** on-foot travel escapes the world box south (`soak` ends at
  `z:-11.21`, deterministic across 3 runs; box `z` starts at `R0=-6.5`). Cars are held by the
  boundary colliders. Deferred deliberately — see "Outstanding".
- **Reboot-safety / scratch policy:** nothing important lives in `/tmp`. The spliced copy inside
  `src/index.html` is the source of truth for the game, `tests/harness/` holds the harness, and
  `git show HEAD:src/index.html` reproduces the committed file byte-exactly. The old chunk-5
  authoring drafts (`/tmp/c5c.js` spliced, `/tmp/c5b.js` never spliced) are now redundant.

## Current objective (unchanged)
Deliver ONE self-contained HTML file (`src/index.html`) that is a playable web version of
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

## Playtest-feedback round (the 5 changes since chunk 5, all verified)
User's words: *"I think A and D keys are swapped. The game loads. I don't see any people yet"*,
then *"Change the users view so the camera is directly overhead looking straight down instead of
tilted, and zoom in closer. I see other people now, but not the main character."*, then the rename
/ rebrand request, then *"please make it so pressing F12 will show the controls"*.

1. **Invisible player — REAL BUG, root-caused.** `spawnPlayer()` (src 4477) registers the player
   with `addActor(P.g)` (⇒ `scene.add` + `ACT.push`), but `newGame` calls `spawnPlayer` **before**
   `populateCity()`, and `populateCity` opens with `clearActors()`, which did
   `for(i...)scene.remove(ACT[i])` over the whole array — including `P.g` — and then truncated it.
   Nothing re-added him, so from the *second* frame of the session onward the player was a
   parentless `Group`: three.js silently skips parentless objects, while camera follow, physics,
   collisions and the peds' flee logic all kept working on him. Hence "I see other people now, but
   not the main character". Fix (src ~3763): `clearActors` skips `P.g` and re-registers it.
   Nothing else iterates `ACT` (maintain uses VEH/PED), so he simply survives the rebuild.
   **Why 5 earlier harness runs missed it:** every player gate was projection/physics *arithmetic*.
   The gates that now pin this: `c5.play.ply.attach` (`P.g.parent===scene`), `c5.play.ply.inAct`,
   and `c5.newgame.plyAttach`/`plyInAct` sampled right after `newGame(1)` — the exact path that
   orphaned him. Corroborating: `audit2.n` 249 → **255** (the player's 6 unique material/geometry
   combos are now present at audit time), and the `?shot=1` probe flipped from
   `par:"none", inAct:0` to `par:"Scene#240", inAct:1`.
   **The lesson, in one line: arithmetic was green while the pixels were empty — a screenshot is a
   first-class gate, not a demo.** `shotPix` at screen centre went `[59,62,64]` (asphalt) →
   `[60,51,43]` (jacket/head), and the centre crop shows a blue torso + dark head.
2. **A/D swap + steering** — fixed in `53f78fc`/earlier; the PLAY-PROBE gate
   `c5.play.walkOK`/`drive.rightTurnsClockwise` keeps it honest.
3. **Crowd visible** — `CROWD={ped:32,veh:18}`, `DESP_R 118→52`, `SPAWN_MIN/MAX 38/64→28/40`,
   `PED_MIN 10→6`; the old despawn radius streamed the crowd off-screen entirely. Gate
   `c5.play.pedOK` requires ≥24 peds on screen, ≥20 distinct spots, nearest 5–12 m, median ≥16 px.
4. **Camera** — `PLAYCAM` is now a straight-down **OrthographicCamera** (`up=(0,0,-1)`, basis set
   in `camUpdate`), not a tilted perspective eye. `CFG.VIEWW` (now **46**) is the ONLY zoom knob
   (`camFit` is the only writer of `VIEW`); `CFG.CAMH` does not frame an ortho camera, it only
   clears the near plane above the tallest roof. Headless viewport is 1280×633 ⇒ `VIEW={x:23,
   z:11.37}`, 27.8 px/m (depends only on canvas width). At 36 m the frame showed no rooftops;
   the user picked 46 from 36/46/56/64.
5. **Rename + rebrand** — `src/gta1.html` → **`src/index.html`** (`git mv`, rename staged; the
   `.gitignore` comment and `run.sh`'s awk path follow it). Title/branding strings are now
   **METRO MAYHEM**, logo mark **`MM`**, themes **MERIDIAN CITY** (was LIBERTY CITY) /
   **PACIFIC CITY** (was SAN ANDREAS) / **PALM CITY** (was VICE CITY). Deliberately left alone
   (user's "leave internals alone"): ~75 GTA-derived street/district/brand strings inside the
   generator tables, the `window.__GTA_TEST__` opt-out, and 3 code comments that still say GTA.
   The `MM` mark is confirmed painted in both screenshots.
6. **Controls sheet** — the user asked for **F12**; F12/F1 are browser-reserved (DevTools / macOS
   media key), so the sheet is on **`?`** (`e.code==='Slash'`) with a **permanent HUD chip**
   (`drawHelpChip`, last paint of `drawHUD`) and a blinking `PRESS ? FOR CONTROLS` line on the
   title card. `GS.helpFrom` restores the previous mode on close. Gate `c5.help.ok` (scenario 6.6)
   checks the keydown is prevented, exactly one key (`Slash`) opens it, the sheet actually moves
   ink on the overlay (`moved>8`), and the chip restores. Proven on screen: full CONTROLS table +
   `? or ESC — Close this list` + `PRESS ? TO GO BACK`.

## Baseline checkpoint (chunk 4c — the run that predates chunk 5; kept for comparison only)
At commit `7c03886` (5720 lines) `src/index.html` was `node --check`-clean (`FULL_SYNTAX_OK`) and
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

## Playtest-round verified evidence (`/tmp/run_ply.txt`, AUTHORITATIVE)
```
FULL_SYNTAX_OK   smoke written, bytes=361127
missing {}   log []   errKinds {}
counts {errs:0, stepErrs:0, rendErrs:0, frames:9984, stop:false}
per {frames:9984, ms:5303, msPerFrame:0.53}          # SwiftShader, not a GPU claim
audit2 {n:255, bad:[]}                                # was 249 pre-fix: +6 player meshes visible
c5.play {ok:true, err:none, walkOK:true, drive.rightTurnsClockwise:true,
         ply:{ndc:[0,0], onScreen:1, centrePx:0, fpPx:18, attach:1, inAct:1}, plyOK:true,
         ped:{onScreen:…, fp8:…, within18:…, spots:…, nearest:…, median:…, fpPxMedian:…}}
c5.help {ok:true, moved>8, keys:['Slash'], Slash:true}
c5.newgame {plyAttach:1, plyInAct:1, bad:0, city:1, mode:'play', …}
```
`?shot=1` probe (separate Chrome run over `file:///tmp/gta_smoke.html?shot=1`, dump-dom, extract
`img#shot`): `shot {mode:'play', ply:[295,181.9], peds:32, cam:[295,90,181.9], ortho:1, vieww:46,
size:[1280,633], rend:'ok'}` and
`shotPly {mode:'foot', gVis:1, tri:7, gPos:[295,0,181.9], box:[294.6,295.4,0,1.8,181.4,182.4],
inAct:1, actN:226, par:"Scene#240", sceneN:240, lr:[-23,23,11.4,-11.4], nf:[2,2000], zoom:1,
ndc:[0,0], pxPly:[640,317]}`, `shotPix:[60,51,43,255]` at centre vs ring
`[[54,57,59],[82,88,92],[58,61,63],[68,73,77]]` (asphalt). `shotErr` null.
Screenshot on disk: **`/tmp/ply_fixed.png`** (1 265 509 B, 1280×633) — a blue torso + dark head
sits exactly at screen centre, straddling the double yellow line; the same crop was empty asphalt
before the fix. Earlier frames kept for reference: `/tmp/play46.png` (pre-fix, empty centre),
`/tmp/v46b.png` (CONTROLS sheet), `/tmp/probe46.png` (pre-fix probe run).

## Chunk 5 verified evidence (`/tmp/run_c5c.txt` — HISTORICAL, predates the camera/rebrand/`clearActors` work)
All four green gates: `missing {}` · `log []` · `errKinds {}` ·
`counts {errs:0,stepErrs:0,rendErrs:0,frames:9663,stop:false}`. Also `audit0 {n:6,bad:[],Mesh:324,Group:3}`,
`audit2 {n:249,bad:[],Mesh:1023,Group:241}`, `nanTot {pos:0,uv:0,col:0,nrm:0,tris:0}`,
`rsScan {n:0,r0:-6.5,wx:642.5,wz:406.5}`, `render2:"ok"`,
`per {frames:9663,ms:4970,msPerFrame:0.51}` (**SwiftShader — NOT indicative of real-GPU perf**).
Note `audit2` now audits **SAN ANDREAS** (renamed **PACIFIC CITY** since; rebuilt twice by
`advanceCity()`/`newGame(1)`), so it is deliberately NOT comparable to the chunk-4c
LIBERTY CITY (now MERIDIAN CITY) baseline above.

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

## Harness state (`tests/harness/mk_smoke.js`, 1470 lines)
### New since the playtest round — read this before touching the driver
- **Three new scenarios**, in driver order: **PLAY-PROBE** (`C.play`, ~1000–1225: walk direction,
  clockwise turn, ped legibility, player centre+attach), **HELP-PROBE** (scenario 6.6, ~1240–1310),
  **`newGame(1)` attach check** (scenario 7, ~1317–1341). The tail `?shot=1` / `?help=1` screenshot
  hook sits after `R.per` and is the last thing before the report is written.
- **Screenshot recipe (the only one that works).** Build with `run.sh` (or `cp tests/harness/*  /tmp
  && node /tmp/mk_smoke.js`), then load `file:///tmp/gta_smoke.html?shot=1[&help=1]` with
  `--dump-dom` and base64-extract `img#shot`:
  `re.search(r'id="shot"[^>]*src="data:image/png;base64",…')` → 1 687 348 b64 chars → 1 265 509-byte
  PNG. **`--screenshot` does NOT work** — it fires before the hook runs, so both attempts returned
  the *same* 4250-byte all-black 1280×720 box; do not trust it as "the game renders black".
  Parse the report in shot mode with `r'<pre id="out"[^>]*>(.*?)</pre>'` — the `[^>]*` is
  **mandatory** there because that `pre` is written with `style="display:none"`.
- **Driver-scope trap (bit me 3×: `r1`, `tryRender`, `projAt`).** The scenario helpers live in the
  driver's own closure and are **not visible in the tail `?shot=1` hook**; a `ReferenceError` there
  kills `R.shot` *silently* (it throws while building the object literal, after `img.src` was
  already painted, so the screenshot looks fine and only `shotErr` tells the truth). Tail code must
  use local helpers (`rr`, inline `new THREE.Vector3(...).project(camera)`, inline
  `renderer.render(scene,camera)` in a try/catch — those three ARE game-scope `var`s).
- **`slog` truncates at 200 chars** (`H.log.push(String(x).slice(0,200))`) ⇒ log *failures only*,
  never a whole probe object, or the diagnostic is cut mid-field.
- **Player-visibility gates are scene-graph gates, not projection gates.** `PL.plyOK` now requires
  `attach===1 && inAct===1` on top of `onScreen/centrePx/fpPx`; projection was green for two windows
  while the renderer never saw him. Scenario 7 re-checks it after the city rebuild.
- **`timeout` is not installed on macOS** and chained `sleep` is blocked by the tool wrapper — poll
  a sentinel (`; echo exit=$? > /tmp/x.status`) from a background shell instead.
- Two Chromes must never run against the same `/tmp/gta_smoke.html` (each rewrites `/tmp/dom.html`);
  give each its own `--user-data-dir` and output file, and never rebuild the page mid-run.

### Carried from chunk 5 (still true)
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
sh tests/harness/run.sh log missing errKinds counts c5 audit2 nanTot per \
  > /tmp/run_ply.txt 2>&1          # run in background; ~70-90 s wall
python3 /tmp/rd.py log missing errKinds counts c5 audit2 nanTot per
```
The full key list still works too (it just prints more):
`sh tests/harness/run.sh log missing errKinds counts soak jobs driveFree topSpeed guns \
  gunProbe police death crash runOver enter exit audit0 audit2 nanTot rsScan render2 per c5`
`c5` returns the whole nested scenario object (`rd.py` is top-level-only), which is the quickest
way to re-inspect chunk-5 evidence without re-running. Use `is_background:true` — the run is
~70 s wall.
To re-query an existing report without re-running, `python3 /tmp/rd.py <keys>` reads the persisted
`/tmp/dom.html`. For the screenshot pass, `dom.html` is NOT the right file — re-dump with
`?shot=1` into its own file and base64-extract `img#shot` (see the recipe in "Harness state").
`run.sh <keys>` = awk-extract the inline script → `node --check` (prints `FULL_SYNTAX_OK`) →
`cp tests/harness/{mk_smoke.js,rd.py,three128.js} /tmp` → `node /tmp/mk_smoke.js` (pre-compiles
with `new vm.Script`, prints `smoke written, bytes=`) → Chrome `--headless=new --disable-gpu
--use-angle=swiftshader --enable-unsafe-swiftshader --window-size=1280,720
--virtual-time-budget=60000 --dump-dom` (cwd forced to `/tmp`: `three128.js` is a relative
path) → `python3 /tmp/rd.py <keys>`. ~5 s of sim, 9663 frames, ~50 s wall.
- Line mapping: harness-reported HTML line *N* == `src/index.html` line *N*. For
  `/tmp/gta_extract.js` the offset is ≈ +28..32 (recompute by content match).
- `audit()` dedupes by attr/itemSize/material ⇒ its `n=` is the FIRST offending tile.
- `/tmp/missing.js` **HANGS (catastrophic backtracking) — do not run.**

## Outstanding / next actions
1. **Playtest-feedback round — DONE, verified, about to be committed** (rename + rebrand, ortho
   plan camera + `VIEWW:46`, crowd retune, `?` controls sheet + HUD chip, **invisible-player fix**).
   Evidence: "Playtest-round verified evidence" above.
2. **Chunk 5 — DONE, verified, committed** (`0229719`, docs follow-up `871b51c`).
3. **The playtest is the user's, not the agent's.** Open `src/index.html` in a real browser
   (needs network for the cdnjs r128 tag; `boot()` runs normally there; audio unlocks on first
   `pointerdown`). **Never hand off `/tmp/gta_smoke.html`** — that copy carries the
   `__GTA_TEST__` injection and the driver, so it boots to a blank canvas. Things only a human
   can judge: driving feel, spawn density, mission flow, `crash peakShake`, and whether the HUD /
   map / title / pause / complete screens *say the right words* (the harness proves ink, not text).
4. Still open from chunk 5's list:
   - **On-foot south escape:** `soak` leaves the player at `x:166.46 z:-11.21`, outside the world
     box (`R0=-6.5`). Deterministic — the same `-11.21` in three separate runs, so bounded rather
     than runaway. `footMove` **does** call `CITY.C.resolve(_pb,0.31)` (fn at src 4306, resolve at 4317) and the south
     wall **is** registered in `CITY.C` (src 1585–1588), so this is *not* "foot ignores colliders";
     mechanism not yet diagnosed. Deliberately NOT fixed in this commit either — physics changes
     do not belong in the same commit as a rebrand + camera + render-graph change.
     Cars are fine (`edgeWest`/`edgeNorth` report `inWater:0`).
   - Perf: `populateCity` creates 208 vehicles / 190 park boxes; `maintain()` trims the active
     set to ~27 veh / 26 ped. `per msPerFrame:0.53` at 1280×633 **SwiftShader** — proves nothing
     about a real GPU. Now that a real rAF loop exists, check `GS.fps` in a browser too.
   - **Cosmetic, deliberately untouched:** `hd=mk(g.head,null)` in `makePlayer()` (src ~3447) gives
     the head `MAT.pant` (dark navy) instead of a skin material, so from directly overhead the head
     reads as a dark blob. Visible in the playtest screenshots; not worth a physics-adjacent commit.

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
Branch `main`, identity `kireol / 3438792+kireol@users.noreply.github.com`, **no remote** — nothing
is ever pushed. Recent (newest first, `git log -n 3` is authoritative): `871b51c` PROJECT_STATE
docs follow-up, `0229719` **chunk 5** (HUD, map, screens, main loop, `boot()`, +4 surgical src
fixes), `7c03886` chunk 4c, `53f78fc` boarding radius + throttle drag, `ba13cd0` NaN geometry +
driving physics, `add6241` foot-velocity fix + island walls, `a4f538c` chunk 4b, `254dbcc` baseline.
**The playtest-feedback round is uncommitted as of this section** and consists of: `git mv
src/gta1.html src/index.html` (already staged as a rename) + the rebrand strings, the ortho plan
camera, `VIEWW:46`, the crowd retune, the `?` help machine, the `clearActors` fix, the two harness
follow-ups (`.gitignore` comment and `run.sh`'s awk path both referenced `src/gta1.html`), plus
this file.
`refs/wip/chunk5` → `0b68d96` ("WIP on main: 7c03886") is the **pre-verification snapshot and is
NOT an ancestor of main** (`git merge-base --is-ancestor` fails). Verified delta vs HEAD: exactly
the `advanceCity()` cityScore fix in src, plus the 241-line `R.c5` harness block — i.e. it holds
nothing unique, so `git update-ref -d refs/wip/chunk5` only discards the pre-fix variant.
Every chunk staged **explicit paths only**: `src/index.html`, `tests/harness/mk_smoke.js`,
`tests/harness/run.sh`, `.gitignore`, `docs/agent/PROJECT_STATE.md`. **Never stage `tmp/` or
`.qwen/skill-curator.json`** (pre-existing untracked scratch), never `git add -A`.

## Important files
- `src/index.html` — the entire deliverable (**6507 lines**; renamed from `src/gta1.html`; tail is
  `})();`, `</script>`, `</body>`, `</html>`). Chunk 4c body starts ~4560, chunk 5 body ~5739.
- `docs/agent/PROJECT_STATE.md` — this checkpoint.
- `tests/harness/run.sh` — **one-command pipeline**; args are report keys; awk-extracts from
  `src/index.html`. Read before re-running anything by hand.
- `tests/harness/mk_smoke.js` — the harness builder (**1470 lines**; chunk-5 scenario block
  ~821–1045, PLAY-PROBE ~1000–1225, HELP-PROBE ~1240–1310, `newGame(1)`+attach ~1317–1341,
  `R.c5` set ~1343, `?shot=1` hook in the report tail). Reads `three128.js` relative
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
  cdnjs r128 URL in `src/index.html` if missing.
- `.qwen/tmp/clips/seg*.mp4` — sampled reference footage. `docs/images/` — the three frames the
  README embeds (`gameplay-plan-view.png`, `controls-sheet.png`, `invisible-player-before.png`),
  all 1280×633, committed.
- Scratch in `/tmp` (may not survive reboot): `gta_extract.js`, `gta_smoke.html`, `dom.html`,
  `chrome.err`, `run_ply.txt` (**authoritative current report**), `ply_fixed.png`
  (**post-fix play screenshot, 1.27 MB**), `shotdom3.html` (its dump), `shot3.status`,
  `chrome_shot3.err`, `play46.png` / `probe46.png` / `shotdom2.html` / `playdom.html` (pre-fix
  frames + probes), `v46b.png` / `shotdom.html` (CONTROLS-sheet frame), `run_c5c.txt`
  (chunk-5 report), `run_c5b.txt` / `run_c5.txt` / `run_gun.txt` (earlier reports),
  `mk_smoke.js`, `rd.py`, `three128.js`.

## Next action
**Playtest-feedback round is committed (`08b812c`), and so are README.md + the three `docs/images/`
frames (`9c95d2c`, pushed). Two README corrections from the user after that push: (1) THREE models
built this, not two — primary **Qwen 3.8 Flash Next** (the model the reference README names) plus the
2 × `Qwen3.6-35B-A3B-GGUF:UD-Q4_K_S` `--fast` pair; (2) this repo is a **follow-up** to
[kireol/qwen3.8_GTA_one_shot_test](https://github.com/kireol/qwen3.8_GTA_one_shot_test), **not a
fork** — no code, history or assets carried over; what is inherited is the method and the primary
model, and 128K-vs-64K context remains the only setup change. Push rule for
`https://github.com/kireol/Qwen3.8-GTA-1-Test-2` (user-authorized for that one URL): fast-forward
only, never force; stop and report if the remote is non-empty and not an ancestor of HEAD.** The
things his eyes are still the only instrument for: whether `VIEWW:46` feels right at a real window
size and DPR, whether the dark head material reads as a head, `GS.fps` on a real GPU, the `PtPool`
look, and the audio graph.
The one known live bug to triage next is the **on-foot south escape** (`soak z:-11.21`) — it needs a
physics diagnosis, not a guess, and it must be a separate commit. For any fix that touches physics
or the world sim, re-run `sh tests/harness/run.sh … c5` and require the green gates **plus**
`c5.play.ply.attach:1` and `c5.newgame.plyAttach:1`, and take a `?shot=1` frame: arithmetic was
green for two windows while the player was invisible.
