---
name: incremental-single-file-build
description: Build a large single-file deliverable (one HTML/JS artifact) by appending verified chunks at a marker, with side-file syntax gating and grep-verified cross-chunk APIs.
source: auto-skill
extracted_at: '2026-11-06T13:59:44.254Z'
---

# Incremental single-file build (marker + side-file gate)

Use when a deliverable must stay **one file** (e.g. a self-contained HTML game/app)
but the code is far too large to author or rewrite in one write. Growing the file by
appending verified chunks keeps every step cheap to check and trivially resumable
after context loss.

## The loop

1. Keep a sentinel in the file where the next chunk goes: `/*__CHUNK__*/` placed just
   before the closing of the IIFE / `</script>`. Never remove it; always insert above it.
2. Author the new chunk in `/tmp/chunkN.js`, not in the deliverable.
3. `node --check /tmp/chunkN.js` — fix until clean.
4. Splice with a **guarded** script (idempotence guard string + marker check):
   ```js
   node -e 'var fs=require("fs"),f="src/app.html";
     var s=fs.readFileSync(f,"utf8"),c=fs.readFileSync("/tmp/chunkN.js","utf8");
     var m="/*__CHUNK__*/";
     if(s.indexOf(m)<0){console.log("MARKER MISSING");process.exit(1);}
     if(s.indexOf("<unique phrase only in this chunk>")>=0){console.log("ALREADY SPLICED");process.exit(1);}
     s=s.replace(m, c.replace(/\n+$/,"")+"\n"+m+"\n");
     fs.writeFileSync(f,s);console.log("lines now",s.split("\n").length);'
   ```
5. Re-check the **whole** file, not just the chunk:
   `awk '/^<script>/{f=1;next}/^<\/script>/{f=0}f' src/app.html > /tmp/extract.js && node --check /tmp/extract.js`
6. Report the new line count each time — it is the cheap progress signal for a
   many-thousand-line artifact, and lets a future session detect a partial splice.

**Rollback:** if a spliced chunk turns out broken, truncate the file back to the
marker with node (`s.slice(0, s.indexOf(m))` + footer) instead of hand-editing. That
restores the last verified state in one step.

## Verify before you call, never assume

The dominant failure mode is calling a cross-chunk API from memory and getting the
signature or identifier wrong. Before writing a chunk that touches earlier code,
`grep -n`/`read_file` the real definition and copy it:

- **Argument order matters more than it seems.** A `Builder.tri(...)`-style helper that
  ends with normals instead of starting with them silently produces inverted/invisible
  geometry. Read the actual parameter list.
- Confirm constant names (`WHITE`, not `WHITEV`), config fields (`CFG.STRIDE`,
  `CFG.LANE_OFF`), registry shapes (`CITY.spawn` entries are `{t:'p'|'d'|'rank',...}`),
  and which units a helper really returns (a `dist2()` that returns `sqrt` — i.e.
  distance, not squared distance — changes every `d < r` test).
- Note parameter *domain*: a `kindAt(bx,bz)` that takes **tile indices**, not world
  coords, needs `kindAt(CFG.TX(x),CFG.TZ(z))` at every call site.

## Structure rules that keep chunks order-independent

- One IIFE, **non-strict, all `var`**. Function declarations then hoist, so a chunk may
  call functions that a later chunk defines (`policeAlarm`, `aiDrive`) and `if (bullets)`
  is safe before `var bullets` is spliced — but the guard requires a real `var`, so
  forward-declare referenced globals (`var markers=null,pickups=null,bullets=null;`)
  rather than relying on `if (undeclared)`.
- Keep one concern per chunk (input/state/FX → physics/camera/spawn → AI/combat/objectives
  → HUD/loop/boot). Defer anything you are unsure about to the next chunk rather than
  stubbing it with something that looks alive.
- Self-review the side file *before* splicing. Real defects caught that way in practice:
  double-registering an object into two arrays, an implicit global from a missing `var`,
  referencing a data structure that does not exist, a comma-expression where a braced
  `if/else` was meant, dead params/fields, and a registrar that reads `pool.name` before
  assigning it (`FX[undefined]`).

## Geometry/animation gotchas worth remembering

- Duplicate coplanar quads emitted inside a symmetric `for(s=-1;s<=1;s+=2)` loop
  z-fight — bake shared parts once outside the loop.
- To animate a limb, bake its geometry around the **joint height** and offset the mesh
  back to that pivot at build time, otherwise rotation swings the limb about its foot.
- Per-particle size + alpha is impossible with `PointsMaterial`: use `ShaderMaterial`
  on `THREE.Points` with `aS/aA/aC` attributes and `gl_PointSize = uPx*size/(-mv.z)`,
  updating `uPx` from the viewport each frame. Per-instance decal fade is likewise
  impossible with a shared material — shrink the instanced quad instead, and use
  `polygonOffset` to stop z-fighting with the ground.

## State file

For multi-session work, mirror the true state (real marker text, chunks done, chunks
left, findings like "r128 still defines `THREE.VertexColors`", "no git repo here so the
file is the only source of truth") into the project's state doc after each splice. Stale
notes about old marker names are worse than none — they send the next session hunting.
