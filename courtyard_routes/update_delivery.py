from pathlib import Path
import subprocess, zipfile, hashlib, struct, shutil
p=Path(__file__).resolve().parent
subprocess.run(['python3','build.py'],cwd=p,check=True)
subprocess.run(['./node_modules/.bin/esbuild','release.js','--bundle','--charset=utf8','--format=esm','--target=es2022','--external:three','--external:three/*','--external:three-mesh-bvh','--outfile=readable.js'],cwd=p,check=True)
html=(p/'template.html').read_text().replace('/*__APP__*/',(p/'readable.js').read_text().replace('</script','<\\/script'))
for dest in [p/'complete.html',p.parent/'GRAND_ATLAS_DeHaar_原解像度_完全版.html',p.parent/'GRAND_ATLAS_ドア2追加_完全版.html']:
 dest.write_text(html)
package=p.parent/'GRAND_ATLAS_DeHaar_原解像度_配信一式.zip';temp=p.parent/'.cache/dehaar-delivery.zip';temp.parent.mkdir(exist_ok=True)
model=p/'assets/dehaar.glb';expected='ab30453bf313e4ce758d206c51d3ac81b1e9aaf9384e2c5e6d5a1ac24866c295'
if model.exists():data=model.read_bytes()
else:
 with zipfile.ZipFile(package)as old:data=old.read('assets/dehaar.glb')
assert len(data)==32290368 and struct.unpack_from('<I',data,8)[0]==len(data)
assert hashlib.sha256(data).hexdigest()==expected
with zipfile.ZipFile(temp,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6)as z:
 z.writestr('index.html',html);z.writestr('README.txt',(p/'README_ドア2追加.txt').read_text());z.writestr('assets/dehaar.glb',data)
with zipfile.ZipFile(temp)as z:assert z.testzip() is None
shutil.move(temp,package)
old=p.parent/'GRAND_ATLAS_ドア2追加_配信一式.zip'
if old.exists():shutil.move(old,p.parent/'.cache/old-lebioles-delivery.zip')
print('Readable complete HTML',len(html.encode()),'bytes; verified ZIP',package.stat().st_size,'bytes')
