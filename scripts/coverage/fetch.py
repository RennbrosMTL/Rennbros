import json, time, urllib.request, urllib.parse
Q = {
 "Baie-D'Urfé":"Baie-D'Urfé, Québec","Beaconsfield":"Beaconsfield, Québec","Dorval":"Dorval, Québec","Hudson":"Hudson, Québec",
 "Île Bizard":"L'Île-Bizard–Sainte-Geneviève, Montréal","Kirkland":"Kirkland, Québec","L'Île-Perrot":"L'Île-Perrot, Québec",
 "Notre-Dame-de-l'Île-Perrot":"Notre-Dame-de-l'Île-Perrot, Québec","Pierrefonds":"Pierrefonds-Roxboro, Montréal","Pincourt":"Pincourt, Québec",
 "Pointe-Claire":"Pointe-Claire, Québec","Rigaud":"Rigaud, Québec","Saint-Lazare":"Saint-Lazare, Vaudreuil-Soulanges",
 "Sainte-Anne-de-Bellevue":"Sainte-Anne-de-Bellevue, Québec","Senneville":"Senneville, Québec","Terrasse-Vaudreuil":"Terrasse-Vaudreuil, Québec",
 "Valleyfield":"Salaberry-de-Valleyfield, Québec","Vaudreuil-Dorion":"Vaudreuil-Dorion, Québec"}
out={}
for k,q in Q.items():
    url="https://nominatim.openstreetmap.org/search?"+urllib.parse.urlencode({"q":q,"format":"jsonv2","polygon_geojson":1,"limit":5,"countrycodes":"ca"})
    r=json.load(urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"rennbros-site-coverage/1.0 (tashiiwhite@gmail.com)"})))
    pick=[x for x in r if x.get("geojson",{}).get("type") in("Polygon","MultiPolygon")]
    if not pick: print("NO POLY",k,[ (x['type'],x['display_name'][:60]) for x in r]); continue
    x=pick[0]; out[k]=x["geojson"]; print(k,"->",x["type"],x["display_name"][:70])
    time.sleep(1.2)
json.dump(out,open("towns.json","w"))
