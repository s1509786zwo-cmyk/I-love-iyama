import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {PointerLockControls} from 'three/addons/controls/PointerLockControls.js';
import {MeshBVH,acceleratedRaycast} from 'three-mesh-bvh';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Architectural exploration only: no missions, pickups, audio, or game state.
const $=id=>document.getElementById(id);
const C={sponza:'https://raw.githubusercontent.com/Breush/lava-assets/master/models/sponza.glb',floor:1.39896,upper:6.16,walk:2.7,run:6.6,eye:1.62,radius:.26,step:.28};
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
$('view').append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x09111c);scene.fog=new THREE.FogExp2(0x09111c,.005);
const camera=new THREE.PerspectiveCamera(74,innerWidth/innerHeight,.05,220);camera.rotation.order='YXZ';scene.add(camera);
const controls=new PointerLockControls(camera,renderer.domElement);
const hemi=new THREE.HemisphereLight(0xa7c5f3,0x38291d,.9);scene.add(hemi);
const moon=new THREE.DirectionalLight(0x9fbfe8,1.25);moon.position.set(-20,40,12);scene.add(moon);
const spot=new THREE.SpotLight(0xffd5a1,48,30,Math.PI/7,.6,1.5);spot.castShadow=true;spot.shadow.mapSize.set(1024,1024);spot.shadow.bias=-.00012;spot.shadow.normalBias=.025;scene.add(spot);
const aim=new THREE.Object3D();scene.add(aim);spot.target=aim;let flashOn=true;const flashQ=new THREE.Quaternion();
const world=new THREE.Group();scene.add(world);const architecture=new THREE.Group();world.add(architecture);const connector=new THREE.Group();world.add(connector);
let sponza=null,cathedral=null,collider=null,ready=false,failed=false,elapsed=0;
const keys=new Set(),velocity=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),down=new THREE.Vector3(0,-1,0),ray=new THREE.Raycaster();
let feet=C.floor,grounded=true,positionCount=0,cutCount=0,dpr=Math.min(devicePixelRatio,1.5),autoQuality=true;
const spawn=new THREE.Vector3(-7,C.floor+C.eye,0),matCache=new Map();
let stone=null,paving=null,stageText='初期化中';
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
addEventListener('keydown',e=>{if(controls.isLocked&&['KeyW','KeyA','KeyS','KeyD','Space'].includes(e.code))e.preventDefault();keys.add(e.code);if(e.code==='Escape'&&controls.isLocked)document.exitPointerLock();if(e.code==='KeyF'&&!e.repeat&&controls.isLocked){flashOn=!flashOn;spot.visible=flashOn;}});
addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>{keys.clear();if(controls.isLocked)controls.unlock();});
$('reset').onclick=()=>{reset();lock();};$('retry').onclick=()=>location.reload();
$('quality').onchange=()=>{const q=$('quality').value;autoQuality=q==='auto';dpr=q==='high'?Math.min(devicePixelRatio,1.5):q==='low'?.75:Math.min(devicePixelRatio,1.25);renderer.setPixelRatio(dpr);spot.castShadow=q!=='low';};
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
function reset(){camera.position.copy(spawn);camera.lookAt(7,C.floor+2.1,0);flashQ.copy(camera.quaternion);feet=C.floor;velocity.set(0,0,0);}

