from pathlib import Path
import subprocess
p=Path(__file__).parent
subprocess.run(['./node_modules/.bin/esbuild','main.js','--bundle','--format=iife','--target=es2020','--minify','--legal-comments=inline','--outfile=engine.bundle.js'],cwd=p,check=True)
s=(p/'template.html').read_text().replace('/*__ENGINE__*/',(p/'engine.bundle.js').read_text().replace('</script','<\\/script'))
(p/'index.html').write_text(s)
Path('/home/user/耳が飾りになるまで_外部アセット版_完全HTML.html').write_text(s)
print('HTML bytes:',len(s.encode()))
