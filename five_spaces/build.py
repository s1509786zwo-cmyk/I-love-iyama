from pathlib import Path
import subprocess
p=Path(__file__).parent
(p/'release.js').write_text((p/'main.js').read_text().split('// Diagnostics are opt-in')[0])
subprocess.run(['./node_modules/.bin/esbuild','release.js','--bundle','--charset=utf8','--minify','--format=esm','--target=es2022','--external:three','--external:three/*','--external:three-mesh-bvh','--outfile=app.js'],cwd=p,check=True)
s=(p/'template.html').read_text().replace('/*__APP__*/',(p/'app.js').read_text().replace('</script','<\\/script'))
(p/'index.html').write_text(s)
print('HTML',len(s.encode()))
