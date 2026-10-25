import requests,concurrent.futures,io
from PIL import Image,ImageDraw
base='https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Sponza/glTF/'
j=requests.get(base+'Sponza.gltf').json();out=Image.new('RGB',(640,640));d=ImageDraw.Draw(out)
def f(item):
 i,m=item;idx=m.get('pbrMetallicRoughness',{}).get('baseColorTexture',{}).get('index');
 if idx is None:return
 try:
  im=Image.open(io.BytesIO(requests.get(base+j['images'][j['textures'][idx]['source']]['uri']).content));im.thumbnail((120,110));x=i%5*128;y=i//5*128;out.paste(im,(x,y));d.text((x,y+111),str(i),fill='white')
 except:pass
with concurrent.futures.ThreadPoolExecutor(max_workers=12)as e:list(e.map(f,enumerate(j['materials'])))
out.save('/home/user/asset_research/sponza_materials.jpg')
