# Lenati architecture decisions

## Data identifiers
Each anatomy node has stable id, name, system, depth, description, evidence level, source URL and mesh status. A future production record additionally needs synonyms, ontology identifiers (e.g., FMA/UBERON mapping where applicable), coordinate system, laterality, anatomical relations, source version, review date, licensing, and validated asset IDs.

## Separate graphs
The structure graph (part-of and adjacent-to) must not be confused with functional connections (supplied-by, innervated-by), pathways (flows-to), effects (influences), or analogies (shares-pattern-with). UI edges should be typed and provenance linked.

## Geometry and navigation
A high-fidelity body mesh is not automatically a navigable airway. Keep surface meshes, volumetric sections, scale-transition scenes, and traversable passage graph separate. Procedural patterns are never anatomical replacements. If the real vessel route is unknown, show a labeled arrow guide instead of invented fluid motion.

## Camera synchronization
Primary body: movable scene. Secondary model: independently selectable. Locator: synchronized orientation and selected anatomical ID but always shows original whole-body proportions; use ghost coordinates to indicate expanded structure positions. Three cameras should share anatomy graph IDs rather than copy mesh names.

## API versioning
Data is served now as read-only JSON under `/api/v1`. When a backend is ready, replace with FastAPI or Kotlin server, cursor pagination, filtering, permissions, structured error responses, HTTPS and authenticated progress endpoints. Include an OpenAPI schema for generating client bindings.

## Accessibility
Keyboard-accessible structure tables, reduced-motion control, clear contrast, labels describing anatomical status and evidence, accessible alternatives to tunnel navigation. Avoid automatic red/blue as the only way of distinguishing flows.
