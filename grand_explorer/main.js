import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
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
function lock(){if(!ready)return;setMenu(false);try{const p=renderer.domElement.requestPointerLock();p?.catch(()=>{setMenu(true);stage('Pointer Lockが拒否されました。ダウンロードしたHTMLをブラウザで直接開いてください。');});}catch(e){stage(e.message);setMenu(true);}}
$('start').onclick=lock;renderer.domElement.addEventListener('click',()=>{if(!controls.isLocked)lock();});
controls.addEventListener('lock',()=>setMenu(false));controls.addEventListener('unlock',()=>{keys.clear();velocity.set(0,0,0);setMenu(true);});
document.addEventListener('pointerlockerror',()=>{setMenu(true);stage('マウスロックを許可してください。埋込画面ではなく別タブまたはダウンロードしたHTMLで開いてください。');});
addEventListener('keydown',e=>{if(controls.isLocked&&['KeyW','KeyA','KeyS','KeyD','Space'].includes(e.code))e.preventDefault();keys.add(e.code);if(e.code==='Space'&&!e.repeat&&controls.isLocked){e.preventDefault();jumpRequested=true;}if(e.code==='Escape'&&controls.isLocked)document.exitPointerLock();if(e.code==='KeyF'&&!e.repeat&&controls.isLocked){flashOn=!flashOn;spot.visible=flashOn;}});
addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>{keys.clear();if(controls.isLocked)controls.unlock();});
$('reset').onclick=()=>{reset();lock();};$('retry').onclick=()=>location.reload();
$('quality').onchange=()=>{const q=$('quality').value;autoQuality=q==='auto';dpr=q==='high'?Math.min(devicePixelRatio,1.5):q==='low'?.75:Math.min(devicePixelRatio,1.25);renderer.setPixelRatio(dpr);spot.castShadow=q!=='low';};
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
function reset(){camera.position.copy(spawn);camera.lookAt(7,C.floor+2.1,0);flashQ.copy(camera.quaternion);feet=C.floor;grounded=true;verticalVelocity=0;jumpRequested=false;velocity.set(0,0,0);}

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
function inferStairAssist(){
 // Measure the actual cathedral centerline. Fit collision-only inclines to runs
 // of native risers; retain the artist's visible staircase without modifications.
 const samples=[];for(let x=35;x<=74;x+=.10){const h=nativeCast(new THREE.Vector3(x,12,0),down,13,false).find(h=>h.face.normal.y>.62);if(h)samples.push({x,y:h.point.y});}
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
// Culling changes rendering only. All buildings and barriers stay in the same BVH.
const portalBox=new THREE.Box3(new THREE.Vector3(C.seam-.15,0,-14),new THREE.Vector3(C.seam+.15,52,14));
const viewFrustum=new THREE.Frustum(),viewProjection=new THREE.Matrix4();
function updateVisibility(){
 camera.updateMatrixWorld();viewProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);viewFrustum.setFromProjectionMatrix(viewProjection);
 const connectionVisible=viewFrustum.intersectsBox(portalBox),x=camera.position.x;
 if(sponza)sponza.visible=x<C.seam+1.5||(x<75&&connectionVisible);
 if(cathedral)cathedral.visible=x>C.seam-1.5||connectionVisible;
}
async function init(){try{
 stage('石材PBR・建築モデルをロード中…');
 const texturePromise=pbr('castle_brick_01').then(a=>{stone=a;});
 const loader=new GLTFLoader();const remote=loader.loadAsync(C.sponza,e=>stage(`Sponza ${e.total?Math.round(e.loaded/e.total*100)+'%':(e.loaded/1048576).toFixed(1)+' MB'} · Sibenik大聖堂を準備中`));
 const b64=$('cathedralData').textContent.trim();const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));const local=loader.parseAsync(bytes.buffer,'');
 const [sg,cg]=await Promise.all([remote,local,texturePromise]);
 sponza=flattenScene(sg.scene);cathedral=flattenScene(cg.scene);architecture.add(sponza,cathedral);
 normalizeAsset(sponza,42,0,0);normalizeAsset(cathedral,64,45.3,C.floor-.0195536);
 stage('壁の開口・階段の接続空間を実ジオメトリで切削中…');await yieldTask();
 // Each model owns one side of the seam. Trim geometry, not depth-bias:
 // this removes overlap from rendering AND from the native-mesh collision BVH.
 await bakeAndCut(sponza,[[C.seam,10000,-10000,10000,-10000,10000],[11.7,C.seam,C.floor+.045,C.floor+4.5,-2.40,2.40]]);
 await bakeAndCut(cathedral,[[-10000,C.seam,-10000,10000,-10000,10000],[C.seam,19,C.floor+.045,C.floor+5.4,-2.45,2.45]]);
 // Keep the original authored colors; enhance stone with linear roughness/normal data.
 cathedral.traverse(o=>{if(!o.isMesh)return;const name=o.name.toLowerCase();const m=o.material.clone();
  if(/staklo|rozeta/.test(name)){m.emissive=new THREE.Color(0x50698c);m.emissiveIntensity=.25;m.roughness=.25;}
  else {m.roughness=.9;m.metalness=0;if(!m.map)m.map=stone.map;m.normalMap=stone.normalMap;m.roughnessMap=stone.roughnessMap;m.normalScale=new THREE.Vector2(.35,.35);}o.material=m;});
 stage('生成床なし：モデル本来の床・壁・階段を解析中…');
 stage('モデル本来の床・壁・階段のBVHを構築中…');await buildCollision();inferStairAssist();
 reset();const sf=floorAt(spawn.x,spawn.z,C.floor+.4,1);if(sf){feet=sf.point.y;camera.position.y=feet+C.eye;spawn.y=camera.position.y;}
 ready=true;$('start').disabled=false;$('start').textContent='探索をはじめる';stage(`ロード完了 · Sponza ＋ Sibenik Cathedral · 二重床なし · 直接接続された建築空間 · ${Math.round(positionCount).toLocaleString()} collision triangles`);
 }catch(e){console.error(e);failed=true;stage('読込失敗：'+e.message+'\nインターネット接続と外部配信元を確認し、再読込してください。');$('retry').classList.remove('hidden');}}
