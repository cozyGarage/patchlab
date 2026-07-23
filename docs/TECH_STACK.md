# PatchLab — Tech Stack & Prototype Plan

## Recommended stack (MVP)

| Layer | Choice | Why |
|---|---|---|
| App shell | **Vite + React + TypeScript** | Fast refresh, tiny PWA path, great mobile tooling |
| Rendering | **HTML/SVG rack first** (upgrade to PixiJS if cable count hurts) | Simplest hit-testing for ports; snappy on phones |
| State | **Engine module + React state** (`useReducer` over engine intents) | Keeps rules testable and UI dumb |
| Styling | **CSS variables + one layout stylesheet** | Brandable; no heavy UI kit |
| Missions | **JSON in repo** | Designers/SMEs can edit without touching engine |
| Persistence | **localStorage** | No backend for MVP |
| PWA | **vite-plugin-pwa** | Offline rack practice |
| Tests | **Vitest** for engine | Link rules must be deterministic |
| Deploy | **Static host** (Cloudflare Pages / Netlify / GitHub Pages) | Free, global |

### Explicit non-choices for MVP

- Next.js — unnecessary SSR for a game shell  
- Full Three.js / Unity / Unreal — too heavy for patching drills  
- Real IOS / containerized NOS — wrong product  
- Native Swift/Kotlin — defer until PWA validated  

---

## Repository layout (prototype)

```
prototype/
  index.html
  package.json
  vite.config.ts
  public/
    manifest.webmanifest
  src/
    main.tsx
    App.tsx
    types/
      schema.ts
    engine/
      linkSolver.ts
      reducer.ts
      scoring.ts
    missions/
      m1-first-lights.json
      m2-wrong-port.json
      m3-vlan-trap.json
      m4-admin-down.json
      m5-change-window.json
      rackBase.json
      index.ts
    ui/
      MissionList.tsx
      MissionBrief.tsx
      RackView.tsx
      PortNode.tsx
      CableLayer.tsx
      TipBar.tsx
      Debrief.tsx
    styles/
      tokens.css
      app.css
```

This agent run scaffolds **types, engine stubs, rack base, and all 5 mission JSON files**. Full React UI can be the next implementation slice.

---

## Performance budget

- Intent → snapshot: &lt; 2ms for 24 ports  
- Touch response: &lt; 100ms to LED/tip update  
- Bundle (gzip): aim &lt; 200KB JS for MVP shell  
- 60fps cable drag on mid-range Android when using SVG transforms  

---

## Build phases

### Phase 0 — Spec (this folder) ✅
Product brief, screens, model, missions, stack.

### Phase 1 — Engine vertical slice ✅
- `CONNECT` / `DISCONNECT`
- VLAN + admin-down rules
- Vitest cases for M1–M4 tip codes
- Headless mission completeness checks

### Phase 2 — UI vertical slice ✅
- Mission list + brief + rack SVG
- Tap/drag connect
- Tip bar + debrief stars
- PWA manifest

### Phase 3 — Juice & pedagogy
- Stronger path-glow on goal complete
- Ghost hint overlay drawn on rack
- Glossary drawer
- Sound toggles

### Phase 4 — Expand content
- Fiber module
- Second rack
- Classroom progress export

---

## Brand / visual direction (MVP UI)

Avoid purple-glow SaaS clichés and cream+terracotta poster looks.

**Direction:** cool industrial night-ops  
- Deep graphite rack (`#1B2128`)  
- Muted cyan link-up (`#3DDCB5`)  
- Amber fault (`#E0A106`)  
- Cable blue as the only saturated “tool” color  
- Display font: something like **Space Grotesk** or **IBM Plex Sans** (expressive, not Inter default)  
- Background: subtle radial gradient + faint grid (raised floor), not flat fill  

Motion (2–3 intentional):
1. Cable settle ease when connected  
2. LED soft pulse on link up  
3. Path highlight draw-on for goal complete  

---

## Next implementation command (when ready)

```bash
cd prototype
npm create vite@latest . -- --template react-ts   # if starting fresh UI
npm i
npm test
npm run dev
```

Or continue from the scaffolds already in `prototype/src`.
