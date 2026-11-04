# Lenati Anatomy Foundry — six-method production system

## Purpose
Build anatomically identifiable, source-backed and versioned 3D, sectional, microscopic and molecular learning assets. This is a production framework, **not an assertion that all these source models are already imported**. The interactive atlas currently uses conceptual procedural geometry.

## Methods (choose and combine)
1. **Scientific meshes:** import licensed source models such as BodyParts3D and NIH 3D. Preserve source identifiers, transformation history, creator/attribution, and exact license.
2. **Clinical imaging:** use 3D Slicer and reviewed segmentation to reconstruct anatomy from appropriately licensed/de-identified CT or MRI. Do not upload patient scans or protected health data to public GitHub.
3. **Procedural geometry:** parameterize branching, surface folds, and networks with measured biological constraints. Label results simulated.
4. **Manual 3D reconstruction:** build hard-to-image ligaments, fascial layers, hair follicles and other structures from primary evidence, with expert review.
5. **Microscopy:** use histological datasets, SWC neuron morphology, and other microscopy reconstructions for cellular structures. Confirm license and biological context.
6. **Molecular coordinates:** render Protein Data Bank entries in a molecular viewer; validate accession, experimental method, units, resolution and biological assembly.

All six are complementary. Do **not** use image-to-3D generation as a substitute for verified medical geometry.

## First production objective
**Thorax pilot:** inventory rib and sternum meshes; import audited skeleton, lungs, heart, trachea and vessels; add tissue section views; generate a verified pathway graph; attach explanatory source notes and clinical limitations. The current interactive procedural demo is not this pilot's completed medical mesh.

## Three fidelity levels
- **Measured**: directly derived from imaging/experimental coordinates and verified for intended use.
- **Reviewed reconstruction**: modeled from multiple scientific references and expert-checked.
- **Conceptual**: geometry meant to teach a relationship, never to imply exact human dimensions.

## License inventory fields
`asset_id`, `anatomical_term`, `representation`, `source_url`, `source_id`, `source_version`, `downloaded_at`, `license`, `license_url`, `authors`, `attribution_text`, `derivative_changes`, `quality_level`, `reviewer`, `reviewed_at`, `anatomical_parent_id`, `mesh_file`, `checksum`.

## Automation / access
No API key is needed to start from downloaded open model assets, local Blender, 3D Slicer, original procedural code, or publicly downloadable PDB/SWC files. Some providers offer rate-limited APIs, require API keys for particular endpoints, or impose account-specific terms; those integrations are optional. **Never commit credentials or private patient scans.**

GitHub Pages can serve compressed GLB and metadata files. Large-scale processing, private review workflows, live updates and account sync need separate services. Each asset should be imported offline, checked, then published in a versioned release.

## Source / licensing starting points
- [BodyParts3D archive license](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html)
- [NIH 3D](https://3d.nih.gov/)
- [3D Slicer](https://www.slicer.org/)
- [TotalSegmentator](https://github.com/wasserth/TotalSegmentator)
- [Allen Cell Types](https://celltypes.brain-map.org/)
- [RCSB PDB](https://www.rcsb.org/)
- [Asset audit](ASSET_AUDIT.md)

**Caution:** a provider's homepage license does not override the license of an individual download or earlier derived asset.
