from pathlib import Path
p=Path('/home/user/five_spaces/main.js');s=p.read_text();s=s.replace("import {KTX2Loader}","import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';\nimport {KTX2Loader}")
s=s.replace("breakfast:{name:'The Breakfast Room — 外部朝食・晩餐室',url:'https://raw.githubusercontent.com/gkjohnson/3d-demo-data/main/models/bitterli-rendering-resources/breakfast-room.glb',targetHeight:3.0,baseY:0},", "library:{name:'大図書館 — Library',url:'https://raw.githubusercontent.com/dracosdraco-coder/thelibrary/HEAD/public/assets/models/Library.glb',targetHeight:6.2},\n myroom:{name:'自分の部屋 — The Botanist’s Study',url:'https://raw.githubusercontent.com/gkjohnson/3d-demo-data/main/models/botanists-study/scene.gltf',targetHeight:3.25},")
s=s.replace("wine:{name:'地下ワインバー — Amazon Lumberyard Bistro',url:'https://raw.githubusercontent.com/qian-o/GLTF-Assets/main/Bistro/BistroInterior_Wine.gltf',targetHeight:3.4,baseY:0}","wine:{name:'地下ワインセラー',url:'https://raw.githubusercontent.com/Radoslav02/winery-demo/HEAD/public/models/cellar-opt.glb',targetHeight:3.3}")
s=s.replace('let loadSerial=0;const wineTextureCache=new Map();',"let loadSerial=0;const PROP_CONFIG={barrel:{name:'外部ワイン樽',url:'https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/wine_barrel_01/wine_barrel_01_1k.gltf',manifest:'https://api.polyhaven.com/files/wine_barrel_01'}};")
a=s.index('async function externalScene(');b=s.index('function releaseDetached(',a)
s=s[:a]+'''async function externalScene(key){
 const cfg=AREA_CONFIG[key]||PROP_CONFIG[key],controller=new AbortController(),blobs=[],resources=new Map();let timedOut=false;
 const work=(async()=>{
  async function get(url){if(rawCache.has(url))return rawCache.get(url);const response=await fetch(url,{signal:controller.signal,mode:'cors'});if(!response.ok)throw Error(`HTTP ${response.status}: ${url}`);const bytes=await response.arrayBuffer();rawCache.set(url,bytes);return bytes;}
  try{
   stage(cfg.name+'：公開アセットを取得中…');$('fadeDetail').textContent=cfg.name;
   let bytes=await get(cfg.url);
   if(new DataView(bytes).getUint32(0,true)!==0x46546c67){
    const json=JSON.parse(new TextDecoder().decode(bytes));let includes={};
    if(cfg.manifest){const manifest=JSON.parse(new TextDecoder().decode(await get(cfg.manifest)));includes=manifest.gltf['1k'].gltf.include;}
    const paths=[...new Set([...(json.buffers||[]),...(json.images||[])].map(r=>r.uri).filter(u=>u&&!u.startsWith('data:')))];let next=0,done=0;
    await Promise.all(Array.from({length:Math.min(6,paths.length)},async()=>{while(next<paths.length){const path=paths[next++],url=new URL(path,cfg.url).href,real=includes[path]?.url||url,data=await get(real),blob=URL.createObjectURL(new Blob([data]));blobs.push(blob);resources.set(url,blob);$('fadeDetail').textContent=cfg.name+' '+(++done)+'/'+paths.length;}}));
   }
   const manager=new THREE.LoadingManager();manager.setURLModifier(url=>resources.get(url)||url);const loader=new GLTFLoader(manager),draco=new DRACOLoader();draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');loader.setDRACOLoader(draco);loader.setKTX2Loader(ktx2);loader.setMeshoptDecoder(MeshoptDecoder);
   let parseTimer;const parsing=loader.parseAsync(bytes,new URL('.',cfg.url).href);
   try{const gltf=await Promise.race([parsing,new Promise((_,reject)=>{parseTimer=setTimeout(()=>{parsing.then(g=>releaseDetached(g.scene)).catch(()=>{});reject(Error('解析が60秒を超えました'));},60000);})]);if(timedOut){releaseDetached(gltf.scene);throw Error('ロード中断');}return gltf.scene;}finally{clearTimeout(parseTimer);draco.dispose();}
  }finally{blobs.forEach(url=>URL.revokeObjectURL(url));}
 })();
 let timer;try{return await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>{timedOut=true;controller.abort();reject(Error('外部アセット取得が120秒を超えました'));},120000);})]);}finally{clearTimeout(timer);}
}
''' +s[b:]
s=s.replace('group=await boundedExternal(key);','group=await externalScene(key);')
s=s.replace("else humanScale(group,cfg);", "else{if(key==='myroom'){const remove=[];group.traverse(o=>{if(/VolumetricLight/i.test(o.name))remove.push(o);if(/Glass/i.test(o.name))o.userData.noCollision=true;});for(const o of remove){if(o.parent){o.removeFromParent();releaseDetached(o);}}}humanScale(group,cfg);}")
s=s.replace("if(key==='wine')group=await batchExternal(group);", "if(key==='wine')await addExternalBarrels(group);\n  if(key==='library')group=await batchExternal(group);")
s=s.replace("if(/WhiteMarble/i.test(o.name))deskY=b.max.y;", "if(/WhiteMarble|TastingTable/i.test(o.name)){deskY=b.max.y;tableBase=b.min.y;deskBox=b.clone();}")
s=s.replace("eyeHeight:C.eye,scaleBasis:","eyeHeight:C.eye,floorY:(floorY-before.min.y)*factor,scaleBasis:")
idx=s.index('async function batchExternal(')
s=s[:idx]+'''async function addExternalBarrels(root){
 const prototype=await externalScene('barrel');prototype.updateMatrixWorld(true);let box=new THREE.Box3().setFromObject(prototype);prototype.scale.setScalar(1/(box.max.y-box.min.y));prototype.updateMatrixWorld(true);box.setFromObject(prototype);const center=box.getCenter(new THREE.Vector3());prototype.position.x-=center.x;prototype.position.z-=center.z;prototype.position.y-=box.min.y;prototype.updateMatrixWorld(true);
 const roomBox=new THREE.Box3().setFromObject(root),size=roomBox.getSize(new THREE.Vector3()),y=scaleReport.floorY;
 for(const side of[-1,1])for(const fraction of[-.28,-.10,.33]){const barrel=prototype.clone(true);barrel.position.add(new THREE.Vector3(side*size.x*.23,y,size.z*fraction));barrel.updateMatrixWorld(true);root.attach(barrel);}prototype.clear();
}
''' +s[idx:]
s=s.replace("renderer.render(scene,camera);frames++", "renderer.render(scene,camera);frames++")
p.write_text(s)
p=Path('/home/user/five_spaces/maps.js');s=p.read_text().replace('wall(root,16,3.45,[2.2,0,8],-Math.PI/2);','wall(root,16,3.45,[2.2,0,8],-Math.PI/2,{center:4,width:1.70,top:2.75});').replace('wall(root,32.5,3.45,[-2.2,0,16.25],Math.PI/2,{center:16.25-20,width:1.70,top:2.75});','wall(root,32.5,3.45,[-2.2,0,16.25],Math.PI/2);').replace('[[-2.2,20,-1],[2.2,20,1]]','[[2.2,12,1],[2.2,20,1]]').replace('blackArch(-2.26,0,20,Math.PI/2);','blackArch(2.26,0,12,Math.PI/2);')
s=s.replace("{id:'wine',kind:'enter',target:'wine',label:'黒アーチ：外部ワインバーへ',position:[2.22,1.25,20],stand:[1,0,20],size:[.65,2.5,1.6]},", "{id:'myroom',kind:'enter',target:'myroom',label:'黒アーチ②：自分の部屋へ',position:[2.22,1.25,20],stand:[1,0,20],size:[.65,2.5,1.6]},")
s=s.replace("{id:'breakfast',kind:'enter',target:'breakfast',label:'反対側：The Breakfast Roomへ',position:[-2.22,1.25,20],stand:[-1,0,20],size:[.65,2.5,1.6]},", "{id:'library',kind:'enter',target:'library',label:'黒アーチ①：大図書館へ',position:[2.22,1.25,12],stand:[1,0,12],size:[.65,2.5,1.6]},")
s=s.replace('石階段の底：外部ワインバーへ','石階段の底：地下ワインセラーへ');p.write_text(s)
p=Path('/home/user/five_spaces/template.html');s=p.read_text();a=s.index('<h1>');b=s.index('<label for="quality">',a);s=s[:a]+'''<h1>GRAND ATLAS</h1><p>SPONZA / LONG CORRIDOR / GRAND LIBRARY / MY ROOM / WINE CELLAR</p><p>WASD：移動 ／ Shift：ダッシュ ／ Space：ジャンプ<br>E：鉄扉・黒アーチ ／ F・L：懐中電灯 ／ Esc：マウス解除<br>中庭の既存鉄扉 → 大回廊。右壁の黒アーチ①は大図書館、②は自分の部屋。奥の左側の石階段を下ると地下ワインセラー。部屋内の黒アーチから入場前の位置・向きへ戻ります。</p>''' +s[b:];a=s.index('<details>');b=s.index('</details>',a)+10;s=s[:a]+'''<details><summary>外部アセット・利用条件</summary><p>接続する空間は上記5つのみ。反対側の扉・大聖堂・Breakfast Roomはありません。既存大回廊・階段は維持します。追加3室の床・壁・本棚・家具・樽は全て外部GLTF/GLBをロードします。自作部屋への置換はありません。</p><p>大図書館：<a href="https://github.com/dracosdraco-coder/thelibrary">thelibrary / Library.glb</a>、約9.3MB。公開モデルを直接ロード。以前の自作図書館とは別の外観です。二層の本棚と床・階段・家具をそのまま使用。背景の大きな地面も元モデルの一部です。</p><p>自分の部屋：<a href="https://sketchfab.com/3d-models/the-botanists-study-8b7b5743b1c848ed8ea58f5518c44e7e">The Botanist's Study</a> by riikkakilpelainen。配布glTF内記載：CC BY-NC-SA 4.0。非商用・表示・継承条件に従ってください。書斎型の公開ジオラマで、開放側の壁や天井を新造しません。光の演出用ボリュームのみ衝突・スケール判定から除外します。</p><p>地下：<a href="https://github.com/Radoslav02/winery-demo">winery-demo / cellar-opt.glb</a>、約17.3MB。元の石壁・棚・瓶・試飲テーブルを使用。<a href="https://polyhaven.com/a/wine_barrel_01">Wine Barrel 01</a>（Poly Haven、CC0）の外部glTFを6個配置。本体建築は作りません。公開リポジトリのLibrary.glbとcellar-opt.glbは再配布ライセンスを確認できていないため、アセットをこのHTMLに同梱せず参照します。公開配信・商用利用の前に各権利者へ利用条件を確認してください。</p><p>Sponza：Frank Meinl / Crytek、Marko Dabrovic、PBR Alexandre Pestana。<a href="https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Sponza">出典・利用条件</a>。既存大回廊PBR：Poly Haven、CC0。Three.js / three-mesh-bvh：MIT。</p><p>目線は足元＋1.65m。大図書館の二層構造全体を約6.2mに均一正規化。書斎は全体高約3.25m、セラーは実際の試飲天板約0.75mを基準にします。実床Raycast・接地ジャンプ・段差0.4m・地下階段アシスト。60fpsは実機依存の目標です。DPR最大1.5、懐中電灯の影のみ1024²、FOV70、near0.2、far300。</p><p>外部ロード120秒、解析60秒でタイムアウト。失敗時は大回廊へ復帰。Chrome/Edge・ネット接続が必要です。マウスロックが拒否される場合は別タブかダウンロードしたHTMLで開いてください。</p></details>''' +s[b:];p.write_text(s)
