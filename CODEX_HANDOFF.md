# Squash IQ - Development Handoff

> 2026-11-23: 2.0 Phase 0/1 현황과 실행·좌표·검증·한계는 [PHASE1_HANDOFF.md](PHASE1_HANDOFF.md)를 참조하세요. 신규 3D 튜토리얼은 왼쪽 포핸드이며 기존 2D 매핑은 유지됩니다. 아래는 기존 구현의 이력입니다.

## 1. Project Goal

Squash IQ is an interactive browser experience for people who are new to squash.

The concept began as a website explaining squash and expanded into a playable learning experience.

The project should allow users to learn squash concepts by directly moving a player and choosing shots rather than only reading explanations.

The product should remain approachable as a website.

---

## 2. Current Core Interaction

Updated implementation (2026-11-05):

- Practice opens a mode menu: Solo and CPU, both with A–E character selection.
- Solo is implemented in `practice.js`, `practice-physics.js`, and `practice.css`.
- Solo controls: WASD movement; mouse position aim; hold/release left for backhand,
  right for forehand; R for a new ball. Buttons choose the stroke; relative ball
  position, height, and reach determine whether it makes contact.
- Solo physics uses x/y/z and velocities, gravity, and dissipative wall/floor
  reflections at a fixed 240 Hz. Rendering is Canvas. Two floor bounces, tin or
  a simplified uniform 4.6m out height end the current ball; no full match rules.
- Ball simulation now runs at 60% learning tempo; player movement and charging
  remain in real time. Ball trajectories and reflection angles are preserved.
- Solo charging uses a small vertical gauge beside the player (left backhand,
  right forehand), held briefly after impact. Height ticks, rising/falling arrows,
  speed-coloured trails and a next-bounce prediction make motion easier to read.
- The gauge also remains visible empty while idle. Solo asset URLs have an
  explicit revision to refresh cached scripts after updates.
- Floor restitution was reduced from 0.72 to 0.45 after playtest feedback. A
  representative drive rebounds to about 0.3m rather than about 0.75m. This is
  prototype tuning, not a calibrated competition ball. Resting balls do not
  generate repeated floor-impact events.
- Character differences currently affect speed, charge rate, reach and launch
  speed. Drop/lob specialty controls and stamina are not implemented.
- CPU remains the original keyboard/path-animation prototype in `index.html`.
  Character selection currently changes its player movement speed only.
- Both renderers already use Canvas; Canvas migration is not pending work.
- Run `node --test tests/physics.test.js` for deterministic physics checks.
- Next: playtest contact/charge tuning, then share the new physics with CPU.
  Online play is a future separate menu; no network code exists.

The following describes the original CPU prototype and earlier direction:

Player movement uses:

W / A / S / D

Shot selection uses:

7 - Straight  
8 - Cross  
9 - Boast  
0 - Drop

The intended interaction is approximately:

Opponent hits ball  
→ player reads ball trajectory  
→ player moves into position  
→ player selects a shot  
→ ball travels according to selected shot  
→ player returns toward the T  
→ rally continues

Shot choice should eventually matter tactically.

---

## 3. Shot Meanings

### Straight

Ball is played largely along the same side of the court.

Learning purpose:

- basic pressure shot
- keeping the opponent behind
- understanding side-wall control

### Cross

Ball travels toward the opposite side of the court.

Learning purpose:

- changing direction
- moving the opponent laterally
- understanding when changing sides is useful

### Boast

Ball reaches the front wall via a side wall.

Learning purpose:

- showing a distinctly different squash trajectory
- pulling the opponent forward
- teaching side-wall usage

### Drop

Short attacking shot near the front.

Learning purpose:

- exploiting an opponent positioned deep
- understanding risk versus reward
- introducing front-court play

These shot types should have visually and tactically distinguishable behaviour.

---

## 4. Product Direction

Continue with the browser-based implementation.

Do not migrate to Godot at this stage.

Reasons:

- Squash IQ is primarily a web learning experience.
- Users should be able to open a URL and immediately try it.
- Educational pages and gameplay should exist naturally in the same site.
- Current gameplay complexity does not yet require a full game engine.
- GitHub + Vercel provide a simple deployment pipeline.

Godot can be reconsidered later if the project becomes focused on:

