# Squash IQ - Codex Instructions

## Project Overview

Squash IQ is a browser-based interactive learning experience designed to introduce people to squash.

The project is not primarily intended to become a full commercial squash simulation game.

Its main goal is to help beginners understand squash through direct interaction:

- player movement
- court positioning
- basic rally flow
- shot selection
- ball trajectories
- tactical differences between common squash shots

Education and intuitive understanding take priority over simulation accuracy.

---

## Product Direction

Keep Squash IQ as a web-first experience.

The current preferred architecture is:

- HTML/CSS for the website, explanations, controls, tutorial UI, and HUD
- JavaScript for game logic
- Canvas for gameplay rendering when practical
- GitHub for source control
- Vercel for deployment

Do not migrate the project to Godot or another game engine unless explicitly requested.

The project should remain easy to open from a URL without installation.

---

## Core Controls

Movement:

- W: up
- A: left
- S: down
- D: right

Solo experience (user-approved control update):

- Mouse position: aim
- Left mouse: hold to charge, release for backhand
- Right mouse: hold to charge, release for forehand
- R: prepare a new ball
- WASD remains movement only

The solo mode uses continuous ball physics. Drop/lob controls are not yet defined.

Legacy CPU prototype only — shot selection:

- 7: Straight
- 8: Cross
- 9: Boast
- 0: Drop

These controls are intentional.

Do not change them without explicit approval.

---

## Game Philosophy

Squash IQ is an educational game.

The player should gradually understand ideas such as:

- returning toward the T after a shot
- keeping the ball tight to the side wall
- using Straight shots to maintain pressure
- using Cross shots to change direction
- using Boast shots to bring the opponent forward
- using Drop shots when the opponent is behind

The game does not need perfect real-world physics.

Prefer:

"Does this trajectory clearly teach what this shot does?"

over:

"Is this mathematically identical to professional squash?"

However, obviously unnatural ball behavior should still be avoided.

---

## Ball Behaviour

Ball movement should visually communicate squash mechanics.

Important principles:

- The front wall is the primary target surface.
- Ball trajectories should be easy to understand visually.
- Front-wall rebounds should produce believable outgoing trajectories.
- Side-wall interaction should be visible and meaningful.
- Different shot types should produce clearly different trajectories.
- Straight, Cross, Boast, and Drop must not feel like cosmetic variations of the same shot.

Avoid random or unpredictable physics unless explicitly used as a gameplay mechanic.

---

## Architecture Direction

Avoid putting all gameplay code into one large script.

When refactoring becomes appropriate, prefer separating responsibilities conceptually into components such as:

- Game
- Player
- Opponent
- Ball
- Court
- ShotSystem
- Input
- Renderer
- HUD / Tutorial UI

Exact filenames do not need to match this list.

Follow the current repository structure where reasonable.

Do not perform a large architecture rewrite merely to match this document.

Refactor incrementally.

---

## Rendering Direction

The educational website should remain HTML/CSS based.

For gameplay, Canvas is preferred as the project grows.

Target direction:

HTML / CSS:
- navigation
- explanation content
- buttons
- tutorial text
- HUD
- score and status displays

Canvas:
- squash court
- player
- opponent
- ball
- trajectories
- gameplay effects

If the existing implementation currently uses DOM elements for gameplay, do not automatically rewrite everything.

First understand the existing implementation, then migrate incrementally only when there is a concrete benefit.

---

## Development Rules

Before changing code:

1. Inspect the relevant existing implementation.
2. Understand why it currently works the way it does.
3. Preserve existing working behaviour unless the task explicitly changes it.
4. Prefer small and reviewable changes over large rewrites.
5. Test the affected functionality after modifying it.

Do not remove existing features merely because a cleaner implementation is possible.

Do not introduce a framework unless it provides a clear benefit.

Prefer simple browser-native technologies for this project.

---

## UX Principles

A person who has never played squash should still be able to understand what is happening.

Prefer:

- clear visual feedback
- short explanations
- direct interaction
- immediately understandable controls
- obvious differences between shot types

Avoid:

- dense menus
- unnecessary configuration
- complicated RPG-style systems
- excessive statistics
- systems that make the learning goal harder to understand

The first few minutes should be approachable.

---

## Scope Control

Before adding a feature, consider whether it helps teach squash.

High-value features include:

- trajectory visualization
- T-position teaching
- shot-selection exercises
- rally demonstrations
- basic opponent AI
- contextual feedback
- beginner tutorials

Lower-priority features include:

- character customization
- progression systems
- equipment systems
- large content inventories
- complex match simulation

These are not forbidden, but they should not distract from the educational goal.

---

## Deployment

The project is intended to work as a static or lightweight browser application.

Primary deployment target:

- GitHub repository
- Vercel

Changes should avoid unnecessary server dependencies.

The application should continue to work when deployed through Vercel.

---

## Working With This Repository

At the start of a new Codex task:

1. Read this `AGENTS.md`.
2. Inspect the repository before making assumptions.
3. Check the existing implementation related to the requested feature.
4. Explain significant structural changes before performing them when possible.
5. Run available tests or perform practical browser/build validation after modifications.

When completing a task, summarize:

- files changed
- behaviour changed
- testing performed
- remaining issues or suggested next step

---

## Important Constraint

Do not turn Squash IQ into a generic arcade game.

The central question should always remain:

> Does this help someone understand squash better?

If the answer is no, the feature is probably not a priority.
