import json, matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from shapely.geometry import shape, Polygon, MultiPolygon
from shapely.ops import unary_union
t=json.load(open("towns.json")); W=shape(json.load(open("water.json")))
U=unary_union([shape(v) for v in t.values()])
U=unary_union([Polygon(p.exterior) for p in getattr(U,"geoms",[U])])          # fill DDO hole
L=U.difference(W)
r=0.006  # ~500 m: close slivers, round corners, then back off
S=L.buffer(r,join_style=1).buffer(-r*1.6,join_style=1).buffer(r*0.6,join_style=1)
S=S.difference(W.buffer(0.0015))  # keep the edge off the water
parts=[p for p in getattr(S,'geoms',[S]) if p.area>4e-4]
parts=[Polygon(p.exterior).simplify(0.0012,preserve_topology=True) for p in parts]
print([round(p.area,4) for p in parts],[len(p.exterior.coords) for p in parts])
json.dump([[ [round(x,4),round(y,4)] for x,y in p.exterior.coords] for p in parts],open("coverage.json","w"))
fig,ax=plt.subplots(figsize=(11,8))
for w in getattr(W,'geoms',[W]):
    x,y=w.exterior.xy; ax.fill(x,y,color="#9cc8ee")
for p in parts:
    x,y=p.exterior.xy; ax.fill(x,y,color="#c8161d",alpha=.25); ax.plot(x,y,color="#c8161d",lw=1.2)
ax.set_xlim(-74.5,-73.65); ax.set_ylim(45.17,45.6); ax.set_aspect(1/0.7); plt.savefig("cov.png",dpi=110)
