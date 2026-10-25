import {createBuilders} from './maps.js';
import * as THREE from 'three';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {KTX2Loader} from 'three/addons/loaders/KTX2Loader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
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
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(data,3));parts.length=0;await yieldTask();geo.boundsTree=new MeshBVH(geo,{maxLeafTris:10});collider=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));collider.raycast=acceleratedRaycast;collider.updateMatrixWorld(true);positionCount=total/9;
}
function nativeCast(origin,dir,length,first=true){if(!collider)return [];ray.set(origin,dir);ray.near=.001;ray.far=length;ray.firstHitOnly=first;return ray.intersectObject(collider,false);}
function cast(origin,dir,length,first=true){const hits=nativeCast(origin,dir,length,stairAssist?false:first),r=stairAssist;return r?hits.filter(h=>!(Math.abs(h.face.normal.x)>.9&&Math.abs(h.point.z-r.z)<r.halfWidth&&h.point.x>=r.x0-.03&&h.point.x<=r.x1&&h.point.y<=.02)):hits;}
function floorAt(x,z,from,max){const native=nativeCast(new THREE.Vector3(x,from,z),down,max,false).find(h=>h.face.normal.y>.62),r=stairAssist;if(r&&Math.abs(z-r.z)<r.halfWidth&&x>=r.x0&&x<=r.x1){const y=THREE.MathUtils.lerp(r.y0,r.y1,(x-r.x0)/(r.x1-r.x0));if(from>=y&&from-y<=max&&(!native||native.point.y<y))return {point:new THREE.Vector3(x,y,z),distance:from-y,face:{normal:up}};}return native;}
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
 camera.position.y=feet+C.eye;
}
// One active zone: inactive GPU meshes, materials, textures and BVHs are disposed.
// Compressed source ArrayBuffers are cached to avoid re-downloading the 53 MB hub.
// Sponza -> Long Corridor -> rooms. All transitions are attached to native
// openings; this system never creates a wooden door panel or a door prop.
const AREA_CONFIG={
 hub:{name:'Sponza — 中庭',url:C.sponza,span:42,baseY:0,spawn:[-7,C.floor,0],look:[7,C.floor+1.65,0]},
 corridor:{name:'Long Corridor — 大回廊',built:'corridor',targetHeight:3.45,baseY:0},
 breakfast:{name:'The Breakfast Room — 外部朝食・晩餐室',url:'https://raw.githubusercontent.com/gkjohnson/3d-demo-data/main/models/bitterli-rendering-resources/breakfast-room.glb',targetHeight:3.0,baseY:0},
 wine:{name:'地下ワインバー — Amazon Lumberyard Bistro',url:'https://raw.githubusercontent.com/qian-o/GLTF-Assets/main/Bistro/BistroInterior_Wine.gltf',targetHeight:3.4,baseY:0}
};
const rawCache=new Map(),routeStack=[];
let activeArea='hub',activeSpawn=null,activeLook=null,transitioning=false,portals=[],selectedPortal=null,interactionTime=0;
let wood=null,paving=null,metal=null,builders=null,scaleReport=null,lampAnchors=[];
const sharedMaterials=new Set(),sharedTextures=new Set();
const torchLights=[new THREE.PointLight(0xffac60,0,6.5,2),new THREE.PointLight(0xffad64,0,6.5,2)];torchLights.forEach(l=>scene.add(l));
function rememberShared(material){sharedMaterials.add(material);for(const v of Object.values(material))if(v?.isTexture)sharedTextures.add(v);return material;}
let loadSerial=0;const wineTextureCache=new Map();
const ktx2=new KTX2Loader().setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/basis/').setWorkerLimit(2);ktx2.detectSupport(renderer);
async function externalScene(key){
 const cfg=AREA_CONFIG[key],serial=++loadSerial,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),120000),blobs=[],resources=new Map();
 const progress=(n,total)=>{const text=`Loading… ${cfg.name} · ${n}/${total}`;stage(text);$('fadeDetail').textContent=text;};
 async function get(url){if(rawCache.has(url))return rawCache.get(url);const r=await fetch(url,{signal:controller.signal,mode:'cors'});if(!r.ok)throw Error(`HTTP ${r.status}: ${url}`);const bytes=await r.arrayBuffer();if(key!=='wine'||/\.(gltf|bin)$/.test(url))rawCache.set(url,bytes);return bytes;}
 try{
  let bytes=await get(cfg.url),rootURL=cfg.url;
  if(new DataView(bytes).getUint32(0,true)!==0x46546c67){const json=JSON.parse(new TextDecoder().decode(bytes));
   if(key==='wine'){
    // Keep authored base colors, material factors, geometry and UVs. Bound texture
    // memory on integrated GPUs by transcoding maps one at a time to 512 px PNG.
    const originalTextures=json.textures,originalImages=json.images,selected=new Map();json.textures=[];json.images=[];
    for(const m of json.materials||[]){const ref=m.pbrMetallicRoughness?.baseColorTexture;if(ref){const old=ref.index;if(!selected.has(old)){const t=originalTextures[old],src=t.extensions?.KHR_texture_basisu?.source??t.source,idx=json.textures.length;selected.set(old,idx);json.images.push({uri:originalImages[src].uri});json.textures.push({source:idx,...(t.sampler!=null?{sampler:t.sampler}:{})});}ref.index=selected.get(old);}delete m.normalTexture;delete m.occlusionTexture;delete m.emissiveTexture;if(m.pbrMetallicRoughness)delete m.pbrMetallicRoughness.metallicRoughnessTexture;if(m.extensions)for(const extension of Object.values(m.extensions))for(const name of Object.keys(extension))if(name.endsWith('Texture'))delete extension[name];}
    for(const k of ['extensionsRequired','extensionsUsed'])if(json[k])json[k]=json[k].filter(e=>e!=='KHR_texture_basisu');
   }

   const paths=[...new Set([...(json.buffers||[]),...(json.images||[])].map(v=>v.uri).filter(u=>u&&!u.startsWith('data:')))];let done=0,next=0;progress(0,paths.length);
   await Promise.all(Array.from({length:Math.min(6,paths.length)},async()=>{while(next<paths.length){const path=paths[next++],url=new URL(path,rootURL).href;let real=url;if(url.endsWith('/BistroInterior_Wine.bin'))real='https://media.githubusercontent.com/media/qian-o/GLTF-Assets/main/Bistro/BistroInterior_Wine.bin';const data=key==='wine'&&wineTextureCache.has(url)?wineTextureCache.get(url):await get(real),blob=URL.createObjectURL(new Blob([data]));blobs.push(blob);resources.set(url,blob);progress(++done,paths.length);}}));
   if(key==='wine'){const converted=new Set();for(let i=0;i<json.images.length;i++){const url=new URL(json.images[i].uri,rootURL).href;if(converted.has(url)||wineTextureCache.has(url))continue;converted.add(url);const original=resources.get(url);const texture=await ktx2.loadAsync(original),png=await thumbnailTexture(texture);texture.dispose();wineTextureCache.set(url,await png.arrayBuffer());const blob=URL.createObjectURL(png);blobs.push(blob);resources.set(url,blob);URL.revokeObjectURL(original);progress(i+1,json.images.length);}}
   bytes=new TextEncoder().encode(JSON.stringify(json)).buffer;
  }
  const manager=new THREE.LoadingManager();manager.setURLModifier(url=>resources.get(url)||url);const loader=new GLTFLoader(manager),draco=new DRACOLoader();draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');loader.setDRACOLoader(draco);loader.setKTX2Loader(ktx2);
  const scenePromise=loader.parseAsync(bytes,new URL('.',rootURL).href);
  let parseTimer;const parsed=await Promise.race([scenePromise,new Promise((_,reject)=>{parseTimer=setTimeout(()=>{scenePromise.then(g=>releaseDetached(g.scene)).catch(()=>{});reject(Error('モデル解析が時間制限を超えました'));},60000);})]).finally(()=>{clearTimeout(parseTimer);draco.dispose();});
  if(serial!==loadSerial){releaseDetached(parsed.scene);throw Error('読み込みは中断されました');}return parsed.scene;
 }catch(e){controller.abort();throw Error(e.name==='AbortError'?'読み込みが120秒を超えました／通信中断':e.message);}finally{clearTimeout(timer);blobs.forEach(u=>URL.revokeObjectURL(u));}
}
async function boundedExternal(key){let timer,expired=false;const work=externalScene(key);try{return await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;reject(Error('総読み込み時間が150秒を超えました'));},150000);})]);}finally{clearTimeout(timer);if(expired)work.then(releaseDetached).catch(()=>{});}}
async function thumbnailTexture(texture){const width=Math.min(512,texture.image.width),height=Math.min(512,texture.image.height),target=new THREE.WebGLRenderTarget(width,height);target.texture.colorSpace=THREE.SRGBColorSpace;const sc=new THREE.Scene(),cam=new THREE.OrthographicCamera(-1,1,1,-1,0,2),quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshBasicMaterial({map:texture,toneMapped:false}));sc.add(quad);cam.position.z=1;const old=renderer.getRenderTarget();renderer.setRenderTarget(target);renderer.render(sc,cam);const pixels=new Uint8Array(width*height*4);renderer.readRenderTargetPixels(target,0,0,width,height,pixels);renderer.setRenderTarget(old);target.dispose();quad.geometry.dispose();quad.material.dispose();const c=document.createElement('canvas');c.width=width;c.height=height;const context=c.getContext('2d'),image=context.createImageData(width,height);for(let y=0;y<height;y++)image.data.set(pixels.subarray((height-1-y)*width*4,(height-y)*width*4),y*width*4);context.putImageData(image,0,0);return new Promise(resolve=>c.toBlob(resolve,'image/png'));}
function releaseDetached(root){const images=new Set();root.traverse(o=>{o.geometry?.dispose();for(const m of[].concat(o.material||[])){for(const v of Object.values(m))if(v?.isTexture){v.dispose();if(v.image)images.add(v.image);}m.dispose();}});images.forEach(i=>i.close?.());}
function disposeArea(){
 stairAssist=null;portals=[];selectedPortal=null;lampAnchors=[];torchLights.forEach(l=>l.intensity=0);$('doorPrompt').textContent='';
 const gs=new Set(),ms=new Set(),ts=new Set();for(const group of architecture.children.slice()){architecture.remove(group);group.traverse(o=>{if(o.geometry)gs.add(o.geometry);for(const m of [].concat(o.material||[])){ms.add(m);for(const v of Object.values(m))if(v?.isTexture)ts.add(v);}});}
 gs.forEach(g=>g.dispose());ms.forEach(m=>{if(!sharedMaterials.has(m))m.dispose();});const images=new Set();ts.forEach(t=>{if(!sharedTextures.has(t)){t.dispose();if(t.image)images.add(t.image);}});images.forEach(i=>{if(i.close)i.close();});
 if(collider){collider.geometry.boundsTree=null;collider.geometry.dispose();collider.material.dispose();collider=null;}renderer.renderLists.dispose();ready=false;
}
function humanScale(root,cfg){
 root.scale.setScalar(1);root.updateMatrixWorld(true);const before=new THREE.Box3().setFromObject(root),height=before.max.y-before.min.y;
 let floorY=null,deskY=null,tableBase=null,deskBox=null;
 root.traverse(o=>{if(!o.isMesh)return;const b=new THREE.Box3().setFromObject(o);if(/FloorTiles/i.test(o.name))floorY=b.max.y;if(/WhiteMarble/i.test(o.name))deskY=b.max.y;if(/Paris_Table_02/i.test(o.name)){if(deskY==null||b.max.y<deskY){deskY=b.max.y;tableBase=b.min.y;deskBox=b.clone();}}});
 if(floorY==null&&deskBox){const probe=new THREE.Raycaster(),samples=[],margin=(deskY-tableBase)*.12;probe.near=.001;probe.far=(deskY-tableBase)*1.5;for(const x of[deskBox.min.x-margin,deskBox.max.x+margin])for(const z of[deskBox.min.z-margin,deskBox.max.z+margin]){probe.set(new THREE.Vector3(x,deskY-.06,z),down);const hit=probe.intersectObject(root,true).find(h=>h.face.normal.clone().transformDirection(h.object.matrixWorld).y>.62&&Math.abs(h.point.y-tableBase)<(deskY-tableBase)*.3);if(hit)samples.push(hit.point.y);}if(samples.length){samples.sort((a,b)=>a-b);floorY=samples[Math.floor(samples.length/2)];}}
 if(floorY==null)floorY=tableBase??before.min.y;let factor=deskY!=null?.75/(deskY-floorY):cfg.targetHeight/height;
 if(!Number.isFinite(factor)||factor<=0)throw Error('モデルの実寸を取得できません');
 root.scale.setScalar(factor);root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(root),center=box.getCenter(new THREE.Vector3());root.position.x-=center.x;root.position.z-=center.z;root.position.y-=box.min.y;root.updateMatrixWorld(true);
 scaleReport={factor,bboxHeight:height*factor,tableHeight:deskY==null?null:(deskY-floorY)*factor,eyeHeight:C.eye,scaleBasis:deskY==null?'bbox':'authored tabletop / floor'};
}
async function batchExternal(root){root.updateMatrixWorld(true);const groups=new Map(),sourceGeometry=new Set();root.traverse(o=>{if(!o.isMesh)return;const g=o.geometry.clone().applyMatrix4(o.matrixWorld);if(!g.attributes.normal)g.computeVertexNormals();if(!g.attributes.uv)g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));for(const k of Object.keys(g.attributes))if(!['position','normal','uv'].includes(k))g.deleteAttribute(k);const c=new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()),key=o.material.uuid+':'+Math.floor(c.x/4)+':'+Math.floor(c.z/4);if(!groups.has(key))groups.set(key,{mat:o.material,geos:[]});groups.get(key).geos.push(g.index?g.toNonIndexed():g);if(g.index)g.dispose();sourceGeometry.add(o.geometry);});const result=new THREE.Group();let n=0;for(const {mat,geos}of groups.values()){const g=mergeGeometries(geos);geos.forEach(v=>v.dispose());if(g)result.add(new THREE.Mesh(g,mat));if(++n%8===0)await yieldTask();}sourceGeometry.forEach(g=>g.dispose());return result;}
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
 if(cfg.built){group=builders[cfg.built]();group.updateMatrixWorld(true);scaleReport={eyeHeight:C.eye,authoredMeters:true};}
 else{
  group=await boundedExternal(key);
  if(key==='hub'){normalizeAsset(group,42,0,0);scaleReport={eyeHeight:C.eye,originalMonumentalScale:true};}
  else humanScale(group,cfg);
  if(key==='wine')group=await batchExternal(group);

 }
 architecture.add(group);group.updateMatrixWorld(true);group.traverse(o=>{if(o.isLight){o.visible=false;return;}if(!o.isMesh)return;o.castShadow=o.userData.noCollision!==true;o.receiveShadow=true;o.frustumCulled=true;for(const m of[].concat(o.material))for(const property of['map','normalMap','roughnessMap']){const t=m[property];if(t&&t.anisotropy!==4){t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());t.needsUpdate=true;}}});
 activeArea=key;stage(cfg.name+'：ネイティブ床・壁のBVHを構築中…');await buildCollision();
 if(key==='hub'){activeSpawn=new THREE.Vector3(-7,C.floor+C.eye,0);activeLook=new THREE.Vector3(7,C.floor+C.eye,0);installHubOpening(group);}
 else if(cfg.built){installBuiltOpenings(group);stairAssist={axis:'x',x0:-6.04,x1:-2.20,z:36.2,halfWidth:.78,y0:-1.92,y1:0};}
 else installRoomReturn(group);

 const f=floorAt(activeSpawn.x,activeSpawn.z,activeSpawn.y-C.eye+.7,1.8);if(!f||!bodyClear(activeSpawn.x,f.point.y,activeSpawn.z))throw Error('入口に安全な足場がありません。');activeSpawn.y=f.point.y+C.eye;
 lampAnchors=(group.userData.lamps||[]).map(p=>group.localToWorld(new THREE.Vector3(...p)));reset();ready=true;spot.shadow.needsUpdate=true;shadowTime=-1;
 hemi.intensity=key==='hub'?.9:key==='wine'?1.15:.65;moon.intensity=key==='hub'?1.25:key==='wine'?.85:.4;
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
async function useDoor(){if(transitioning||!ready)return;scanDoor();if(selectedPortal)await travel(selectedPortal.target,selectedPortal.id,selectedPortal.kind==='return');}
async function travel(requested,id='drop',returning=false){
 if(transitioning)return;
 const from=activeArea,pose={position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),feet},parent=returning?routeStack.at(-1):null,target=parent?parent.source:requested,same=from===target;
 transitioning=true;controls.enabled=false;keys.clear();jumpRequested=false;velocity.set(0,0,0);$('doorPrompt').textContent='';$('fadeLabel').textContent='……（扉を開けています）';$('fadeDetail').textContent='Loading…';await fade(1);let error=null;
 try{await loadArea(target);if(returning&&parent){restorePose(parent.pose);routeStack.pop();}else if(!same)routeStack.push({source:from,target,portalId:id,pose});}
 catch(e){error=e;console.error(e);$('fadeLabel').textContent='読み込み失敗 — 大回廊へ復帰しています';try{await loadArea('corridor');if(from==='corridor')restorePose(pose);else{const r=routeStack.findLast(f=>f.source==='corridor');if(r)restorePose(r.pose);}while(routeStack.length&&routeStack.at(-1).target!=='corridor')routeStack.pop();}catch(rollback){ready=false;failed=true;stage('復帰エラー：'+rollback.message);$('retry').classList.remove('hidden');}}
 spot.shadow.needsUpdate=true;shadowTime=-1;await fade(0);transitioning=false;controls.enabled=true;keys.clear();if(!ready){controls.unlock();setMenu(true);$('start').disabled=true;}else if(!controls.isLocked)setMenu(true);if(error){stage('復帰済み：'+error.message+'');}
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
 }catch(e){console.error(e);if(builders){await loadArea('corridor');$('start').disabled=false;$('start').textContent='大回廊から探索をはじめる';stage('Sponza読込失敗。大回廊から開始できます。');}else{failed=true;stage('読込失敗：'+e.message);$('retry').classList.remove('hidden');}}}
