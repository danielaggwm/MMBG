"""Regenerates js/walk-data.js from Tree&FragranceWalk.xlsx and Pollinator.xlsx.
Run:  python3 build_walk_data.py  (from the data/ folder)

Sheets:
- 'Arboretum Walk'   (Tree&FragranceWalk.xlsx) -> tree walk (sections as header rows, numbered 1..N)
- 'Fragrance Walk'   (Tree&FragranceWalk.xlsx) -> fragrance walk
- 'Pollinator Tour'  (Pollinator.xlsx)         -> pollinator overlay (num + stoplight color + sector)
- 'Top Animals'      (MBBG_Top_Pollinators.xlsx) -> per-sector species catalogue (POLLINATOR_SPECIES)
- "Kathy's Walk"    -> highlights walk (num, name, lng, lat). The Excel
  sheet keeps its original name; the output walk key is "highlights".
  Each stop is matched to a Tree Walk pin BY COORDINATES and inherits its
  garden section and photo, so only the 4 basic columns are needed.
"""
import openpyxl, json, re, os

HERE = os.path.dirname(os.path.abspath(__file__))

def parse_name(raw):
    raw = re.sub(r'\s+', ' ', raw.strip())
    m = re.match(r'^(.*?)\s*\((.+)\)\s*$', raw)
    common, sci = (m.group(1).strip(), m.group(2).strip()) if m else (raw, None)
    common = re.sub(r'\s*\btrees?\b\s*', ' ', common, flags=re.I).strip()
    return common, sci

# The "Highlights Walk" data still lives on the Excel sheet named "Kathy's Walk";
# only the internal walk key and public label were renamed to "highlights".

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

wb = openpyxl.load_workbook(os.path.join(HERE, 'Tree&FragranceWalk.xlsx'), data_only=True)
features, tree_by_coord = [], {}

for sheet, walk in [('Arboretum Walk', 'tree'), ('Fragrance Walk', 'fragrance')]:
    ws, section = wb[sheet], None
    for row in ws.iter_rows(min_row=2, values_only=True):
        num, name, lng, lat = row[0], row[1], row[2], row[3]
        if isinstance(num, str) and name is None:
            section = num.title(); continue
        if num is None or lng is None or lat is None:
            continue
        common, sci = parse_name(name)
        feat = {"type": "Feature",
                "geometry": {"type": "Point", "coordinates": [round(lng, 6), round(lat, 6)]},
                "properties": {"walk": walk, "num": num, "common": common, "scientific": sci,
                               "section": section if walk == 'tree' else None,
                               "peak": FRAGRANCE_PEAK.get(num) if walk == 'fragrance' else None,
                               "photo": f"images/trees/{walk}-{num:02d}.jpg"}}
        features.append(feat)
        if walk == 'tree':
            tree_by_coord[(round(lng, 6), round(lat, 6))] = feat

for row in wb["Kathy's Walk"].iter_rows(min_row=2, values_only=True):
    num, name, lng, lat = row[0], row[1], row[2], row[3]
    if num is None or lng is None or lat is None:
        continue
    common, sci = parse_name(name)
    src = tree_by_coord.get((round(lng, 6), round(lat, 6)))
    if src is None:
        print(f"WARNING: Highlights stop {num} '{common}' has no matching Tree Walk pin — no section/photo")
    features.append({"type": "Feature",
        "geometry": {"type": "Point", "coordinates": [round(lng, 6), round(lat, 6)]},
        "properties": {"walk": "highlights", "num": num, "common": common, "scientific": sci,
                       "section": src["properties"]["section"] if src else None,
                       "photo": src["properties"]["photo"] if src else f"images/trees/highlights-{num:02d}.jpg"}})

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
def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', (s or '').lower()).strip('-')

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
