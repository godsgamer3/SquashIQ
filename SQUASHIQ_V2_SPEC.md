# Squash IQ 2.0 — Product & Technical Specification

Updated: 2026-11-23. This document supersedes **product-direction and input-mapping guidance** in older handoff notes where they conflict, but does not invalidate existing working code.

## 1. Mission and audience

Squash IQ is a **Korean-language, web-first introduction to squash** for new members of an in-company squash club. The club president is a game programmer, not a 3D artist or animator. The website informs beginners before their first lesson; a 10–15 minute interactive 3D tutorial lets them rehearse core concepts before entering a real squash court.

Success criteria: first-time players understand forehand vs. backhand, where to stand and move, the ball's wall/floor path, safety and compact racket preparation near walls/other players, and returning toward the T. The simulation supplements—not replaces—coach-supervised physical instruction. Do not overclaim real-world biomechanics.

## 2. Website IA — tutorial is one menu item, not the whole website

- Home: accessible overview, immediate intro and tutorial entry.
- About squash: sport overview, history, characteristics, benefits (avoid unsupported medical claims).
- Rules & safety: scoring, court lines, serve basics, let/stroke at beginner level, safe racket swing and player clearance. Verify formal rules against an authoritative source before publishing.
- Techniques: forehand/backhand, straight, cross, boast, drop, volley, footwork, T positioning. Explain with short text and illustrations/animations, linking to the relevant stage.
- **3D Tutorial / Squash Academy:** staged hands-on teaching.
- Club: optional club introduction and onboarding; no internal/private data without explicit approval.

Use responsive semantic HTML UI and Korean copy; navigation and instructional content stay accessible and searchable. Keep existing useful content and routes intact.

## 3. Visual and interaction style

- Stylized low-poly / clean 3D, not photorealism. Court geometry, walls, floor and lines should be readable and dimensionally consistent.
- Elevated fixed rear camera facing the front wall, with view of court depth and T. A temporary side/onboarding demonstration view may illustrate a swing; gameplay camera does not chase player.
- 3D character: simple rigged/procedural figure with articulated shoulder, elbow, torso, legs, wrist/racket; locomotion and stroke animation. Start with procedural assets; documented-license external GLB animation assets are optional, not required.
- Ball: physically meaningful 3D x/y/z, wall and floor bounces; visible shadow and optional trail and landing prediction. Avoid misleading physics; preserve/refactor tested code when useful.
- UI: short Korean tutorial prompts, target zone overlays, charge gauge, contextual guidance, stage progress; keyboard/mouse desktop-first and clear unsupported-mobile fallback.

## 4. Controls — user-approved *NEW* intent, reconcile with repo

- WASD: move on court.
- Mouse movement: direction/aim (design an intuitive mapping for fixed perspective and make it testable).
- **Left mouse hold/release = forehand. Right mouse hold/release = backhand** (LATEST intent). An older `AGENTS.md` and current solo mode invert these bindings: left=backhand/right=forehand. Do not silently rely on old mapping. Update new tutorial controls and instructional UI accordingly; preserve legacy mode if necessary until explicit migration.
- Hold: prepare/charge, show power gauge; release: swing. Charge and timing should be novice-friendly.
- Advanced stage: while holding, circular/curved mouse gesture indicates compact racket preparation with bent elbow and shoulder/torso rotation; straight vertical drag indicates exaggerated backswing with greater clearance risk, and no gesture yields a short weaker swing. Gesture tolerance should be forgiving; this is an educational abstraction, not a scientifically validated motion-capture system.
- Shot outcome follows player's body orientation, racket contact and ball geometry; do not simply map four keys to straight/cross/boast in the NEW tutorial. Old 7/8/9/0 CPU mode may remain as legacy until integrated.
- Only intercept context menu over active game canvas, not the entire site. Respect browser keyboard focus.

## 5. Progressive tutorial — target 10–15 minutes

