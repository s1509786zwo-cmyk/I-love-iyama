import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {KTX2Loader} from 'three/addons/loaders/KTX2Loader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {PointerLockControls} from 'three/addons/controls/PointerLockControls.js';
import {MeshBVH, acceleratedRaycast} from 'three-mesh-bvh';

// The default is an architectural reference, NOT a Japanese house.
// See credits in the UI. Replace this URL with your licensed, walkable interior GLB.
const CONFIG={modelURL:'https://raw.githubusercontent.com/Breush/lava-assets/master/models/sponza.glb',maxSpan:42,grid:.7,eye:1.62,radius:.28,step:.32};
const $=id=>document.getElementById(id), clamp=THREE.MathUtils.clamp;
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;$('view').append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x090f1b);scene.fog=new THREE.FogExp2(0x090f1b,.012);
const camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.06,85);camera.rotation.order='YXZ';scene.add(camera);
const controls=new PointerLockControls(camera,renderer.domElement);controls.pointerSpeed=.8;
scene.add(new THREE.HemisphereLight(0x8caadd,0x38251b,.85));
const moon=new THREE.DirectionalLight(0x9fbfe8,1.3);moon.position.set(-15,30,10);scene.add(moon);
const flash=new THREE.SpotLight(0xffdcaa,45,24,Math.PI/7,.6,1.5);flash.castShadow=true;flash.shadow.mapSize.set(1024,1024);flash.shadow.bias=-.00015;flash.shadow.normalBias=.02;scene.add(flash);
const flashTarget=new THREE.Object3D();scene.add(flashTarget);flash.target=flashTarget;
const flashQ=new THREE.Quaternion();let lightOn=true;
const keys=new Set(),ray=new THREE.Raycaster(),up=new THREE.Vector3(0,1,0),down=new THREE.Vector3(0,-1,0),v=new THREE.Vector3();
let root=null,collider=null,nav=[],spawn=null,items=[],notes=0,gotKey=false,ready=false,loading=false,reading=false,ended=false,elapsed=0,lookTarget=null,token=0;
let floorY=0,materials=[],originals=new Map(),overrides=new Map(),assetLabel='',lastSafe=new THREE.Vector3(),curFloor=0,velocity=new THREE.Vector3();
const texLoader=new THREE.TextureLoader();texLoader.setCrossOrigin('anonymous');const pbr={};
const PBR={wood:{name:'古木 / Old wood floor',id:'old_wood_floor'},tatami:{name:'畳 / Tatami mat',id:'tatami_mat'},clay:{name:'土壁 / Clay plaster',id:'clay_plaster'}};
function status(t){$('status').textContent=t;}
function toast(t){$('toast').textContent=t;clearTimeout(toast.t);toast.t=setTimeout(()=>$('toast').textContent='',5000);}
function overlay(show){$('panel').classList.toggle('hidden',!show);}
function sleep(){return new Promise(r=>setTimeout(r,0));}
function progress(t){status(t);$('busy').textContent=t;}
async function texture(url,color=false){const t=await texLoader.loadAsync(url);t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t;}
async function loadPBR(){
 for(const [key,{id}] of Object.entries(PBR)){
  const base=`https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/${id}/${id}`;
  try{const [map,roughnessMap,normalMap]=await Promise.all([texture(base+'_diff_2k.jpg',true),texture(base+'_rough_2k.jpg'),texture(base+'_nor_gl_2k.jpg')]);
   // Roughness maps from Poly Haven are grayscale: Three.js reads the green channel correctly.
   pbr[key]=new THREE.MeshStandardMaterial({name:PBR[key].name,map,roughnessMap,normalMap,roughness:1,normalScale:new THREE.Vector2(.65,.65)});
  }catch(e){console.warn('PBR texture unavailable',key,e);toast(`${PBR[key].name} を取得できません。モデル本来のPBRを維持します。`);}
 }
}
function makeLoader(manager){const loader=new GLTFLoader(manager);const draco=new DRACOLoader(manager);draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');loader.setDRACOLoader(draco);const ktx=new KTX2Loader(manager);ktx.setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/basis/');ktx.detectSupport(renderer);loader.setKTX2Loader(ktx);loader.setMeshoptDecoder(MeshoptDecoder);return {loader,dispose:()=>{draco.dispose();ktx.dispose();}};}
function disposeRoot(r){if(!r)return;const gs=new Set(),ms=new Set(),ts=new Set();r.traverse(o=>{if(o.geometry)gs.add(o.geometry);for(const m of [].concat(o.material||[])){ms.add(m);for(const x of Object.values(m))if(x?.isTexture)ts.add(x);}});gs.forEach(g=>g.dispose());ms.forEach(m=>{if(!Object.values(pbr).includes(m))m.dispose();});ts.forEach(t=>{if(!Object.values(pbr).some(m=>Object.values(m).includes(t)))t.dispose();});}
async function loadAsset(url,manager,label){
 if(loading){toast('現在のロードが終わってからお試しください。');return;}loading=true;ready=false;controls.unlock();reading=false;ended=false;$('reading').classList.add('hidden');$('busy').classList.remove('hidden');overlay(true);$('play').disabled=true;
 const mine=++token;let loaded=null,pack;
 try{
  progress('外部モデルをダウンロード中…');pack=makeLoader(manager);const gltf=await pack.loader.loadAsync(url,e=>{progress(`モデル読込 ${e.total?Math.round(e.loaded/e.total*100)+'%':(e.loaded/1048576).toFixed(1)+' MB'}`);});
  loaded=gltf.scene;if(mine!==token)return;
  // glTF is Y-up; normalize the largest horizontal dimension to meters.
  loaded.updateMatrixWorld(true);let box=new THREE.Box3().setFromObject(loaded),size=box.getSize(new THREE.Vector3());
  if(!Number.isFinite(size.x)||Math.max(size.x,size.z)<.001)throw new Error('モデルに有効な建築ジオメトリがありません。');
  const scale=CONFIG.maxSpan/Math.max(size.x,size.z);loaded.scale.multiplyScalar(scale);loaded.updateMatrixWorld(true);box.setFromObject(loaded);const c=box.getCenter(new THREE.Vector3());loaded.position.x-=c.x;loaded.position.z-=c.z;loaded.position.y-=box.min.y;loaded.updateMatrixWorld(true);
  materials=[];originals.clear();overrides.clear();const arr=[];let vertices=0,triangles=0;
  loaded.traverse(o=>{
   if(o.isLight){o.visible=false;return;}if(!o.isMesh)return;
   o.castShadow=true;o.receiveShadow=true;o.frustumCulled=true;
   const mm=[].concat(o.material);mm.forEach(m=>{if(m&&!materials.includes(m))materials.push(m);});originals.set(o,o.material);
   let g=o.geometry.clone();if(o.isSkinnedMesh)toast('スキン付きモデルは静的な当たり判定として扱います。建築用の静的GLBを推奨。');
   if(g.index){const old=g;g=g.toNonIndexed();old.dispose();}g.applyMatrix4(o.matrixWorld);
   const a=g.attributes.position;triangles+=a.count/3;vertices+=a.count*3;arr.push(new Float32Array(a.array));g.dispose();
  });
  if(vertices>18000000)throw new Error('モデルが重すぎます（600万頂点超）。メッシュを軽量化してください。');
  progress(`当たり判定BVHを構築中… ${Math.round(triangles).toLocaleString()} triangles`);await sleep();
  const positions=new Float32Array(vertices);let at=0;for(const a of arr){positions.set(a,at);at+=a.length;}
  const cg=new THREE.BufferGeometry();cg.setAttribute('position',new THREE.BufferAttribute(positions,3));cg.computeVertexNormals();cg.boundsTree=new MeshBVH(cg,{maxLeafTris:12});
  const nextCollider=new THREE.Mesh(cg,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));nextCollider.raycast=acceleratedRaycast;nextCollider.updateMatrixWorld(true);
  // Swap only after successful parsing and collider construction.
  const oldRoot=root,oldCollider=collider;root=loaded;collider=nextCollider;scene.add(root);
  if(oldRoot){scene.remove(oldRoot);disposeRoot(oldRoot);}if(oldCollider){oldCollider.geometry.dispose();oldCollider.material.dispose();}
  progress('歩行可能な床と経路を解析中…');await sleep();await buildNavigation();
  if(!nav.length)throw new Error('頭上に1.8mの空間がある歩行可能な床が見つかりません。外観のみのモデルには入れません。');
  resetGame();populateMaterialUI();autoPBR();assetLabel=label;$('modelName').textContent=label;
  ready=true;$('play').disabled=false;status(`準備完了 · ${Math.round(triangles).toLocaleString()} tris · 歩行点 ${nav.length} · 手記3枚と鍵を配置`);
 }catch(e){console.error(e);status('読込失敗：'+e.message);toast('モデルまたは関連ファイルを確認してください。');if(loaded&&loaded!==root)disposeRoot(loaded);}
 finally{pack?.dispose();loading=false;$('busy').classList.add('hidden');}
}
function hits(origin,dir,max=100,first=false){ray.set(origin,dir);ray.near=.002;ray.far=max;ray.firstHitOnly=first;return collider?ray.intersectObject(collider,false):[];}
function castFloor(x,z,startY,max=100){const hs=hits(new THREE.Vector3(x,startY,z),down,max);return hs.find(h=>h.face.normal.y>.65)||null;}
function clearSegment(a,b,r=.02){const d=b.clone().sub(a);const length=d.length();if(length<.001)return true;return !hits(a,d.normalize(),Math.max(.001,length-r),true).length;}
function bodyClear(x,y,z){
 if(hits(new THREE.Vector3(x,y+.08,z),up,1.76,true).length)return false;
 for(const height of [.22,.85,1.5])for(let k=0;k<8;k++){
  const a=k*Math.PI/4;if(hits(new THREE.Vector3(x,y+height,z),new THREE.Vector3(Math.cos(a),0,Math.sin(a)),CONFIG.radius+.04,true).length)return false;
 }return true;
}
async function buildNavigation(){
 const box=new THREE.Box3().setFromObject(root),step=CONFIG.grid;let candidates=[];const grid=new Map();
 // Multiple surfaces per column; roof surfaces are not presumed to be interior floors.
 for(let x=box.min.x+step/2,ix=0;x<box.max.x;x+=step,ix++){
  for(let z=box.min.z+step/2,iz=0;z<box.max.z;z+=step,iz++){
   const hs=hits(new THREE.Vector3(x,box.max.y+1,z),down,box.max.y-box.min.y+3);let last=-Infinity;
   for(const h of hs.slice().reverse()){
    if(h.face.normal.y<.65||Math.abs(h.point.y-last)<.15)continue;last=h.point.y;
    if(!bodyClear(x,last,z))continue;
    const n={x,z,y:last,ix,iz,links:[],id:candidates.length};candidates.push(n);const key=ix+','+iz;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(n);
   }
  }if(ix%8===0){progress('床を解析中… '+candidates.length+'点');await sleep();}
 }
 for(const n of candidates)for(const [dx,dz] of [[1,0],[0,1]])for(const b of grid.get((n.ix+dx)+','+(n.iz+dz))||[]){
  if(Math.abs(n.y-b.y)>.38)continue;
  let clear=true;for(const dy of [.4,1.4])if(!clearSegment(new THREE.Vector3(n.x,n.y+dy,n.z),new THREE.Vector3(b.x,b.y+dy,b.z))){clear=false;break;}
  if(clear&&bodyClear((n.x+b.x)/2,(n.y+b.y)/2,(n.z+b.z)/2)){n.links.push(b);b.links.push(n);}
 }
 const seen=new Set(),components=[];
 for(const n of candidates){if(seen.has(n))continue;const q=[n];seen.add(n);for(let i=0;i<q.length;i++)for(const b of q[i].links)if(!seen.has(b)){seen.add(b);q.push(b);}if(q.length>3)components.push(q);}
 // Largest connected walking area, with a slight preference for lower floors.
 const largest=Math.max(0,...components.map(c=>c.length));const substantial=components.filter(c=>c.length>=Math.max(12,largest*.05));
 const lowest=Math.min(Infinity,...substantial.map(c=>Math.min(...c.map(n=>n.y))));
 // Prefer enclosed, low-level interiors to a larger exterior pavement or roof.
 const lower=substantial.filter(c=>Math.min(...c.map(n=>n.y))<lowest+2.5);
 const score=c=>{let enclosed=0,total=0;for(let i=0;i<c.length;i+=Math.max(1,Math.floor(c.length/24))){const n=c[i];for(let k=0;k<8;k++){const a=k*Math.PI/4;total++;if(hits(new THREE.Vector3(n.x,n.y+1.5,n.z),new THREE.Vector3(Math.cos(a),0,Math.sin(a)),16,true).length)enclosed++;}}return enclosed/Math.max(1,total)*2+Math.log(c.length)*.08;};
 lower.sort((a,b)=>score(b)-score(a));nav=lower[0]||[];
 if(nav.length){floorY=Math.min(...nav.map(n=>n.y));spawn=nav.reduce((best,n)=>n.z-Math.abs(n.x)*.45>best.z-Math.abs(best.x)*.45?n:best,nav[0]);curFloor=spawn.y;}
}
function farthest(from,avoid=[]){const dist=new Map([[from,0]]),q=[from];for(let i=0;i<q.length;i++){const n=q[i];for(const b of n.links)if(!dist.has(b)){dist.set(b,dist.get(n)+1);q.push(b);}}let best=from,score=-1;for(const n of q){const sep=Math.min(...[from,...avoid].map(a=>Math.hypot(a.x-n.x,a.z-n.z)));const s=sep+dist.get(n)*.08;if(s>score){score=s;best=n;}}return best;}
const texts=[['一枚目 ― 呼び声','呼ばれても、返事をしてはいけない。\n\n返事をした者から、この屋敷は音を取り戻す。雨音が消えたなら、もう一枚を探せ。'],['二枚目 ― 静寂','耳の形を覚えられると、まず低い音が聞こえなくなる。\n\n鍵はここではない。音のしない廊下の先へ。'],['三枚目 ― 耳飾り','最後の音を失う前に、鍵を取って入口へ戻れ。\n\n外へ出たなら、後ろから名前を呼ばれても、決して振り返るな。']];
function noteTexture(label){const c=document.createElement('canvas');c.width=512;c.height=512;const g=c.getContext('2d');g.clearRect(0,0,512,512);g.fillStyle='#2c2018';g.font='46px serif';g.fillText(label,80,120);g.font='28px serif';['呼ばれても返事をするな','雨音が消えたら','次の手記を探せ','耳の形を覚えられる'].forEach((s,i)=>g.fillText(s,50,220+i*60));const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
function addItem(type,n,index){
 const group=new THREE.Group();group.position.set(n.x,n.y+.13,n.z);scene.add(group);
 // Only interactables are planes; the entire building comes from the external model.
 const baseMat=(pbr.tatami||materials.find(m=>m.map)||materials[0]);
 const paper=new THREE.Mesh(new THREE.PlaneGeometry(type==='note'?.48:.3,type==='note'?.38:.3),baseMat);paper.rotation.x=-Math.PI/2;paper.receiveShadow=true;group.add(paper);
 const text=new THREE.Mesh(new THREE.PlaneGeometry(.47,.37),new THREE.MeshBasicMaterial({map:noteTexture(type==='note'?'古い手記':'鍵'),transparent:true,depthWrite:false}));text.rotation.x=-Math.PI/2;text.position.y=.003;group.add(text);
 const halo=new THREE.Mesh(new THREE.RingGeometry(.24,.27,24),new THREE.MeshBasicMaterial({color:type==='key'?0xf4ca77:0xa5bdd1,transparent:true,opacity:.55,side:THREE.DoubleSide}));halo.rotation.x=-Math.PI/2;halo.position.y=.006;group.add(halo);
 if(type==='key'){const metal=(pbr.wood||baseMat).clone();metal.color.set(0xc8a35c);metal.metalness=.78;metal.roughness=.42;const ring=new THREE.Mesh(new THREE.TorusGeometry(.09,.025,8,20),metal);ring.rotation.x=-Math.PI/2;ring.position.y=.04;group.add(ring);const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.27,8),metal);shaft.rotation.x=Math.PI/2;shaft.position.set(0,.04,.20);group.add(shaft);}
 const hit=new THREE.Mesh(new THREE.SphereGeometry(.38,8,6),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,colorWrite:false}));hit.position.y=.12;group.add(hit);
 const item={type,n,index,group,hit,collected:false};hit.userData.item=item;items.push(item);
 // Real Poly Haven tatami patch (not a procedural placeholder) helps identify items in dark interiors.
 if(type==='note'&&pbr.tatami){const m=pbr.tatami.clone();const rug=new THREE.Mesh(new THREE.PlaneGeometry(1.8,.9),m);rug.rotation.x=-Math.PI/2;rug.position.set(n.x,n.y+.012,n.z);rug.receiveShadow=true;scene.add(rug);item.rug=rug;}
 return item;
}
function removeItems(){for(const a of items){scene.remove(a.group);a.group.traverse(o=>{if(o.isMesh){o.geometry.dispose();if(!Object.values(pbr).includes(o.material)&&!materials.includes(o.material)){if(o.material.map)o.material.map.dispose();o.material.dispose();}}});if(a.rug){scene.remove(a.rug);a.rug.geometry.dispose();a.rug.material.dispose();}}items=[];}
function resetGame(){
 removeItems();notes=0;gotKey=false;elapsed=0;ended=false;reading=false;velocity.set(0,0,0);audio.reset();
 camera.position.set(spawn.x,spawn.y+CONFIG.eye,spawn.z);camera.lookAt(0,spawn.y+CONFIG.eye,0);lastSafe.copy(camera.position);curFloor=spawn.y;flashQ.copy(camera.quaternion);
 const chosen=[];let prev=spawn;for(let i=0;i<4;i++){const n=farthest(prev,[spawn,...chosen]);chosen.push(n);prev=n;addItem(i<3?'note':'key',n,i);}
 updateObjective();$('reading').classList.add('hidden');$('play').textContent='クリックして探索開始';
}
function updateObjective(){ $('count').textContent=`手記 ${notes}/3　${gotKey?'🗝 鍵':''}`;$('objective').textContent=gotKey?'入口へ戻り、Eで脱出する':notes===3?'鍵を探す（Qで方向を確認）':'手記3枚と鍵を探す（Qで方向を確認）';}
function populateMaterialUI(){const select=$('material');select.replaceChildren();materials.forEach((m,i)=>{const o=document.createElement('option');o.value=i;o.textContent=`${i}: ${m.name||'名称なし'}${m.map?' · テクスチャあり':''}`;select.append(o);});}
function replaceMaterial(index,key){const old=materials[index],mat=pbr[key];if(!old||!mat){toast('対象PBRテクスチャが未取得です。');return;}overrides.set(old,mat);root.traverse(o=>{if(!o.isMesh)return;const orig=originals.get(o);if(Array.isArray(orig))o.material=orig.map(m=>overrides.get(m)||m);else o.material=overrides.get(orig)||orig;});}
function autoPBR(){
 let assigned=0;const stats=new Map(materials.map(m=>[m,{area:0,floor:0,wall:0}]));
 root.traverse(o=>{if(!o.isMesh)return;const geom=o.geometry;const pos=geom.attributes.position,idx=geom.index;const groups=geom.groups.length?geom.groups:[{start:0,count:idx?idx.count:pos.count,materialIndex:0}];
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),ab=new THREE.Vector3(),ac=new THREE.Vector3();
 for(const group of groups){const m=Array.isArray(o.material)?o.material[group.materialIndex]:o.material;const st=stats.get(m);if(!st)continue;
 for(let i=group.start;i<group.start+group.count;i+=3){a.fromBufferAttribute(pos,idx?idx.getX(i):i).applyMatrix4(o.matrixWorld);b.fromBufferAttribute(pos,idx?idx.getX(i+1):i+1).applyMatrix4(o.matrixWorld);c.fromBufferAttribute(pos,idx?idx.getX(i+2):i+2).applyMatrix4(o.matrixWorld);ab.subVectors(b,a);ac.subVectors(c,a);const n=ab.cross(ac);const area=n.length()*.5;if(area<1e-8)continue;n.normalize();st.area+=area;if(n.y>.9&&Math.abs((a.y+b.y+c.y)/3-floorY)<.6)st.floor+=area;if(Math.abs(n.y)<.05&&(Math.abs(n.x)>.98||Math.abs(n.z)>.98))st.wall+=area;}
 }});
 for(let i=0;i<materials.length;i++){const m=materials[i],n=m.name.toLowerCase(),st=stats.get(m);let key=null;if(/tatami|畳/.test(n))key='tatami';else if(/wood|floor.?board|木|timber/.test(n)||st.floor/Math.max(st.area,.01)>.55)key='wood';else if(/plaster|土壁/.test(n))key='clay';if(key&&pbr[key]){replaceMaterial(i,key);assigned++;}}
 // A single planar wall finish can be selected without overwriting every original PBR surface.
 if(!materials.some(m=>/plaster|土壁/.test(m.name))){const candidates=materials.map((m,i)=>({i,st:stats.get(m)})).filter(a=>a.st.wall/Math.max(.01,a.st.area)>.65&&a.st.area>20&&a.st.floor<1).sort((a,b)=>a.st.area-b.st.area);if(candidates[0]&&pbr.clay){replaceMaterial(candidates[0].i,'clay');assigned++;}}
 $('pbrState').textContent=Object.keys(pbr).length+'/3 PBRセット取得済み（各2K） · 自動割当 '+assigned+'材質';
}
function restoreMaterials(){overrides.clear();root?.traverse(o=>{if(originals.has(o))o.material=originals.get(o);});}
function getTarget(){
 lookTarget=null;if(!ready||reading)return;
 camera.updateMatrixWorld(true);ray.setFromCamera(new THREE.Vector2(),camera);ray.far=3;ray.firstHitOnly=false;
 const candidates=items.filter(a=>!a.collected&&(a.type!=='key'||notes===3)).map(a=>a.hit);scene.updateMatrixWorld();
 const hs=ray.intersectObjects(candidates,false);
 if(hs.length){const h=hs[0];const d=h.point.clone().sub(camera.position).normalize();if(!hits(camera.position,d,Math.max(.01,h.distance-.15),true).length)lookTarget=h.object.userData.item;}
 const nearExit=gotKey&&Math.hypot(camera.position.x-spawn.x,camera.position.z-spawn.z)<1.9;
 $('prompt').textContent=lookTarget?`E / 左クリック：${lookTarget.type==='note'?'古い手記を読む':'鍵を拾う'}`:nearExit?'E / 左クリック：屋敷から脱出する':'';
}
function interact(){
 if(!ready||reading||ended)return;getTarget();
 if(lookTarget){const a=lookTarget;a.collected=true;a.group.visible=false;
 if(a.type==='note'){notes++;audio.paper();audio.fade(notes);reading=true;controls.unlock();$('noteTitle').textContent=texts[a.index][0];$('noteText').textContent=texts[a.index][1];$('reading').classList.remove('hidden');}
 else{gotKey=true;audio.tone(1100,.8,.08);toast('鍵を拾った。入口へ戻ろう。');}updateObjective();return;}
 if(gotKey&&Math.hypot(camera.position.x-spawn.x,camera.position.z-spawn.z)<1.9){ended=true;controls.unlock();overlay(true);status(`脱出成功 ― ${Math.floor(elapsed/60)}分${Math.floor(elapsed%60)}秒。あなたの耳は、まだあなたのものだ。`);$('play').textContent='もう一度遊ぶ';}
}
function lock(){if(!ready||loading)return;audio.init();audio.resume();if(ended)resetGame();overlay(false);try{const p=renderer.domElement.requestPointerLock();p?.catch(()=>{overlay(true);status('マウスロックを許可してください。ダウンロードしたHTMLをブラウザで直接開くか、ライブプレビューを別タブで開いてください。');});}catch(e){overlay(true);status(e.message);}}
function closeNote(){reading=false;$('reading').classList.add('hidden');lock();}
function move(dt){
 const forward=new THREE.Vector3();camera.getWorldDirection(forward);forward.y=0;forward.normalize();const right=new THREE.Vector3().crossVectors(forward,up);
 let x=Number(keys.has('KeyD'))-Number(keys.has('KeyA')),z=Number(keys.has('KeyW'))-Number(keys.has('KeyS'));const len=Math.hypot(x,z);if(len>1){x/=len;z/=len;}
 let speed=keys.has('ShiftLeft')?3:1.8;if(keys.has('KeyQ'))speed*=.5;const wish=forward.multiplyScalar(z*speed).addScaledVector(right,x*speed);velocity.lerp(wish,1-Math.exp(-12*dt));
 const dist=velocity.length()*dt;const steps=Math.max(1,Math.ceil(dist/.07));const old=camera.position.clone();
 for(let k=0;k<steps;k++)for(const axis of ['x','z']){
  const target=camera.position.clone();target[axis]+=velocity[axis]*dt/steps;
  const ground=castFloor(target.x,target.z,curFloor+CONFIG.step+.05,CONFIG.step+1.1);
  if(!ground||Math.abs(ground.point.y-curFloor)>CONFIG.step||!bodyClear(target.x,ground.point.y,target.z))continue;
  // Ray sweeps at feet / hips / head stop thin walls even at frame spikes.
  const delta=target.clone().sub(camera.position);delta.y=0;const d=delta.length();if(d>.00001){delta.normalize();let block=false;for(const h of [.25,.9,1.5]){const a=camera.position.clone();a.y=curFloor+h;if(hits(a,delta,d+CONFIG.radius,true).length){block=true;break;}}if(block)continue;}
  camera.position[axis]=target[axis];curFloor=ground.point.y;
 }
 camera.position.y=THREE.MathUtils.damp(camera.position.y,curFloor+CONFIG.eye,16,dt);lastSafe.copy(camera.position);
 const moved=old.distanceTo(camera.position);move.acc=(move.acc||0)+moved;if(move.acc>.95){move.acc=0;audio.step();}
}
function listen(){if(!keys.has('KeyQ')){$('listen').textContent='';return;}const target=gotKey?{n:spawn}:items.filter(a=>!a.collected&&(a.type!=='key'||notes===3)).sort((a,b)=>Math.hypot(camera.position.x-a.n.x,camera.position.z-a.n.z)-Math.hypot(camera.position.x-b.n.x,camera.position.z-b.n.z))[0];if(!target)return;const d=new THREE.Vector3(target.n.x,0,target.n.z).sub(new THREE.Vector3(camera.position.x,0,camera.position.z));const f=new THREE.Vector3();camera.getWorldDirection(f);f.y=0;f.normalize();const r=new THREE.Vector3().crossVectors(f,up);const angle=Math.atan2(d.dot(r),d.dot(f));$('listen').textContent=`耳を澄ます：${Math.abs(angle)<.5?'前':Math.abs(angle)>2.4?'後ろ':angle>0?'右':'左'} · ${d.length()<4?'すぐ近く':'廊下の先'}`;if(performance.now()-(listen.t||0)>1600){listen.t=performance.now();audio.tone(850,.18,.025,Math.sin(angle));}}
const audio={ctx:null,layers:[],init(){if(this.ctx)return;const C=window.AudioContext||window.webkitAudioContext;this.ctx=new C();this.master=this.ctx.createGain();this.master.gain.value=.4;this.master.connect(this.ctx.destination);const b=this.ctx.createBuffer(1,this.ctx.sampleRate*2,this.ctx.sampleRate);const a=b.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=Math.random()*2-1;this.buffer=b;this.layers=[];const noise=this.ctx.createBufferSource();noise.buffer=b;noise.loop=true;const f=this.ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=650;const g=this.ctx.createGain();g.gain.value=.13;noise.connect(f);f.connect(g);g.connect(this.master);noise.start();this.layers.push({g,value:.13});for(const [freq,value] of [[48,.035],[96,.015]]){const o=this.ctx.createOscillator();o.frequency.value=freq;const g=this.ctx.createGain();g.gain.value=value;o.connect(g);g.connect(this.master);o.start();this.layers.push({g,value});}for(let i=1;i<=notes;i++)this.fade(i);},resume(){this.ctx?.resume();},reset(){if(!this.ctx)return;for(const {g,value}of this.layers){g.gain.cancelScheduledValues(this.ctx.currentTime);g.gain.setTargetAtTime(value,this.ctx.currentTime,.2);}},fade(n){if(!this.ctx)return;const l=this.layers[n-1];if(l){l.g.gain.cancelScheduledValues(this.ctx.currentTime);l.g.gain.setTargetAtTime(0,this.ctx.currentTime,.6);}},tone(f,d,g,pan=0){if(!this.ctx||g<=0)return;const t=this.ctx.currentTime,o=this.ctx.createOscillator(),gain=this.ctx.createGain(),p=this.ctx.createStereoPanner();o.frequency.value=f;gain.gain.setValueAtTime(g,t);gain.gain.exponentialRampToValueAtTime(.0001,t+d);p.pan.value=pan;o.connect(gain);gain.connect(p);p.connect(this.master);o.start();o.stop(t+d);},paper(){this.tone(1300,.16,.05);},step(){// Loss of hearing affects footsteps too, without muting UI pickup feedback.
 this.tone(95,.11,.09*(1-notes/3));}};

