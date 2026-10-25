import {createBuilders} from './maps.js';
import * as THREE from 'three';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {KTX2Loader} from 'three/addons/loaders/KTX2Loader.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {PointerLockControls} from 'three/addons/controls/PointerLockControls.js';
import {MeshBVH,acceleratedRaycast} from 'three-mesh-bvh';

// Architectural exploration only: no missions, pickups, audio, or game state.
const $=id=>document.getElementById(id);
const C={sponza:'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Sponza/glTF/Sponza.gltf',floor:1.39896,walk:2.7,run:6.6,eye:1.65,height:1.8,radius:.26,step:.4,gravity:22,jumpSpeed:6.5};
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance',logarithmicDepthBuffer:false});
renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
$('view').append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x09111c);scene.fog=new THREE.FogExp2(0x09111c,.005);
const camera=new THREE.PerspectiveCamera(70,window.innerWidth/window.innerHeight,0.2,300);camera.rotation.order='YXZ';scene.add(camera);
const controls=new PointerLockControls(camera,renderer.domElement);
const hemi=new THREE.HemisphereLight(0xa7c5f3,0x38291d,.9);scene.add(hemi);
const moon=new THREE.DirectionalLight(0x9fbfe8,1.25);moon.position.set(-20,40,12);scene.add(moon);
const spot=new THREE.SpotLight(0xffd5a1,48,30,Math.PI/7,.6,1.5);spot.castShadow=true;spot.shadow.mapSize.set(1024,1024);spot.shadow.bias=-.00012;spot.shadow.normalBias=.025;spot.shadow.autoUpdate=false;spot.shadow.needsUpdate=true;spot.shadow.camera.near=.1;spot.shadow.camera.far=30;scene.add(spot);
const aim=new THREE.Object3D();scene.add(aim);spot.target=aim;let flashOn=true;const flashQ=new THREE.Quaternion();
const world=new THREE.Group();scene.add(world);const architecture=new THREE.Group();world.add(architecture);
let stairAssist=null;
let collider=null,ready=false,failed=false,elapsed=0;
const keys=new Set(),velocity=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),down=new THREE.Vector3(0,-1,0),ray=new THREE.Raycaster();
let feet=C.floor,grounded=true,verticalVelocity=0,jumpRequested=false,positionCount=0,dpr=Math.min(devicePixelRatio,1.5),autoQuality=true;
const spawn=new THREE.Vector3(-7,C.floor+C.eye,0);
let stone=null,stageText='初期化中';
function stage(t){stageText=t;$('stage').textContent=t;}
function setMenu(on){$('menu').classList.toggle('hidden',!on);}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function yieldTask(){return new Promise(r=>setTimeout(r,0));}
const pref=(()=>{try{return JSON.parse(localStorage.getItem('grand-explorer-settings')||'{}');}catch{return {};}})();
$('sensitivity').value=clamp(Number(pref.sensitivity)||.8,.2,3);
function setSensitivity(){controls.pointerSpeed=Number($('sensitivity').value);$('sensitivityValue').textContent=controls.pointerSpeed.toFixed(2);try{localStorage.setItem('grand-explorer-settings',JSON.stringify({sensitivity:controls.pointerSpeed}));}catch{}}
$('sensitivity').addEventListener('input',setSensitivity);setSensitivity();
function lock(){if(!ready||transitioning)return;setMenu(false);try{const p=renderer.domElement.requestPointerLock();p?.catch(()=>{setMenu(true);stage('Pointer Lockが拒否されました。ダウンロードしたHTMLをブラウザで直接開いてください。');});}catch(e){stage(e.message);setMenu(true);}}
$('start').onclick=lock;renderer.domElement.addEventListener('click',()=>{if(!controls.isLocked)lock();});
controls.addEventListener('lock',()=>setMenu(false));controls.addEventListener('unlock',()=>{keys.clear();velocity.set(0,0,0);if(!transitioning)setMenu(true);});
document.addEventListener('pointerlockerror',()=>{setMenu(true);stage('マウスロックを許可してください。埋込画面ではなく別タブまたはダウンロードしたHTMLで開いてください。');});
addEventListener('keydown',e=>{if(controls.isLocked&&['KeyW','KeyA','KeyS','KeyD','Space'].includes(e.code))e.preventDefault();keys.add(e.code);if(e.code==='KeyE'&&!e.repeat&&controls.isLocked&&!transitioning)useDoor();if(e.code==='Space'&&!e.repeat&&controls.isLocked&&!transitioning){e.preventDefault();jumpRequested=true;}if(e.code==='Escape'&&controls.isLocked)document.exitPointerLock();if((e.code==='KeyF'||e.code==='KeyL')&&!e.repeat&&controls.isLocked){flashOn=!flashOn;spot.visible=flashOn;}});
addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>{keys.clear();if(controls.isLocked)controls.unlock();});
$('reset').onclick=()=>{reset();lock();};$('retry').onclick=()=>location.reload();
$('quality').onchange=()=>{const q=$('quality').value;autoQuality=q==='auto';dpr=q==='high'?Math.min(devicePixelRatio,1.5):q==='low'?.75:Math.min(devicePixelRatio,1.25);renderer.setPixelRatio(dpr);spot.castShadow=q!=='low';};
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
function reset(){camera.position.copy(activeSpawn||spawn);if(activeLook)camera.lookAt(activeLook);else camera.lookAt(7,C.floor+2.1,0);flashQ.copy(camera.quaternion);feet=camera.position.y-C.eye;grounded=true;verticalVelocity=0;jumpRequested=false;velocity.set(0,0,0);}

