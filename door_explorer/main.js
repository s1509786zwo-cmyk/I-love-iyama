import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {PointerLockControls} from 'three/addons/controls/PointerLockControls.js';
import {MeshBVH,acceleratedRaycast} from 'three-mesh-bvh';

// Architectural exploration only: no missions, pickups, audio, or game state.
const $=id=>document.getElementById(id);
const C={sponza:'https://raw.githubusercontent.com/Breush/lava-assets/master/models/sponza.glb',floor:1.39896,upper:6.16,walk:2.7,run:6.6,eye:1.62,height:1.8,radius:.26,step:.4,gravity:22,jumpSpeed:6.5,seam:14.35};
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
let sponza=null,cathedral=null,collider=null,ready=false,failed=false,elapsed=0;
const keys=new Set(),velocity=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),down=new THREE.Vector3(0,-1,0),ray=new THREE.Raycaster();
let feet=C.floor,grounded=true,verticalVelocity=0,jumpRequested=false,positionCount=0,cutCount=0,dpr=Math.min(devicePixelRatio,1.5),autoQuality=true;
const spawn=new THREE.Vector3(-7,C.floor+C.eye,0),matCache=new Map();
const stairRuns=[];
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
addEventListener('keydown',e=>{if(controls.isLocked&&['KeyW','KeyA','KeyS','KeyD','Space'].includes(e.code))e.preventDefault();keys.add(e.code);if(e.code==='KeyE'&&!e.repeat&&controls.isLocked&&!transitioning)useDoor();if(e.code==='Space'&&!e.repeat&&controls.isLocked&&!transitioning){e.preventDefault();jumpRequested=true;}if(e.code==='Escape'&&controls.isLocked)document.exitPointerLock();if(e.code==='KeyF'&&!e.repeat&&controls.isLocked){flashOn=!flashOn;spot.visible=flashOn;}});
addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>{keys.clear();if(controls.isLocked)controls.unlock();});
$('reset').onclick=()=>{reset();lock();};$('retry').onclick=()=>location.reload();
$('quality').onchange=()=>{const q=$('quality').value;autoQuality=q==='auto';dpr=q==='high'?Math.min(devicePixelRatio,1.5):q==='low'?.75:Math.min(devicePixelRatio,1.25);renderer.setPixelRatio(dpr);spot.castShadow=q!=='low';};
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
function reset(){camera.position.copy(activeSpawn||spawn);if(activeLook)camera.lookAt(activeLook);else camera.lookAt(7,C.floor+2.1,0);flashQ.copy(camera.quaternion);feet=camera.position.y-C.eye;grounded=true;verticalVelocity=0;jumpRequested=false;velocity.set(0,0,0);}

