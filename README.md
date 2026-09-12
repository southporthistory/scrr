# Southport Archive — Full GitHub Deployment

A static discovery layer over archival files served by Google Drive. GitHub Actions compiles a validated catalog and deploys `dist/` atomically to GitHub Pages. Google Sheets is a replaceable build-time source, never a browser runtime dependency.

## What is intentional

- `content/catalog.json` is the current full 3,679-record staging catalog used by GitHub Pages. `content/fixture/catalog.json` remains a 112-record development fixture.
- `site/` is the authored visitor experience.
- `scripts/acquire.mjs` is the only source-specific adapter.
- `scripts/model.mjs` validates the canonical catalog and compiles the smaller public browser projection.
- `content/thumbnails/` carries the complete recovered preview cache so the full catalog can be staged without re-fetching thousands of files. Each deployment copies only thumbnails referenced by the currently published catalog. Original images, PDFs, audio, and multi-GB video remain in Drive.
- `dist/` is disposable generated output and is never hand-edited.

No crawler, old Google Sites hierarchy parser, broken-link state, synthesized “untitled” records, or filename inference participates in the production build.

## Run locally

Requires Node 20+ and no third-party packages.

```bash
npm run check
npm run serve
# open http://localhost:4173
```

`npm run check` validates the catalog, runs tests, synchronizes thumbnails, and creates `dist/`.

## Publish to GitHub Pages

1. Create a GitHub repository and copy this project into it.
2. Push the default branch as `main`.
3. In **Settings → Pages → Build and deployment**, select **GitHub Actions**.
4. The included `publish.yml` builds all 3,679 staged records and deploys on every push to `main`.
5. It also supports manual runs, `catalog_changed` repository dispatches, and hourly reconciliation.

All paths are relative, so the site works at both `org.github.io/repository/` and a later custom domain.

## Switch from the fixture to Google Sheets

The future curator manager can own two canonical worksheets. Publish only the safe public projections as CSV, following:

- `content/templates/items.csv`
- `content/templates/collections.csv`

Add GitHub repository configuration:

- Variable `CATALOG_SOURCE` = `sheet`
- Secret `SHEET_ITEMS_CSV_URL`
- Secret `SHEET_COLLECTIONS_CSV_URL`

The next build uses the Sheet without changing the site or compiler. Drafts and archived records are validated but omitted from `dist/data/catalog.json`.

For a private Sheet, replace only the fetch logic in `scripts/acquire.mjs` with authenticated Google API access; the canonical model and publication pipeline remain unchanged.

## Curator workflow (future Workspace app)

```text
Upload original to Shared Drive
→ paste Drive link into curator manager
→ describe and choose collection
→ save/publish
→ manager writes canonical Sheet rows
→ manager dispatches catalog_changed
→ GitHub validates, builds, and deploys
```

An hourly scheduled build is the recovery path if immediate dispatch fails.

## Canonical item fields

- Stable catalog `id` independent of the Drive file ID
- `status`: `draft`, `published`, or `archived`
- `title`, optional `description`
- One or more `collectionIds`
- Structured `contentDate`: display label plus optional start/end years
- Optional `publicationDate`: the date the underlying work was published or filed (distinct from CMS publication status)
- `media`: type, Drive file ID, permanent public viewer URL
- Optional subjects, people, places, and featured flag

Counts, date facets, search material, thumbnail paths, and collection totals are derived publication state—not Sheet columns.

## Cache coherence

The build emits content-addressed names for every mutable browser asset:

- `assets/css/main.<hash>.css`
- `assets/js/archive.<hash>.js`
- `data/catalog.<hash>.json`

HTML is the only mutable entry point. When GitHub Pages serves a new HTML version, its asset URLs necessarily identify the matching CSS, JavaScript, and catalog payload. This prevents partial old/new renders even when the CDN or a phone retains prior assets. Thumbnails keep stable Drive-ID names because they are independent archival previews.

## Curated homepage and collection imagery

Representative imagery is managed through the same Google Sheet catalog as everything else:

- `Items.homepage_slot` is blank for ordinary items or `1`–`6` for the six ordered homepage highlights. Each tile links to that exact archive record.
- `Collections.cover_item_id` selects the representative image for that collection card.

The future Workspace Manager presents visual pickers over those fields:

- **Homepage highlights:** six numbered slots with thumbnail preview, Choose/Replace, and reorder. Saving updates `homepage_slot` on the affected Item rows.
- **Collection cover:** one thumbnail picker on the Collection editor. Saving updates `cover_item_id` on that Collection row.

Curators never type IDs and there is no separate YAML, JSON, or site-settings workflow. The build adapter reads the Items and Collections worksheets and compiles their values into the static site's publication JSON. See `content/templates/items.csv` and `content/templates/collections.csv` for the eventual worksheet columns.