async function pbr(id,repeat=1){
 const loader=new THREE.TextureLoader();loader.setCrossOrigin('anonymous');
 const urls=[['diff','2k'],['rough','1k'],['nor_gl','1k']].map(([kind,res])=>`https://dl.polyhaven.org/file/ph-assets/Textures/jpg/${res}/${id}/${id}_${kind}_${res}.jpg`);
 const textures=await Promise.all(urls.map(url=>loader.loadAsync(url)));
 textures.forEach((t,i)=>{t.colorSpace=i===0?THREE.SRGBColorSpace:THREE.NoColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeat,repeat);t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());});
 return new THREE.MeshStandardMaterial({map:textures[0],roughnessMap:textures[1],normalMap:textures[2],normalScale:new THREE.Vector2(.45,.45),roughness:1});
}
function normalizeAsset(r,span,cx,baseY){r.updateMatrixWorld(true);let box=new THREE.Box3().setFromObject(r),size=box.getSize(new THREE.Vector3());r.scale.multiplyScalar(span/Math.max(size.x,size.z));r.updateMatrixWorld(true);box.setFromObject(r);const c=box.getCenter(new THREE.Vector3());r.position.x+=cx-c.x;r.position.z-=c.z;r.position.y+=baseY-box.min.y;r.updateMatrixWorld(true);}
async function buildCollision(){
 world.updateMatrixWorld(true);const parts=[];let total=0;
 world.traverse(o=>{if(!o.isMesh||o.userData.noCollision)return;let g=o.geometry.clone();if(g.index){const prev=g;g=g.toNonIndexed();prev.dispose();}
  if(o.isInstancedMesh){const im=new THREE.Matrix4(),wm=new THREE.Matrix4();for(let k=0;k<o.count;k++){o.getMatrixAt(k,im);wm.multiplyMatrices(o.matrixWorld,im);const t=g.clone().applyMatrix4(wm);const a=new Float32Array(t.attributes.position.array);parts.push(a);total+=a.length;t.dispose();}}
  else{g.applyMatrix4(o.matrixWorld);const a=new Float32Array(g.attributes.position.array);parts.push(a);total+=a.length;}g.dispose();
 });
 const data=new Float32Array(total);let at=0;for(const a of parts){data.set(a,at);at+=a.length;}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(data,3));geo.computeVertexNormals();await yieldTask();geo.boundsTree=new MeshBVH(geo,{maxLeafTris:10});collider=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));collider.raycast=acceleratedRaycast;collider.updateMatrixWorld(true);positionCount=total/9;
}
function nativeCast(origin,dir,length,first=true){if(!collider)return [];ray.set(origin,dir);ray.near=.001;ray.far=length;ray.firstHitOnly=first;return ray.intersectObject(collider,false);}
function cast(origin,dir,length,first=true){const r=stairAssist,hits=nativeCast(origin,dir,length,r?false:first);if(!r)return hits;return hits.filter(h=>r.axis==='x'?!(Math.abs(h.face.normal.x)>.9&&Math.abs(h.point.z-r.z)<r.halfWidth&&h.point.x>=r.x0-.03&&h.point.x<=r.x1&&h.point.y<=.02):!(Math.abs(h.face.normal.z)>.9&&Math.abs(h.point.x)<r.halfWidth&&h.point.z>=r.z0&&h.point.z<=r.z1+.03&&h.point.y<=r.y1+.02));}
function floorAt(x,z,from,max){const native=nativeCast(new THREE.Vector3(x,from,z),down,max,false).find(h=>h.face.normal.y>.62),r=stairAssist;if(r){const inside=r.axis==='x'?Math.abs(z-r.z)<r.halfWidth&&x>=r.x0&&x<=r.x1:Math.abs(x)<r.halfWidth&&z>=r.z0&&z<=r.z1;if(inside){const t=r.axis==='x'?(x-r.x0)/(r.x1-r.x0):(z-r.z0)/(r.z1-r.z0),y=THREE.MathUtils.lerp(r.y0,r.y1,t);if(from>=y&&from-y<=max&&(!native||native.point.y<y))return {point:new THREE.Vector3(x,y,z),distance:from-y,face:{normal:up}};}}return native;}
// Capsule-like ray sweeps: only native architecture is present in the BVH.
const directions=Array.from({length:8},(_,k)=>new THREE.Vector3(Math.cos(k*Math.PI/4),0,Math.sin(k*Math.PI/4)));
const testOrigin=new THREE.Vector3();
function bodyClear(x,y,z){
 if(cast(testOrigin.set(x,y+.06,z),up,C.height-.06).length)return false;
 for(const h of [.12,.85,1.65])for(let k=0;k<8;k+=(h===.85?1:2))if(cast(testOrigin.set(x,y+h,z),directions[k],C.radius).length)return false;
 return true;
}
function supportAt(x,z,y,maxRise=C.step){return floorAt(x,z,y+maxRise+.035,maxRise+.55);}
function stepTarget(x,z){
 const f=supportAt(x,z,feet);if(!f)return null;
 const delta=f.point.y-feet;
 if(delta>C.step+.001||delta<-.43)return null;
 return bodyClear(x,f.point.y,z)?f.point.y:null;
}
function horizontalStep(axis,distance){
 if(Math.abs(distance)<1e-8)return;
 const target=camera.position.clone();target[axis]+=distance;
 let targetFeet=feet;
 const stepY=grounded?stepTarget(target.x,target.z):null;
 if(stepY!==null)targetFeet=stepY;
 if(!bodyClear(target.x,targetFeet,target.z))return;
 // Raise the sweep origin to the accepted step surface. The riser is not a wall.
 const dir=new THREE.Vector3();dir[axis]=Math.sign(distance);
 for(const h of [.12,.85,1.65])if(cast(testOrigin.set(camera.position.x,Math.max(feet,targetFeet)+h,camera.position.z),dir,Math.abs(distance)+C.radius*.8).length)return;
 camera.position[axis]=target[axis];
 if(stepY!==null){feet=stepY;verticalVelocity=0;grounded=true;}
 else if(grounded){
  const f=floorAt(target.x,target.z,feet+.035,.11);
  if(f&&Math.abs(f.point.y-feet)<.07)feet=f.point.y;
  else grounded=false;
 }
}
function integrateVertical(dt){
 if(grounded){
  const f=floorAt(camera.position.x,camera.position.z,feet+.035,.12);
  if(f&&Math.abs(f.point.y-feet)<.08){feet=f.point.y;verticalVelocity=0;return;}
  grounded=false;
 }
 verticalVelocity-=C.gravity*dt;
 const travel=verticalVelocity*dt;
 if(travel>0){
  const ceiling=cast(testOrigin.set(camera.position.x,feet+C.height,camera.position.z),up,travel+.025)[0];
  if(ceiling){feet+=Math.max(0,ceiling.distance-.025);verticalVelocity=0;}else feet+=travel;
 }else{
  const f=floorAt(camera.position.x,camera.position.z,feet+.035,-travel+.075);
  if(f&&f.point.y<=feet+.04&&f.point.y>=feet+travel-.035){feet=f.point.y;verticalVelocity=0;grounded=true;}
  else feet+=travel;
 }
 if(feet<-20){reset();}
}
function move(dt){
 if(jumpRequested){if(grounded){verticalVelocity=C.jumpSpeed;grounded=false;}jumpRequested=false;}
 const f=new THREE.Vector3();camera.getWorldDirection(f);f.y=0;f.normalize();const r=new THREE.Vector3().crossVectors(f,up);
 let x=Number(keys.has('KeyD'))-Number(keys.has('KeyA')),z=Number(keys.has('KeyW'))-Number(keys.has('KeyS'));const len=Math.hypot(x,z);if(len>1){x/=len;z/=len;}
 const speed=(keys.has('ShiftLeft')||keys.has('ShiftRight'))?C.run:C.walk;
 velocity.lerp(f.multiplyScalar(z*speed).addScaledVector(r,x*speed),1-Math.exp(-13*dt));
 // Fixed-size substeps protect against thin walls at dash speed and during falls.
 const n=Math.max(1,Math.ceil(dt/(1/120)),Math.ceil(velocity.length()*dt/.065));
 for(let k=0;k<n;k++){const step=dt/n;horizontalStep('x',velocity.x*step);horizontalStep('z',velocity.z*step);integrateVertical(step);}
 // Jump arc is physical, stair/landing camera changes are smoothly damped.
 camera.position.y=THREE.MathUtils.damp(camera.position.y,feet+C.eye,grounded?20:34,dt);
}
// One active zone: inactive GPU meshes, materials, textures and BVHs are disposed.
// Compressed source ArrayBuffers are cached to avoid re-downloading the 53 MB hub.
// Sponza -> Long Corridor -> rooms. All transitions are attached to native
// openings; this system never creates a wooden door panel or a door prop.
const AREA_CONFIG={
 hub:{name:'Sponza — 中庭',url:C.sponza,span:42,baseY:0,spawn:[-7,C.floor,0],look:[7,C.floor+1.65,0]},
 corridor:{name:'Long Corridor — 大回廊',built:'corridor',targetHeight:3.45,baseY:0},
 library:{name:'Grand Library — 大図書館',built:'library',targetHeight:3.45,baseY:0},
 lounge:{name:'Castle Lounge — 城の休憩室',built:'lounge',targetHeight:3.45,baseY:0},
 myroom:{name:'My Room — 自分の部屋（PBR建築＋公式SheenChair）',built:'myroom',targetHeight:3.45,baseY:0},
 dungeon:{name:'地下ワインセラー',url:'https://raw.githubusercontent.com/Radoslav02/winery-demo/HEAD/public/models/cellar-opt.glb',targetHeight:3.3,baseY:0},
 chair:{name:'公式SheenChair',url:'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/SheenChair.glb'}
};
const rawCache=new Map(),routeStack=[];
let activeArea='hub',activeSpawn=null,activeLook=null,transitioning=false,portals=[],selectedPortal=null,interactionTime=0;
let wood=null,paving=null,metal=null,builders=null,scaleReport=null,lampAnchors=[];
const sharedMaterials=new Set(),sharedTextures=new Set();
const torchLights=[new THREE.PointLight(0xffac60,0,6.5,2),new THREE.PointLight(0xffad64,0,6.5,2)];torchLights.forEach(l=>scene.add(l));
function rememberShared(material){sharedMaterials.add(material);for(const v of Object.values(material))if(v?.isTexture)sharedTextures.add(v);return material;}
let loadSerial=0;const PROP_CONFIG={barrel:{name:'外部ワイン樽',url:'https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/wine_barrel_01/wine_barrel_01_1k.gltf',manifest:'https://api.polyhaven.com/files/wine_barrel_01'}};
const ktx2=new KTX2Loader().setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/basis/').setWorkerLimit(2);ktx2.detectSupport(renderer);
async function externalScene(key){
 const cfg=AREA_CONFIG[key]||PROP_CONFIG[key],controller=new AbortController(),blobs=[],resources=new Map();let timedOut=false;
 const work=(async()=>{
  async function get(url){if(rawCache.has(url))return rawCache.get(url);const response=await fetch(url,{signal:controller.signal,mode:'cors'});if(!response.ok)throw Error(`HTTP ${response.status}: ${url}`);const bytes=await response.arrayBuffer();rawCache.set(url,bytes);return bytes;}
  try{
   stage(cfg.name+'：公開アセットを取得中…');$('fadeDetail').textContent=cfg.name;
   let bytes=await get(cfg.url);
   if(key==='dungeon'&&new DataView(bytes).getUint32(0,true)===0x46546c67){const length=new DataView(bytes).getUint32(12,true),json=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,20,length))),binary=bytes.slice(28+length),binURL=URL.createObjectURL(new Blob([binary]));blobs.push(binURL);json.buffers[0].uri=binURL;for(let i=0;i<(json.images||[]).length;i++){const image=json.images[i];if(image.bufferView==null)continue;const view=json.bufferViews[image.bufferView],source=new Blob([binary.slice(view.byteOffset||0,(view.byteOffset||0)+view.byteLength)],{type:image.mimeType}),bitmap=await createImageBitmap(source,{resizeWidth:1024,resizeHeight:1024,colorSpaceConversion:'none'}),canvas=document.createElement('canvas');canvas.width=canvas.height=1024;canvas.getContext('2d').drawImage(bitmap,0,0);bitmap.close();const png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png')),url=URL.createObjectURL(png);canvas.width=canvas.height=1;blobs.push(url);image.uri=url;delete image.bufferView;image.mimeType='image/png';$('fadeDetail').textContent='セラーのテクスチャ最適化 '+(i+1)+'/'+json.images.length;await yieldTask();}bytes=new TextEncoder().encode(JSON.stringify(json)).buffer;}

   if(new DataView(bytes).getUint32(0,true)!==0x46546c67){
    const json=JSON.parse(new TextDecoder().decode(bytes));let includes={};
    if(cfg.manifest){const manifest=JSON.parse(new TextDecoder().decode(await get(cfg.manifest)));includes=manifest.gltf['1k'].gltf.include;}
    const paths=[...new Set([...(json.buffers||[]),...(json.images||[])].map(r=>r.uri).filter(u=>u&&!u.startsWith('data:')&&!u.startsWith('blob:')))];let next=0,done=0;
    await Promise.all(Array.from({length:Math.min(6,paths.length)},async()=>{while(next<paths.length){const path=paths[next++],url=new URL(path,cfg.url).href,real=includes[path]?.url||url,data=await get(real),blob=URL.createObjectURL(new Blob([data]));blobs.push(blob);resources.set(url,blob);$('fadeDetail').textContent=cfg.name+' '+(++done)+'/'+paths.length;}}));
   }
   if(false){
    const json=JSON.parse(new TextDecoder().decode(bytes));let done=0;
    for(const image of json.images||[]){if(!image.uri||image.uri.startsWith('data:'))continue;const url=new URL(image.uri,cfg.url).href,original=resources.get(url);if(!original)continue;const source=await fetch(original).then(r=>r.blob()),bitmap=await createImageBitmap(source,{resizeWidth:1024,resizeHeight:1024,colorSpaceConversion:'none'}),canvas=document.createElement('canvas');canvas.width=canvas.height=1024;canvas.getContext('2d').drawImage(bitmap,0,0);bitmap.close();const png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));canvas.width=canvas.height=1;const data=await png.arrayBuffer(),blob=URL.createObjectURL(png);rawCache.set(url,data);blobs.push(blob);resources.set(url,blob);URL.revokeObjectURL(original);$('fadeDetail').textContent='書斎テクスチャ最適化 '+(++done)+'/'+json.images.length;await yieldTask();}
   }
   const manager=new THREE.LoadingManager();manager.setURLModifier(url=>resources.get(url)||url);const loader=new GLTFLoader(manager),draco=new DRACOLoader();draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');loader.setDRACOLoader(draco);loader.setKTX2Loader(ktx2);loader.setMeshoptDecoder(MeshoptDecoder);
   let parseTimer;const parsing=loader.parseAsync(bytes,new URL('.',cfg.url).href);
   try{const gltf=await Promise.race([parsing,new Promise((_,reject)=>{parseTimer=setTimeout(()=>{parsing.then(g=>releaseDetached(g.scene)).catch(()=>{});reject(Error('解析が60秒を超えました'));},60000);})]);if(timedOut){releaseDetached(gltf.scene);throw Error('ロード中断');}return gltf.scene;}finally{clearTimeout(parseTimer);draco.dispose();}
  }finally{blobs.forEach(url=>URL.revokeObjectURL(url));}
 })();
 let timer;try{return await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>{timedOut=true;controller.abort();reject(Error('外部アセット取得が120秒を超えました'));},120000);})]);}finally{clearTimeout(timer);}
}
function releaseDetached(root){const images=new Set();root.traverse(o=>{o.geometry?.dispose();for(const m of[].concat(o.material||[])){for(const v of Object.values(m))if(v?.isTexture){v.dispose();if(v.image)images.add(v.image);}m.dispose();}});images.forEach(i=>i.close?.());}
function disposeArea(){
 stairAssist=null;portals=[];selectedPortal=null;lampAnchors=[];torchLights.forEach(l=>l.intensity=0);$('doorPrompt').textContent='';
 const gs=new Set(),ms=new Set(),ts=new Set();for(const group of architecture.children.slice()){architecture.remove(group);group.traverse(o=>{if(o.geometry)gs.add(o.geometry);for(const m of [].concat(o.material||[])){ms.add(m);for(const v of Object.values(m))if(v?.isTexture)ts.add(v);}});}
 gs.forEach(g=>g.dispose());ms.forEach(m=>{if(!sharedMaterials.has(m))m.dispose();});const images=new Set();ts.forEach(t=>{if(!sharedTextures.has(t)){t.dispose();if(t.image)images.add(t.image);}});images.forEach(i=>{if(i.close)i.close();});
 if(collider){collider.geometry.boundsTree=null;collider.geometry.dispose();collider.material.dispose();collider=null;}renderer.renderLists.dispose();ready=false;
}
function cellarScale(root,cfg){
 root.scale.setScalar(1);root.updateMatrixWorld(true);const before=new THREE.Box3().setFromObject(root),height=before.max.y-before.min.y;
 let floorY=null,deskY=null,tableBase=null,deskBox=null;
 root.traverse(o=>{if(!o.isMesh)return;const b=new THREE.Box3().setFromObject(o);if(/FloorTiles/i.test(o.name))floorY=b.max.y;if(/WhiteMarble|TastingTable/i.test(o.name)){deskY=b.max.y;tableBase=b.min.y;deskBox=b.clone();}if(/Paris_Table_02/i.test(o.name)){if(deskY==null||b.max.y<deskY){deskY=b.max.y;tableBase=b.min.y;deskBox=b.clone();}}});
 if(floorY==null&&deskBox){const probe=new THREE.Raycaster(),samples=[],margin=(deskY-tableBase)*.12;probe.near=.001;probe.far=(deskY-tableBase)*1.5;for(const x of[deskBox.min.x-margin,deskBox.max.x+margin])for(const z of[deskBox.min.z-margin,deskBox.max.z+margin]){probe.set(new THREE.Vector3(x,deskY-.06,z),down);const hit=probe.intersectObject(root,true).find(h=>h.face.normal.clone().transformDirection(h.object.matrixWorld).y>.62&&Math.abs(h.point.y-tableBase)<(deskY-tableBase)*.3);if(hit)samples.push(hit.point.y);}if(samples.length){samples.sort((a,b)=>a-b);floorY=samples[Math.floor(samples.length/2)];}}
 if(floorY==null)floorY=tableBase??before.min.y;let factor=deskY!=null?.75/(deskY-floorY):cfg.targetHeight/height;
 if(!Number.isFinite(factor)||factor<=0)throw Error('モデルの実寸を取得できません');
 root.scale.setScalar(factor);root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(root),center=box.getCenter(new THREE.Vector3());root.position.x-=center.x;root.position.z-=center.z;root.position.y-=box.min.y;root.updateMatrixWorld(true);
 scaleReport={factor,bboxHeight:height*factor,tableHeight:deskY==null?null:(deskY-floorY)*factor,eyeHeight:C.eye,floorY:(floorY-before.min.y)*factor,scaleBasis:deskY==null?'bbox':'authored tabletop / floor'};
}
async function addExternalBarrels(root){
 const prototype=await externalScene('barrel');prototype.updateMatrixWorld(true);let box=new THREE.Box3().setFromObject(prototype);prototype.scale.setScalar(1/(box.max.y-box.min.y));prototype.updateMatrixWorld(true);box.setFromObject(prototype);const center=box.getCenter(new THREE.Vector3());prototype.position.x-=center.x;prototype.position.z-=center.z;prototype.position.y-=box.min.y;prototype.updateMatrixWorld(true);
 const roomBox=new THREE.Box3().setFromObject(root),size=roomBox.getSize(new THREE.Vector3()),y=scaleReport.floorY;
 for(const side of[-1,1])for(const fraction of[-.28,-.10,.33]){const barrel=prototype.clone(true);barrel.position.add(new THREE.Vector3(side*size.x*.23,y,size.z*fraction));barrel.updateMatrixWorld(true);root.attach(barrel);}prototype.clear();
}