- character animation
- sophisticated opponent AI
- full match simulation
- advanced physics
- complex scene management
- large amounts of game-specific content

For now, web technology remains the preferred direction.

---

## 5. Recommended Technical Direction

Do not immediately rewrite the existing application.

First inspect its current implementation.

Long-term preferred separation:

Game
- owns overall game state and update loop

Player
- position
- movement
- state

Opponent
- basic AI
- positioning
- return behaviour

Ball
- position
- velocity
- wall interactions

ShotSystem
- Straight
- Cross
- Boast
- Drop trajectory definitions

Court
- court geometry
- boundaries
- important positions such as the T

Input
- WASD
- 7 / 8 / 9 / 0

Renderer
- Canvas drawing

HUD / Tutorial
- HTML UI
- explanations
- feedback

This is a direction, not a requirement for an immediate rewrite.

---

## 6. Canvas Migration

If gameplay currently depends heavily on DOM positioning, consider gradually moving the game scene to Canvas.

Preferred eventual structure:

HTML / CSS
- website content
- navigation
- instructions
- tutorial
- buttons
- HUD

Canvas
- court
- players
- ball
- shot trajectories
- gameplay effects

Do not migrate everything in one change.

Start with parts that provide a clear benefit.

---

## 7. Physics Philosophy

Do not attempt to implement a full professional squash physics simulation yet.

The goal is understandable behaviour.

Important:

- front-wall rebounds must look believable
- side-wall rebounds should communicate their purpose clearly
- Boast must visibly involve a side wall
- Straight and Cross should produce recognizably different court patterns
- Drop should visibly lose depth and pace

Prefer deterministic and teachable trajectories over noisy realism.

---

## 8. Opponent AI Direction

Opponent AI does not need to be sophisticated initially.

A useful first AI can:

- predict roughly where the ball will become playable
- move toward that location
- return the ball after reaching it
- recover toward the T

Later improvements could include:

- different skill levels
- reaction delay
- positional mistakes
- shot-selection tendencies
- tactical behaviour

AI exists to create useful learning situations rather than defeat the player at all costs.

---

## 9. Suggested Development Order

Recommended next development stages:

### Stage A - Repository assessment

Before modifying the project:

- inspect the current structure
- identify entry HTML / JavaScript / CSS files
- identify gameplay code
- identify rendering method
- identify current physics and shot implementation
- identify duplicated or fragile code

Do not modify code during the first assessment unless necessary.

### Stage B - Stabilize current prototype

Fix obvious issues:

- broken layouts
- inconsistent input handling
- unnatural wall collisions
- incorrect shot trajectories
- game state bugs

Make the existing prototype reliable first.

### Stage C - Separate gameplay responsibilities

Gradually separate:

- player movement
- ball movement
- shot definitions
- opponent behaviour
- rendering

Avoid a massive one-time rewrite.

### Stage D - Improve shot learning

Make Straight / Cross / Boast / Drop clearly distinct.

Add visual feedback explaining why each shot behaved differently.

### Stage E - Positioning

Teach the T.

Possible feedback:

- return toward T
- too far from T
- good recovery
- opponent behind you
- opponent in front

### Stage F - Rally scenarios

Introduce small training situations rather than immediately building full matches.

Examples:

- choose the best shot
- recover to T
- respond to a deep straight
- defend a boast
- punish an opponent stuck deep

---

## 10. Non-Goals For Now

Do not prioritize:

- online multiplayer
- realistic character models
- complex animation systems
- RPG progression
- equipment statistics
- career mode
- advanced server infrastructure

The project should stay small enough to iterate quickly.

---

## 11. Deployment

Current expected workflow:

local development
→ Git commit
→ GitHub
→ Vercel

Keep this workflow simple.

Avoid dependencies that complicate static deployment unless they solve an important problem.

---

## 12. First Task For Codex

Start by analyzing the repository.

Do not perform a large refactor yet.

Report:

1. Current repository structure
2. Application entry points
3. How gameplay rendering currently works
4. How player movement works
5. How ball movement / collision works
6. How Straight / Cross / Boast / Drop are currently implemented
7. Major technical problems
8. Fragile or duplicated code
9. Whether Canvas migration is worthwhile now
10. Recommended next three implementation tasks

After the assessment, wait for the next task before making large architectural changes.