async function pbr(id,repeat=1){
 const loader=new THREE.TextureLoader();loader.setCrossOrigin('anonymous');
 const base=`https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/${id}/${id}`;
 const urls=['_diff_2k.jpg','_rough_2k.jpg','_nor_gl_2k.jpg'];
 const textures=await Promise.all(urls.map(s=>loader.loadAsync(base+s)));
 textures.forEach((t,i)=>{t.colorSpace=i===0?THREE.SRGBColorSpace:THREE.NoColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeat,repeat);t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());});
 return new THREE.MeshStandardMaterial({map:textures[0],roughnessMap:textures[1],normalMap:textures[2],normalScale:new THREE.Vector2(.45,.45),roughness:1});
}
// Exact AABB subtraction on selected triangles, interpolating position/normal/UV.
// Visual triangles and collision triangles share the same opened doorways.
function lerpVertex(a,b,t){return a.map((x,i)=>x+(b[i]-x)*t);}
function clipPoly(poly,axis,value,greater){const out=[];if(!poly.length)return out;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=(a[axis]-value)*(greater?1:-1),db=(b[axis]-value)*(greater?1:-1);if(da>=-1e-7)out.push(a);if((da>0&&db<0)||(da<0&&db>0))out.push(lerpVertex(a,b,da/(da-db)));}return out;}
function subtractTriangle(tri,b){let remainder=tri,out=[];for(const [axis,v,g] of [[0,b[0],true],[0,b[1],false],[1,b[2],true],[1,b[3],false],[2,b[4],true],[2,b[5],false]]){const outside=clipPoly(remainder,axis,v,!g);if(outside.length>=3)out.push(outside);remainder=clipPoly(remainder,axis,v,g);if(remainder.length<3)break;}return out;}
function touches(t,b){for(let a=0;a<3;a++){const lo=Math.min(...t.map(v=>v[a])),hi=Math.max(...t.map(v=>v[a]));if(hi<b[a*2]||lo>b[a*2+1])return false;}return true;}
async function bakeAndCut(group,cuts){
 group.updateMatrixWorld(true);const meshes=[];group.traverse(o=>{if(o.isMesh)meshes.push(o);});
 let count=0;
 for(const old of meshes){
  if(old.isSkinnedMesh)continue;let g=old.geometry.clone();if(g.index){const prev=g;g=g.toNonIndexed();prev.dispose();}g.applyMatrix4(old.matrixWorld);if(!g.attributes.normal)g.computeVertexNormals();
  const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;const outP=[],outN=[],outUV=[],groups=[];
  const inputGroups=g.groups.length?g.groups:[{start:0,count:p.count,materialIndex:0}];
  for(const gr of inputGroups){const begin=outP.length/3;for(let i=gr.start;i<gr.start+gr.count;i+=3){let polygons=[Array.from({length:3},(_,k)=>{const j=i+k;return [p.getX(j),p.getY(j),p.getZ(j),n.getX(j),n.getY(j),n.getZ(j),uv?uv.getX(j):0,uv?uv.getY(j):0];})];
   for(const cut of cuts){const next=[];for(const poly of polygons){if(touches(poly,cut)){next.push(...subtractTriangle(poly,cut));cutCount++;}else next.push(poly);}polygons=next;if(!polygons.length)break;}
   for(const poly of polygons)for(let k=1;k<poly.length-1;k++)for(const v of [poly[0],poly[k],poly[k+1]]){outP.push(v[0],v[1],v[2]);outN.push(v[3],v[4],v[5]);outUV.push(v[6],v[7]);}
  }groups.push({start:begin,count:outP.length/3-begin,materialIndex:gr.materialIndex});}
  const ng=new THREE.BufferGeometry();ng.setAttribute('position',new THREE.Float32BufferAttribute(outP,3));ng.setAttribute('normal',new THREE.Float32BufferAttribute(outN,3));ng.setAttribute('uv',new THREE.Float32BufferAttribute(outUV,2));groups.forEach(a=>ng.addGroup(a.start,a.count,a.materialIndex));ng.computeBoundingSphere();
  const m=new THREE.Mesh(ng,old.material);m.name=old.name;
  for(const material of [].concat(m.material)){for(const key of ['map','normalMap','roughnessMap'])if(material[key]){const t=material[key],a=Math.min(4,renderer.capabilities.getMaxAnisotropy());if(t.anisotropy!==a){t.anisotropy=a;t.needsUpdate=true;}}}
  m.castShadow=m.receiveShadow=true;m.frustumCulled=true;group.add(m);old.parent.remove(old);g.dispose();old.geometry.dispose();count++;if(count%8===0)await yieldTask();
 }
 // All new baked meshes have world-space coordinates; keep their parent's transform identity.
 group.position.set(0,0,0);group.rotation.set(0,0,0);group.scale.set(1,1,1);group.updateMatrixWorld(true);
}
function normalizeAsset(r,span,cx,baseY){r.updateMatrixWorld(true);let box=new THREE.Box3().setFromObject(r),size=box.getSize(new THREE.Vector3());r.scale.multiplyScalar(span/Math.max(size.x,size.z));r.updateMatrixWorld(true);box.setFromObject(r);const c=box.getCenter(new THREE.Vector3());r.position.x+=cx-c.x;r.position.z-=c.z;r.position.y+=baseY-box.min.y;r.updateMatrixWorld(true);}
function flattenScene(original){const holder=new THREE.Group();original.updateMatrixWorld(true);original.traverse(o=>{if(!o.isMesh)return;const m=new THREE.Mesh(o.geometry.clone(),o.material);m.name=o.name;m.applyMatrix4(o.matrixWorld);holder.add(m);});return holder;}
async function buildCollision(){
 world.updateMatrixWorld(true);const parts=[];let total=0;
 world.traverse(o=>{if(!o.isMesh||o.userData.noCollision)return;let g=o.geometry.clone();if(g.index){const prev=g;g=g.toNonIndexed();prev.dispose();}
  if(o.isInstancedMesh){const im=new THREE.Matrix4(),wm=new THREE.Matrix4();for(let k=0;k<o.count;k++){o.getMatrixAt(k,im);wm.multiplyMatrices(o.matrixWorld,im);const t=g.clone().applyMatrix4(wm);const a=new Float32Array(t.attributes.position.array);parts.push(a);total+=a.length;t.dispose();}}
  else{g.applyMatrix4(o.matrixWorld);const a=new Float32Array(g.attributes.position.array);parts.push(a);total+=a.length;}g.dispose();
 });
 const data=new Float32Array(total);let at=0;for(const a of parts){data.set(a,at);at+=a.length;}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(data,3));geo.computeVertexNormals();await yieldTask();geo.boundsTree=new MeshBVH(geo,{maxLeafTris:10});collider=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));collider.raycast=acceleratedRaycast;collider.updateMatrixWorld(true);positionCount=total/9;
}
function rampAt(x,z){return stairRuns.find(r=>x>=r.x0&&x<=r.x1&&Math.abs(z)<=r.halfWidth);}
function rampHeight(r,x){return r.y0+(r.y1-r.y0)*clamp((x-r.x0)/(r.x1-r.x0),0,1);}
function isAssistedRiser(h){const r=rampAt(h.point.x,h.point.z);return r&&h.point.y>=Math.min(r.y0,r.y1)-.25&&h.point.y<=rampHeight(r,h.point.x)+.65;}
function nativeCast(origin,dir,length,first=true){if(!collider)return [];ray.set(origin,dir);ray.near=.001;ray.far=length;ray.firstHitOnly=first;return ray.intersectObject(collider,false);}
function cast(origin,dir,length,first=true){
 let hits=nativeCast(origin,dir,length,first);
 if(!stairRuns.length)return hits;
 // Hidden analytic ramps replace only low native stair risers in these narrow runs.
 // There is no render mesh or coplanar floor overlay.
 if(first&&hits.some(isAssistedRiser))hits=nativeCast(origin,dir,length,false);
 return hits.filter(h=>!isAssistedRiser(h));
}
function floorAt(x,z,from,max){
 const native=cast(new THREE.Vector3(x,from,z),down,max,false).find(h=>h.face.normal.y>.62);
 const r=rampAt(x,z);
 if(r){const y=rampHeight(r,x),distance=from-y;
  if(distance>=-.001&&distance<=max&&(!native||native.point.y<y))return {point:new THREE.Vector3(x,y,z),distance,face:{normal:new THREE.Vector3(-(r.y1-r.y0)/(r.x1-r.x0),1,0).normalize()},assisted:true};
 }
 return native;
}
function inferStairAssist(range){
 if(!range)return;
 // Measure the actual cathedral centerline. Fit collision-only inclines to runs
 // of native risers; retain the artist's visible staircase without modifications.
 const samples=[];for(let x=range[0];x<=range[1];x+=.10){const h=nativeCast(new THREE.Vector3(x,12,0),down,13,false).find(h=>h.face.normal.y>.62);if(h)samples.push({x,y:h.point.y});}
 const rises=[];for(let i=1;i<samples.length;i++){const dy=samples[i].y-samples[i-1].y;if(dy>.035&&dy<.9)rises.push({i,x:samples[i].x});}
 const groups=[];for(const rise of rises){const g=groups.at(-1);if(g&&rise.x-g.at(-1).x<1.6)g.push(rise);else groups.push([rise]);}
 for(const g of groups){if(g.length<2)continue;const before=samples[g[0].i-1],after=samples[g.at(-1).i];const x0=before.x-.15,x1=after.x+.15;
  if(after.y-before.y<.25||(after.y-before.y)/(x1-x0)>.7)continue;
  stairRuns.push({x0,x1,y0:before.y,y1:after.y,halfWidth:1.55});
 }
}
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
const AREA_CONFIG={
 hub:{name:'Sponza — メイン回廊',url:C.sponza,span:42,baseY:0,spawn:[-7,C.floor,0],look:[7,C.floor+1.62,0]},
 A:{name:'扉A — 大広間 / Sibenik',embedded:'cathedralData',span:64,baseY:C.floor-.0195536,spawn:[-20,C.floor,0],look:[5,C.floor+5,0],stairScan:[-10,30]},
 B:{name:'扉B — 地下の休憩室 / Breakfast Room',url:'https://raw.githubusercontent.com/gkjohnson/3d-demo-data/main/models/bitterli-rendering-resources/breakfast-room.glb',span:14,baseY:-12,useCamera:true}
};
const rawCache=new Map();
let activeArea='hub',activeSpawn=null,activeLook=null,transitioning=false,returnPose=null,doors=[],doorHits=[],selectedDoor=null,interactionTime=0;
let wood=null,doorIron=null;
const sharedMaterials=new Set(),sharedTextures=new Set();
function rememberShared(material){sharedMaterials.add(material);for(const v of Object.values(material))if(v?.isTexture)sharedTextures.add(v);return material;}
async function sourceBytes(key){
 if(rawCache.has(key))return rawCache.get(key);
 const cfg=AREA_CONFIG[key];let bytes;
 if(cfg.embedded){bytes=Uint8Array.from(atob($(cfg.embedded).textContent.trim()),c=>c.charCodeAt(0)).buffer;}
 else{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),120000);
  try{const response=await fetch(cfg.url,{mode:'cors',signal:controller.signal});if(!response.ok)throw new Error(`HTTP ${response.status}: ${cfg.name}`);bytes=await response.arrayBuffer();}finally{clearTimeout(timer);}
 }
 rawCache.set(key,bytes);return bytes;
}
function disposeArea(){
 doors=[];doorHits=[];selectedDoor=null;$('doorPrompt').textContent='';stairRuns.length=0;
 const geometries=new Set(),materials=new Set(),textures=new Set();
 for(const group of architecture.children.slice()){
  architecture.remove(group);group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of [].concat(o.material||[])){materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}});
 }
 geometries.forEach(g=>g.dispose());materials.forEach(m=>{if(!sharedMaterials.has(m))m.dispose();});const images=new Set();textures.forEach(t=>{if(!sharedTextures.has(t)){t.dispose();if(t.image)images.add(t.image);}});images.forEach(image=>{if(typeof image.close==='function')image.close();});
 if(collider){collider.geometry.boundsTree=null;collider.geometry.dispose();collider.material.dispose();collider=null;}
 renderer.renderLists.dispose();ready=false;
}
function doorMesh(group,geometry,material,x,y,z){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;group.add(m);return m;}
function createDoor({id,target,label,x,y,z,yaw=0,stand}){
 const group=new THREE.Group();group.position.set(x,y,z);group.rotation.y=yaw;architecture.add(group);
 const b=(w,h,d,x,y,z,m)=>doorMesh(group,new THREE.BoxGeometry(w,h,d),m,x,y,z);
 // An interactable prop only: no generated floor or stair geometry.
 b(1.58,2.62,.12,0,1.31,0,wood);
 for(const sx of [-.86,.86])b(.15,2.88,.24,sx,1.44,.03,stone);
 b(1.88,.17,.24,0,2.84,.03,stone);
 for(const sx of [-.39,.39])for(const h of [.54,1.37,2.18])b(.66,.09,.07,sx,h,.10,doorIron);
 for(const sx of [-.07,.07]){
  const ring=doorMesh(group,new THREE.TorusGeometry(.058,.014,7,16),doorIron,sx,1.25,.14);
  const back=b(.09,.17,.025,sx,1.28,.10,doorIron);
 }
 const studs=new THREE.InstancedMesh(new THREE.SphereGeometry(.022,6,4),doorIron,24),dummy=new THREE.Object3D();
 let at=0;for(const sx of [-.69,-.18,.18,.69])for(const y of [.54,.69,1.37,1.52,2.18,2.33]){dummy.position.set(sx,y,.15);dummy.updateMatrix();studs.setMatrixAt(at++,dummy.matrix);}studs.castShadow=true;group.add(studs);
 // Merge local door details by material. Keep the proxy out of the collision BVH.
 const buckets=new Map();for(const m of group.children.slice()){if(!m.isMesh||m.isInstancedMesh)continue;if(!buckets.has(m.material))buckets.set(m.material,[]);buckets.get(m.material).push(m);}
 for(const [material,list] of buckets){if(list.length<2)continue;const gs=list.map(m=>{m.updateMatrix();let g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();return g.applyMatrix4(m.matrix);});const g=mergeGeometries(gs);gs.forEach(g=>g.dispose());if(g){const m=new THREE.Mesh(g,material);m.castShadow=m.receiveShadow=true;group.add(m);list.forEach(m=>{group.remove(m);m.geometry.dispose();});}}
 const proxy=new THREE.Mesh(new THREE.BoxGeometry(1.85,2.9,.38),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,colorWrite:false}));proxy.position.set(0,1.45,.03);proxy.userData.noCollision=true;group.add(proxy);
 const door={id,target,label,group,proxy,stand};proxy.userData.door=door;doors.push(door);doorHits.push(proxy);group.updateMatrixWorld(true);return door;
}
function safeSpawn(cfg,cameraHint){
 const candidates=[];
 if(cameraHint)candidates.push({x:cameraHint.position.x,z:cameraHint.position.z,from:cameraHint.position.y+.5});
 if(cfg.spawn)candidates.push({x:cfg.spawn[0],z:cfg.spawn[2],from:cfg.spawn[1]+.5});
 for(const c of candidates){const floor=floorAt(c.x,c.z,c.from,8);if(floor&&bodyClear(c.x,floor.point.y,c.z))return new THREE.Vector3(c.x,floor.point.y+C.eye,c.z);}
 const box=new THREE.Box3().setFromObject(architecture);let best=null,bestScore=-Infinity;
 for(let x=box.min.x+.7;x<box.max.x;x+=.8)for(let z=box.min.z+.7;z<box.max.z;z+=.8){const f=floorAt(x,z,box.min.y+4,6);if(!f||!bodyClear(x,f.point.y,z))continue;const score=-Math.hypot(x-(cameraHint?.position.x||0),z-(cameraHint?.position.z||0));if(score>bestScore){bestScore=score;best=new THREE.Vector3(x,f.point.y+C.eye,z);}}
 if(!best)throw new Error('歩行可能な入口が見つかりません。');return best;
}
function installDoors(cfg){
 if(activeArea==='hub'){
  for(const [id,target,label,ideal] of [['doorA','A','扉A：大広間',-6],['doorB','B','扉B：地下の休憩室',6]]){
   let choice=null;
   for(const delta of [0,.7,-.7,1.4,-1.4,2.1,-2.1]){const x=ideal+delta,standZ=-5.0,f=floorAt(x,standZ,C.floor+.5,2);if(f&&Math.abs(f.point.y-C.floor)<.3&&bodyClear(x,f.point.y,standZ)){choice={x,y:f.point.y,z:-6.3,stand:[x,f.point.y,standZ]};break;}}
   if(!choice)throw new Error(`${label} の安全な足場が見つかりません。`);
   createDoor({id,target,label,...choice});
  }
 }else{
  const fwd=activeLook.clone().sub(activeSpawn);fwd.y=0;fwd.normalize();if(fwd.lengthSq()<.1)fwd.set(1,0,0);
  let chosen=null;
  // The authored camera can be close to a wall. Choose an unobstructed return
  // door position instead of blindly putting it behind that wall.
  for(const angle of [Math.PI,Math.PI/2,-Math.PI/2,0]){
   const direction=fwd.clone().applyAxisAngle(up,angle);
   for(const distance of [1.05,.85,.65]){
    const p=activeSpawn.clone().addScaledVector(direction,distance);
    const f=floorAt(p.x,p.z,activeSpawn.y-C.eye+.45,1.5);
    if(!f||Math.abs(f.point.y-(activeSpawn.y-C.eye))>.35)continue;
    const center=new THREE.Vector3(p.x,f.point.y+1.45,p.z),toDoor=center.clone().sub(activeSpawn),length=toDoor.length();
    if(nativeCast(activeSpawn,toDoor.normalize(),Math.max(.01,length-.24),true).length)continue;
    chosen={position:p,y:f.point.y};break;
   }if(chosen)break;
  }
  if(!chosen)throw new Error('戻り扉を安全に配置できませんでした。');
  const pos=chosen.position,toward=activeSpawn.clone().sub(pos);toward.y=0;toward.normalize();
  createDoor({id:'return',target:'hub',label:'メイン回廊へ戻る',x:pos.x,y:chosen.y,z:pos.z,yaw:Math.atan2(toward.x,toward.z),stand:[activeSpawn.x,activeSpawn.y-C.eye,activeSpawn.z]});
 }
}
async function loadArea(key){
 const cfg=AREA_CONFIG[key];stage(`${cfg.name} を読み込み中…`);$('fadeDetail').textContent=cfg.name;
 // Free the previous area's decoded meshes and GPU allocations before parsing.
 disposeArea();await wait(80);
 const bytes=await sourceBytes(key),loader=new GLTFLoader();const draco=new DRACOLoader();draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');loader.setDRACOLoader(draco);
 let gltf;
 try{gltf=await loader.parseAsync(bytes,'');}finally{draco.dispose();}
 normalizeAsset(gltf.scene,cfg.span,0,cfg.baseY);
 let cameraHint=null;if(cfg.useCamera&&gltf.cameras?.length){const c=gltf.cameras[0];c.updateWorldMatrix(true,false);cameraHint={position:c.getWorldPosition(new THREE.Vector3()),quaternion:c.getWorldQuaternion(new THREE.Quaternion())};}
 const group=gltf.scene;architecture.add(group);
 // Keep the native scene hierarchy; avoid duplicating all vertex buffers on load.
 group.traverse(o=>{if(o.isLight){o.visible=false;return;}if(!o.isMesh)return;o.castShadow=o.receiveShadow=true;o.frustumCulled=true;
  if(key==='A'){const name=o.name.toLowerCase(),m=o.material.clone();if(/staklo|rozeta/.test(name)){m.emissive=new THREE.Color(0x50698c);m.emissiveIntensity=.25;}else{m.roughness=.9;m.metalness=0;if(!m.map)m.map=stone.map;m.normalMap=stone.normalMap;m.roughnessMap=stone.roughnessMap;m.normalScale=new THREE.Vector2(.35,.35);}o.material=m;}
  for(const m of [].concat(o.material))for(const property of ['map','normalMap','roughnessMap']){const t=m[property];if(t&&t.anisotropy!==4){t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());t.needsUpdate=true;}}
 });
 activeArea=key;stage(`${cfg.name}：床・壁の当たり判定を構築中…`);await buildCollision();inferStairAssist(cfg.stairScan);
 activeSpawn=safeSpawn(cfg,cameraHint);
 if(cameraHint)activeLook=activeSpawn.clone().add(new THREE.Vector3(0,0,-1).applyQuaternion(cameraHint.quaternion).multiplyScalar(5));
 else if(cfg.look)activeLook=new THREE.Vector3(...cfg.look);else activeLook=activeSpawn.clone().add(new THREE.Vector3(1,0,0));
 installDoors(cfg);
 // Rebuild once with the physical wooden doors included.
 if(collider){collider.geometry.boundsTree=null;collider.geometry.dispose();collider.material.dispose();collider=null;}
 await buildCollision();reset();ready=true;spot.shadow.needsUpdate=true;shadowTime=-1;
 if(key==='B'){hemi.intensity=.65;moon.intensity=.65;}else{hemi.intensity=.9;moon.intensity=1.25;}
 stage(`${cfg.name} · Eで扉を調べる · ${Math.round(positionCount).toLocaleString()} collision tris`);
}
function scanDoor(){
 selectedDoor=null;$('doorPrompt').textContent='';if(!ready||transitioning||!controls.isLocked)return;
 camera.updateMatrixWorld(true);architecture.updateMatrixWorld(true);
 const r=new THREE.Raycaster();r.setFromCamera(new THREE.Vector2(),camera);r.far=3;const hits=r.intersectObjects(doorHits,false);if(!hits.length)return;
 const hit=hits[0],door=hit.object.userData.door,dir=hit.point.clone().sub(camera.position).normalize();
 // Test only native environment; the interactive door's own front is permitted.
 const blockers=nativeCast(camera.position,dir,Math.max(.01,hit.distance-.22),true);
 if(blockers.length)return;selectedDoor=door;
 $('doorPrompt').textContent=`Eキー：${door.target==='hub'?'回廊へ戻る':'部屋に入る'}　— ${door.label}`;
}
function wait(ms){return new Promise(r=>setTimeout(r,ms));}
async function fade(to){const el=$('fade');el.classList.remove('hidden');if(to===1){el.style.opacity='0';el.getBoundingClientRect();}el.style.opacity=String(to);await wait(1050);if(to===0)el.classList.add('hidden');}
async function useDoor(){
 if(transitioning||!ready)return;scanDoor();const door=selectedDoor;if(!door)return;
 const from=activeArea,pose={position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),feet};
 if(from==='hub')returnPose={...pose,doorId:door.id};
 transitioning=true;controls.enabled=false;keys.clear();jumpRequested=false;velocity.set(0,0,0);selectedDoor=null;$('doorPrompt').textContent='';$('fadeLabel').textContent='……（扉を開けています）';$('fadeDetail').textContent='';
 // Keep Pointer Lock across the asynchronous load; only Esc or blur releases it.
 await fade(1);
 let error=null;
 try{
  await loadArea(door.target);
  if(door.target==='hub'&&returnPose){camera.position.fromArray(returnPose.position);camera.quaternion.fromArray(returnPose.quaternion);feet=returnPose.feet;grounded=true;verticalVelocity=0;flashQ.copy(camera.quaternion);}
  // Hide the shader/texture warm-up behind the black screen.
  try{await renderer.compileAsync(scene,camera);}catch{}
  renderer.render(scene,camera);
 }catch(e){error=e;console.error(e);$('fadeLabel').textContent='読み込みに失敗しました。元の場所へ戻ります…';
  try{await loadArea(from);camera.position.fromArray(pose.position);camera.quaternion.fromArray(pose.quaternion);feet=pose.feet;verticalVelocity=0;grounded=true;flashQ.copy(camera.quaternion);}catch(rollback){console.error(rollback);failed=true;ready=false;stage('復帰にも失敗しました。再読込してください。');$('retry').classList.remove('hidden');}
 }
 spot.shadow.needsUpdate=true;shadowTime=-1;await fade(0);transitioning=false;controls.enabled=true;keys.clear();
 if(!ready){controls.unlock();setMenu(true);$('start').disabled=true;}else if(!controls.isLocked)setMenu(true);
 if(error)stage(`読込に失敗したため復帰しました：${error.message}`);
}