function humanScale(root,cfg){
 root.scale.setScalar(1);root.updateMatrixWorld(true);const before=new THREE.Box3().setFromObject(root),height=before.max.y-before.min.y;
 let factor=cfg.targetHeight/height,deskTop=null;
 // Maps carry a physical tabletop-height reference before uniform scaling.
 if(root.userData.tableHeight!=null)deskTop=before.min.y+root.userData.tableHeight;
 else root.traverse(o=>{if(o.isMesh&&/WhiteMarble|HumanDesk|TableTop/i.test(o.name)){const b=new THREE.Box3().setFromObject(o);if(!deskTop||b.max.y<deskTop)deskTop=b.max.y;}});
 if(deskTop!=null&&deskTop-before.min.y>.1){const waistScale=.8/(deskTop-before.min.y);factor=clamp(waistScale,3.0/height,3.5/height);}
 root.scale.setScalar(factor);root.updateMatrixWorld(true);let box=new THREE.Box3().setFromObject(root),center=box.getCenter(new THREE.Vector3());root.position.x-=center.x;root.position.z-=center.z;root.position.y+=(cfg.baseY||0)-box.min.y;root.updateMatrixWorld(true);
 scaleReport={factor,bboxHeight:height*factor,ceilingTarget:[3.0,3.5],tableHeight:deskTop==null?null:(deskTop-before.min.y)*factor,eyeHeight:C.eye};
}
function nativeOpening(id,target,label,position,stand,size,kind='enter'){
 const center=new THREE.Vector3(...position),s=new THREE.Vector3(...size);portals.push({id,target,label,kind,position:center,stand,box:new THREE.Box3().setFromCenterAndSize(center,s)});
}
function installHubOpening(root){
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
  const x=box.min.x+size.x*ix/25,z=box.min.z+size.z*iz/25,f=nativeCast(new THREE.Vector3(x,box.max.y+.2,z),down,size.y+.5,false).find(h=>h.face.normal.y>.62&&h.point.y<=box.min.y+.8);
  if(!f||f.point.y>box.min.y+.8||!bodyClear(x,f.point.y,z))continue;
  if(nativeCast(new THREE.Vector3(x,f.point.y+.05,z),up,1.82).length)continue;
  const dist=Math.hypot(x-center.x,z-center.z);candidates.push({x,z,y:f.point.y,dist});
 }
 const lowest=Math.min(...candidates.map(c=>c.y));candidates.sort((a,b)=>(a.y>lowest+.12)-(b.y>lowest+.12)||a.dist-b.dist);
 for(const c of candidates)for(let k=0;k<8;k++){const dir=new THREE.Vector3(Math.sin(k*Math.PI/4),0,Math.cos(k*Math.PI/4));if([.25,.9,1.75].some(h=>nativeCast(new THREE.Vector3(c.x,c.y+h,c.z),dir,1.05).length))continue;
  const p=new THREE.Vector3(c.x,c.y,c.z).addScaledVector(dir,.85);activeSpawn=new THREE.Vector3(c.x,c.y+C.eye,c.z);activeLook=activeSpawn.clone().addScaledVector(dir,-3);nativeOpening('return','corridor','黒アーチから大回廊へ戻る',[p.x,c.y+1.1,p.z],[c.x,c.y,c.z],[1.5,2.3,.7],'return');
  const sh=new THREE.Shape();sh.moveTo(-.65,0);sh.lineTo(.65,0);sh.lineTo(.65,1.55);sh.absarc(0,1.55,.65,0,Math.PI,false);sh.closePath();const portal=new THREE.Mesh(new THREE.ShapeGeometry(sh,24),new THREE.MeshBasicMaterial({color:0x000000,side:THREE.DoubleSide}));portal.position.copy(p);portal.rotation.y=Math.atan2(dir.x,dir.z);portal.userData.noCollision=true;architecture.add(portal);return;
 }throw Error('成人サイズの安全な床と帰還地点を検出できません。');
}
function installBuiltOpenings(root){
 for(const p of root.userData.portals||[]){const center=root.localToWorld(new THREE.Vector3(...p.position)),stand=root.localToWorld(new THREE.Vector3(...p.stand));const scale=root.scale.x;
  nativeOpening(p.id,p.target,p.label,center.toArray(),stand.toArray(),p.size.map(s=>s*scale),p.kind);
 }
 const s=root.localToWorld(new THREE.Vector3(...root.userData.spawnLocal)),l=root.localToWorld(new THREE.Vector3(...root.userData.lookLocal));activeSpawn=s.clone();activeSpawn.y+=C.eye;activeLook=l;
}
async function loadArea(key){
 const cfg=AREA_CONFIG[key];stage(cfg.name+'を読み込み中…');$('fadeDetail').textContent=cfg.name;disposeArea();await wait(80);
 let group;
 if(cfg.built){group=builders[cfg.built]();if(key==='myroom'){const chair=await externalScene('chair');chair.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(chair);chair.scale.setScalar(.95/(b.max.y-b.min.y));chair.updateMatrixWorld(true);const bb=new THREE.Box3().setFromObject(chair),cc=bb.getCenter(new THREE.Vector3());chair.position.set(-cc.x,-bb.min.y,5.6-cc.z);chair.rotation.y=Math.PI;group.add(chair);}if(key==='corridor'){group.updateMatrixWorld(true);scaleReport={eyeHeight:C.eye,authoredMeters:true};}else humanScale(group,cfg);}
 else{
  group=await externalScene(key);
  if(key==='hub'){normalizeAsset(group,42,0,0);scaleReport={eyeHeight:C.eye,originalMonumentalScale:true};}
  else if(key==='dungeon'){cellarScale(group,cfg);await addExternalBarrels(group);}else humanScale(group,cfg);

 }
 architecture.add(group);group.updateMatrixWorld(true);group.traverse(o=>{if(o.isLight){o.visible=false;return;}if(!o.isMesh)return;o.castShadow=o.userData.noCollision!==true;o.receiveShadow=true;o.frustumCulled=true;for(const m of[].concat(o.material))for(const property of['map','normalMap','roughnessMap']){const t=m[property];if(t&&t.anisotropy!==4){t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());t.needsUpdate=true;}}});
 activeArea=key;stage(cfg.name+'：ネイティブ床・壁のBVHを構築中…');await buildCollision();
 if(key==='hub'){activeSpawn=new THREE.Vector3(-7,C.floor+C.eye,0);activeLook=new THREE.Vector3(7,C.floor+C.eye,0);installHubOpening(group);}
 else if(cfg.built){installBuiltOpenings(group);if(key==='corridor')stairAssist={axis:'x',x0:-6.04,x1:-2.2,z:36.2,halfWidth:.78,y0:-1.92,y1:0};if(key==='library'){const a=group.localToWorld(new THREE.Vector3(0,0,15.18)),b=group.localToWorld(new THREE.Vector3(0,.45,16.42));stairAssist={z0:a.z,z1:b.z,y0:a.y,y1:b.y,halfWidth:6.6*group.scale.x};}}
 else installRoomReturn(group);
 const f=floorAt(activeSpawn.x,activeSpawn.z,activeSpawn.y-C.eye+.45,1.3);if(!f||!bodyClear(activeSpawn.x,f.point.y,activeSpawn.z))throw Error('入口に安全な足場がありません。');activeSpawn.y=f.point.y+C.eye;
 lampAnchors=(group.userData.lamps||[]).map(p=>group.localToWorld(new THREE.Vector3(...p)));reset();ready=true;spot.shadow.needsUpdate=true;shadowTime=-1;
 hemi.intensity=key==='dungeon'?1.15:key==='hub'?.9:key==='library'?1.05:key==='lounge'?.75:.55;moon.intensity=key==='dungeon'?.85:key==='hub'?1.25:key==='library'?.8:key==='lounge'?.65:.35;
 stage(cfg.name+' · 目線 '+C.eye.toFixed(2)+'m · E：既存の開口部から移動');
}
function scanDoor(){
 selectedPortal=null;$('doorPrompt').textContent='';if(!ready||transitioning||!controls.isLocked)return;
 camera.updateMatrixWorld(true);const direction=new THREE.Vector3();camera.getWorldDirection(direction);const viewRay=new THREE.Ray(camera.position,direction),point=new THREE.Vector3();let nearest=Infinity;
 for(const p of portals){const aimed=viewRay.intersectBox(p.box,point),distance=camera.position.distanceTo(p.position);if(distance>2.8)continue;if(!aimed&&distance>1.65)continue;
  const to=p.position.clone().sub(camera.position),length=to.length();if(nativeCast(camera.position,to.normalize(),Math.max(.01,length-.25),true).length)continue;
  if(distance<nearest){nearest=distance;selectedPortal=p;}
 }
 if(selectedPortal)$('doorPrompt').textContent='Eキー：'+selectedPortal.label;
}
function wait(ms){return new Promise(r=>setTimeout(r,ms));}
async function fade(to){const el=$('fade');el.classList.remove('hidden');if(to===1){el.style.opacity='0';el.getBoundingClientRect();}el.style.opacity=String(to);await wait(1050);if(to===0)el.classList.add('hidden');}
function restorePose(pose){camera.position.fromArray(pose.position);camera.quaternion.fromArray(pose.quaternion);feet=pose.feet;grounded=true;verticalVelocity=0;jumpRequested=false;velocity.set(0,0,0);flashQ.copy(camera.quaternion);}
async function useDoor(){
 if(transitioning||!ready)return;scanDoor();const portal=selectedPortal;if(!portal)return;
 const from=activeArea,pose={position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),feet};
 const returning=portal.kind==='return',parent=returning?routeStack.at(-1):null,target=parent?parent.source:portal.target;
 transitioning=true;controls.enabled=false;keys.clear();jumpRequested=false;velocity.set(0,0,0);$('doorPrompt').textContent='';$('fadeLabel').textContent='……（扉を開けています）';$('fadeDetail').textContent='';await fade(1);
 let error=null;
 try{await loadArea(target);if(returning){if(parent){restorePose(parent.pose);routeStack.pop();}}else routeStack.push({source:from,target,portalId:portal.id,pose});
  try{await renderer.compileAsync(scene,camera);}catch{}renderer.render(scene,camera);
 }catch(e){error=e;console.error(e);$('fadeLabel').textContent='読込に失敗しました。大回廊へ戻ります…';try{await loadArea('corridor');if(from==='corridor')restorePose(pose);else{const frame=routeStack.findLast(f=>f.source==='corridor');if(frame)restorePose(frame.pose);}while(routeStack.length&&routeStack.at(-1).target!=='corridor')routeStack.pop();}catch(rollback){console.error(rollback);failed=true;ready=false;stage('復帰に失敗しました。再読込してください。');$('retry').classList.remove('hidden');}}
 spot.shadow.needsUpdate=true;shadowTime=-1;await fade(0);transitioning=false;controls.enabled=true;keys.clear();if(!ready){controls.unlock();setMenu(true);$('start').disabled=true;}else if(!controls.isLocked)setMenu(true);if(error)stage('読込失敗のため復帰：'+error.message);
}
function updateTorches(){
 if(!lampAnchors.length){torchLights.forEach(l=>l.intensity=0);return;}
 const candidates=lampAnchors.map(p=>({p,d:p.distanceToSquared(camera.position)})).sort((a,b)=>a.d-b.d);
 torchLights.forEach((light,i)=>{const c=candidates[i];if(!c){light.intensity=0;return;}light.position.copy(c.p);light.intensity=7.5+Math.sin(elapsed*13+i)*.30;});
}

