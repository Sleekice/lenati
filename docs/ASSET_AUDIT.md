# Anatomical asset provenance and publication policy

## Public atlas status
The published `atlas.html` is an **interactive procedural 3D preview**, built from original schematic geometry. It is **not** the previously supplied detailed BodyParts3D mesh viewer and must not be used for diagnosis, exact proportions, or surgical planning.

## Legacy model found in Lenati offline HTML
The uploaded `Lenati-offline.html` contains this attribution:
> Anatomy models: BodyParts3D, © The Database Center for Life Science, licensed CC BY-SA 2.1 Japan. Reduced and recoloured for Lenati.

That identifies an intended upstream source, but **does not establish the precise source version, object IDs, individual derived-file licenses, or modifications**. The older share-alike license may apply to those embedded derivatives. The official BodyParts3D current licensing page must not be retroactively assumed to relicense already-downloaded model versions.

## Required audit before republishing the original embedded meshes
1. Identify the original download location, version/date, and license file for the exact embedded meshes.
2. Extract an inventory of all source object IDs, file formats, mesh labels, and transforms.
3. Record each asset's upstream author, license/version, source URL, and changes (decimation, recoloring, morphing, segmentation).
4. Preserve copyright notices and required attribution, provide the applicable license link, and disclose adaptations.
5. For share-alike derivatives, ensure distribution terms comply with the specific source license; review separately sourced files independently.
6. Validate anatomical labels, orientation, structures, and omissions before marking assets scientifically reviewed.
7. Only then add appropriately attributed assets to a public build.

## Source references
- [BodyParts3D official license page](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html)
- [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/)
- [Creative Commons Attribution–ShareAlike 2.1 Japan](https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en)
- [Creative Commons Attribution–ShareAlike 4.0](https://creativecommons.org/licenses/by-sa/4.0/)

## Transparency
Do not represent this procedural preview as a full anatomical dataset. Its parts are select-able educational placeholders, with the detail and positional accuracy limitations explicitly shown on screen. We can replace them with appropriately licensed, audited geometry in subsequent versions.
