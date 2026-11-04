# Scientific data governance and updates

- Catalogs and articles are **versioned**. Public metadata is in `api/v1/release.json`; research records are in `api/v1/research.json`. Published records are snapshots.
- The app checks the release manifest **when opened** and on explicit **Check updates**. It cannot silently monitor publications while closed. Periodic automated ingestion requires a future GitHub Action / server job and a reviewer.
- Local reader progress uses namespaced browser `localStorage`; local export/import provides portable JSON backups. It is not encrypted, synchronized, or suitable for patient data. A future IndexedDB-backed cache may store media and larger offline datasets.
- Each research record requires article ID, DOI/URL, dates, type of evidence, author's finding in an original *paraphrase*, image provenance, review date, and a question plus answer. Avoid reproducing copyrighted abstracts.
- Article figures may only be used if explicit licensing permits it. Current thumbnails are original conceptual SVG illustrations, not scientific experimental images.
- Research desk is a curated list, **not** a claim to cover latest literature. Every record is reviewed against the publisher/source before publication.
- Amendments and retractions must be recorded, with source and decision status. Never silently rewrite a published clinical claim.
- Entries may be `hypothesis`, `preprint`, `peer-reviewed`, `replicated`, `contested`, or `retracted`; labels must match the underlying work, not author enthusiasm.
- Novel geometry claims: separate measured mathematical pattern, tested biological mechanism, and visual analogy. Golden ratio claims require defensible landmarks, control models and quantitative tests; do not state that the heart has seven folds without a definition and sources.
- Human variation: do not equate race with genetic ancestry or use race as a genetic diagnosis. Record specific biological variants, ancestry datasets where relevant, and social/environmental determinants. Cite NHGRI: https://www.genome.gov/about-genomics/policy-issues/population-descriptors-in-genomics .
- Source starts: https://www.nature.com/articles/s41591-024-03150-z ; https://www.nature.com/articles/s41586-024-07606-7 ; https://pmc.ncbi.nlm.nih.gov/articles/PMC10792139/ ; https://pmc.ncbi.nlm.nih.gov/articles/PMC12462182/ .
- Version increments: PATCH for correction, MINOR for content/schema-compatible additions, MAJOR for breaking API/schema. Keep release notes and immutable Git history.
