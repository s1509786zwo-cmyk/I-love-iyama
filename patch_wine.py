from pathlib import Path
p=Path('/home/user/wine_explorer/main.js');s=p.read_text().replace("import {GLTFLoader}","import {KTX2Loader} from 'three/addons/loaders/KTX2Loader.js';\nimport {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';\nimport {GLTFLoader}")
s=s.replace("https://raw.githubusercontent.com/Breush/lava-assets/master/models/sponza.glb","https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Sponza/glTF/Sponza.gltf")
a=s.index(" library:{name:");b=s.index('\n};',a);s=s[:a]+" dungeon:{name:'地下探索 — three.js collision-world',url:'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/collision-world.glb',targetHeight:3.4,baseY:0},\n wine:{name:'ワインバー — Amazon Lumberyard Bistro',url:'https://raw.githubusercontent.com/qian-o/GLTF-Assets/main/Bistro/BistroInterior_Wine.gltf',targetHeight:3.4,baseY:0}"+s[b:]
a=s.index('async function sourceBytes(');b=s.index('function disposeArea()',a)
s=s[:a]+'''let localWine=null,loadSerial=0;
const ktx2=new KTX2Loader().setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/basis/').setWorkerLimit(2);ktx2.detectSupport(renderer);
async function externalScene(key){
 const cfg=AREA_CONFIG[key],serial=++loadSerial,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),120000),blobs=[],resources=new Map();
 const progress=(n,total)=>{const text=`Loading… ${cfg.name} · ${n}/${total}`;stage(text);$('fadeDetail').textContent=text;};
 async function get(url){if(rawCache.has(url))return rawCache.get(url);const r=await fetch(url,{signal:controller.signal,mode:'cors'});if(!r.ok)throw Error(`HTTP ${r.status}: ${url}`);const bytes=await r.arrayBuffer();if(key!=='wine')rawCache.set(url,bytes);return bytes;}
 try{
  let bytes=key==='wine'&&localWine?localWine:await get(cfg.url),rootURL=cfg.url;
  if(new DataView(bytes).getUint32(0,true)!==0x46546c67){const json=JSON.parse(new TextDecoder().decode(bytes));
   const paths=[...new Set([...(json.buffers||[]),...(json.images||[])].map(v=>v.uri).filter(u=>u&&!u.startsWith('data:')))];let done=0,next=0;progress(0,paths.length);
   await Promise.all(Array.from({length:Math.min(6,paths.length)},async()=>{while(next<paths.length){const path=paths[next++],url=new URL(path,rootURL).href;let real=url;if(url.endsWith('/BistroInterior_Wine.bin'))real='https://media.githubusercontent.com/media/qian-o/GLTF-Assets/main/Bistro/BistroInterior_Wine.bin';const data=await get(real),blob=URL.createObjectURL(new Blob([data]));blobs.push(blob);resources.set(url,blob);progress(++done,paths.length);}}));
  }
  const manager=new THREE.LoadingManager();manager.setURLModifier(url=>resources.get(url)||url);const loader=new GLTFLoader(manager);loader.setKTX2Loader(ktx2);
  const scenePromise=loader.parseAsync(bytes,new URL('.',rootURL).href);
  let parseTimer;const parsed=await Promise.race([scenePromise,new Promise((_,reject)=>{parseTimer=setTimeout(()=>{scenePromise.then(g=>releaseDetached(g.scene)).catch(()=>{});reject(Error('モデル解析が時間制限を超えました'));},60000);})]).finally(()=>clearTimeout(parseTimer));
  if(serial!==loadSerial){releaseDetached(parsed.scene);throw Error('読み込みは中断されました');}return parsed.scene;
 }catch(e){controller.abort();throw Error(e.name==='AbortError'?'読み込みが120秒を超えました／通信中断':e.message);}finally{clearTimeout(timer);blobs.forEach(u=>URL.revokeObjectURL(u));}
}
function releaseDetached(root){const images=new Set();root.traverse(o=>{o.geometry?.dispose();for(const m of[].concat(o.material||[])){for(const v of Object.values(m))if(v?.isTexture){v.dispose();if(v.image)images.add(v.image);}m.dispose();}});images.forEach(i=>i.close?.());}
''' +s[b:]
a=s.index('function installHubOpening(');b=s.index('function installBuiltOpenings',a)
s=s[:a]+'''function installHubOpening(root){
 // The supplied Khronos asset's material 11 contains this original iron door.
 // Original mesh coordinates were measured from the actual Sponza.bin.
 let source;root.traverse(o=>{if(!source&&o.isMesh)source=o;});
 const door=source.localToWorld(new THREE.Vector3(-64,100,567));
 const stand=new THREE.Vector3(door.x,0,door.z-1.05),f=floorAt(stand.x,stand.z,3.0,4);
 if(!f||!bodyClear(stand.x,f.point.y,stand.z))throw Error('既存鉄扉前の足場がありません');
 nativeOpening('ironDoor','corridor','鉄扉を開けて大回廊へ',[door.x,f.point.y+1.15,door.z-.18],[stand.x,f.point.y,stand.z],[1.45,2.4,.55]);
}
function installRoomReturn(root){
 const box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),candidates=[];
 for(let iz=1;iz<25;iz++)for(let ix=1;ix<25;ix++){
  const x=box.min.x+size.x*ix/25,z=box.min.z+size.z*iz/25,f=floorAt(x,z,box.max.y+.2,size.y+.5);
  if(!f||f.point.y>box.min.y+.8||!bodyClear(x,f.point.y,z))continue;
  if(nativeCast(new THREE.Vector3(x,f.point.y+.05,z),up,1.82).length)continue;
  const dist=Math.hypot(x-center.x,z-center.z);candidates.push({x,z,y:f.point.y,dist});
 }
 candidates.sort((a,b)=>a.dist-b.dist);
 for(const c of candidates)for(let k=0;k<8;k++){const dir=new THREE.Vector3(Math.sin(k*Math.PI/4),0,Math.cos(k*Math.PI/4));if([.25,.9,1.75].some(h=>nativeCast(new THREE.Vector3(c.x,c.y+h,c.z),dir,1.05).length))continue;
  const p=new THREE.Vector3(c.x,c.y,c.z).addScaledVector(dir,.85);activeSpawn=new THREE.Vector3(c.x,c.y+C.eye,c.z);activeLook=activeSpawn.clone().addScaledVector(dir,-3);nativeOpening('return','corridor','黒アーチから大回廊へ戻る',[p.x,c.y+1.1,p.z],[c.x,c.y,c.z],[1.5,2.3,.7],'return');
  const sh=new THREE.Shape();sh.moveTo(-.65,0);sh.lineTo(.65,0);sh.lineTo(.65,1.55);sh.absarc(0,1.55,.65,0,Math.PI,false);sh.closePath();const portal=new THREE.Mesh(new THREE.ShapeGeometry(sh,24),new THREE.MeshBasicMaterial({color:0x000000,side:THREE.DoubleSide}));portal.position.copy(p);portal.rotation.y=Math.atan2(dir.x,dir.z);portal.userData.noCollision=true;architecture.add(portal);return;
 }throw Error('成人サイズの安全な床と帰還地点を検出できません。別のGLBをドロップしてください。');
}
''' +s[b:]
s=s.replace("if(cfg.built){group=builders[cfg.built]();humanScale(group,cfg);}","if(cfg.built){group=builders[cfg.built]();group.updateMatrixWorld(true);scaleReport={eyeHeight:C.eye,authoredMeters:true};}")
a=s.index('  const loader=new GLTFLoader(),gltf=');b=s.index("  if(key==='hub')",a);s=s[:a]+"  group=await externalScene(key);\n"+s[b:]
s=s.replace('installHubOpening();','installHubOpening(group);')
a=s.index(" else if(cfg.built){installBuiltOpenings");b=s.index('\n const f=floorAt(activeSpawn',a)
s=s[:a]+" else if(cfg.built){installBuiltOpenings(group);stairAssist={axis:'x',x0:-6.38,x1:-2.20,z:28.8,halfWidth:.78,y0:-1.92,y1:0};}\n else installRoomReturn(group);\n"+s[b:]
s=s.replace("hemi.intensity=key==='hub'?.9:key==='library'?1.05:key==='lounge'?.75:.55;moon.intensity=key==='hub'?1.25:key==='library'?.8:key==='lounge'?.65:.35;","hemi.intensity=key==='hub'?.9:key==='wine'?1.15:.65;moon.intensity=key==='hub'?1.25:key==='wine'?.85:.4;")
a=s.index('function cast(origin,');b=s.index('// Capsule-like ray sweeps',a)
s=s[:a]+'''function cast(origin,dir,length,first=true){const hits=nativeCast(origin,dir,length,stairAssist?false:first),r=stairAssist;return r?hits.filter(h=>!(Math.abs(h.face.normal.x)>.9&&Math.abs(h.point.z-r.z)<r.halfWidth&&h.point.x>=r.x0-.03&&h.point.x<=r.x1&&h.point.y<=.02)):hits;}
function floorAt(x,z,from,max){const native=nativeCast(new THREE.Vector3(x,from,z),down,max,false).find(h=>h.face.normal.y>.62),r=stairAssist;if(r&&Math.abs(z-r.z)<r.halfWidth&&x>=r.x0&&x<=r.x1){const y=THREE.MathUtils.lerp(r.y0,r.y1,(x-r.x0)/(r.x1-r.x0));if(from>=y&&from-y<=max&&(!native||native.point.y<y))return {point:new THREE.Vector3(x,y,z),distance:from-y,face:{normal:up}};}return native;}
''' +s[b:]
s=s.replace("let target=", "let target=")
a=s.index('async function useDoor()');b=s.index('function updateTorches()',a)
s=s[:a]+'''async function useDoor(){if(transitioning||!ready)return;scanDoor();if(selectedPortal)await travel(selectedPortal.target,selectedPortal.id,selectedPortal.kind==='return');}
async function travel(requested,id='drop',returning=false){
 if(transitioning)return;
 const from=activeArea,pose={position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),feet},parent=returning?routeStack.at(-1):null,target=parent?parent.source:requested,same=from===target;
 transitioning=true;controls.enabled=false;keys.clear();jumpRequested=false;velocity.set(0,0,0);$('doorPrompt').textContent='';$('fadeLabel').textContent='……（扉を開けています）';$('fadeDetail').textContent='Loading…';await fade(1);let error=null;
 try{await loadArea(target);if(returning&&parent){restorePose(parent.pose);routeStack.pop();}else if(!same)routeStack.push({source:from,target,portalId:id,pose});}
 catch(e){error=e;console.error(e);$('fadeLabel').textContent='読み込み失敗 — 大回廊へ復帰しています';try{await loadArea('corridor');if(from==='corridor')restorePose(pose);else{const r=routeStack.findLast(f=>f.source==='corridor');if(r)restorePose(r.pose);}while(routeStack.length&&routeStack.at(-1).target!=='corridor')routeStack.pop();}catch(rollback){ready=false;failed=true;stage('復帰エラー：'+rollback.message);$('retry').classList.remove('hidden');}}
 spot.shadow.needsUpdate=true;shadowTime=-1;await fade(0);transitioning=false;controls.enabled=true;keys.clear();if(!ready){controls.unlock();setMenu(true);$('start').disabled=true;}else if(!controls.isLocked)setMenu(true);if(error){stage('復帰済み：'+error.message+' ／ GLBをドロップして差し替え可能');$('dropStatus').textContent='外部読込失敗。GLBをドロップして再試行できます。';}
}
addEventListener('dragover',e=>{e.preventDefault();$('dropHint').classList.add('dragging');});addEventListener('dragleave',()=>$('dropHint').classList.remove('dragging'));
async function replaceWine(file){if(!file||transitioning)return;if(!/\\.glb$/i.test(file.name)){$('dropStatus').textContent='.glbファイルを選択してください';return;}try{localWine=await file.arrayBuffer();if(localWine.byteLength<20||new DataView(localWine).getUint32(0,true)!==0x46546c67)throw Error('有効なGLBではありません');$('dropStatus').textContent='ローカルGLB：'+file.name;await travel('wine');}catch(e){$('dropStatus').textContent='差し替えエラー：'+e.message;}}
addEventListener('drop',e=>{e.preventDefault();$('dropHint').classList.remove('dragging');replaceWine(e.dataTransfer.files[0]);});$('glbFile').onchange=e=>replaceWine(e.target.files[0]);
''' +s[b:]
s=s.replace("const f=floorAt(activeSpawn.x,activeSpawn.z,activeSpawn.y-C.eye+.45,1.3);", "const f=floorAt(activeSpawn.x,activeSpawn.z,activeSpawn.y-C.eye+.7,1.8);")
s=s.replace("openingScan(){", "openingScan(){") # preserved opt-in diagnostics
p.write_text(s)
