import json, urllib.request, urllib.parse
from shapely.geometry import LineString, Polygon
from shapely.ops import polygonize, unary_union, linemerge
bbox="45.15,-74.5,45.6,-73.6"
q=f"""[out:json][timeout:120];
(relation["natural"="water"]({bbox}); way["natural"="water"]({bbox}););
out geom;"""
data=urllib.parse.urlencode({"data":q}).encode()
req=urllib.request.Request("https://overpass-api.de/api/interpreter",data=data,headers={"User-Agent":"rennbros-site-coverage/1.0"})
import os,time
if os.path.exists("raw.json"): r=json.load(open("raw.json"))
else:
    for i in range(6):
        try: r=json.load(urllib.request.urlopen(req,timeout=180)); break
        except Exception as e: print("retry",e); time.sleep(30)
    json.dump(r,open("raw.json","w"))
polys=[]
KEEP={"Lac des Deux-Montagnes","Lac Saint-Louis","Lac Saint-François","Rivière des Prairies","Canal de Beauharnois","Rapides de Lachine"}
for el in r["elements"]:
    if False:
        c=[(p["lon"],p["lat"]) for p in el["geometry"]]
        if len(c)>3 and c[0]==c[-1]:
            P=Polygon(c)
            if P.is_valid and P.area>2e-5: polys.append(P)
    elif el["type"]=="relation":
        lines=[LineString([(p["lon"],p["lat"]) for p in m["geometry"]]) for m in el.get("members",[]) if m.get("role")=="outer" and m.get("geometry")]
        inner=[LineString([(p["lon"],p["lat"]) for p in m["geometry"]]) for m in el.get("members",[]) if m.get("role")=="inner" and m.get("geometry")]
        if not lines: continue
        outs=list(polygonize(linemerge(lines)))
        ins=list(polygonize(linemerge(inner))) if inner else []
        if outs:
            P=unary_union(outs)
            if ins: P=P.difference(unary_union(ins))
            if el.get("tags",{}).get("name") in KEEP: polys.append(P); print("rel",el.get("tags",{}).get("name"),round(P.area,5))
W=unary_union([p.buffer(0) for p in polys])
json.dump(W.__geo_interface__,open("water.json","w"))
print("water parts",len(getattr(W,'geoms',[W])), W.area)
