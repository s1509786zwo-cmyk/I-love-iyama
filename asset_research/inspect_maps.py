import numpy as np,struct,json
from pathlib import Path
for file in ['GrandLibrary.glb','cellar.glb']:
 data=Path('/home/user/asset_research/'+file).read_bytes();j=json.loads(data[20:20+struct.unpack_from('<I',data,12)[0]])
 def mat(n):
  if'matrix'in n:return np.array(n['matrix']).reshape(4,4).T
  x,y,z,w=n.get('rotation',[0,0,0,1]);m=np.eye(4);m[:3,:3]=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])@np.diag(n.get('scale',[1,1,1]));m[:3,3]=n.get('translation',[0,0,0]);return m
 out=[]
 def walk(idx,m):
  n=j['nodes'][idx];m=m@mat(n);a=[]
  if'mesh'in n:
   for p in j['meshes'][n['mesh']]['primitives']:
    b=j['accessors'][p['attributes']['POSITION']];mi=b['min'];ma=b['max'];a.extend([(m@np.array([x,y,z,1]))[:3]for x in [mi[0],ma[0]]for y in[mi[1],ma[1]]for z in[mi[2],ma[2]]])
   out.append((n.get('name'),np.min(a,axis=0),np.max(a,axis=0)))
  for c in n.get('children',[]):walk(c,m)
 for i in j['scenes'][j.get('scene',0)]['nodes']:walk(i,np.eye(4))
 print(file,'BBOX',np.min([x[1]for x in out],axis=0),np.max([x[2]for x in out],axis=0),'MESHES',len(out))
 print('LARGE',[(n,a.round(3).tolist(),b.round(3).tolist())for n,a,b in sorted(out,key=lambda v:np.prod(v[2]-v[1]),reverse=True)[:15]])
 print('FLAT',[(n,a.round(3).tolist(),b.round(3).tolist())for n,a,b in out if (b-a)[1]<.5 and(b-a)[0]*(b-a)[2]>15][:15])
