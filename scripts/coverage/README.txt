Rebuild the service-area outline (lib/area.ts `coverage`):
  python fetch.py   # town boundaries from Nominatim (add Dollard-des-Ormeaux to the list if refetching)
  python water.py   # big lakes and rivers from Overpass
  python build.py   # union, minus water, smoothed -> coverage.json + cov.png preview
Needs: pip install shapely matplotlib. Paste coverage.json rings into lib/area.ts.