async function pbr(id,repeat=1){
 const loader=new THREE.TextureLoader();loader.setCrossOrigin('anonymous');
 const base=`https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/${id}/${id}`;
 const urls=['_diff_2k.jpg','_rough_2k.jpg','_nor_gl_2k.jpg'];
 const textures=await Promise.all(urls.map(s=>loader.loadAsync(base+s)));
 textures.forEach((t,i)=>{t.colorSpace=i===0?THREE.SRGBColorSpace:THREE.NoColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeat,repeat);t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());});
 return new THREE.MeshStandardMaterial({map:textures[0],roughnessMap:textures[1],normalMap:textures[2],normalScale:new THREE.Vector2(.45,.45),roughness:1});
}
function mesh(g,m,parent=connector){const o=new THREE.Mesh(g,m);o.castShadow=true;o.receiveShadow=true;o.frustumCulled=true;parent.add(o);return o;}
function box(w,h,d,x,y,z,m=stone,parent=connector){const o=mesh(new THREE.BoxGeometry(w,h,d),m,parent);o.position.set(x,y,z);return o;}
function rail(x1,z1,x2,z2,y,m=stone){const len=Math.hypot(x2-x1,z2-z1);const o=box(len,.16,.19,(x1+x2)/2,y+1.08,(z1+z2)/2,m);o.rotation.y=-Math.atan2(z2-z1,x2-x1);
 const n=Math.ceil(len/.85),geometry=new THREE.CylinderGeometry(.075,.10,.90,8);const posts=new THREE.InstancedMesh(geometry,m,n+1),dummy=new THREE.Object3D();posts.castShadow=posts.receiveShadow=true;
 for(let i=0;i<=n;i++){dummy.position.set(x1+(x2-x1)*i/n,y+.50,z1+(z2-z1)*i/n);dummy.updateMatrix();posts.setMatrixAt(i,dummy.matrix);}connector.add(posts);
 // Continuous physical barrier, not just the ornamental posts.
 const barrier=box(len,1.18,.15,(x1+x2)/2,y+.59,(z1+z2)/2,m);barrier.rotation.y=o.rotation.y;barrier.visible=false;barrier.userData.collisionOnly=true;
}
function angledRail(x1,y1,z1,x2,y2,z2){const length=Math.hypot(x2-x1,y2-y1,z2-z1);const geo=new THREE.CylinderGeometry(.075,.075,length,10);const o=mesh(geo,stone);o.position.set((x1+x2)/2,(y1+y2)/2+1.05,(z1+z2)/2);o.quaternion.setFromUnitVectors(up,new THREE.Vector3(x2-x1,y2-y1,z2-z1).normalize());
 const n=Math.ceil(Math.hypot(x2-x1,z2-z1)/.8);for(let i=0;i<=n;i++){const t=i/n;const p=mesh(new THREE.CylinderGeometry(.065,.09,.95,8),stone);p.position.set(x1+(x2-x1)*t,y1+(y2-y1)*t+.50,z1+(z2-z1)*t);}
 // sloped continuous safety slab, hidden only from rendering
 const b=box(length,1.1,.14,o.position.x,(y1+y2)/2+.55,o.position.z);b.rotation.z=Math.atan2(y2-y1,x2-x1);b.visible=false;b.userData.collisionOnly=true;
}
function buildStairs(){
 const start=-11,end=2.3,rise=C.upper-C.floor,steps=30;
 for(const sign of [-1,1]){
  const z=sign*3.0,width=2.1,shape=new THREE.Shape();shape.moveTo(start,C.floor-.35);shape.lineTo(end,C.floor-.35);shape.lineTo(end,C.upper);
  for(let i=steps-1;i>=0;i--){const x=start+(end-start)*i/steps,y=C.floor+rise*(i+1)/steps;shape.lineTo(x,y);shape.lineTo(x,C.floor+rise*i/steps);}shape.lineTo(start,C.floor-.35);
  const g=new THREE.ExtrudeGeometry(shape,{depth:width,bevelEnabled:false,steps:1,curveSegments:1});g.translate(0,0,z-width/2);mesh(g,stone);
  // Stone tread lips add scale and visual rhythm without separate collision physics.
  for(let i=0;i<steps;i++){const x=start+(end-start)*(i+.5)/steps,y=C.floor+rise*(i+1)/steps;box((end-start)/steps,.045,width+.12,x,y+.015,z,paving);}
  angledRail(start,C.floor,z-width/2-.09,end,C.upper,z-width/2-.09);angledRail(start,C.floor,z+width/2+.09,end,C.upper,z+width/2+.09);
  box(3,.25,3.8,3.7,C.upper-.125,sign*4.0,paving);
  rail(2.3,sign*2.1,5.2,sign*2.1,C.upper);rail(5.2,sign*2.1,5.2,sign*3.98,C.upper);
 }
 // Continuous gallery deck, above the artist's original floor (avoids z-fighting).
 box(31,.18,2.9,0,C.upper-.09,-5.45,paving);box(31,.18,2.9,0,C.upper-.09,5.45,paving);
 box(2.9,.18,8,-14.05,C.upper-.09,0,paving);box(2.9,.18,8,14.05,C.upper-.09,0,paving);
 // Courtyard edge rail; staircase landing openings only at x=2.3..5.2.
 for(const z of [-3.98,3.98]){rail(-12.6,z,2.3,z,C.upper);rail(5.2,z,12.6,z,C.upper);}
 rail(-12.6,-3.98,-12.6,3.98,C.upper);rail(12.6,-3.98,12.6,3.98,C.upper);
 rail(-15.5,-6.9,15.5,-6.9,C.upper);rail(-15.5,6.9,15.5,6.9,C.upper);rail(-15.5,-6.9,-15.5,6.9,C.upper);rail(15.5,-6.9,15.5,6.9,C.upper);
}
function arch(x,z,width=5.4,height=5.2){
 const r=width/2,th=.32;const s=new THREE.Shape();s.moveTo(-r,0);s.lineTo(-r,height-r);s.absarc(0,height-r,r,Math.PI,0,true);s.lineTo(r,0);s.lineTo(r-th,0);s.lineTo(r-th,height-r);s.absarc(0,height-r,r-th,0,Math.PI,false);s.lineTo(-r+th,0);s.closePath();
 const g=new THREE.ExtrudeGeometry(s,{depth:.36,bevelEnabled:true,bevelThickness:.025,bevelSize:.025,bevelSegments:1,curveSegments:16});const o=mesh(g,stone);o.rotation.y=Math.PI/2;o.position.set(x,C.floor,z);return o;
}
function buildBridge(){
 // One physical corridor, no teleports: x=14..62, with an open centerline.
 box(48,.32,5.4,38,C.floor-.16,0,paving);
 box(48,.3,.42,38,C.floor+4.9,-2.55,stone);box(48,.3,.42,38,C.floor+4.9,2.55,stone);
 for(let x=20;x<=58;x+=5.4)arch(x,0);
 rail(16,-2.68,60,-2.68,C.floor);rail(16,2.68,60,2.68,C.floor);
 // Lanterns are emissive geometry, not additional shadow-casting lights.
 const lantern=new THREE.MeshStandardMaterial({map:stone.map,emissive:0xffb965,emissiveIntensity:1.1,roughness:.5});
 for(let x=23;x<58;x+=10.8){box(.16,.60,.16,x,C.floor+3.8,-2.5,lantern);box(.16,.60,.16,x,C.floor+3.8,2.5,lantern);}
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
  const m=new THREE.Mesh(ng,old.material);m.name=old.name;m.castShadow=m.receiveShadow=true;m.frustumCulled=true;group.add(m);old.parent.remove(old);g.dispose();old.geometry.dispose();count++;if(count%8===0)await yieldTask();
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
function batchConnector(){
 connector.updateMatrixWorld(true);const buckets=new Map();for(const o of connector.children.slice()){if(!o.isMesh||o.isInstancedMesh||!o.visible)continue;const key=o.material.uuid+':'+Math.floor(o.position.x/12)+':'+Math.floor(o.position.z/12);if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(o);}
 for(const list of buckets.values()){if(list.length<2)continue;const gs=list.map(o=>{let g=o.geometry.clone();if(g.index){const old=g;g=g.toNonIndexed();old.dispose();}g.applyMatrix4(o.matrixWorld);return g;});const g=mergeGeometries(gs,false);gs.forEach(g=>g.dispose());if(!g)continue;g.computeBoundingSphere();const o=mesh(g,list[0].material);list.forEach(m=>{connector.remove(m);m.geometry.dispose();});}
}

function cast(origin,dir,length,first=true){if(!collider)return [];ray.set(origin,dir);ray.near=.001;ray.far=length;ray.firstHitOnly=first;return ray.intersectObject(collider,false);}
function floorAt(x,z,from,max){return cast(new THREE.Vector3(x,from,z),down,max,false).find(h=>h.face.normal.y>.62);}
function bodyClear(x,y,z){
 if(cast(new THREE.Vector3(x,y+.05,z),up,1.75).length)return false;
 for(const h of [.3,.85,1.5])for(let k=0;k<8;k++){const a=k*Math.PI/4;if(cast(new THREE.Vector3(x,y+h,z),new THREE.Vector3(Math.cos(a),0,Math.sin(a)),C.radius).length)return false;}
 return true;
}
function canMove(x,z,dyMax=C.step){const f=floorAt(x,z,feet+dyMax+.04,dyMax+.65);if(!f||f.point.y-feet>dyMax+.01||feet-f.point.y>.45)return null;return bodyClear(x,f.point.y,z)?f.point.y:null;}
function move(dt){
 const f=new THREE.Vector3();camera.getWorldDirection(f);f.y=0;f.normalize();const r=new THREE.Vector3().crossVectors(f,up);
 let x=Number(keys.has('KeyD'))-Number(keys.has('KeyA')),z=Number(keys.has('KeyW'))-Number(keys.has('KeyS'));const len=Math.hypot(x,z);if(len>1){x/=len;z/=len;}
 const speed=(keys.has('ShiftLeft')||keys.has('ShiftRight'))?C.run:C.walk;velocity.lerp(f.multiplyScalar(z*speed).addScaledVector(r,x*speed),1-Math.exp(-13*dt));
 const steps=Math.max(1,Math.ceil(velocity.length()*dt/.065));
 for(let k=0;k<steps;k++)for(const axis of ['x','z']){
  const next=camera.position.clone();const delta=velocity[axis]*dt/steps;next[axis]+=delta;if(Math.abs(delta)<1e-7)continue;
  const y=canMove(next.x,next.z);if(y===null)continue;
  let blocked=false;const dir=new THREE.Vector3();dir[axis]=Math.sign(delta);
  for(const h of [.40,.95,1.5])if(cast(new THREE.Vector3(camera.position.x,feet+h,camera.position.z),dir,Math.abs(delta)+C.radius*.8).length){blocked=true;break;}
  if(!blocked){camera.position[axis]=next[axis];feet=y;}
 }
 camera.position.y=THREE.MathUtils.damp(camera.position.y,feet+C.eye,18,dt);
}
// Culling changes rendering only. All buildings and barriers stay in the same BVH.
function updateVisibility(){if(sponza)sponza.visible=camera.position.x<64;if(cathedral)cathedral.visible=camera.position.x>23;}
async function init(){try{
 stage('石材PBR・建築モデルをロード中…');
 const texturePromise=Promise.all([pbr('castle_brick_01'),pbr('monastery_stone_floor')]).then(([a,b])=>{stone=a;paving=b;});
 const loader=new GLTFLoader();const remote=loader.loadAsync(C.sponza,e=>stage(`Sponza ${e.total?Math.round(e.loaded/e.total*100)+'%':(e.loaded/1048576).toFixed(1)+' MB'} · Sibenik大聖堂を準備中`));
 const b64=$('cathedralData').textContent.trim();const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));const local=loader.parseAsync(bytes.buffer,'');
 const [sg,cg]=await Promise.all([remote,local,texturePromise]);
 sponza=flattenScene(sg.scene);cathedral=flattenScene(cg.scene);architecture.add(sponza,cathedral);
 normalizeAsset(sponza,42,0,0);normalizeAsset(cathedral,64,90,C.floor-.02);
 stage('壁の開口・階段の接続空間を実ジオメトリで切削中…');await yieldTask();
 await bakeAndCut(sponza,[[11.7,23,C.floor+.045,C.floor+4.5,-2.40,2.40],[-11.4,2.35,C.floor+.06,C.upper+2.0,-4.18,-1.82],[-11.4,2.35,C.floor+.06,C.upper+2.0,1.82,4.18],[2.3,5.3,C.upper-.02,C.upper+1.8,-5.5,5.5]]);
 await bakeAndCut(cathedral,[[55,63,C.floor+.045,C.floor+5.4,-2.45,2.45]]);
 // Keep the original authored colors; enhance stone with linear roughness/normal data.
 cathedral.traverse(o=>{if(!o.isMesh)return;const name=o.name.toLowerCase();const m=o.material.clone();
  if(/staklo|rozeta/.test(name)){m.emissive=new THREE.Color(0x50698c);m.emissiveIntensity=.25;m.roughness=.25;}
  else {m.roughness=.9;m.metalness=0;if(!m.map)m.map=stone.map;m.normalMap=stone.normalMap;m.roughnessMap=stone.roughnessMap;m.normalScale=new THREE.Vector2(.35,.35);}o.material=m;});
 stage('重厚な双階段・2階回廊・渡り廊下を構築中…');buildStairs();buildBridge();
 stage('床・壁・階段・全周手すりのBVH当たり判定を構築中…');await buildCollision();batchConnector();
 reset();const sf=floorAt(spawn.x,spawn.z,C.floor+.4,1);if(sf){feet=sf.point.y;camera.position.y=feet+C.eye;spawn.y=camera.position.y;}
 ready=true;$('start').disabled=false;$('start').textContent='探索をはじめる';stage(`ロード完了 · Sponza ＋ Sibenik Cathedral · 約145mの連続空間 · ${Math.round(positionCount).toLocaleString()} collision triangles`);
 }catch(e){console.error(e);failed=true;stage('読込失敗：'+e.message+'\nインターネット接続と外部配信元を確認し、再読込してください。');$('retry').classList.remove('hidden');}}
