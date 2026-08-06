"""Regenerates js/walk-data.js from Tree&FragranceWalk_with_descriptions.xlsx
and Pollinator.xlsx.
Run:  python3 build_walk_data.py  (from the data/ folder)

Sheets (Tree&FragranceWalk_with_descriptions.xlsx):
- 'Arboretum Walk'   -> tree walk (sections as header rows, numbered 1..N)
- 'Fragrance Walk'   -> fragrance walk
- 'Pollinator Tour'  (Pollinator.xlsx)         -> pollinator overlay (num + stoplight color + sector)
- 'Top Animals'      (MBBG_Top_Pollinators.xlsx) -> per-sector species catalogue (POLLINATOR_SPECIES)
- 'Highlights Walk'  -> highlights walk (num, name, lng, lat, description).
  The output walk key is "highlights". Each stop is matched to a Tree Walk pin
  BY COORDINATES to inherit its garden section. Its Description column is
  optional: used when filled, otherwise the matching tree's description is
  inherited.

Photos: every stop links to images/trees/<scientific-name-slug>.jpg, the same
convention the pollinator catalogue uses. Filenames are stable when trees are
added/removed/reordered (unlike the old tree-NN.jpg numbering). Stops that share
a species share one image. See photo_slug() for the exact rule.
"""
import openpyxl, json, re, os

HERE = os.path.dirname(os.path.abspath(__file__))

def parse_name(raw):
    raw = re.sub(r'\s+', ' ', raw.strip())
    m = re.match(r'^(.*?)\s*\((.+)\)\s*$', raw)
    common, sci = (m.group(1).strip(), m.group(2).strip()) if m else (raw, None)
    common = re.sub(r'\s*\btrees?\b\s*', ' ', common, flags=re.I).strip()
    return common, sci

def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', (s or '').lower()).strip('-')

def photo_slug(common, sci):
    # Filenames follow the scientific name (like the pollinator catalogue). For
    # multi-species stops (a comma in the scientific field) or stops with no
    # scientific name, fall back to the common name to keep filenames clean.
    base = sci if (sci and ',' not in sci) else common
    return slug(base)

TREES_DIR = os.path.join(HERE, '..', 'images', 'trees')

def photo_list(base):
    # A stop can have several photos: <base>.jpg is the primary, and optional
    # <base>-2.jpg, <base>-3.jpg ... are extra views. Returns the web paths that
    # actually exist on disk, in order, so the popup shows a slider only when
    # there is more than one. Falls back to [<base>.jpg] (which may not exist
    # yet) so the popup can still show a "photo coming soon" placeholder.
    found = []
    if os.path.exists(os.path.join(TREES_DIR, base + '.jpg')):
        found.append(f'images/trees/{base}.jpg')
    n = 2
    while os.path.exists(os.path.join(TREES_DIR, f'{base}-{n}.jpg')):
        found.append(f'images/trees/{base}-{n}.jpg')
        n += 1
    return found or [f'images/trees/{base}.jpg']


def clean_text(v):
    # Normalizes a description cell while PRESERVING paragraph breaks. Line
    # breaks in the cell (Alt/Ctrl+Option+Enter in Excel) become "\n" here, and
    # the website renders each line as its own paragraph. Spaces/tabs within a
    # line are collapsed; blank lines are dropped. Keeps any **bold** markers.
    if v in (None, ''):
        return None
    s = str(v).replace('\r\n', '\n').replace('\r', '\n')
    lines = [re.sub(r'[ \t]+', ' ', ln).strip() for ln in s.split('\n')]
    lines = [ln for ln in lines if ln]
    return '\n'.join(lines) or None


# Peak / best time of year for each Fragrance Walk stop (keyed by stop number).
FRAGRANCE_PEAK = {
    1:  'February–May',
    2:  'May–August',
    3:  'Spring–summer',
    4:  'Year-round; peak spring–fall',
    5:  'March–June',
    6:  'Year-round; peak May–October',
    7:  'May–November',
    8:  'March–May',
    9:  'August–November',
    10: 'Year-round leaf fragrance',
    11: 'Year-round leaf fragrance; flowers April–August',
    12: 'Year-round leaf fragrance',
}

wb = openpyxl.load_workbook(os.path.join(HERE, 'Tree&FragranceWalk_with_descriptions.xlsx'), data_only=True)
features, tree_by_coord = [], {}

for sheet, walk in [('Arboretum Walk', 'tree'), ('Fragrance Walk', 'fragrance')]:
    ws, section = wb[sheet], None
    for row in ws.iter_rows(min_row=2, values_only=True):
        num, name, lng, lat = row[0], row[1], row[2], row[3]
        # Column E ("Description") exists on the Arboretum Walk sheet; guard in
        # case a sheet has fewer columns or the cell is blank.
        desc = clean_text(row[4] if len(row) > 4 else None)
        if isinstance(num, str) and name is None:
            # Title-case the ALL-CAPS header, then fix the apostrophe-S quirk
            # (str.title() turns "CHILDREN'S" into "Children'S").
            section = re.sub(r"'(\w)", lambda m: "'" + m.group(1).lower(), num.title())
            continue
        if num is None or lng is None or lat is None:
            continue
        common, sci = parse_name(name)
        photos = photo_list(photo_slug(common, sci))
        feat = {"type": "Feature",
                "geometry": {"type": "Point", "coordinates": [round(lng, 6), round(lat, 6)]},
                "properties": {"walk": walk, "num": num, "common": common, "scientific": sci,
                               "section": section if walk == 'tree' else None,
                               "peak": FRAGRANCE_PEAK.get(num) if walk == 'fragrance' else None,
                               "description": desc if walk == 'tree' else None,
                               "photo": photos[0], "photos": photos}}
        features.append(feat)
        if walk == 'tree':
            tree_by_coord[(round(lng, 6), round(lat, 6))] = feat

