from pathlib import Path
import subprocess,base64
p=Path(__file__).parent
subprocess.run(['./node_modules/.bin/esbuild','main.js','--bundle','--minify','--format=iife','--target=es2020','--legal-comments=inline','--outfile=engine.bundle.js'],cwd=p,check=True)
s=(p/'template.html').read_text()
license='\n'.join((p/x).read_text() for x in ['node_modules/three/LICENSE','node_modules/three-mesh-bvh/LICENSE'])
s=s.replace('<!--__LICENSES__-->','<!-- Bundled library licenses:\n'+license.replace('--','—')+'\n-->').replace('/*__CATHEDRAL__*/',base64.b64encode((p/'assets/sibenik.glb').read_bytes()).decode()).replace('/*__ENGINE__*/',(p/'engine.bundle.js').read_text().replace('</script','<\\/script'))
(p/'index.html').write_text(s)
Path('/home/user/GRAND_ATLAS_扉エリア遷移_完全版.html').write_text(s)
print('Complete HTML:',len(s.encode()),'bytes')
