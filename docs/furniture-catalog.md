# Furniture catalog generation

The checked-in JSON files under `src/data/furniture` are the runtime source for
the Vite application. `catalog.json` and the Backend catalog resource are
deterministic generated views of those files; neither production runtime reads
the workspace-only `_incoming` directory.

Regenerate both manifests from the checked-in runtime assets:

```bash
npm run catalog:generate
```

Import a reviewed incoming archive, copy its runtime assets into the Web
project, and regenerate both manifests:

```bash
node scripts/generateFurnitureCatalog.mjs \
  --source ../_incoming/roomfit-furniture-json \
  --backend-root ../RoomFit-Backend \
  --copy-assets
```

Inputs:

- `materials.json`
- `variants/*.json` for checked-in assets, or `furniture/*.json` for an incoming archive

Outputs:

- `src/data/furniture/materials.json`
- `src/data/furniture/variants/*.json`
- `src/data/furniture/catalog.json`
- `../RoomFit-Backend/src/main/resources/catalog/furniture-catalog.json`

Product IDs are generated as `<variantId>-01`. The four established desk IDs
therefore remain unchanged. The generated `sourceHash` is based on normalized,
sorted JSON content rather than file timestamps or formatting.