for row in wb["Highlights Walk"].iter_rows(min_row=2, values_only=True):
    num, name, lng, lat = row[0], row[1], row[2], row[3]
    if num is None or lng is None or lat is None:
        continue
    # The Highlights Walk sheet has its own Column E ("Description") and optional
    # Column F ("Section"). Each is used when filled; otherwise it falls back to
    # the matching Tree pin's value. Landmark stops (bridge, lawn, fountain) have
    # no matching tree, so the Section column is how they get a chip.
    own_desc = clean_text(row[4] if len(row) > 4 else None)
    own_section = row[5] if len(row) > 5 else None
    own_section = re.sub(r'\s+', ' ', str(own_section).strip()) if own_section not in (None, '') else None
    common, sci = parse_name(name)
    src = tree_by_coord.get((round(lng, 6), round(lat, 6)))
    section = own_section or (src["properties"].get("section") if src else None)
    if src is None and not own_section:
        print(f"WARNING: Highlights stop {num} '{common}' has no matching Tree Walk pin and no Section — chip will be blank")
    description = own_desc or (src["properties"].get("description") if src else None)
    photos = photo_list(photo_slug(common, sci))
    features.append({"type": "Feature",
        "geometry": {"type": "Point", "coordinates": [round(lng, 6), round(lat, 6)]},
        "properties": {"walk": "highlights", "num": num, "common": common, "scientific": sci,
                       "section": section,
                       "description": description,
                       "photo": photos[0], "photos": photos}})

# Pollinator Tour — a separate toggle overlay, not a numbered walk. Each stop
# carries a stoplight "color" (red/yellow/green) and the MBBG garden sector it
# sits in. Columns: Number | Color | Longitude (X) | Latitude (Y) | MBBG Sector.
poll_wb = openpyxl.load_workbook(os.path.join(HERE, 'Pollinator.xlsx'), data_only=True)
for row in poll_wb['Pollinator Tour'].iter_rows(min_row=2, values_only=True):
    num, color, lng, lat, sector = row[0], row[1], row[2], row[3], row[4]
    if num is None or lng is None or lat is None:
        continue
    features.append({"type": "Feature",
        "geometry": {"type": "Point", "coordinates": [round(lng, 6), round(lat, 6)]},
        "properties": {"walk": "pollinator", "num": num,
                       "color": str(color).strip().lower(),
                       "sector": str(sector).strip() if sector else None}})

# Top pollinators per garden sector (MBBG_Top_Pollinators.xlsx). Each species is
# recorded in one or more sectors; we keep the sheet order (most common first)
# so the catalogue naturally surfaces the most frequently seen species first.
# Image filenames follow a slug of the scientific name, e.g. Danaus plexippus ->
# images/pollinators/danaus-plexippus.jpg  (placeholders until photos are added).
# (slug() is defined near the top of this file.)
CLASS_MAP = {'insecta': 'insect', 'insect': 'insect', 'birds': 'bird', 'bird': 'bird'}

species = []
top_wb = openpyxl.load_workbook(os.path.join(HERE, 'MBBG_Top_Pollinators.xlsx'), data_only=True)
for row in top_wb['Top Animals'].iter_rows(min_row=2, values_only=True):
    cls_raw, common, sci, sectors_raw = row[0], row[1], row[2], row[3]
    if not common:
        continue
    cls = CLASS_MAP.get(str(cls_raw).strip().lower(), 'insect')
    sectors = [s.strip() for s in str(sectors_raw or '').split(',') if s.strip()]
    species.append({"cls": cls, "common": common.strip(),
                    "scientific": sci.strip() if sci else None,
                    "img": f"images/pollinators/{slug(sci or common)}.jpg",
                    "sectors": sectors})

out = "// Auto-generated by data/build_walk_data.py — do not edit by hand.\n"
out += "const WALK_DATA = " + json.dumps({"type": "FeatureCollection", "features": features},
                                          indent=2, ensure_ascii=False) + ";\n\n"
out += "const POLLINATOR_SPECIES = " + json.dumps(species, indent=2, ensure_ascii=False) + ";\n"
open(os.path.join(HERE, '..', 'js', 'walk-data.js'), 'w').write(out)
for w in ('tree', 'fragrance', 'highlights', 'pollinator'):
    print(w, sum(1 for f in features if f['properties']['walk'] == w))
print('species', len(species), '(', sum(s['cls'] == 'bird' for s in species), 'birds,',
      sum(s['cls'] == 'insect' for s in species), 'insects )')