const shadowPosition=new THREE.Vector3(10000,10000,10000),shadowRotation=new THREE.Quaternion();let shadowTime=-1;
const clock=new THREE.Clock();let frames=0,frameTime=0,smoothFPS=60,adaptTime=0;
function animate(){requestAnimationFrame(animate);const real=clock.getDelta(),dt=Math.min(real,.05);elapsed+=dt;if(ready&&controls.isLocked)move(dt);
 flashQ.slerp(camera.quaternion,1-Math.exp(-15*dt));const direction=new THREE.Vector3(0,0,-1).applyQuaternion(flashQ);spot.position.copy(camera.position).add(new THREE.Vector3(.15,-.13,0).applyQuaternion(camera.quaternion));aim.position.copy(spot.position).addScaledVector(direction,12);aim.updateMatrixWorld();
 // Cache static flashlight shadows while stationary; refresh at most 30 Hz
 // while moving. The scene and input still render on every requestAnimationFrame.
 if(spot.visible&&spot.castShadow&&elapsed-shadowTime>=1/30&&(spot.position.distanceToSquared(shadowPosition)>.0004||flashQ.angleTo(shadowRotation)>.003||shadowTime<0)){
  spot.shadow.needsUpdate=true;shadowTime=elapsed;shadowPosition.copy(spot.position);shadowRotation.copy(flashQ);
 }
 updateVisibility();renderer.render(scene,camera);frames++;frameTime+=real;adaptTime+=real;
 if(frameTime>=1){const fps=frames/frameTime;smoothFPS=smoothFPS*.6+fps*.4;$('perf').innerHTML=`<b>${Math.round(fps)}</b> FPS <span>${renderer.info.render.calls} draws · ${Math.round(renderer.info.render.triangles/1000)}k tris · DPR ${dpr.toFixed(2)}</span>`;frames=0;frameTime=0;}
 if(ready&&autoQuality&&controls.isLocked&&adaptTime>3){adaptTime=0;if(smoothFPS<52&&dpr>.65){dpr=Math.max(.65,dpr-.10);renderer.setPixelRatio(dpr);}else if(smoothFPS>59&&dpr<Math.min(devicePixelRatio,1.5)){dpr=Math.min(Math.min(devicePixelRatio,1.5),dpr+.05);renderer.setPixelRatio(dpr);}}
}
reset();animate();init();
// Diagnostics are opt-in and never visible in the exploration HUD.
if(new URLSearchParams(location.search).has('debug'))window.ExplorerDebug={
 state:()=>({ready,failed,stage:stageText,position:camera.position.toArray(),feet,grounded,verticalVelocity,locked:controls.isLocked,sensitivity:controls.pointerSpeed,collisionTriangles:positionCount,cutCount,stairRuns:stairRuns.map(r=>({...r})),near:camera.near,far:camera.far,fov:camera.fov,generatedMeshes:world.children.filter(c=>c!==architecture).length}),
 teleport(x,y,z){camera.position.set(x,y+C.eye,z);feet=y;grounded=true;verticalVelocity=0;jumpRequested=false;velocity.set(0,0,0);camera.lookAt(x+5,y+C.eye,z);},
 floor(x,z,y=30){const f=floorAt(x,z,y,100);return f?f.point.toArray():null;},
 simulate(codes,seconds=1){keys.clear();codes.forEach(c=>keys.add(c));const count=Math.ceil(seconds/.008);for(let i=0;i<count;i++)move(.008);keys.clear();return this.state();},
 jump(){jumpRequested=true;},
 trajectory(seconds=1,repeat=false){const values=[];for(let i=0;i<Math.ceil(seconds/.008);i++){if(repeat&&i%8===0)jumpRequested=true;move(.008);values.push({feet,grounded,verticalVelocity});}return values;},
 clear(x,y,z){return bodyClear(x,y,z);},look(x,y,z){camera.lookAt(x,y,z);},reset
};
