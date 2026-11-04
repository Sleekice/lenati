# Lenati — 12-Sprint Product Roadmap

**Mission:** an explorable, source-backed encyclopedia of the human body and its relationships to biology, medicine, physics, chemistry, mathematics, and nature. It is **not a nursing-only product**. Content should be useful at beginner, secondary-school, university, clinical, and research levels, with separate rigor and safety standards.

**Delivery policy:** ship a demonstrable, tested increment each sprint; distinguish interactive implementation from planned capabilities; never publish incorrect anatomical meshes as accurate. All major anatomy labels should resolve to stable identifiers, citations, visual validation records, and licensing metadata. Technical requirements are hypotheses until validated in prototypes.

## Sprint 01 — Repository & foundation (current baseline)
- Publish accessible encyclopedia hub, about page, organized asset/source code, 19 viewpoint UI, first study sets, anatomy list, API v1 static JSON.
- Add smoke tests, source/license notices, project conventions, issues and roadmap.
- Acceptance: main site loads in browsers; JSON validates; navigation and links work; no secrets in repository.

## Sprint 02 — Orientation, anatomy views & unfolding
- Anatomical directional terminology: anatomical position, anterior/posterior, superior/inferior, medial/lateral, proximal/distal; sagittal (median/parasagittal), coronal/frontal, transverse/axial, oblique planes; left/right, dorsal/ventral, and prone/supine positions.
- **Unfolded / blanket atlas**: a planar laid-out map of body regions and discrete selectable structures; top-down and underside, with fold/unfold transitions and an anatomical orientation legend. This is an **educational layout**, not a physically flattened human specimen.
- Sync full-body locator orientation and active region with exploded views; return to origin.
- Acceptance: at least 30 individual labeled structures selectable from unfolded map and catalog, with accurate region focus.

## Sprint 03 — Verified skeleton and connective anatomy
- Individually isolate bones, individual ribs/vertebrae/carpals/tarsals, joints, cartilage, ligament insertions, tendons and muscle connections.
- Investigate and fix sternum / extraneous ellipsoid mapping; create per-mesh label QA and screenshot tests.
- Acceptance: no misleading phantom organs; each selected mesh matches its ID and source reference.

## Sprint 04 — Body models, skin and life-stage variation
- Verified adult female and male anatomical references, diverse skin/hair appearances, skin layers and hair follicles. Age-related model differences only where supported by data.
- Build skin peel and restoration preserving underlying spatial alignment, without implying pigment alters unrelated internal anatomy.
- Acceptance: accurately attribute provenance; no fabricated child/older-adult organs.

## Sprint 05 — Thorax, breathing and circulation
- Chest entry from wider camera; diaphragm, ribs, heart, great vessels, bronchial tree; camera-safe labeling and uncluttered controls.
- Blood/air routes as explicitly simplified arrows or particles, and realistic visual flows only after validation.
- Acceptance: a user can trace a correctly directed respiratory/circulatory route and access sources.

## Sprint 06 — Brain, senses and nervous system
- Regions: cerebrum, lobes, sulci/gyri, corpus callosum, ventricles, cerebellum, brainstem, spinal cord, cranial nerves, eye, retina, optic pathway, inner ear.
- Progressive scale: region -> tissue -> neuron -> synapse -> ion/channel -> molecular mechanism; distinguish real anatomical spaces from visualization portals.
- Clinical and cognitive claims require high-quality sources and qualified review.
- Acceptance: guided optic-to-visual-cortex path, cerebral hemisphere exploration and referenced brain-region cards.

## Sprint 07 — Paths / first-person spatial journeys
- Digestive, vascular, respiratory, neural, urinary, lymphatic and CSF guided pathways; context camera, navigation maps, return to surface.
- Real lumen navigation only where structure is hollow; microscopy/solid tissues use clearly labeled transitions.
- Acceptance: paths have junctions, scale bars, orientation cues and evidence classifications.

## Sprint 08 — Connected Structures Apart & causality
- Separate spatial exploded view, relationship graph view, and physiological consequence view.
- Link nodes with blood supply, venous return, lymph, nerves, fascial/mechanical attachments and biochemical effects.
- Acceptance: users can trace selected organ relationships beyond its chamber without physically misrepresenting stretched vessels.

## Sprint 09 — Molecules, cells, histones and fractal mathematics
- Cells, membrane, nucleus, chromosome, DNA, nucleosome/histone, proteins, ATP, ions; measured structures from scientific databases.
- Explore branching, symmetry, spirals and geometry with honest labels: established mechanism, model approximation, visual analogy.
- Mandelbrot/Julia sets are mathematical experiences rather than claims that all biological patterns are literal Mandelbrot geometry.
- Acceptance: multi-scale path to histones with sources, scale legend and nonmisleading transitions.

## Sprint 10 — Learning library and daily discovery
- Banks by discipline, anatomy system, body region, age-appropriate level and difficulty; flashcards, search, spaced repetition, case reasoning, daily streaks and accessibility.
- Question provenance links, validated answers and model limitations; original medical/clinical cases only.
- Acceptance: recover saved progress, filter by topic and reveal a structure from a card.

## Sprint 11 — Scientific data, clinical simulation and public API
- API v1 expands to versioned structures, relationships, path waypoints, illustrations, references and learning content usable by Kotlin/Compose and web clients.
- Simulation models for occlusion, bleeding and physiologic change reviewed by qualified experts; never describe a training visualization as a validated diagnostic tool.
- Acceptance: schema tests, sample Compose consumption, review workflow and clearly gated simulated scenarios.

## Sprint 12 — Performance, accessibility, publishing and governance
- Progressive asset streaming, WebGPU/WebGL fallbacks, loading benchmarks, mobile testing, keyboard/screen-reader interaction, evidence review and licensing audit.
- Strong citation UX, contributor policy, secure real authentication, public changelog and roadmap.
- Acceptance: repeatable builds, site deployment, verified citations/attributions, tested fallback path, public release criteria.

## Scientific source strategy
- **Anatomical nomenclature:** FIPAT / Terminologia Anatomica and open ontology mappings such as UBERON and Foundational Model of Anatomy (license and access permitting).
- **Open anatomy texts:** OpenStax Anatomy and Physiology, NCBI Bookshelf (source/edition-specific attribution).
- **Brain:** NIH/NINDS, Human Connectome Project, Allen Brain Atlas, peer-reviewed neuroscience. Distinguish population reference atlas from individual variation.
- **Biomolecular structures:** RCSB Protein Data Bank, EMBL-EBI, PubChem, and curated primary literature.
- **Medical 3D assets:** 3D Slicer workflows and individually documented model/segmentation datasets. Review accuracy, transformation alignment, and asset license for each item.
- All imported facts should record source URL, retrieval date, claim anchor, licensing, confidence, reviewed-by and review date. No automatic claim that a cited page supports each sentence.

## Release discipline
Each sprint ships: product demo, acceptance tests, screenshots, API contract changes, source provenance changelog, known limitations and open follow-up issues. No passwords or personal patient data should be stored in the public static client.