// Multi-file drop uses relative virtual paths, never uploads local files.
async function entriesFromDrop(dt){const out=[];async function walk(e,prefix=''){if(e.isFile){const f=await new Promise((r,j)=>e.file(r,j));out.push({file:f,path:prefix+f.name});}else if(e.isDirectory){const reader=e.createReader();let batch;do{batch=await new Promise((r,j)=>reader.readEntries(r,j));for(const child of batch)await walk(child,prefix+e.name+'/');}while(batch.length);}}const entries=[...(dt.items||[])].map(i=>i.webkitGetAsEntry?.()).filter(Boolean);if(entries.length)for(const e of entries)await walk(e);else for(const f of dt.files)out.push({file:f,path:f.webkitRelativePath||f.name});return out;}
function normalize(path){const out=[];for(const x of decodeURIComponent(path).replaceAll('\\','/').split('/')){if(!x||x==='.')continue;if(x==='..')out.pop();else out.push(x);}return out.join('/');}
async function loadLocal(files){
 const models=files.filter(a=>/\.(glb|gltf)$/i.test(a.path));if(!models.length){toast('GLB、またはGLTFと関連ファイルをまとめてドロップしてください。');return;}if(models.length>1){toast('複数のモデルがあります。一つのGLB／GLTFだけを含めてください。');return;}
 const m=models[0],urls=new Map(),names=new Map();for(const a of files){const path=normalize(a.path),u=URL.createObjectURL(a.file);urls.set(path,u);const name=path.split('/').pop();if(!names.has(name))names.set(name,u);else names.set(name,null);}
 const base=m.path.includes('/')?normalize(m.path.slice(0,m.path.lastIndexOf('/')+1)):'';const manager=new THREE.LoadingManager();
 manager.setURLModifier(url=>{if(/^(blob:|data:)/.test(url))return url;const raw=url.replace(/^local:\/\//,'');const path=normalize(raw);const resolved=urls.get(path)||urls.get(normalize(base+'/'+raw))||names.get(path.split('/').pop());if(resolved)return resolved;if(/^https?:/.test(url))return url;throw new Error('関連ファイル不足：'+raw);});
 try{await loadAsset('local:///'+normalize(m.path),manager,m.file.name);}finally{for(const url of urls.values())URL.revokeObjectURL(url);}
}
addEventListener('dragover',e=>{e.preventDefault();$('drop').classList.remove('hidden');});addEventListener('dragleave',e=>{if(!e.relatedTarget)$('drop').classList.add('hidden');});addEventListener('drop',async e=>{e.preventDefault();$('drop').classList.add('hidden');if(loading){toast('読込完了をお待ちください。');return;}await loadLocal(await entriesFromDrop(e.dataTransfer));});
$('file').addEventListener('change',e=>loadLocal([...e.target.files].map(file=>({file,path:file.webkitRelativePath||file.name}))));$('folder').addEventListener('change',e=>loadLocal([...e.target.files].map(file=>({file,path:file.webkitRelativePath||file.name}))));
$('urlLoad').onclick=()=>{try{const url=new URL($('url').value);if(!['https:','http:'].includes(url.protocol))throw Error('HTTP(S) URLのみ対応します');loadAsset(url.href,undefined,url.pathname.split('/').pop());}catch(e){toast(e.message);}};
$('play').onclick=lock;$('closeNote').onclick=closeNote;
$('apply').onclick=()=>replaceMaterial(Number($('material').value),$('preset').value);$('restore').onclick=restoreMaterials;
renderer.domElement.addEventListener('click',()=>{if(!controls.isLocked)lock();else interact();});
controls.addEventListener('lock',()=>overlay(false));controls.addEventListener('unlock',()=>{keys.clear();if(!reading){overlay(true);if(!ended)status('一時停止 · クリックでマウスをロックして再開');}});
document.addEventListener('pointerlockerror',()=>{overlay(true);status('Pointer Lockが拒否されました。別タブで開くか、HTMLをダウンロードしてブラウザで直接開いてください。');});
addEventListener('keydown',e=>{if(['KeyW','KeyA','KeyS','KeyD','Space'].includes(e.code))e.preventDefault();keys.add(e.code);if(e.repeat)return;if(reading&&['KeyE','Enter'].includes(e.code)){closeNote();return;}if(controls.isLocked){if(e.code==='KeyE')interact();if(e.code==='KeyF'){lightOn=!lightOn;flash.visible=lightOn;}}});addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>{keys.clear();if(controls.isLocked)controls.unlock();});
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
$('quality').onchange=()=>{const low=$('quality').value==='low';renderer.setPixelRatio(Math.min(devicePixelRatio,low?1:1.5));flash.castShadow=!low;};
const clock=new THREE.Clock();let scan=0,frames=0,fpsTime=0;
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);if(controls.isLocked&&ready&&!reading&&!ended){elapsed+=dt;move(dt);listen();scan-=dt;if(scan<=0){scan=.08;getTarget();}}
 flashQ.slerp(camera.quaternion,1-Math.exp(-15*dt));const dir=new THREE.Vector3(0,0,-1).applyQuaternion(flashQ);flash.position.copy(camera.position).add(new THREE.Vector3(.15,-.13,0).applyQuaternion(camera.quaternion));flashTarget.position.copy(flash.position).addScaledVector(dir,10);flashTarget.updateMatrixWorld();
 for(const a of items)if(a.type==='key')a.group.visible=notes===3&&!a.collected;
 renderer.render(scene,camera);frames++;fpsTime+=dt;if(fpsTime>1){$('perf').textContent=`${Math.round(frames/fpsTime)} fps · ${renderer.info.render.calls} draws · ${(renderer.info.render.triangles/1000).toFixed(0)}k tris`;frames=0;fpsTime=0;}}
animate();
(async()=>{progress('2K PBRテクスチャを準備中…');$('busy').classList.remove('hidden');await loadPBR();await loadAsset(CONFIG.modelURL,undefined,'Sponza Atrium · 建築リファレンス');})();
if(new URLSearchParams(location.search).has('debug'))window.AssetGameDebug={state:()=>({ready,loading,notes,gotKey,ended,nav:nav.length,spawn:spawn?{x:spawn.x,y:spawn.y,z:spawn.z}:null,position:camera.position.toArray(),items:items.map(a=>({type:a.type,n:{x:a.n.x,y:a.n.y,z:a.n.z},collected:a.collected})),locked:controls.isLocked,pbr:Object.keys(pbr),layers:audio.layers.map(l=>l.g.gain.value)}),teleportToItem(i){const a=items[i],n=a.n.links[0]||a.n;camera.position.set(n.x,n.y+CONFIG.eye,n.z);curFloor=n.y;camera.lookAt(a.n.x,a.n.y+.13,a.n.z);},interact,closeNote,resetGame,teleportExit(){camera.position.set(spawn.x,spawn.y+CONFIG.eye,spawn.z);curFloor=spawn.y;}};
