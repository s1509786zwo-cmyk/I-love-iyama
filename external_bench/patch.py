from pathlib import Path
p=Path('/home/user/external_bench/main.js');s=p.read_text();s=s.replace("import {KTX2Loader}","import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';\nimport {KTX2Loader}")
s=s.replace("dungeon:{name:'地下探索 — three.js collision-world',url:'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/collision-world.glb',targetHeight:3.4,baseY:0},", "breakfast:{name:'The Breakfast Room — 外部朝食・晩餐室',url:'https://raw.githubusercontent.com/gkjohnson/3d-demo-data/main/models/bitterli-rendering-resources/breakfast-room.glb',targetHeight:3.0,baseY:0},")
s=s.replace("wine:{name:'ワインバー — Amazon Lumberyard Bistro'", "wine:{name:'地下ワインバー — Amazon Lumberyard Bistro'")
s=s.replace("let localWine=null,loadSerial=0;", "let loadSerial=0;const wineTextureCache=new Map();")
s=s.replace("if(key!=='wine')rawCache.set(url,bytes);", "if(key!=='wine'||/\\.(gltf|bin)$/.test(url))rawCache.set(url,bytes);")
s=s.replace("let bytes=key==='wine'&&localWine?localWine:await get(cfg.url),rootURL=cfg.url;", "let bytes=await get(cfg.url),rootURL=cfg.url;")
s=s.replace("const data=await get(real),blob=URL.createObjectURL(new Blob([data]));", "const data=key==='wine'&&wineTextureCache.has(url)?wineTextureCache.get(url):await get(real),blob=URL.createObjectURL(new Blob([data]));")
s=s.replace("if(converted.has(url))continue;", "if(converted.has(url)||wineTextureCache.has(url))continue;")
s=s.replace("const blob=URL.createObjectURL(png);", "wineTextureCache.set(url,await png.arrayBuffer());const blob=URL.createObjectURL(png);")
s=s.replace("const loader=new GLTFLoader(manager);loader.setKTX2Loader(ktx2);", "const loader=new GLTFLoader(manager),draco=new DRACOLoader();draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');loader.setDRACOLoader(draco);loader.setKTX2Loader(ktx2);")
s=s.replace("}).finally(()=>clearTimeout(parseTimer));", "}).finally(()=>{clearTimeout(parseTimer);draco.dispose();});")
# Existing source has a different Promise.race ending; ensure decoder disposed after successful/failed parse.
s=s.replace("}).finally(()=>clearTimeout(parseTimer));", "}).finally(()=>{clearTimeout(parseTimer);draco.dispose();});")
s=s.replace("parseTimer));", "parseTimer));")
a=s.index('function humanScale(');b=s.index('async function batchExternal',a)
s=s[:a]+'''function humanScale(root,cfg){
 root.scale.setScalar(1);root.updateMatrixWorld(true);const before=new THREE.Box3().setFromObject(root),height=before.max.y-before.min.y;
 let floorY=null,deskY=null,tableBase=null;
 root.traverse(o=>{if(!o.isMesh)return;const b=new THREE.Box3().setFromObject(o);if(/FloorTiles/i.test(o.name))floorY=b.max.y;if(/WhiteMarble/i.test(o.name))deskY=b.max.y;if(/Paris_Table_02/i.test(o.name)){if(deskY==null||b.max.y<deskY){deskY=b.max.y;tableBase=b.min.y;}}});
 if(floorY==null)floorY=tableBase??before.min.y;let factor=deskY!=null?.75/(deskY-floorY):cfg.targetHeight/height;
 if(!Number.isFinite(factor)||factor<=0)throw Error('モデルの実寸を取得できません');
 root.scale.setScalar(factor);root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(root),center=box.getCenter(new THREE.Vector3());root.position.x-=center.x;root.position.z-=center.z;root.position.y-=box.min.y;root.updateMatrixWorld(true);
 scaleReport={factor,bboxHeight:height*factor,tableHeight:deskY==null?null:(deskY-floorY)*factor,eyeHeight:C.eye,scaleBasis:deskY==null?'bbox':'authored tabletop / floor'};
}
''' +s[b:]
s=s.replace("console.log('ROOM_BOX',box.min.toArray(),box.max.toArray(),JSON.stringify(scaleReport));",'')
a=s.find("console.log('ROOM_CANDIDATES'")
if a>=0:
 b=s.index('const lowest=',a);s=s[:a]+s[b:]
s=s.replace("z:28.8", "z:36.2")
s=s.replace("(e.code==='KeyF'||e.code==='KeyL')", "(e.code==='KeyF'||e.code==='KeyL')")
s=s.replace("e.code==='KeyF'", "(e.code==='KeyF'||e.code==='KeyL')") if "e.code==='KeyL'"not in s else s
# No local replacement UI from the earlier wine experiment.
a=s.index("addEventListener('dragover'");b=s.index('function updateTorches()',a);s=s[:a]+s[b:]
s=s.replace(";$('dropStatus').textContent='外部読込失敗。GLBをドロップして再試行できます。';",';')
s=s.replace("$('dropStatus').textContent='外部読込失敗。GLBをドロップして再試行できます。';",'')
s=s.replace(" ／ GLBをドロップして差し替え可能",'')
s=s.replace("。別のGLBをドロップしてください。",'。')
p.write_text(s)
p=Path('/home/user/external_bench/maps.js');s=p.read_text();s=s.replace('return {corridor,library,lounge,myroom};','return {corridor};')
s=s.replace("wall(root,16,3.45,[2.2,0,8],-Math.PI/2,{center:4,width:1.70,top:2.75});", "wall(root,16,3.45,[2.2,0,8],-Math.PI/2);")
s=s.replace("{center:16.25-28.8,width:1.70,top:2.75}", "{center:16.25-20,width:1.70,top:2.75}")
s=s.replace('[[2.2,12,1],[-2.2,28.8,-1],[2.2,20,1]]','[[-2.2,20,-1],[2.2,20,1]]')
s=s.replace('blackArch(2.26,0,12,Math.PI/2);','').replace('blackArch(-2.26,0,28.8,Math.PI/2);','blackArch(-2.26,0,20,Math.PI/2);')
a=s.index("   {id:'library'");b=s.index('\n  ];root.userData.spawnLocal',a);s=s[:a]+"   {id:'wine',kind:'enter',target:'wine',label:'黒アーチ：外部ワインバーへ',position:[2.22,1.25,20],stand:[1,0,20],size:[.65,2.5,1.6]},\n   {id:'breakfast',kind:'enter',target:'breakfast',label:'反対側：The Breakfast Roomへ',position:[-2.22,1.25,20],stand:[-1,0,20],size:[.65,2.5,1.6]},\n   {id:'cellar',kind:'enter',target:'wine',label:'石階段の底：外部ワインバーへ',position:[-7.08,-.72,36.2],stand:[-6.25,-1.92,36.2],size:[.65,2.5,1.6]}"+s[b:]
p.write_text(s)
