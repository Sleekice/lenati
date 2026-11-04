# Lenati body viewer (BodyParts3D pilot)

A 3D body you can orbit like a map, expand region by region down to single parts, rearrange by hand, and walk through in first-person tunnels. Open `/body/` on the Pages site or serve the repo root locally (`python3 -m http.server 8765`, then visit `http://localhost:8765/body/`).

**Fidelity level:** measured source geometry, *unreviewed derivative*. The meshes come from scan-based BodyParts3D models but have been decimated and regrouped, and no anatomist has checked the labels, orientation or omissions yet (audit steps 6 and 7 in `docs/ASSET_AUDIT.md`). Not for diagnosis or exact proportions. It is a single adult male model.

## Scale descent (body to histone)

Every structure opens into the next smaller world that makes sense for it, and stops where its own detail stops. The ladder at the bottom shows the level (Body, Organ, Tissue, Cell, Organelle, Chromatin, Nucleosome, Molecule) with a live scale bar in real units.

- Select a part and press **Zoom into ...** (or double-click it, or press E). Labels with an arrow can go deeper.
- **Up a level**, Esc, a breadcrumb or an earlier rung on the ladder takes you back up.
- 29 worlds, about 220 clickable components with cards and sources, in `src/micro.js`:
  - tissues: heart muscle, alveoli, small intestine lining, cerebral cortex, compact bone, skeletal muscle, skin layers, olfactory epithelium
  - cells: cardiomyocyte, type II pneumocyte, enterocyte, pyramidal neuron, osteocyte, muscle fibre, keratinocyte, olfactory receptor neuron
  - organelles: nucleus, mitochondrion
  - chromatin fibre, nucleosome, histones H3, H4, H2A and H2B (with named modification sites), DNA
  - branch endings: haemoglobin (red blood cells), odour receptor (smell), ATP synthase (mitochondria), collagen and hydroxyapatite (bone, tendon, dermis)
- These worlds are procedural models scaled from published measurements, not scans. Colours are chosen for clarity. Each card lists its sources.

## Controls

- Drag to orbit, right-drag to pan, scroll to zoom.
- Click a part to select it, click again to go one level deeper, Alt-click for the exact part.
- Expand, Retract and Collapse all open and close groups. A small layout solver spreads child parts until they stop overlapping, capped at about 1.3 times the parent's size.
- **Move parts** (or hold Shift) and drag a part or its label to slide it out of the way. **Put moved parts back** resets.
- Layers, Study mode, search and the Mind Maze tunnels (mouth to lungs or stomach) are in the side panel.

## What is here

| Path | Contents |
| --- | --- |
| `index.html` | Built page (from `src/` by `build.sh`) |
| `models/*.txt` | Nine regional glTF files, meshopt compressed, base64 encoded (about 8 MB in total) |
| `src/` | `shell.html` UI, `app.js` engine, `data.js` and `tree.json` anatomy hierarchy (1,095 nodes) |
| `pipeline/` | Scripts that turn the BodyParts3D STL set into these files, plus `part-assignment.json` (FMA ID to Lenati node) |
| `ASSET_INVENTORY.csv` | One row per source mesh (934): FMA ID, source URL at a pinned commit, version, licence, authors, changes, parent node, output file and SHA-256 checksums |

## Source and licence

- BodyParts3D release 3.0 (archive date 20110915), the 95% reduced OBJ set, as converted to STL in [Kevin-Mattheus-Moerman/BodyParts3D](https://github.com/Kevin-Mattheus-Moerman/BodyParts3D) at commit `f0eeb6e`.
- Licence: [CC BY-SA 2.1 Japan](https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en). Attribution: "BodyParts3D, (c) The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan".
- Citation: Mitsuhashi N, et al. BodyParts3D: 3D structure database for anatomical concepts. *Nucleic Acids Res.* 2009;37:D782-5. doi:10.1093/nar/gkn613. Archive DOI 10.18908/lsdba.nbdc00837-000.
- The files in `models/` are adapted versions and are shared under the same licence. Changes are listed per part in the inventory.
- Anatomical names and parent classes come from the FMA identifiers shipped with BodyParts3D.

Structures with no source mesh (knee ligaments and menisci, peripheral nerves, tongue, thyroid gland, nephron) are drawn as simplified conceptual shapes and labelled that way on their cards.

## Rebuilding

`pipeline/build_mesh.py` needs Python with `trimesh`, `fast-simplification`, `pyfqmr`, `scipy`; then `npx @gltf-transform/cli meshopt` per region and base64 encoding. Paths at the top of each script point at the original working folders.
