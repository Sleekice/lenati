# LENATI — The Living Encyclopedia

**A source-backed interactive encyclopedia of the body and its relationships to biology, physics, chemistry, mathematics, medicine, and the natural world.** This is **not nursing-specific**. Lenati aims to support curious visitors, students, artists, scientists, clinicians, and researchers at appropriate levels of detail.

## Current demo

The static site provides an encyclopedia home, a selectable body-region overview, 137 searchable anatomy references, an anatomy table, five guided biological paths, 19 mathematical/conceptual viewing lenses, educational flashcards, a daily-discovery question, locally stored demo progress, an About page, and read-only JSON endpoints. The view is illustrative: it does **not** yet demonstrate full 3D unfolding, anatomically verified flows, age-specific organs, or validated diagnostic simulation.

This public build intentionally excludes bundled legacy 3D meshes until dataset attribution and redistribution permissions are audited.

## Start locally

Run `python3 -m http.server 8765` in the repository directory and open `http://localhost:8765/`. Browsers may block JSON or asset loading from `file://` links.

## Publish with GitHub Pages

In **Settings → Pages**, select **Deploy from a branch**, branch `main`, folder `/ (root)`. GitHub Pages is a static hosting service; the JSON resources under `api/v1/` are read-only files, not a live dynamic database or user-authentication service. Deployment must be explicitly enabled and verified.

## Project map

- `index.html` — encyclopedia sections, search and controls
- `styles.css` — responsive visual system
- `app.js` / `data.js` — client interactions and content
- `api/v1/*.json` — versioned public reference catalog, paths, lenses and decks
- `api/openapi.yaml` — OpenAPI description for consumers
- `kotlin/LenatiApi.kt` — Kotlin/Retrofit integration example
- `docs/ARCHITECTURE.md` — engineering notes
- `docs/ROADMAP_12_SPRINTS.md` — release plan and scientific source standards
- `docs/smoke.py` — static data/build smoke checks

## Next planned viewport

The **Unfolded Anatomy Atlas** lays the body out like an open blanket, with selectable individual bones, nerves, organs and linked structures, and explicit scientific orientation controls: anterior, posterior, superior, inferior, lateral, medial, sagittal, coronal, transverse and oblique. This is a proposed navigational visualization, not an assertion that the anatomy can be accurately flattened with no distortion. The miniature locator must remain synchronized with the selected structure, the orientation and the exploded view.

## Evidence and intellectual property

All scientific claims require traceable citations, citations appropriate to the particular claim, and explicit labeling of estimates/simulations/visual analogies. 3D source meshes and patient-derived scans require individual redistribution and privacy review. No proprietary assessment bank is reproduced and no professional endorsement is implied.

## Project status

Early static prototype. Individual anatomy and vascular/cellular interior models, professional simulation, actual secure login, verified female/pediatric/older-adult datasets, procedural fractal geometry, real-time 3D anatomical expansion, and all-browser QA are **future** capabilities.

## Research Desk and local versioning (v0.2.0)

- `/research` is a **subject-wide** evidence desk, not nursing-specific. The current build includes source-linked research on brain-cell mapping, Alzheimer's disease, human population variation, and a critical evaluation of golden ratio claims. No publisher abstracts are copied; accompanying SVG images are original illustrations.
- Evidence records contain publication identifiers, original summaries, evidence types, review dates and questions. See `docs/RESEARCH_GOVERNANCE.md`.
- Reader preferences and learning progress persist locally in the browser. The Research Desk supports export/import of a JSON backup; never put patient or medical records in this local prototype.
- `api/v1/release.json` is polled **on each visit** and on demand. Automatic checking while the site is closed is not implemented. Future scheduled literature monitoring requires a server/GitHub Action and human review.
- The broader encyclopedia starts with Biology, Physics, Chemistry, Mathematics, Computer Science, Earth/Space/History; other subjects are planned and not misrepresented as fully implemented.
- The Fractal/Flower of Life/Mandelbrot entry is artistic and mathematical navigation; geometric resemblances are not proof of a biological mechanism.
- Version: **0.2.0** (research and governance increment).

## 3D body viewer pilot (`body/`)
A scan-based 3D body viewer built on BodyParts3D release 3.0 meshes lives in `body/`. It supports orbit-style navigation, recursive expand and retract, moving parts by hand, layers, study questions and first-person tunnels. Provenance for all 934 source meshes is in `body/ASSET_INVENTORY.csv`; anatomical review is still pending (see `docs/ASSET_AUDIT.md`).

## Platform (Sprint 1): monorepo, database and API

The platform described in the Lenati Platform Spec lives alongside the static demo. Nothing above was moved.

```
apps/web          Next.js 15 app (Vercel): home, /atlas, /api/v1
packages/graph    Prisma schema, typed read functions, seed importer and validator
packages/engine   3D atlas engine (stub; the prototype in body/ moves here in Sprint 2)
packages/ui       shared React components (stub)
packages/sdk-js   typed client for /api/v1
packages/config   shared tsconfig and design tokens
```

Run it locally (Node 20+, pnpm 9, Postgres 16 or a Neon branch):

```bash
cp .env.example .env            # set DATABASE_URL and DIRECT_URL
pnpm install                    # also generates the Prisma client
pnpm db:push                    # create the tables
pnpm db:seed                    # load the body tree and micro worlds as drafts (about 1,350 nodes)
pnpm db:validate                # single tree, every deeper link resolves, heart reaches histone H3
pnpm dev                        # http://localhost:3000
```

`/atlas` serves the `body/` prototype (copied into `apps/web/public/atlas` on dev and build). The API reads published content only; in development add `?drafts=1` to see the seeded drafts:

- `GET /api/v1/halls`
- `GET /api/v1/nodes/{id}` (sections, sources, links, children, breadcrumb)
- `GET /api/v1/nodes/{id}/children?skip=0&take=50`
- `GET /api/v1/search?q=heart`
- `GET /api/health`

CI (`.github/workflows/ci.yml`) typechecks, runs the unit tests, seeds a throwaway Postgres, validates the graph and builds the web app on every pull request.