async function init(){try{
 stage('高精細PBRとSponzaを準備中…');
 [stone,wood,paving]=await Promise.all([pbr('castle_brick_01'),pbr('old_wood_floor'),pbr('monastery_stone_floor')]);
 rememberShared(stone);rememberShared(wood);rememberShared(paving);wood.color.set(0xb59a77);
 metal=rememberShared(new THREE.MeshStandardMaterial({map:wood.map,roughnessMap:wood.roughnessMap,color:0x4f4435,metalness:.75,roughness:.45}));builders=createBuilders({stone,wood,paving,metal});
 await loadArea('hub');$('start').disabled=false;$('start').textContent='中庭の探索をはじめる';
 }catch(e){failed=true;console.error(e);stage('読込失敗：'+e.message);$('retry').classList.remove('hidden');}}
const shadowPosition=new THREE.Vector3(10000,10000,10000),shadowRotation=new THREE.Quaternion();let shadowTime=-1;
const clock=new THREE.Clock();let frames=0,frameTime=0,smoothFPS=60,adaptTime=0;
function animate(){requestAnimationFrame(animate);const real=clock.getDelta(),dt=Math.min(real,.05);elapsed+=dt;if(ready&&controls.isLocked&&!transitioning){move(dt);interactionTime-=dt;if(interactionTime<=0){interactionTime=.08;scanDoor();}}else $('doorPrompt').textContent='';
 flashQ.slerp(camera.quaternion,1-Math.exp(-15*dt));const direction=new THREE.Vector3(0,0,-1).applyQuaternion(flashQ);spot.position.copy(camera.position).add(new THREE.Vector3(.15,-.13,0).applyQuaternion(camera.quaternion));aim.position.copy(spot.position).addScaledVector(direction,12);aim.updateMatrixWorld();
 // Cache static flashlight shadows while stationary; refresh at most 30 Hz
 // while moving. The scene and input still render on every requestAnimationFrame.
 if(spot.visible&&spot.castShadow&&elapsed-shadowTime>=1/30&&(spot.position.distanceToSquared(shadowPosition)>.0004||flashQ.angleTo(shadowRotation)>.003||shadowTime<0)){
  spot.shadow.needsUpdate=true;shadowTime=elapsed;shadowPosition.copy(spot.position);shadowRotation.copy(flashQ);
 }
 updateTorches();renderer.render(scene,camera);frames++;frameTime+=real;adaptTime+=real;
 if(frameTime>=1){const fps=frames/frameTime;smoothFPS=smoothFPS*.6+fps*.4;$('perf').innerHTML=`<b>${Math.round(fps)}</b> FPS <span>${renderer.info.render.calls} draws · ${Math.round(renderer.info.render.triangles/1000)}k tris · DPR ${dpr.toFixed(2)} · ${activeArea.toUpperCase()}</span>`;frames=0;frameTime=0;}
 if(ready&&!transitioning&&autoQuality&&controls.isLocked&&adaptTime>3){adaptTime=0;if(smoothFPS<52&&dpr>.65){dpr=Math.max(.65,dpr-.10);renderer.setPixelRatio(dpr);}else if(smoothFPS>59&&dpr<Math.min(devicePixelRatio,1.5)){dpr=Math.min(Math.min(devicePixelRatio,1.5),dpr+.05);renderer.setPixelRatio(dpr);}}
}
reset();animate();init();
// Diagnostics are opt-in and never visible in the exploration HUD.
if(new URLSearchParams(location.search).has('debug'))window.ExplorerDebug={
 state:()=>({ready,failed,transitioning,area:activeArea,route:routeStack.map(f=>({source:f.source,target:f.target,portalId:f.portalId})),scale:scaleReport,cache:[...rawCache.keys()],gpu:{...renderer.info.memory},portals:portals.map(p=>({id:p.id,target:p.target,kind:p.kind,position:p.position.toArray(),stand:p.stand})),stage:stageText,position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),flashOn,feet,eye:C.eye,grounded,verticalVelocity,locked:controls.isLocked,sensitivity:controls.pointerSpeed,near:camera.near,far:camera.far,fov:camera.fov}),
 teleport(x,y,z){camera.position.set(x,y+C.eye,z);feet=y;grounded=true;verticalVelocity=0;jumpRequested=false;velocity.set(0,0,0);camera.lookAt(x+5,y+C.eye,z);},
 simulate(codes,seconds=1){keys.clear();codes.forEach(c=>keys.add(c));for(let i=0;i<Math.ceil(seconds/.008);i++)move(.008);keys.clear();return this.state();},
 jump(){jumpRequested=true;},trajectory(seconds=1,repeat=false){const values=[];for(let i=0;i<Math.ceil(seconds/.008);i++){if(repeat&&i%8===0)jumpRequested=true;move(.008);values.push({feet,grounded,verticalVelocity});}return values;},
 faceDoor(id){const p=portals.find(p=>p.id===id);if(!p)throw Error('Portal not found');camera.position.set(p.stand[0],p.stand[1]+C.eye,p.stand[2]);feet=p.stand[1];grounded=true;verticalVelocity=0;velocity.set(0,0,0);camera.lookAt(p.position);camera.updateMatrixWorld();scanDoor();return {selected:selectedPortal?.id,prompt:$('doorPrompt').textContent};},
 openingScan(){const out=[];for(const side of[-1,1])for(let x=-12;x<=12;x+=.4){const z0=side*2.5,z1=side*5.0,f=floorAt(x,z0,C.floor+.4,3),g=floorAt(x,z1,C.floor+.4,3);if(!f||!g)continue;const blocks=[.25,.9,1.7].map(h=>nativeCast(new THREE.Vector3(x,f.point.y+h,z0),new THREE.Vector3(0,0,side),2.5,true).map(v=>v.point.toArray()));out.push({x,side,y:f.point.y,other:g.point.y,clear0:bodyClear(x,f.point.y,z0),clear1:bodyClear(x,g.point.y,z1),blocks});}return out;},floor(x,z,y=5){const h=floorAt(x,z,y,30);return h?.point.toArray();},useDoor,reset,clear(x,y,z){return bodyClear(x,y,z);}
};
