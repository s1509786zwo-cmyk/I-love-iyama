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
  wall(root,16,3.45,[2.2,0,8],-Math.PI/2);wall(root,26,3.45,[2.2,0,29],-Math.PI/2,{center:-9,width:1.70,top:2.75});
  wall(root,32.5,3.45,[-2.2,0,16.25],Math.PI/2,{center:16.25-20,width:1.70,top:2.75});wall(root,9.5,3.45,[-2.2,0,37.25],Math.PI/2,{center:1.05,width:1.70,top:2.75});
  wall(root,4.4,3.45,[0,0,0],0,{center:0,width:1.95,top:2.85});wall(root,4.4,3.45,[0,0,42],Math.PI);
  // Two shallow stone vestibules are actual parts of this map, not door decals.
  for(const [x,z,sign] of [[-2.2,20,-1],[2.2,20,1]]){
   box(root,1.1,3.0,.20,x+sign*.5,1.5,z-.96,stone);box(root,1.1,3.0,.20,x+sign*.5,1.5,z+.96,stone);box(root,.22,3,2.12,x+sign*1.1,1.5,z,stone);
   // A single floor piece only in the vestibule extension; it does not overlap the hall floor.
   const g=new THREE.PlaneGeometry(1.1,1.72);g.rotateX(-Math.PI/2);mesh(root,g,paving,x+sign*.55,.0,z);
  }
  const stairProfile=[[0,0]];for(let k=0;k<12;k++){stairProfile.push([(k+1)*.32,-k*.16],[(k+1)*.32,-(k+1)*.16]);}stairProfile.push([5.0,-1.92]);const stair=floorProfile(root,1.70,stairProfile);stair.rotation.y=-Math.PI/2;stair.position.set(-2.2,0,36.2);
  for(const dz of[-.97,.97])box(root,5.0,4.2,.22,-4.7,.18,36.2+dz,stone);box(root,5.0,.15,2.1,-4.7,2.2,36.2,stone);
  wall(root,2.1,4.2,[-7.2,-1.92,36.2],Math.PI/2,{width:1.6,top:2.65});
  function blackArch(x,y,z,rotation){const sh=new THREE.Shape();sh.moveTo(-.79,0);sh.lineTo(.79,0);sh.lineTo(.79,1.86);sh.absarc(0,1.86,.79,0,Math.PI,false);sh.closePath();const o=mesh(root,new THREE.ShapeGeometry(sh,24),new THREE.MeshBasicMaterial({color:0x000000,side:THREE.DoubleSide}),x,y,z);o.rotation.y=rotation;o.userData.noCollision=true;}
  blackArch(2.26,0,20,Math.PI/2);blackArch(-2.26,0,20,Math.PI/2);blackArch(-7.12,-1.92,36.2,Math.PI/2);
  for(let z=3;z<41;z+=4.8){sconce(root,1.95,z,1);sconce(root,-1.95,z,-1);}
  root.userData.portals=[
   {id:'courtyard',kind:'return',target:'hub',label:'中庭（Sponza）へ戻る',position:[0,1.25,.22],stand:[0,0,1.65],size:[1.9,2.5,.65]},
   {id:'wine',kind:'enter',target:'wine',label:'黒アーチ：外部ワインバーへ',position:[2.22,1.25,20],stand:[1,0,20],size:[.65,2.5,1.6]},
   {id:'breakfast',kind:'enter',target:'breakfast',label:'反対側：The Breakfast Roomへ',position:[-2.22,1.25,20],stand:[-1,0,20],size:[.65,2.5,1.6]},
   {id:'cellar',kind:'enter',target:'wine',label:'石階段の底：外部ワインバーへ',position:[-7.08,-.72,36.2],stand:[-6.25,-1.92,36.2],size:[.65,2.5,1.6]}
  ];root.userData.spawnLocal=[0,0,2.0];root.userData.lookLocal=[0,1.65,8];batch(root);return root;
 }
 return {corridor};
}
