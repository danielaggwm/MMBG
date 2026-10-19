TREE, FRAGRANCE & HIGHLIGHTS WALK PHOTOS
========================================
Popups load photos from this folder automatically. Filenames follow the
SCIENTIFIC NAME of the plant (same convention as images/pollinators/), NOT
stop numbers. This keeps image links stable when trees are added, removed, or
reordered in the Excel.

Naming rule (see photo_slug() in data/build_walk_data.py):
  - Use the scientific name, lowercased, non-alphanumerics -> hyphens.
      "Ceiba speciosa"          -> ceiba-speciosa.jpg
      "Podocarpus macrophyllus" -> podocarpus-macrophyllus.jpg
  - If a stop lists MULTIPLE species (a comma in the scientific name) or has no
    scientific name, the common name is used instead.
      "Copernicia palms (C. alba, ...)"             -> copernicia-palms.jpg
      "Pond apple (Annona glabra, Annona squamosa)" -> pond-apple.jpg
  - Note: the word "tree"/"trees" is stripped from common names before slugging.

Shared images:
  - Stops that are the same species share ONE image. e.g. both "Cabbage palm"
    stops (Arboretum #16 and #46, Sabal palmetto) use sabal-palmetto.jpg.
  - The Highlights Walk reuses the tree images by scientific name automatically.

Multiple photos per stop (slider):
  - <slug>.jpg is the primary photo. Add <slug>-2.jpg, <slug>-3.jpg, ... for
    extra views. When more than one exists, the popup shows a small dot slider;
    otherwise it shows a single static image.
      musa-sp.jpg + musa-sp-2.jpg                       -> 2-photo slider
      orchid-collection.jpg + -2.jpg + -3.jpg           -> 3-photo slider
  - The build scans this folder for the numbered files, so just drop them in and
    re-run build_walk_data.py; no code changes needed.

Source of truth:
  data/Tree&FragranceWalk_with_descriptions.xlsx  (Arboretum / Fragrance /
  Highlights sheets). After editing, run:
      cd data && python3 build_walk_data.py
  to regenerate js/walk-data.js.

_unused/ : images no longer referenced by the map (kept as backups). Currently
  holds tree-46.jpg, the second Cabbage palm photo made redundant when the two
  Sabal palmetto stops were merged onto one shared image.

JPG format, roughly 1200px on the long side looks best. Until a photo exists,
the popup shows a "Photo coming soon" placeholder.