1. Forehand straight (front/mid-court target): WASD + left-click charge/release; short explanation and 3–5 successful hits.
2. Backhand straight: unlock right-click; repeat opposite-side shot.
3. Forehand volley: hit before floor bounce; timing cue.
4. Backcourt straight forehand & backhand: introduce compact rotating backswing gesture; compare wall clearance near rear glass, teach safe preparation.
5. T recovery footwork: compare turning and recovering versus controlled backward steps; avoid teaching dangerous blind backward running.
6. Alternating left/right feeds: combine strokes and recovery; prioritize understanding rather than punishing timing.
7. Mini challenge: multiple feeds; evaluate target hit, reasonable wall clearance and T recovery separately.

Stage teaching has a single *new* primary skill at a time, soft scoring and brief feedback. Coach should review exact sequence and instructional cues (original lesson sequence also included additional backhand straight practice, repeated forward and deep drives). Data-drive stages and target areas for easy changes. No required login or backend for MVP; optional local progress persistence.

## 6. First playable vertical slice (MVP)

Implement *only* Stage 1 first, inside site navigation:

1. Existing website still works; '3D 튜토리얼' menu opens a distinct scene.
2. Stylized 3D court with fixed elevated rear camera, clear T, boundaries, front wall and target area.
3. A procedurally generated stylized articulated player, WASD movement and body orientation.
4. A coherent forehand preparation/swing animation triggered by left mouse hold/release, visible charge gauge.
5. A supplied ball using 3D flight, front-wall and floor reflections, with deterministic reset and target-zone hit checks.
6. Success/failure instruction text and a stage restart action. Make it possible to complete the exercise end-to-end.
7. Test and build/deploy validation. Demo playable locally and compatible with Vercel.

Do **not** start by building seven shallow mock stages. Make one usable lesson, then add stage architecture, backhand/volley, gesture and recovery in later increments.

## 7. Architecture and repo constraints

Live repo: https://github.com/godsgamer3/SquashIQ ; published URL noted in repository: https://squash-iq.vercel.app/ . As checked on 2026-11-23, root contains `index.html`, `practice.js`, `practice-physics.js`, `practice.css`, `tests/`, `AGENTS.md`, `CODEX_HANDOFF.md`, `vercel.json`. Existing `CODEX_HANDOFF.md` mentions solo 2D Canvas, 240 Hz physics, 60% learning tempo, and `node --test tests/physics.test.js`. These are historic notes: confirm all details by inspecting actual files before changes.

- Do not assume React or Vite already exists. Prefer **incremental JS + Three.js** integration if current static HTML site is maintainable; propose React/Vite migration only with concrete, reviewed rationale.
- Preserve working legacy solo/CPU functionality until new tutorial is ready. Keep physics model separate from rendering; consider adapting existing `practice-physics.js` before implementing a duplicate engine.
- Source/assets must be suitable for public web deployment. No unlicensed characters, stock models, copyrighted songs or borrowed animation files without licenses.
- Keep physics stable with deterministic tests for front wall, side wall, floor, service target, racket clearance approximations and lesson completion.
- Avoid unnecessary server/database. Prefer responsive site, desktop-focused 3D experience, performance budgets and fallback instructions.
- Document coordinate conventions (x left-right, y court depth, z height or equivalent) and camera mapping; avoid mixing the old physics coordinate frame with Three.js default without explicit conversion.

## 8. Delivery and quality bar

For every implementation milestone report: what changed, how to launch, observed behavior, automated/manual tests, known deficiencies, what needs coach validation. Only claim a test passed after actually running it. Maintain small logical commits; don't force-push or delete existing code without approval. Explain risky migrations before applying them.

## 9. Implementation phases

- Phase 0: repository audit, screenshot/site baseline, tests baseline, identify old input mappings and content routing; outline a safe integration plan.
- Phase 1: Stage 1 playable vertical slice with court + player + ball + feedback, keeping legacy site.
- Phase 2: integrate stage data definitions, backhand and volley.
- Phase 3: compact backswing gesture + procedural shoulder/elbow/racket animations + collision/clearance feedback.
- Phase 4: T recovery footwork, chained feeds and mini challenge.
- Phase 5: Polish educational articles, accessibility, onboarding, mobile handling and site deployment.

## 10. Non-goals for MVP

No online PvP, exhaustive CPU simulation, photorealistic models, advanced motion capture, account system, full tournament mode or heavy RPG-like progression. The product is a **teachable squash onboarding experience**, not a generic arcade game.
