import struct,json
from pathlib import Path
def replace(src,image,dest,mime):
 b=Path(src).read_bytes();jl=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+jl]);ix=j['images'][0]['bufferView'];v=j['bufferViews'][ix];blob=Path(image).read_bytes();off=v.get('byteOffset',0);binlen=len(b)-(28+jl);prefix=off if off+v['byteLength']>=binlen-3 else binlen;v['byteOffset']=prefix;binary=b[28+jl:28+jl+prefix]+blob;binary+=b'\0'*((-len(binary))%4);v['byteLength']=len(blob);j['buffers'][0]['byteLength']=len(binary);j['images'][0]['mimeType']=mime
 if mime=='image/webp':
  for k in ['extensionsUsed','extensionsRequired']:
   if 'EXT_texture_webp'not in j.setdefault(k,[]):j[k].append('EXT_texture_webp')
  for t in j['textures']:
   t.setdefault('extensions',{})['EXT_texture_webp']={'source':t.pop('source')}
 js=json.dumps(j,separators=(',',':')).encode();js+=b' '*((-len(js))%4)
 with Path(dest).open('wb')as f:f.write(struct.pack('<III',0x46546c67,2,28+len(js)+len(binary)));f.write(struct.pack('<II',len(js),0x4e4f534a));f.write(js);f.write(struct.pack('<II',len(binary),0x004e4942));f.write(binary)
 print(dest,Path(dest).stat().st_size)
if __name__=='__main__':
 for n in ['hintze','lebioles']:replace('/home/user/.cache/route_models/'+n+'-geometry.glb','/home/user/.cache/route_models/'+n+'-inspect.jpg','/home/user/courtyard_routes/assets/'+n+'-inspect.glb','image/jpeg')
 replace('/home/user/courtyard_routes/assets/lebioles.glb','/home/user/.cache/route_models/lebioles.webp','/home/user/courtyard_routes/assets/lebioles-webp.glb','image/webp');Path('/home/user/courtyard_routes/assets/lebioles-webp.glb').replace('/home/user/courtyard_routes/assets/lebioles.glb')
