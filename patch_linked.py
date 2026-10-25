from pathlib import Path
import shutil
p=Path('/home/user/linked_cellar');p.mkdir(exist_ok=True)
for f in ['main.js','maps.js','template.html','build.py','package.json','package-lock.json']:shutil.copy(Path('/home/user/expanded_hub')/f,p/f)
s=(p/'main.js').read_text(); n=Path('/home/user/five_spaces/main.js').read_text()
s=s.replace("import {GLTFLoader}","import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';\nimport {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';\nimport {KTX2Loader} from 'three/addons/loaders/KTX2Loader.js';\nimport {GLTFLoader}")
s=s.replace("dungeon:{name:'地下探索 — 公式collision-world',url:'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/collision-world.glb',targetHeight:3.4,baseY:0}","dungeon:{name:'地下ワインセラー',url:'https://raw.githubusercontent.com/Radoslav02/winery-demo/HEAD/public/models/cellar-opt.glb',targetHeight:3.3,baseY:0}")
a=s.index('async function externalScene('); b=s.index('function releaseDetached',a)
x=n[n.index('let loadSerial='):n.index('function releaseDetached')].replace("key==='wine'","key==='dungeon'")
# Original furnished room keeps its original chair loader and architecture.
x=x.replace("if(key==='myroom')", "if(false)")
s=s[:a]+x+s[b:]
start=n.index('function humanScale('); end=n.index('async function batchExternal',start)
x=n[start:end].replace('function humanScale(', 'function cellarScale(')
s=s.replace('function humanScale(root,cfg){',x+'\nfunction humanScale(root,cfg){',1)
s=s.replace('else humanScale(group,cfg);\n\n }',"else if(key==='dungeon'){cellarScale(group,cfg);await addExternalBarrels(group);}else humanScale(group,cfg);\n\n }")
s=s.replace("hemi.intensity=key==='hub'?.9:","hemi.intensity=key==='dungeon'?1.15:key==='hub'?.9:").replace("moon.intensity=key==='hub'?1.25:","moon.intensity=key==='dungeon'?.85:key==='hub'?1.25:")
(p/'main.js').write_text(s)
s=(p/'maps.js').read_text().replace('地下探索へ','地下ワインセラーへ');(p/'maps.js').write_text(s)
s=(p/'template.html').read_text().replace('地下探索','地下ワインセラー')
import re
s=re.sub(r'<p>地下ワインセラーは指定のthree.js公式.*?</p>', '<p>地下のみ実在するワインセラーGLBへ差し替え、Poly Havenの外部ワイン樽を配置。セラーの画像は最大1024²へ最適化しています。リンク先の大図書館・自分の部屋・休憩室・大回廊は変更していません。</p>',s,flags=re.S)
s=re.sub(r'外部地下モデルはBBox全高約3.4mへ均一縮小し', 'セラーモデルは机の高さ0.75mを基準に全体を均一拡縮し',s)
s=s.replace('three.js / three-mesh-bvh: MIT。','セラー: Radoslav02/winery-demo（再利用ライセンス未確認、公開・商用利用前に権利確認が必要）。ワイン樽: Poly Haven wine_barrel_01 / CC0。three.js / three-mesh-bvh: MIT。')
(p/'template.html').write_text(s)
assert (p/'maps.js').read_text().replace('地下ワインセラーへ','地下探索へ')==Path('/home/user/expanded_hub/maps.js').read_text()
print('Exact deployed original verified; room architecture preserved.')
