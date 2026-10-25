from pathlib import Path
p=Path('/home/user/grand_explorer/main.js');s=p.read_text()
s=s.replace("import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';\n",'')
s=s.replace("upper:6.16,walk:2.7,run:6.6,eye:1.62,radius:.26,step:.28", "upper:6.16,walk:2.7,run:6.6,eye:1.62,height:1.8,radius:.26,step:.4,gravity:22,jumpSpeed:6.5,seam:14.35")
s=s.replace("{antialias:true,powerPreference:'high-performance'}", "{antialias:true,powerPreference:'high-performance',logarithmicDepthBuffer:false}")
s=s.replace('new THREE.PerspectiveCamera(74,innerWidth/innerHeight,.05,220)', 'new THREE.PerspectiveCamera(70,window.innerWidth/window.innerHeight,0.2,300)')
s=s.replace('const connector=new THREE.Group();world.add(connector);','')
s=s.replace('let feet=C.floor,grounded=true,', 'let feet=C.floor,grounded=true,verticalVelocity=0,jumpRequested=false,')
s=s.replace("keys.add(e.code);if(e.code==='Escape'", "keys.add(e.code);if(e.code==='Space'&&!e.repeat&&controls.isLocked){e.preventDefault();jumpRequested=true;}if(e.code==='Escape'")
s=s.replace("feet=C.floor;velocity.set(0,0,0);", "feet=C.floor;grounded=true;verticalVelocity=0;jumpRequested=false;velocity.set(0,0,0);")
a=s.index('function mesh(');b=s.index('// Exact AABB subtraction',a);s=s[:a]+s[b:]
a=s.index('function batchConnector()');b=s.index('function cast(',a);s=s[:a]+s[b:]
a=s.index('function bodyClear(');b=s.index('// Culling changes rendering only.',a)
s=s[:a]+'''// Capsule-like ray sweeps: only native architecture is present in the BVH.
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
''' +s[b:]
s=s.replace('if(sponza)sponza.visible=camera.position.x<64;if(cathedral)cathedral.visible=camera.position.x>23;', 'if(sponza)sponza.visible=camera.position.x<52;if(cathedral)cathedral.visible=camera.position.x>-18;')
s=s.replace('normalizeAsset(cathedral,64,90,C.floor-.02)', 'normalizeAsset(cathedral,64,45.3,C.floor-.0195536)')
a=s.index(' await bakeAndCut(sponza,');b=s.index(' // Keep the original',a)
s=s[:a]+''' // Each model owns one side of the seam. Trim geometry, not depth-bias:
 // this removes overlap from rendering AND from the native-mesh collision BVH.
 await bakeAndCut(sponza,[[C.seam,10000,-10000,10000,-10000,10000],[11.7,C.seam,C.floor+.045,C.floor+4.5,-2.40,2.40]]);
 await bakeAndCut(cathedral,[[-10000,C.seam,-10000,10000,-10000,10000],[C.seam,19,C.floor+.045,C.floor+5.4,-2.45,2.45]]);
''' +s[b:]
s=s.replace(" stage('重厚な双階段・2階回廊・渡り廊下を構築中…');buildStairs();buildBridge();", " stage('生成床なし：モデル本来の床・壁・階段を解析中…');")
s=s.replace("stage('床・壁・階段・全周手すりのBVH当たり判定を構築中…')", "stage('モデル本来の床・壁・階段のBVHを構築中…')")
s=s.replace('await buildCollision();batchConnector();', 'await buildCollision();')
s=s.replace('約145mの連続空間','二重床なし · 直接接続された建築空間')
s=s.replace('次へ','次へ')
a=s.index('if(new URLSearchParams(location.search)');s=s[:a]+'''if(new URLSearchParams(location.search).has('debug'))window.ExplorerDebug={
 state:()=>({ready,failed,stage:stageText,position:camera.position.toArray(),feet,grounded,verticalVelocity,locked:controls.isLocked,sensitivity:controls.pointerSpeed,collisionTriangles:positionCount,cutCount,near:camera.near,far:camera.far,fov:camera.fov,generatedMeshes:world.children.filter(c=>c!==architecture).length}),
 teleport(x,y,z){camera.position.set(x,y+C.eye,z);feet=y;grounded=true;verticalVelocity=0;jumpRequested=false;velocity.set(0,0,0);camera.lookAt(x+5,y+C.eye,z);},
 floor(x,z,y=30){const f=floorAt(x,z,y,100);return f?f.point.toArray():null;},
 simulate(codes,seconds=1){keys.clear();codes.forEach(c=>keys.add(c));const count=Math.ceil(seconds/.008);for(let i=0;i<count;i++)move(.008);keys.clear();return this.state();},
 jump(){jumpRequested=true;},
 trajectory(seconds=1,repeat=false){const values=[];for(let i=0;i<Math.ceil(seconds/.008);i++){if(repeat&&i%8===0)jumpRequested=true;move(.008);values.push({feet,grounded,verticalVelocity});}return values;},
 clear(x,y,z){return bodyClear(x,y,z);},look(x,y,z){camera.lookAt(x,y,z);},reset
};
'''
p.write_text(s)
