import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// These maps are authored in meters. Their portals are actual apertures in
// the architectural walls, not door props pasted onto a finished model.
export function createBuilders(materials){
 const {stone,wood,paving,metal}=materials;
 function mesh(root,g,m,x=0,y=0,z=0){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;root.add(o);return o;}
 function box(root,w,h,d,x,y,z,m=wood){const g=new THREE.BoxGeometry(w,h,d),uv=g.attributes.uv,p=g.attributes.position,n=g.attributes.normal;
  for(let i=0;i<p.count;i++){const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i));uv.setXY(i,ny>.5?p.getX(i)/1.4:nx>.5?p.getZ(i)/1.2:p.getX(i)/1.2,ny>.5?p.getZ(i)/1.4:p.getY(i)/1.5);}return mesh(root,g,m,x,y,z);}
 function extrude(root,shape,depth,material,position,rotation=0){const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:24});const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)/1.3,uv.getY(i)/1.3);const o=mesh(root,g,material,...position);o.rotation.y=rotation;return o;}
 function archRing(root,width,height,position,rotation=0,material=stone){const r=width/2,t=.15,spring=height-r,s=new THREE.Shape();s.moveTo(-r-t,0);s.lineTo(-r-t,spring);s.absarc(0,spring,r+t,Math.PI,0,true);s.lineTo(r+t,0);s.lineTo(r,0);s.lineTo(r,spring);s.absarc(0,spring,r,0,Math.PI,false);s.lineTo(-r,0);s.closePath();extrude(root,s,.20,material,position,rotation);}
 function wall(root,length,height,position,rotation=0,opening=null){
  const half=length/2;
  if(!opening){const s=new THREE.Shape();s.moveTo(-half,0);s.lineTo(half,0);s.lineTo(half,height);s.lineTo(-half,height);s.closePath();extrude(root,s,.24,stone,position,rotation);return;}
  const {center=0,width=1.65,top=2.65}=opening,r=width/2,spring=top-r;
  for(const [a,b] of [[-half,center-r],[center+r,half]]){if(b<=a)continue;const s=new THREE.Shape();s.moveTo(a,0);s.lineTo(b,0);s.lineTo(b,height);s.lineTo(a,height);s.closePath();extrude(root,s,.24,stone,position,rotation);}
  const crown=new THREE.Shape();crown.moveTo(center-r,spring);crown.absarc(center,spring,r,Math.PI,0,true);crown.lineTo(center+r,height);crown.lineTo(center-r,height);crown.closePath();extrude(root,crown,.24,stone,position,rotation);
  const base=new THREE.Vector3(center,0,0).applyAxisAngle(new THREE.Vector3(0,1,0),rotation).add(new THREE.Vector3(...position));archRing(root,width,top,base.toArray(),rotation);
 }
 function floorProfile(root,width,profile){const p=[],uv=[];const add=(a,b,c)=>{for(const v of [a,b,c]){p.push(...v);uv.push(v[0]/2,v[2]/2);}};
  for(let i=0;i<profile.length-1;i++){const [z0,y0]=profile[i],[z1,y1]=profile[i+1];add([-width/2,y0,z0],[-width/2,y1,z1],[width/2,y1,z1]);add([-width/2,y0,z0],[width/2,y1,z1],[width/2,y0,z0]);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();const o=mesh(root,g,paving);o.name='NativeFloor';return o;
 }
 function vault(root,width,length){const p=[],uv=[],r=width/2,steps=32,spring=2.15,rise=1.20;const add=(a,b,c)=>{for(const v of[a,b,c]){p.push(...v);uv.push(v[0]/1.4,v[2]/1.4);}};
  for(let i=0;i<steps;i++){const a=i/steps*Math.PI,b=(i+1)/steps*Math.PI;const q0=[Math.cos(a)*r,spring+Math.sin(a)*rise,0],q1=[Math.cos(b)*r,spring+Math.sin(b)*rise,0],q2=[q1[0],q1[1],length],q3=[q0[0],q0[1],length];add(q0,q2,q1);add(q0,q3,q2);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();const m=stone.clone();m.side=THREE.DoubleSide;mesh(root,g,m);
  // End-to-end elliptical stone ribs, integrated into the vault geometry.
  const pathPoints=[];for(let i=0;i<=32;i++){const a=i/32*Math.PI;pathPoints.push(new THREE.Vector3(Math.cos(a)*r,2.15+Math.sin(a)*1.20,0));}
  for(let z=.20;z<length;z+=4.8){const curve=new THREE.CatmullRomCurve3(pathPoints),g=new THREE.TubeGeometry(curve,36,.075,7,false);mesh(root,g,stone,0,-.02,z);}
 }
 const flameMat=new THREE.MeshStandardMaterial({color:0xffd39c,emissive:0xffa041,emissiveIntensity:2.2,roughness:.7});
 function sconce(root,x,z,side=1,y=2.12){box(root,.07,.38,.16,x,y,z,metal);const arm=mesh(root,new THREE.CylinderGeometry(.023,.028,.28,8),metal,x-side*.12,y-.08,z);arm.rotation.z=Math.PI/2;
  const candle=mesh(root,new THREE.CylinderGeometry(.038,.043,.18,10),wood,x-side*.24,y+.04,z);const flame=mesh(root,new THREE.SphereGeometry(.033,8,6),flameMat,x-side*.24,y+.17,z);flame.scale.y=1.8;flame.castShadow=false;
  root.userData.lamps.push([x-side*.24,y+.22,z]);
 }
 function batch(root){root.updateMatrixWorld(true);const buckets=new Map();for(const m of root.children.slice()){if(!m.isMesh||m.isInstancedMesh||Array.isArray(m.material))continue;const k=m.material.uuid+':'+Math.floor(m.position.x/6)+':'+Math.floor(m.position.z/7);if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(m);}
  for(const list of buckets.values()){if(list.length<2)continue;const gs=list.map(o=>{let g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrixWorld);return g;});const g=mergeGeometries(gs);gs.forEach(g=>g.dispose());if(!g)continue;g.computeBoundingSphere();const m=mesh(root,g,list[0].material);list.forEach(o=>{root.remove(o);o.geometry.dispose();});}
 }
 function corridor(){const root=new THREE.Group();root.name='Long Corridor — integrated architectural portals';root.userData.lamps=[];
  floorProfile(root,4.4,[[0,0],[42,0]]);vault(root,4.4,42);
  wall(root,16,3.45,[2.2,0,8],-Math.PI/2,{center:4,width:1.70,top:2.75});wall(root,26,3.45,[2.2,0,29],-Math.PI/2,{center:-9,width:1.70,top:2.75});
  wall(root,32.5,3.45,[-2.2,0,16.25],Math.PI/2,{center:16.25-28.8,width:1.70,top:2.75});wall(root,9.5,3.45,[-2.2,0,37.25],Math.PI/2,{center:1.05,width:1.70,top:2.75});
  wall(root,4.4,3.45,[0,0,0],0,{center:0,width:1.95,top:2.85});wall(root,4.4,3.45,[0,0,42],Math.PI);
  // Two shallow stone vestibules are actual parts of this map, not door decals.
  for(const [x,z,sign] of [[2.2,12,1],[-2.2,28.8,-1],[2.2,20,1]]){
   box(root,1.1,3.0,.20,x+sign*.5,1.5,z-.96,stone);box(root,1.1,3.0,.20,x+sign*.5,1.5,z+.96,stone);box(root,.22,3,2.12,x+sign*1.1,1.5,z,stone);
   // A single floor piece only in the vestibule extension; it does not overlap the hall floor.
   const g=new THREE.PlaneGeometry(1.1,1.72);g.rotateX(-Math.PI/2);mesh(root,g,paving,x+sign*.55,.0,z);
  }
  const stairProfile=[[0,0]];for(let k=0;k<12;k++){stairProfile.push([(k+1)*.32,-k*.16],[(k+1)*.32,-(k+1)*.16]);}stairProfile.push([5.0,-1.92]);const stair=floorProfile(root,1.70,stairProfile);stair.rotation.y=-Math.PI/2;stair.position.set(-2.2,0,36.2);
  for(const dz of[-.97,.97])box(root,5.0,4.2,.22,-4.7,.18,36.2+dz,stone);box(root,5.0,.15,2.1,-4.7,2.2,36.2,stone);
  wall(root,2.1,4.2,[-7.2,-1.92,36.2],Math.PI/2,{width:1.6,top:2.65});
  function blackArch(x,y,z,rotation){const sh=new THREE.Shape();sh.moveTo(-.79,0);sh.lineTo(.79,0);sh.lineTo(.79,1.86);sh.absarc(0,1.86,.79,0,Math.PI,false);sh.closePath();const o=mesh(root,new THREE.ShapeGeometry(sh,24),new THREE.MeshBasicMaterial({color:0x000000,side:THREE.DoubleSide}),x,y,z);o.rotation.y=rotation;o.userData.noCollision=true;}
  blackArch(2.26,0,12,Math.PI/2);blackArch(2.26,0,20,Math.PI/2);blackArch(-2.26,0,28.8,Math.PI/2);blackArch(-7.12,-1.92,36.2,Math.PI/2);
  for(let z=3;z<41;z+=4.8){sconce(root,1.95,z,1);sconce(root,-1.95,z,-1);}
  root.userData.portals=[
   {id:'courtyard',kind:'return',target:'hub',label:'中庭（Sponza）へ戻る',position:[0,1.25,.22],stand:[0,0,1.65],size:[1.9,2.5,.65]},
   {id:'library',kind:'enter',target:'library',label:'大図書館（Grand Library）へ',position:[2.22,1.25,12],stand:[1.0,0,12],size:[.65,2.5,1.6]},
   {id:'myroom',kind:'enter',target:'myroom',label:'黒アーチ：自分の部屋へ',position:[2.22,1.25,20],stand:[1,0,20],size:[.65,2.5,1.6]},
   {id:'dungeon',kind:'enter',target:'dungeon',label:'石階段の下：地下探索へ',position:[-7.08,-.72,36.2],stand:[-6.25,-1.92,36.2],size:[.65,2.5,1.6]},
   {id:'lounge',kind:'enter',target:'lounge',label:'城の休憩室（Castle Lounge）へ',position:[-2.22,1.25,28.8],stand:[-1.0,0,28.8],size:[.65,2.5,1.6]}
  ];root.userData.spawnLocal=[0,0,2.0];root.userData.lookLocal=[0,1.65,8];batch(root);return root;
 }
 function library(){const root=new THREE.Group();root.name='Grand Library — PBR authored in meters';root.userData.lamps=[];
  // One continuous native floor with three 0.15 m steps and a reading dais.
  floorProfile(root,14,[[0,0],[15.5,0],[15.5,.15],[15.95,.15],[15.95,.30],[16.4,.30],[16.4,.45],[20,.45]]);
  wall(root,14,3.45,[0,0,0],0,{center:0,width:2.0,top:2.75});wall(root,14,3.45,[0,0,20],Math.PI);
  wall(root,20,3.45,[7,0,10],-Math.PI/2);wall(root,20,3.45,[-7,0,10],Math.PI/2);
  // Timber coffers and stone transverse arches; ceiling never exceeds 3.45 m.
  box(root,14,.10,20,0,3.40,10,wood);
  for(let z=1.5;z<20;z+=3.4){box(root,14,.15,.16,0,3.24,z,wood);for(const x of[-6.65,6.65]){box(root,.20,3.25,.22,x,1.625,z,stone);sconce(root,x-sideSign(x)*.16,z,sideSign(x),2.5);}}
  const placements=[];
  function bookcase(x,z,rotation=0,y=0){const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rotation;root.add(g);
   box(g,1.85,2.45,.075,0,1.225,-.23,wood);for(const sx of[-.94,.94])box(g,.12,2.52,.48,sx,1.26,0,wood);
   for(let row=0;row<7;row++)box(g,1.90,.065,.48,0,.14+row*.355,0,wood);
   box(g,2.06,.13,.56,0,2.52,0,wood);
   for(let row=0;row<6;row++)for(let k=0;k<16;k++)placements.push({group:g,x:-.83+k*.109,y:.19+row*.355,z:.11,w:.067+(k%3)*.013,h:.22+((k*3+row)%5)*.016,style:(k+row*5+Math.round(z*2))%16});
   return g;
  }
  for(const x of[-6.44,6.44])for(let z=2.5;z<15;z+=2.35)bookcase(x,z,x>0?-Math.PI/2:Math.PI/2);
  // Freestanding reference stacks keep a wide, clear central walking axis.
  for(const x of[-3.8,3.8])for(const z of[7,11.8]){bookcase(x,z,0);bookcase(x,z-.55,Math.PI);}
  for(const x of[-5.0,-2.5,2.5,5])bookcase(x,19.2,0,.45);
  function desk(x,z,y=0){const top=box(root,2.1,.07,.90,x,y+.765,z,wood);top.name='HumanDesk';for(const dx of[-.88,.88])for(const dz of[-.31,.31]){const leg=mesh(root,new THREE.CylinderGeometry(.035,.052,.73,10),wood,x+dx,y+.365,z+dz);}
   // Curved-back chairs, measured seat 0.45 m and table top 0.80 m.
   for(const dz of[-.88,.88]){const chair=new THREE.Group();chair.position.set(x,y,z+dz);root.add(chair);box(chair,.43,.065,.45,0,.4175,0,wood);for(const a of[-.17,.17])for(const b of[-.17,.17])box(chair,.035,.42,.035,a,.21,b,wood);const sign=Math.sign(dz);for(const a of[-.18,.18])box(chair,.035,.50,.035,a,.68,sign*.19,wood);box(chair,.40,.20,.05,0,.86,sign*.19,wood);}
  }
  desk(-1.5,5);desk(1.5,10);desk(-1.8,18,.45);desk(1.8,18,.45);
  root.updateMatrixWorld(true);
  // Textured book-spine atlas. Sixteen instanced batches, not thousands of draws.
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;const ctx=canvas.getContext('2d');const colors=['#5a2528','#30443b','#6d5236','#334253','#71523d','#4a3549','#746743','#283e42'];
  for(let i=0;i<16;i++){const x=i*64;ctx.fillStyle=colors[i%8];ctx.fillRect(x,0,64,256);for(let k=0;k<180;k++){ctx.fillStyle=`rgba(15,8,2,${.02+(k%5)*.015})`;ctx.fillRect(x+(k*17)%64,(k*29)%256,1,3);}ctx.fillStyle='#b49b63';for(const y of[16,26,220,230])ctx.fillRect(x+4,y,56,2);ctx.font='14px serif';ctx.textAlign='center';ctx.fillText('ARCHIVE',x+32,70);ctx.fillText(String(i+1).padStart(2,'0'),x+32,105);ctx.font='10px serif';ctx.fillText('VOLUME',x+32,144);}
  const atlas=new THREE.CanvasTexture(canvas);atlas.colorSpace=THREE.SRGBColorSpace;atlas.wrapS=atlas.wrapT=THREE.RepeatWrapping;
  const geometry=new THREE.BoxGeometry(1,1,1),dummy=new THREE.Object3D(),matrix=new THREE.Matrix4();
  for(let style=0;style<16;style++){const selected=placements.filter(p=>((p.style%16)+16)%16===style),map=atlas.clone();map.repeat.set(1/16,1);map.offset.x=style/16;map.needsUpdate=true;
   const material=new THREE.MeshStandardMaterial({map,roughness:.92,normalMap:wood.normalMap,normalScale:new THREE.Vector2(.1,.1)});const books=new THREE.InstancedMesh(geometry.clone(),material,selected.length);books.userData.noCollision=true;books.castShadow=books.receiveShadow=true;
   selected.forEach((p,i)=>{dummy.position.set(p.x,p.y+p.h/2,p.z);dummy.scale.set(p.w,p.h,.24);dummy.rotation.set(0,0,((i%7)-3)*.008);dummy.updateMatrix();matrix.multiplyMatrices(p.group.matrixWorld,dummy.matrix);books.setMatrixAt(i,matrix);});root.add(books);
  }
  // Flatten/merge the architectural furniture, while keeping book instancing.
  const flattened=new THREE.Group();flattened.userData=root.userData;flattened.name=root.name;root.updateMatrixWorld(true);root.traverse(o=>{if(!o.isMesh)return;if(o.isInstancedMesh){flattened.add(o.clone());return;}const m=new THREE.Mesh(o.geometry.clone().applyMatrix4(o.matrixWorld),o.material);m.castShadow=m.receiveShadow=true;m.name=o.name;flattened.add(m);});
  // Keep the scale reference independent of merged mesh naming.
  flattened.userData.tableHeight=.80;flattened.userData.portals=[{id:'return',kind:'return',target:'corridor',label:'大回廊へ戻る',position:[0,1.25,.20],stand:[0,0,1.7],size:[1.9,2.5,.65]}];flattened.userData.spawnLocal=[0,0,2.0];flattened.userData.lookLocal=[0,1.65,8];batch(flattened);return flattened;
 }
 function lounge(){const root=new THREE.Group();root.name='Castle Lounge — integrated PBR architecture';root.userData.lamps=[];
  floorProfile(root,6.4,[[0,0],[11,0]]);vault(root,6.4,11);
  wall(root,6.4,3.45,[0,0,0],0,{center:0,width:1.95,top:2.75});wall(root,6.4,3.45,[0,0,11],Math.PI);
  wall(root,11,3.45,[3.2,0,5.5],-Math.PI/2);wall(root,11,3.45,[-3.2,0,5.5],Math.PI/2);
  const clothCanvas=document.createElement('canvas');clothCanvas.width=clothCanvas.height=128;const ctx=clothCanvas.getContext('2d');ctx.fillStyle='#46534d';ctx.fillRect(0,0,128,128);for(let i=0;i<128;i++){ctx.strokeStyle=i%2?'#52605a':'#3f4a44';ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,128);ctx.stroke();ctx.globalAlpha=.3;ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(128,i);ctx.stroke();ctx.globalAlpha=1;}const tex=new THREE.CanvasTexture(clothCanvas);tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(4,4);const cloth=new THREE.MeshStandardMaterial({map:tex,roughness:.98});
  for(const x of[-2.95,2.95])for(const z of[2.6,6.0,9.5]){sconce(root,x,z,sideSign(x),2.25);box(root,.14,2.35,.22,x,1.175,z,stone);}
  function sofa(x,z){for(const dx of[-.76,.76])for(const dz of[-.26,.26])mesh(root,new THREE.CylinderGeometry(.035,.045,.21,10),wood,x+dx,.105,z+dz);box(root,1.95,.19,.82,x,.285,z,wood);for(const dx of[-.48,.48]){const c=box(root,.92,.15,.69,x+dx,.435,z,cloth);c.geometry.dispose();c.geometry=new THREE.BoxGeometry(.92,.15,.69,3,2,3);}box(root,1.78,.55,.14,x,.73,z+.35,cloth);for(const dx of[-.94,.94])box(root,.13,.42,.85,x+dx,.55,z,wood);}
  // Measured seat 0.51 m; adult-height round tea tables (top 0.80 m).
  for(const x of[-1.72,1.72]){sofa(x,7.4);const top=mesh(root,new THREE.CylinderGeometry(.62,.62,.065,48),wood,x,.7675,5.95);top.name='HumanDesk';mesh(root,new THREE.CylinderGeometry(.06,.11,.73,16),metal,x,.365,5.95);mesh(root,new THREE.CylinderGeometry(.38,.42,.045,32),metal,x,.0225,5.95);
   for(const dx of[-.20,.20]){const cup=mesh(root,new THREE.LatheGeometry([new THREE.Vector2(.026,0),new THREE.Vector2(.035,.008),new THREE.Vector2(.038,.075),new THREE.Vector2(.032,.078),new THREE.Vector2(.030,.014)],16),metal,x+dx,.80,5.95);const handle=mesh(root,new THREE.TorusGeometry(.024,.006,7,12),metal,x+dx+.04,.842,5.95);}
  }
  // Carved timber refreshment cabinet, waist-height worktop and brass details.
  box(root,3.2,.70,.57,0,.35,10.45,wood);box(root,3.34,.10,.68,0,.75,10.45,wood);for(const x of[-1.1,0,1.1]){box(root,.94,.53,.045,x,.37,10.13,wood);mesh(root,new THREE.SphereGeometry(.025,8,6),metal,x,.40,10.09);}
  for(const x of[-2.8,2.8]){box(root,.38,1.1,.44,x,.55,10.3,stone);mesh(root,new THREE.SphereGeometry(.14,16,12),metal,x,1.23,10.3);}
  root.userData.tableHeight=.8;root.userData.portals=[{id:'return',kind:'return',target:'corridor',label:'大回廊へ戻る',position:[0,1.25,.20],stand:[0,0,1.7],size:[1.9,2.5,.65]}];root.userData.spawnLocal=[0,0,2];root.userData.lookLocal=[0,1.65,8];batch(root);return root;
 }
 function myroom(){const root=new THREE.Group();root.name='My Room — authored PBR + official SheenChair';root.userData.lamps=[];
  floorProfile(root,8,[[0,0],[12,0]]);wall(root,8,3.45,[0,0,0],0,{width:1.9,top:2.75});wall(root,8,3.45,[0,0,12],Math.PI);wall(root,12,3.45,[4,0,6],-Math.PI/2);wall(root,12,3.45,[-4,0,6],Math.PI/2);
  box(root,8,.10,12,0,3.4,6,wood);for(let z=.7;z<12;z+=2.1){box(root,8,.15,.18,0,3.20,z,wood);for(const x of[-3.7,3.7]){box(root,.15,3.2,.18,x,1.6,z,stone);sconce(root,x,z,sideSign(x),2.25);}}
  const fabric=new THREE.MeshStandardMaterial({color:0x493128,roughness:.98,map:wood.map,normalMap:wood.normalMap,normalScale:new THREE.Vector2(.06,.06)}),linen=new THREE.MeshStandardMaterial({color:0xc0b49a,roughness:1,map:paving.map});
  // Full-size canopy bed: 1.65 x 2.2 m, mattress top 0.58 m.
  box(root,1.85,.24,2.5,-2.0,.26,8.8,wood);box(root,1.65,.26,2.2,-2.0,.45,8.8,linen);box(root,1.68,.04,1.5,-2.0,.60,8.6,fabric);
  for(const x of[-2.86,-1.14])for(const z of[7.64,9.96]){mesh(root,new THREE.CylinderGeometry(.045,.065,2.55,14),wood,x,1.275,z);mesh(root,new THREE.SphereGeometry(.085,12,8),metal,x,2.62,z);}
  box(root,2.0,.12,2.6,-2.0,2.55,8.8,wood);box(root,1.98,.055,2.57,-2.0,2.63,8.8,fabric);box(root,1.7,.85,.10,-2.0,.8,9.9,wood);
  for(const x of[-2.4,-1.6]){const pillow=box(root,.61,.13,.4,x,.65,9.5,linen);pillow.rotation.y=.05;}
  const desk=box(root,2.1,.08,.85,.5,.76,6.8,wood);desk.name='HumanDesk';for(const x of[-.38,1.38])for(const z of[6.5,7.1])box(root,.075,.72,.075,x,.36,z,wood);for(let i=0;i<6;i++)box(root,.31,.04,.24,.9,.82+i*.04,6.85,i%2?fabric:wood);
  // Stone fireplace, chimney breast and recessed hearth; no extra shadow light.
  for(const x of[1.75,3.35])box(root,.26,1.28,.62,x,.64,10.9,stone);box(root,1.86,.2,.74,2.55,1.29,10.9,stone);box(root,1.65,.12,.78,2.55,.06,10.9,stone);box(root,1.45,1.3,.08,2.55,.72,11.17,metal);box(root,1.25,1.85,.4,2.55,2.25,11.05,stone);
  const ember=new THREE.MeshStandardMaterial({color:0x862f12,emissive:0xff5f15,emissiveIntensity:1.2,roughness:1});for(let i=0;i<4;i++){const log=mesh(root,new THREE.CylinderGeometry(.055,.07,.68,9),wood,2.3+i*.16,.18,10.85);log.rotation.z=Math.PI/2;const flame=mesh(root,new THREE.ConeGeometry(.11,.36,7),ember,2.2+i*.23,.35,10.84);flame.castShadow=false;}
  root.userData.lamps.push([2.55,.65,10.5]);root.userData.tableHeight=.8;root.userData.portals=[{id:'return',kind:'return',target:'corridor',label:'大回廊へ戻る',position:[0,1.25,.20],stand:[0,0,1.7],size:[1.9,2.5,.65]}];root.userData.spawnLocal=[0,0,2];root.userData.lookLocal=[0,1.65,7];batch(root);return root;
 }
 function sideSign(x){return x>0?1:-1;}
 return {corridor,library,lounge,myroom};
}