async function init(){try{
 stage('共通PBRを準備し、Sponza回廊を読み込みます…');
 [stone,wood]=await Promise.all([pbr('castle_brick_01'),pbr('old_wood_floor')]);
 rememberShared(stone);rememberShared(wood);wood.color.set(0x9e7952);wood.roughness=.85;
 doorIron=rememberShared(new THREE.MeshStandardMaterial({map:wood.map,roughnessMap:wood.roughnessMap,normalMap:wood.normalMap,color:0x463c2e,metalness:.7,roughness:.5}));
 await loadArea('hub');$('start').disabled=false;$('start').textContent='探索をはじめる';
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
 renderer.render(scene,camera);frames++;frameTime+=real;adaptTime+=real;
 if(frameTime>=1){const fps=frames/frameTime;smoothFPS=smoothFPS*.6+fps*.4;$('perf').innerHTML=`<b>${Math.round(fps)}</b> FPS <span>${renderer.info.render.calls} draws · ${Math.round(renderer.info.render.triangles/1000)}k tris · DPR ${dpr.toFixed(2)} · ${activeArea.toUpperCase()}</span>`;frames=0;frameTime=0;}
 if(ready&&!transitioning&&autoQuality&&controls.isLocked&&adaptTime>3){adaptTime=0;if(smoothFPS<52&&dpr>.65){dpr=Math.max(.65,dpr-.10);renderer.setPixelRatio(dpr);}else if(smoothFPS>59&&dpr<Math.min(devicePixelRatio,1.5)){dpr=Math.min(Math.min(devicePixelRatio,1.5),dpr+.05);renderer.setPixelRatio(dpr);}}
}
reset();animate();init();
// Diagnostics are opt-in and never visible in the exploration HUD.
if(new URLSearchParams(location.search).has('debug'))window.ExplorerDebug={
 state:()=>({ready,failed,transitioning,area:activeArea,cache:[...rawCache.keys()],gpu:{...renderer.info.memory},doors:doors.map(d=>({id:d.id,target:d.target,position:d.group.position.toArray(),stand:d.stand})),stage:stageText,position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),flashOn,feet,grounded,verticalVelocity,locked:controls.isLocked,sensitivity:controls.pointerSpeed,collisionTriangles:positionCount,cutCount,stairRuns:stairRuns.map(r=>({...r})),near:camera.near,far:camera.far,fov:camera.fov,generatedMeshes:world.children.filter(c=>c!==architecture).length}),
 teleport(x,y,z){camera.position.set(x,y+C.eye,z);feet=y;grounded=true;verticalVelocity=0;jumpRequested=false;velocity.set(0,0,0);camera.lookAt(x+5,y+C.eye,z);},
 floor(x,z,y=30){const f=floorAt(x,z,y,100);return f?f.point.toArray():null;},
 simulate(codes,seconds=1){keys.clear();codes.forEach(c=>keys.add(c));const count=Math.ceil(seconds/.008);for(let i=0;i<count;i++)move(.008);keys.clear();return this.state();},
 jump(){jumpRequested=true;},
 trajectory(seconds=1,repeat=false){const values=[];for(let i=0;i<Math.ceil(seconds/.008);i++){if(repeat&&i%8===0)jumpRequested=true;move(.008);values.push({feet,grounded,verticalVelocity});}return values;},
 faceDoor(id){const d=doors.find(d=>d.id===id);if(!d)throw Error('Door not found');camera.position.set(d.stand[0],d.stand[1]+C.eye,d.stand[2]);feet=d.stand[1];grounded=true;verticalVelocity=0;velocity.set(0,0,0);camera.lookAt(d.group.localToWorld(new THREE.Vector3(0,1.45,.20)));camera.updateMatrixWorld();scanDoor();return {selected:selectedDoor?.id,prompt:$('doorPrompt').textContent};},
 useDoor,clear(x,y,z){return bodyClear(x,y,z);},look(x,y,z){camera.lookAt(x,y,z);},reset
};