const shadowPosition=new THREE.Vector3(10000,10000,10000),shadowRotation=new THREE.Quaternion();let shadowTime=-1;
const clock=new THREE.Clock();let frames=0,frameTime=0,smoothFPS=60,adaptTime=0;
function animate(){requestAnimationFrame(animate);const real=clock.getDelta(),dt=Math.min(real,.05);elapsed+=dt;if(ready&&controls.isLocked&&!transitioning){move(dt);interactionTime-=dt;if(interactionTime<=0){interactionTime=.08;scanDoor();}}else $('doorPrompt').textContent='';
 flashQ.slerp(camera.quaternion,1-Math.exp(-15*dt));const direction=new THREE.Vector3(0,0,-1).applyQuaternion(flashQ);spot.position.copy(camera.position).add(new THREE.Vector3(.15,-.13,0).applyQuaternion(camera.quaternion));aim.position.copy(spot.position).addScaledVector(direction,12);aim.updateMatrixWorld();
 // Cache static flashlight shadows while stationary; refresh at most 30 Hz
 // while moving. The scene and input still render on every requestAnimationFrame.
 if(spot.visible&&spot.castShadow&&elapsed-shadowTime>=1/30&&(spot.position.distanceToSquared(shadowPosition)>.0004||flashQ.angleTo(shadowRotation)>.003||shadowTime<0)){
  spot.shadow.needsUpdate=true;shadowTime=elapsed;shadowPosition.copy(spot.position);shadowRotation.copy(flashQ);
 }
 updateTorches();if(!transitioning)renderer.render(scene,camera);frames++;frameTime+=real;adaptTime+=real;
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
 openingScan(){const out=[];for(const side of[-1,1])for(let x=-12;x<=12;x+=.4){const z0=side*2.5,z1=side*5.0,f=floorAt(x,z0,C.floor+.4,3),g=floorAt(x,z1,C.floor+.4,3);if(!f||!g)continue;const blocks=[.25,.9,1.7].map(h=>nativeCast(new THREE.Vector3(x,f.point.y+h,z0),new THREE.Vector3(0,0,side),2.5,true).map(v=>v.point.toArray()));out.push({x,side,y:f.point.y,other:g.point.y,clear0:bodyClear(x,f.point.y,z0),clear1:bodyClear(x,g.point.y,z1),blocks});}return out;},load:key=>loadArea(key),floor(x,z,y=5){const h=floorAt(x,z,y,30);return h?.point.toArray();},useDoor,reset,clear(x,y,z){return bodyClear(x,y,z);}
};