const clock=new THREE.Clock();let frames=0,frameTime=0,smoothFPS=60,adaptTime=0;
function animate(){requestAnimationFrame(animate);const real=clock.getDelta(),dt=Math.min(real,.05);elapsed+=dt;if(ready&&controls.isLocked)move(dt);
 flashQ.slerp(camera.quaternion,1-Math.exp(-15*dt));const direction=new THREE.Vector3(0,0,-1).applyQuaternion(flashQ);spot.position.copy(camera.position).add(new THREE.Vector3(.15,-.13,0).applyQuaternion(camera.quaternion));aim.position.copy(spot.position).addScaledVector(direction,12);aim.updateMatrixWorld();
 updateVisibility();renderer.render(scene,camera);frames++;frameTime+=real;adaptTime+=real;
 if(frameTime>=1){const fps=frames/frameTime;smoothFPS=smoothFPS*.6+fps*.4;$('perf').innerHTML=`<b>${Math.round(fps)}</b> FPS <span>${renderer.info.render.calls} draws · ${Math.round(renderer.info.render.triangles/1000)}k tris · DPR ${dpr.toFixed(2)}</span>`;frames=0;frameTime=0;}
 if(ready&&autoQuality&&controls.isLocked&&adaptTime>3){adaptTime=0;if(smoothFPS<52&&dpr>.65){dpr=Math.max(.65,dpr-.10);renderer.setPixelRatio(dpr);}else if(smoothFPS>59&&dpr<Math.min(devicePixelRatio,1.5)){dpr=Math.min(Math.min(devicePixelRatio,1.5),dpr+.05);renderer.setPixelRatio(dpr);}}
}
reset();animate();init();
// Diagnostics are opt-in and never visible in the exploration HUD.
if(new URLSearchParams(location.search).has('debug'))window.ExplorerDebug={state:()=>({ready,failed,stage:stageText,position:camera.position.toArray(),feet,locked:controls.isLocked,sensitivity:controls.pointerSpeed,collisionTriangles:positionCount,cutCount}),teleport(x,y,z){camera.position.set(x,y+C.eye,z);feet=y;velocity.set(0,0,0);camera.lookAt(x+5,y+C.eye,z);},walk(dx,dz,seconds=1){const start=camera.position.clone();const steps=Math.ceil(seconds/.016);for(let i=0;i<steps;i++){velocity.set(dx,0,dz);const next=camera.position.clone().addScaledVector(velocity,.016);for(const axis of ['x','z']){const p=camera.position.clone();p[axis]=next[axis];const y=canMove(p.x,p.z);if(y!==null){camera.position[axis]=p[axis];feet=y;}}camera.position.y=feet+C.eye;}return {from:start.toArray(),to:camera.position.toArray(),feet};},floor(x,z,y=30){const f=floorAt(x,z,y,80);return f?f.point.toArray():null;},simulate(codes,seconds=1){keys.clear();codes.forEach(c=>keys.add(c));const count=Math.ceil(seconds/.016);for(let i=0;i<count;i++)move(.016);keys.clear();return {position:camera.position.toArray(),feet};},clear(x,y,z){return bodyClear(x,y,z);},probe(x,y,z){return {floor:floorAt(x,z,y+.32,1)?.point.toArray(),head:cast(new THREE.Vector3(x,y+.05,z),up,1.75).map(h=>h.point.toArray()),radial:[.3,.85,1.5].flatMap(h=>Array.from({length:8},(_,k)=>{const a=k*Math.PI/4;return cast(new THREE.Vector3(x,y+h,z),new THREE.Vector3(Math.cos(a),0,Math.sin(a)),C.radius).map(h=>h.point.toArray());})).flat()};},look(x,y,z){camera.lookAt(x,y,z);},reset};
