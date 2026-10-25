from pathlib import Path
import subprocess
p=Path(__file__).parent
subprocess.run(['./node_modules/.bin/esbuild','main.js','--bundle','--minify','--format=iife','--target=es2020','--legal-comments=inline','--outfile=engine.bundle.js'],cwd=p,check=True)
licenses='\n'.join((p/x).read_text() for x in ['node_modules/three/LICENSE','node_modules/three-mesh-bvh/LICENSE'])
s=(p/'template.html').read_text().replace('<!--__LICENSES__-->','<!--\n'+licenses.replace('--','—')+'\n-->').replace('/*__ENGINE__*/',(p/'engine.bundle.js').read_text().replace('</script','<\\/script'))
(p/'index.html').write_text(s)
Path('/home/user/GRAND_ATLAS_自然な城ハブ_人間スケール_完全版.html').write_text(s)
print('Complete HTML bytes:',len(s.encode()))
