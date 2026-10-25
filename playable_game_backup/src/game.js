(function(){
'use strict';
/* ============================================================
   耳が飾りになるまで - プレイ可能プロトタイプ
   Three.js製 一人称探索ホラー
   ============================================================ */
const $ = id => document.getElementById(id);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const dist2=(ax,az,bx,bz)=>{const dx=ax-bx,dz=az-bz;return dx*dx+dz*dz;};

const els={
  game:$('game'),hud:$('hud'),objective:$('objectiveText'),noteCount:$('noteCount'),keyState:$('keyState'),
  prompt:$('prompt'),toast:$('toast'),listen:$('listenHint'),flash:$('flashState'),
  title:$('titleScreen'),pause:$('pauseScreen'),noteScreen:$('noteScreen'),noteTitle:$('noteTitle'),noteBody:$('noteBody'),
  end:$('endScreen'),endTitle:$('endTitle'),endText:$('endText'),endStats:$('endStats'),endFace:$('endFace'),
  jumpscare:$('jumpscare'),danger:$('dangerVignette'),touch:$('touchControls')
};
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints>0;

let renderer,scene,camera,clock;
let mode='title'; // title, playing, paused, reading, ended
let elapsedPlay=0;
const player={pos:new THREE.Vector3(0,0,6.9),vel:new THREE.Vector3(),yaw:0,pitch:0,roll:0,radius:.32,stepAcc:0,bob:0};
const keys={};
let flashOn=true,flashQuat=null,spot=null,spotTarget=null,flickerTimer=0;
let notesFound=0,hasKey=false,keySpawned=false,huntActive=false,dollGone=false,dollHeadAwake=false;
let currentInteract=null,interactTimer=0,toastTimer=0,pendingToast='',whisperTimer=6,heartbeatTimer=0,listenPing=0;
let pendingAfterNote=null;

const colliders=[];       // {minX,maxX,minZ,maxZ,door?}
const occluders=[];       // meshes for line-of-sight
const hitMeshes=[];       // interact hit proxies
const doors=[];
const notes=[];
let doll=null,dollHead=null,dollState={path:[],pathIdx:0,recalc:0,speed:2.55,seen:false};
let candleLight=null,candleFlames=[];
let keyMesh=null,butsudanPos=new THREE.Vector3(5.5,1,-6.7),exitPos=new THREE.Vector3(0,1,7.9);

/* ---------------- textures (procedural) ---------------- */
function makeTex(w,h,draw){
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const g=c.getContext('2d');draw(g,w,h);
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.encoding=THREE.sRGBEncoding;t.anisotropy=4;return t;
}
function noiseOver(g,w,h,n,alpha,dark){
  for(let i=0;i<n;i++){g.fillStyle=dark?`rgba(20,12,5,${Math.random()*alpha})`:`rgba(255,250,230,${Math.random()*alpha})`;g.fillRect(Math.random()*w,Math.random()*h,1+Math.random()*3,1+Math.random()*3);}
}
const texWood=makeTex(512,512,(g,w,h)=>{
  g.fillStyle='#6d482a';g.fillRect(0,0,w,h);
  for(let y=0;y<h;y+=64){g.fillStyle=y%128?'#75502f':'#624023';g.fillRect(0,y,w,62);g.fillStyle='rgba(20,10,2,.75)';g.fillRect(0,y+62,w,3);}
  for(let i=0;i<260;i++){g.strokeStyle=`rgba(35,18,6,${.08+Math.random()*.18})`;g.lineWidth=1;g.beginPath();const y=Math.random()*h;g.moveTo(0,y);g.bezierCurveTo(w*.3,y+Math.random()*6-3,w*.7,y+Math.random()*6-3,w,y);g.stroke();}
  noiseOver(g,w,h,900,.10,true);
});
const texDarkWood=makeTex(512,512,(g,w,h)=>{g.fillStyle='#3d2817';g.fillRect(0,0,w,h);for(let y=0;y<h;y+=52){g.fillStyle='rgba(0,0,0,.35)';g.fillRect(0,y,w,3);}for(let i=0;i<220;i++){g.strokeStyle=`rgba(12,6,2,${.15+Math.random()*.25})`;g.beginPath();const y=Math.random()*h;g.moveTo(0,y);g.lineTo(w,y+Math.random()*8-4);g.stroke();}noiseOver(g,w,h,700,.12,true);});
const texPlaster=makeTex(512,512,(g,w,h)=>{g.fillStyle='#b3a183';g.fillRect(0,0,w,h);noiseOver(g,w,h,2400,.08,true);noiseOver(g,w,h,1400,.05,false);for(let i=0;i<13;i++){const x=Math.random()*w,y=Math.random()*h,r=25+Math.random()*90;const gr=g.createRadialGradient(x,y,2,x,y,r);gr.addColorStop(0,'rgba(74,56,30,.20)');gr.addColorStop(1,'rgba(74,56,30,0)');g.fillStyle=gr;g.beginPath();g.arc(x,y,r,0,7);g.fill();}});
const texTatami=makeTex(512,256,(g,w,h)=>{g.fillStyle='#96965f';g.fillRect(0,0,w,h);for(let x=0;x<w;x+=4){g.fillStyle=x%8?'rgba(126,124,74,.55)':'rgba(171,168,105,.55)';g.fillRect(x,0,2,h);}for(let y=0;y<h;y+=7){g.fillStyle='rgba(81,84,43,.18)';g.fillRect(0,y,w,1);}g.strokeStyle='#35422c';g.lineWidth=18;g.strokeRect(0,0,w,h);g.strokeStyle='#59644a';g.lineWidth=3;g.strokeRect(12,12,w-24,h-24);noiseOver(g,w,h,500,.08,true);});
const texStone=makeTex(512,512,(g,w,h)=>{g.fillStyle='#62605b';g.fillRect(0,0,w,h);for(let y=0;y<h;y+=86)for(let x=0;x<w;x+=110){g.fillStyle=['#716f68','#585650','#68645c'][(x+y)%3];g.fillRect(x+3,y+3,104,80);}noiseOver(g,w,h,1800,.14,true);});
const texFusuma=makeTex(512,512,(g,w,h)=>{g.fillStyle='#d8c7a2';g.fillRect(0,0,w,h);noiseOver(g,w,h,1000,.06,true);g.strokeStyle='rgba(73,62,43,.38)';g.lineWidth=3;g.beginPath();g.moveTo(40,430);g.bezierCurveTo(150,250,260,330,340,160);g.bezierCurveTo(390,70,450,70,478,55);g.stroke();g.fillStyle='rgba(90,74,45,.35)';for(let i=0;i<12;i++){g.beginPath();g.arc(340+Math.random()*90,80+Math.random()*90,7+Math.random()*12,0,7);g.fill();}// faint ear-like stain
 g.strokeStyle='rgba(92,65,35,.22)';g.lineWidth=10;g.beginPath();g.arc(140,145,48,-.6,2.6);g.stroke();g.beginPath();g.arc(145,150,25,-.4,2.4);g.stroke();});
const texShoji=makeTex(256,256,(g,w,h)=>{g.fillStyle='#cdd6d2';g.fillRect(0,0,w,h);const gr=g.createRadialGradient(90,70,10,120,120,240);gr.addColorStop(0,'rgba(255,255,255,.85)');gr.addColorStop(1,'rgba(120,145,160,.28)');g.fillStyle=gr;g.fillRect(0,0,w,h);g.fillStyle='#4a3420';for(let x=0;x<=w;x+=64)g.fillRect(x-3,0,6,h);for(let y=0;y<=h;y+=64)g.fillRect(0,y-3,w,6);});
const texKimono=makeTex(256,256,(g,w,h)=>{g.fillStyle='#7e1d26';g.fillRect(0,0,w,h);g.fillStyle='rgba(240,190,150,.55)';for(let i=0;i<50;i++){const x=Math.random()*w,y=Math.random()*h;for(let p=0;p<5;p++){g.beginPath();g.arc(x+Math.cos(p*1.26)*6,y+Math.sin(p*1.26)*6,4,0,7);g.fill();}}noiseOver(g,w,h,400,.12,true);});
const texScroll=makeTex(256,512,(g,w,h)=>{g.fillStyle='#e6dcc0';g.fillRect(0,0,w,h);g.fillStyle='#54401f';g.fillRect(0,0,w,30);g.fillRect(0,h-30,w,30);g.fillStyle='#20180f';g.font='150px serif';g.textAlign='center';g.fillText('耳',128,285);g.font='24px serif';g.fillText('聞くな',128,365);});
const texNote=makeTex(256,256,(g,w,h)=>{g.fillStyle='#eee4c7';g.fillRect(0,0,w,h);g.fillStyle='rgba(45,38,25,.78)';g.font='20px serif';const lines=['呼ばれても','返事をするな','耳の形を','覚えられる','鈴が鳴ったら','仏壇へ'];lines.forEach((s,i)=>g.fillText(s,28,48+i*33));noiseOver(g,w,h,250,.08,true);});
const texPhoto=makeTex(256,320,(g,w,h)=>{g.fillStyle='#241f1a';g.fillRect(0,0,w,h);g.fillStyle='#b9a58e';g.beginPath();g.arc(128,130,58,0,7);g.fill();g.fillStyle='#181210';g.beginPath();g.arc(105,122,7,0,7);g.arc(151,122,7,0,7);g.fill();g.fillRect(118,165,20,4);g.fillStyle='#0d0b09';g.fillRect(62,205,132,90);noiseOver(g,w,h,600,.15,true);});

function mat(tex,color,repX,repY,opts){
  let t=tex; if(repX||repY){t=tex.clone();t.needsUpdate=true;t.repeat.set(repX||1,repY||1);}
  return new THREE.MeshStandardMaterial(Object.assign({map:t,color:color||0xffffff,roughness:.92,metalness:0},opts||{}));
}
const MAT={
  wood:mat(texWood),woodFloor:mat(texWood,0xffffff,5,4),darkWood:mat(texDarkWood),plaster:mat(texPlaster),
  beam:mat(texDarkWood,0x8a6a4a),stone:mat(texStone,0xffffff,2,2),fusuma:mat(texFusuma),
  shoji:new THREE.MeshStandardMaterial({map:texShoji,emissive:0x8fa8b8,emissiveIntensity:.32,roughness:.8}),
  kimono:mat(texKimono),black:new THREE.MeshStandardMaterial({color:0x111111,roughness:.65}),
  lacquer:new THREE.MeshStandardMaterial({color:0x17100c,roughness:.42,metalness:.08}),
  gold:new THREE.MeshStandardMaterial({color:0xb28c3d,roughness:.35,metalness:.65,emissive:0x2b1c05,emissiveIntensity:.35}),
  skin:new THREE.MeshStandardMaterial({color:0xf0dac9,roughness:.55}),
  redCloth:new THREE.MeshStandardMaterial({color:0x5c2734,roughness:.95}),
  purpleCloth:new THREE.MeshStandardMaterial({color:0x4a3558,roughness:.95}),
  metal:new THREE.MeshStandardMaterial({color:0x777777,roughness:.38,metalness:.7}),
  ceramic:new THREE.MeshStandardMaterial({color:0x9aa0a0,roughness:.35}),
  paper:mat(texNote),scroll:mat(texScroll),photo:mat(texPhoto),
  hit:new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,colorWrite:false})
};

/* ---------------- scene helpers ---------------- */
function addBox(w,h,d,x,y,z,material,o){
  o=o||{};const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);
  if(o.ry)m.rotation.y=o.ry; if(o.rx)m.rotation.x=o.rx; if(o.rz)m.rotation.z=o.rz;
  m.castShadow=o.cast!==false;m.receiveShadow=o.receive!==false;
  (o.parent||scene).add(m);
  if(o.collider)colliders.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2});
  if(o.occluder)occluders.push(m);
  return m;
}
function addCyl(rt,rb,h,x,y,z,material,o){
  o=o||{};const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,o.seg||20),material);m.position.set(x,y,z);
  if(o.ry)m.rotation.y=o.ry; if(o.rx)m.rotation.x=o.rx; if(o.rz)m.rotation.z=o.rz;m.castShadow=o.cast!==false;m.receiveShadow=true;(o.parent||scene).add(m);
  if(o.collider){const r=Math.max(rt,rb);colliders.push({minX:x-r,maxX:x+r,minZ:z-r,maxZ:z+r});}
  return m;
}
function floorRect(cx,cz,w,d,material,y){
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),material);m.rotation.x=-Math.PI/2;m.position.set(cx,y||.021,cz);m.receiveShadow=true;scene.add(m);return m;
}
function wallRun(axis,fixed,from,to,gaps,thick){
  thick=thick||.18;gaps=(gaps||[]).slice().sort((a,b)=>a.c-b.c);let cur=from;
  const solid=(a,b)=>{if(b-a<.03)return;const len=b-a,c=(a+b)/2;
    if(axis==='x')addBox(len,2.7,thick,c,1.35,fixed,MAT.plaster,{collider:true,occluder:true});
    else addBox(thick,2.7,len,fixed,1.35,c,MAT.plaster,{collider:true,occluder:true});};
  gaps.forEach(g=>{const a=g.c-g.w/2,b=g.c+g.w/2;solid(cur,a);
    // lintel above door
    if(axis==='x')addBox(g.w,.7,thick,g.c,2.35,fixed,MAT.plaster,{occluder:true});
    else addBox(thick,.7,g.w,fixed,2.35,g.c,MAT.plaster,{occluder:true});
    // wood posts at edges
    if(axis==='x'){addBox(.14,2.05,thick+.06,a,1.02,fixed,MAT.darkWood,{});addBox(.14,2.05,thick+.06,b,1.02,fixed,MAT.darkWood,{});}
    else{addBox(thick+.06,2.05,.14,fixed,1.02,a,MAT.darkWood,{});addBox(thick+.06,2.05,.14,fixed,1.02,b,MAT.darkWood,{});}
    cur=b;});
  solid(cur,to);
}
function addShoji(x,z,ry,w){
  const grp=new THREE.Group();grp.position.set(x,1.45,z);grp.rotation.y=ry;scene.add(grp);
  const frame=new THREE.Mesh(new THREE.BoxGeometry(w||1.7,1.55,.09),MAT.darkWood);frame.castShadow=true;grp.add(frame);
  const paper=new THREE.Mesh(new THREE.PlaneGeometry((w||1.7)-.14,1.4),MAT.shoji);paper.position.z=.056;grp.add(paper);
  return grp;
}
function makeHit(parent,x,y,z,w,h,d,data){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),MAT.hit);m.position.set(x,y,z);m.userData.interact=data;parent.add(m);hitMeshes.push(m);return m;
}
function createDoor(id,x,z,axis,slideSign,offsetSide,label){
  const grp=new THREE.Group();grp.position.set(x,0,z);scene.add(grp);
  const isX=axis==='x';
  const panel=addBox(isX?1.16:.07,2.0,isX?.07:1.16,0,1.0,0,MAT.fusuma,{parent:grp,occluder:true});
  // small dark handles
  const hmat=MAT.darkWood;
  if(isX){addCyl(.045,.045,.035,.42,1.02,.055,hmat,{parent:grp,rx:Math.PI/2});addCyl(.045,.045,.035,.42,1.02,-.055,hmat,{parent:grp,rx:Math.PI/2});}
  else{addCyl(.045,.045,.035,.055,1.02,.42,hmat,{parent:grp,rz:Math.PI/2});addCyl(.045,.045,.035,-.055,1.02,.42,hmat,{parent:grp,rz:Math.PI/2});}
  const col={minX:0,maxX:0,minZ:0,maxZ:0};colliders.push(col);
  const door={id,group:grp,panel,axis,closed:new THREE.Vector3(x,0,z),slideSign:slideSign||1,current:0,target:0,label,col,offsetSide:offsetSide||0};
  doors.push(door);
  const data={id:'door_'+id,active:()=>true,
    prompt:()=> (door.target>.5?`[E] ${label}を閉める`:`[E] ${label}を開ける`),
    action:()=>toggleDoor(door,true)};
  makeHit(grp,0,1,0,isX?1.25:.55,2.05,isX?.55:1.25,data);
  updateDoorCollider(door);
  return door;
}
function updateDoorCollider(d){
  const p=d.group.position;
  if(d.axis==='x'){d.col.minX=p.x-.58;d.col.maxX=p.x+.58;d.col.minZ=p.z-.14;d.col.maxZ=p.z+.14;}
  else{d.col.minX=p.x-.14;d.col.maxX=p.x+.14;d.col.minZ=p.z-.58;d.col.maxZ=p.z+.58;}
}
function toggleDoor(d,byPlayer){
  d.target=d.target>.5?0:1;
  AudioSys.slide();
  if(byPlayer && Math.random()<.08) setTimeout(()=>AudioSys.knock(),260);
}

/* ---------------- build house ---------------- */
function buildHouse(){
  // ground outside (barely visible)
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(90,90),new THREE.MeshStandardMaterial({color:0x0a0d09,roughness:1}));
  ground.rotation.x=-Math.PI/2;ground.position.y=-.03;ground.receiveShadow=true;scene.add(ground);
  // base wood floor + rooms
  floorRect(0,0,20,16,MAT.woodFloor,.005);
  const tatNW=mat(texTatami,0xffffff,5,10),tatNE=mat(texTatami,0xffffff,5,10),tatSW=mat(texTatami,0xffffff,5,6);
  floorRect(-5.5,-3.5,9,9,tatNW,.022);
  floorRect(5.5,-3.5,9,9,tatNE,.022);
  floorRect(-5.5,5.2,9,5.6,tatSW,.022);
  floorRect(0,6.6,2,2.8,MAT.stone,.025); // genkan

  // ceiling + beams
  const ceil=new THREE.Mesh(new THREE.PlaneGeometry(20,16),mat(texDarkWood,0x777777,6,5));ceil.rotation.x=Math.PI/2;ceil.position.y=2.72;ceil.receiveShadow=true;scene.add(ceil);
  [-6,-3,0,3,6].forEach(z=>addBox(20,.18,.22,0,2.62,z,MAT.beam,{cast:false}));
  [-7.5,-4,0,4,7.5].forEach(x=>addBox(.2,.16,16,x,2.66,0,MAT.beam,{cast:false}));

  // outer walls (front door gap at x=0 south)
  wallRun('x',-8,-10,10,[],.28);
  wallRun('x',8,-10,10,[{c:0,w:1.25}],.28);
  wallRun('z',-10,-8,8,[],.28);
  wallRun('z',10,-8,8,[],.28);
  // inner partitions
  wallRun('z',-1,-8,1,[{c:-4,w:1.2}]);
  wallRun('z',1,-8,1,[{c:-4,w:1.2}]);
  wallRun('x',1,-10,-1,[{c:-5,w:1.25}]);
  wallRun('x',1,1,10,[{c:5,w:1.25}]);
  wallRun('x',2.4,-10,-1,[{c:-5,w:1.25}]);
  wallRun('x',2.4,1,10,[{c:5,w:1.25}]);
  wallRun('z',-1,2.4,8,[{c:5,w:1.2}]);
  wallRun('z',1,2.4,8,[{c:5,w:1.2}]);

  // pillars for Japanese structure feel
  [[-1,-7],[-1,-1],[1,-7],[1,-1],[-5,1],[5,1],[-5,2.4],[5,2.4],[-9.8,-4],[9.8,-4],[-9.8,4],[9.8,4]].forEach(p=>addBox(.18,2.7,.18,p[0],1.35,p[1],MAT.darkWood,{}));

  // doors (offset slightly toward corridor side so panels slide over wall faces)
  createDoor('nw_east',-1.09,-4,'z',-1,0,'人形の間の襖');
  createDoor('nw_south',-5,1.09,'x',1,0,'人形の間の襖');
  createDoor('ne_west',1.09,-4,'z',1,0,'仏間の襖');
  createDoor('ne_south',5,1.09,'x',-1,0,'仏間の襖');
  createDoor('sw_north',-5,2.31,'x',1,0,'居間の襖');
  createDoor('sw_east',-.91,5,'z',-1,0,'居間の襖');
  createDoor('se_north',5,2.31,'x',-1,0,'台所の襖');
  createDoor('se_west',.91,5,'z',1,0,'台所の襖');

  // shoji windows
  addShoji(-5.5,-7.82,0,2.3);addShoji(5.5,-7.82,0,2.3);addShoji(0,-7.82,0,1.2);
  addShoji(-9.82,-3,Math.PI/2,2.1);addShoji(9.82,-3,-Math.PI/2,2.1);
  addShoji(-9.82,5,Math.PI/2,2.0);addShoji(9.82,5,-Math.PI/2,2.0);
  addShoji(-5.5,7.82,Math.PI,2.0);addShoji(5.5,7.82,Math.PI,2.0);

  // exit door (locked)
  const exitDoor=addBox(1.24,2.1,.14,0,1.05,7.92,MAT.darkWood,{collider:true,occluder:true});
  addBox(.9,.08,.04,0,1.1,7.83,MAT.metal,{});
  addCyl(.05,.05,.08,.43,1.03,7.82,MAT.metal,{rx:Math.PI/2});
  const exitData={id:'exit',active:()=>true,prompt:()=>'[E] 玄関の扉を調べる',action:tryExit};
  makeHit(scene,0,1.05,7.75,1.5,2.2,.7,exitData);

  buildProps();
}
function lowTable(x,z,ry){
  const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=ry||0;scene.add(g);
  addBox(1.55,.09,.9,0,.42,0,MAT.darkWood,{parent:g});
  [[-.65,-.32],[.65,-.32],[-.65,.32],[.65,.32]].forEach(p=>addBox(.09,.4,.09,p[0],.2,p[1],MAT.darkWood,{parent:g}));
  colliders.push({minX:x-.8,maxX:x+.8,minZ:z-.5,maxZ:z+.5});
  return g;
}
function tansu(x,z,ry){
  const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=ry;scene.add(g);
  addBox(1.7,1.55,.55,0,.78,0,MAT.wood,{parent:g});
  for(let i=0;i<3;i++)addBox(1.5,.4,.04,0,.35+i*.47,.29,MAT.darkWood,{parent:g});
  for(let i=0;i<3;i++)addCyl(.035,.035,.05,0,.35+i*.47,.33,MAT.metal,{parent:g,rx:Math.PI/2});
  const c=Math.cos(ry),s=Math.sin(ry);const hw=Math.abs(c)*.9+Math.abs(s)*.32,hd=Math.abs(s)*.9+Math.abs(c)*.32;
  colliders.push({minX:x-hw,maxX:x+hw,minZ:z-hd,maxZ:z+hd});return g;
}
function zabuton(x,z,matc,ry){addBox(.62,.09,.62,x,.07,z,matc,{ry:ry||0,cast:false});}
function buildProps(){
  /* --- SW living --- */
  lowTable(-5.5,5.15,0);
  zabuton(-6.5,5.15,MAT.purpleCloth);zabuton(-4.5,5.15,MAT.purpleCloth);zabuton(-5.5,4.25,MAT.redCloth);zabuton(-5.5,6.05,MAT.redCloth);
  // old CRT TV
  addBox(1.1,.45,.5,-8.9,.25,3.3,MAT.darkWood,{collider:true});
  addBox(.78,.62,.62,-8.9,.82,3.3,MAT.black,{collider:false});
  const tvScr=new THREE.Mesh(new THREE.PlaneGeometry(.58,.42),new THREE.MeshStandardMaterial({color:0x10151a,roughness:.25,metalness:.2}));tvScr.position.set(-8.9,.84,3.62);scene.add(tvScr);
  tansu(-9.35,6.9,Math.PI/2);
  const scroll1=new THREE.Mesh(new THREE.PlaneGeometry(.75,1.5),MAT.scroll);scroll1.position.set(-2.2,1.55,7.83);scroll1.rotation.y=Math.PI;scene.add(scroll1);

  /* --- SE kitchen --- */
  addBox(.75,.9,4.6,9.55,.45,5.1,MAT.ceramic,{collider:true,occluder:true});
  addBox(.85,.08,4.7,9.5,.94,5.1,MAT.metal,{});
  addBox(.55,.08,1.0,9.5,.99,4.0,MAT.black,{}); // sink-ish
  addCyl(.16,.16,.12,9.45,1.03,5.9,MAT.metal,{});addCyl(.12,.12,.1,9.45,1.02,6.35,MAT.black,{});
  [3.4,4.1,6.8].forEach((z,i)=>addCyl(.18,.22,.38,9.55,1.18,z,i?MAT.ceramic:MAT.redCloth,{}));
  addBox(.85,1.75,.7,2.0,.88,7.45,new THREE.MeshStandardMaterial({color:0x8b8f88,roughness:.5,metalness:.25}),{collider:true}); // fridge
  lowTable(5.2,5.4,.3);
  addBox(2.6,1.0,.45,5.2,.5,7.65,MAT.wood,{collider:true}); // cupboard

  /* --- NW doll room --- */
  // stand + doll built later at (-5.5,-7.0)
  addBox(1.15,.5,.7,-5.5,.25,-7.15,MAT.lacquer,{collider:true,occluder:true});
  addBox(1.3,.07,.85,-5.5,.53,-7.15,MAT.gold,{});
  tansu(-9.35,-3.5,Math.PI/2);
  // desk for note 3
  addBox(1.25,.08,.65,-8.7,.68,-.1,MAT.darkWood,{collider:true});
  [[-.5,-.23],[.5,-.23],[-.5,.23],[.5,.23]].forEach(p=>addBox(.08,.68,.08,-8.7+p[0],.34,-.1+p[1],MAT.darkWood,{}));
  // futon stack
  addCyl(.28,.28,1.35,-2.2,.3,-6.7,MAT.purpleCloth,{rz:Math.PI/2,collider:true});
  addCyl(.25,.25,1.3,-2.2,.82,-6.7,MAT.redCloth,{rz:Math.PI/2});
  const scroll2=new THREE.Mesh(new THREE.PlaneGeometry(.8,1.6),MAT.scroll);scroll2.position.set(-9.82,1.55,-6.8);scroll2.rotation.y=Math.PI/2;scene.add(scroll2);
  // scattered small boxes
  addBox(.55,.4,.55,-8.7,.22,-6.2,MAT.wood,{collider:true,ry:.4});addBox(.45,.32,.45,-8.15,.18,-6.7,MAT.darkWood,{collider:true,ry:-.3});

  /* --- NE butsudan room --- */
  buildButsudan(5.5,-7.35);
  zabuton(5.5,-5.8,MAT.purpleCloth);zabuton(4.5,-5.8,MAT.purpleCloth);zabuton(6.5,-5.8,MAT.purpleCloth);
  tansu(9.35,-2.5,-Math.PI/2);
  lowTable(3.4,-5.7,.2);
  const photo=new THREE.Mesh(new THREE.PlaneGeometry(.55,.7),MAT.photo);photo.position.set(3.35,1.28,-7.83);scene.add(photo);
  addBox(.65,.8,.05,3.35,1.28,-7.87,MAT.darkWood,{});

  /* --- corridor / genkan props --- */
  addBox(1.1,.85,.38,-1.55,.43,7.55,MAT.wood,{collider:false}); // shoe shelf partly beside genkan (in SW wall side is wall; placed visually near)
  addCyl(.16,.13,.62,.72,.31,7.35,MAT.ceramic,{});
  addBox(.05,.75,.05,.65,1.0,7.3,MAT.black,{rz:.25});
  // wall clock
  const clockM=new THREE.Mesh(new THREE.CylinderGeometry(.28,.28,.06,28),MAT.darkWood);clockM.rotation.x=Math.PI/2;clockM.position.set(0,2.05,-7.82);scene.add(clockM);
  const face=new THREE.Mesh(new THREE.CircleGeometry(.23,28),new THREE.MeshStandardMaterial({color:0xd9cfb2}));face.position.set(0,2.05,-7.78);scene.add(face);
  // framed photo in EW corridor wall
  const ph2=new THREE.Mesh(new THREE.PlaneGeometry(.5,.62),MAT.photo);ph2.position.set(-7.5,1.5,2.29);ph2.rotation.y=Math.PI;scene.add(ph2);
}
function buildButsudan(x,z){
  const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);
  addBox(1.5,1.7,.65,0,.95,0,MAT.lacquer,{parent:g});
  addBox(1.62,.12,.78,0,1.86,0,MAT.gold,{parent:g});
  addBox(1.15,1.15,.05,0,1.12,.34,new THREE.MeshStandardMaterial({color:0x2b1e0d,roughness:.6,emissive:0x442a08,emissiveIntensity:.35}),{parent:g});
  addBox(.12,1.25,.5,-.82,1.08,.18,MAT.lacquer,{parent:g,ry:-.5});
  addBox(.12,1.25,.5,.82,1.08,.18,MAT.lacquer,{parent:g,ry:.5});
  addBox(.9,.16,.55,0,.5,.35,MAT.darkWood,{parent:g});
  // candles
  [-.3,.3].forEach(cx=>{
    addCyl(.035,.045,.26,cx,.72,.42,new THREE.MeshStandardMaterial({color:0xe8ddc4,roughness:.6}),{parent:g});
    const flame=new THREE.Mesh(new THREE.SphereGeometry(.035,10,10),new THREE.MeshBasicMaterial({color:0xffb648}));flame.scale.y=2.1;flame.position.set(cx,.93,.42);g.add(flame);candleFlames.push(flame);
  });
  addCyl(.11,.14,.09,0,.63,.43,MAT.gold,{parent:g}); // bell bowl
  const photo=new THREE.Mesh(new THREE.PlaneGeometry(.34,.42),MAT.photo);photo.position.set(0,1.35,.38);g.add(photo);
  colliders.push({minX:x-.85,maxX:x+.85,minZ:z-.45,maxZ:z+.55});
  candleLight=new THREE.PointLight(0xff8b3d,.95,6.5,1.6);candleLight.position.set(x,1.15,z+.75);scene.add(candleLight);
  // key (hidden until 3 notes)
  keyMesh=new THREE.Group();keyMesh.position.set(x+.48,.62,z+.48);keyMesh.rotation.set(.3,.5,.8);keyMesh.visible=false;scene.add(keyMesh);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.075,.018,10,22),MAT.gold);keyMesh.add(ring);
  const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.016,.016,.22,10),MAT.gold);shaft.position.y=-.16;keyMesh.add(shaft);
  const tooth=new THREE.Mesh(new THREE.BoxGeometry(.07,.035,.02),MAT.gold);tooth.position.set(.035,-.23,0);keyMesh.add(tooth);
  const data={id:'butsudan',active:()=>true,
    prompt:()=> keySpawned&&!hasKey ? '[E] 仏壇を調べる' : '[E] 仏壇に手を合わせる',
    action:()=>{
      if(keySpawned&&!hasKey){pickupKey();}
      else{AudioSys.bell(.25);showToast(hasKey?'仏壇の写真の目が、さっきより開いている気がした。':'線香の匂い。写真の祖母は、こちらではなく「あなたの後ろ」を見ている。',3600);}
    }};
  makeHit(scene,x,1.0,z+.35,1.9,1.9,1.1,data);
}

/* ---------------- doll ---------------- */
function buildDoll(){
  doll=new THREE.Group();doll.position.set(-5.5,.56,-7.15);scene.add(doll);
  const body=new THREE.Mesh(new THREE.CylinderGeometry(.14,.33,.72,22),MAT.kimono);body.position.y=.36;body.castShadow=true;doll.add(body);
  const obi=new THREE.Mesh(new THREE.CylinderGeometry(.19,.21,.16,22),MAT.gold);obi.position.y=.47;doll.add(obi);
  const collar=new THREE.Mesh(new THREE.CylinderGeometry(.105,.14,.16,18),new THREE.MeshStandardMaterial({color:0xe8e0cc,roughness:.8}));collar.position.y=.72;doll.add(collar);
  // sleeves / arms
  [-1,1].forEach(s=>{const arm=new THREE.Mesh(new THREE.CylinderGeometry(.045,.085,.5,12),MAT.kimono);arm.position.set(.22*s,.48,.02);arm.rotation.z=.5*s;arm.castShadow=true;doll.add(arm);
    const hand=new THREE.Mesh(new THREE.SphereGeometry(.045,10,10),MAT.skin);hand.position.set(.32*s,.25,.05);doll.add(hand);});
  dollHead=new THREE.Group();dollHead.position.y=.91;doll.add(dollHead);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.175,24,18),MAT.skin);head.scale.y=1.12;head.castShadow=true;dollHead.add(head);
  const hair=new THREE.Mesh(new THREE.SphereGeometry(.19,24,16,0,Math.PI*2,0,Math.PI*.58),MAT.black);hair.scale.y=1.12;hair.position.set(0,.018,-.012);dollHead.add(hair);
  [-1,1].forEach(s=>{const side=new THREE.Mesh(new THREE.BoxGeometry(.06,.28,.16),MAT.black);side.position.set(.165*s,-.05,-.01);dollHead.add(side);
    const eye=new THREE.Mesh(new THREE.SphereGeometry(.018,10,10),new THREE.MeshBasicMaterial({color:0x050505}));eye.position.set(.062*s,.015,.163);dollHead.add(eye);});
  const mouth=new THREE.Mesh(new THREE.BoxGeometry(.045,.014,.012),new THREE.MeshBasicMaterial({color:0x8c2430}));mouth.position.set(0,-.075,.17);dollHead.add(mouth);
  const backHair=new THREE.Mesh(new THREE.BoxGeometry(.3,.34,.07),MAT.black);backHair.position.set(0,-.03,-.14);dollHead.add(backHair);
  const data={id:'doll',active:()=>!huntActive&&!dollGone,prompt:()=>'[E] 市松人形を調べる',action:()=>{
    AudioSys.whisper(0,.7);dollHeadAwake=true;
    showToast('ガラス玉のような目。瞬きをした……はずがない。人形の耳だけが、やけに精巧に作られている。',4200);
  }};
  makeHit(doll,0,.65,0,.85,1.5,.85,data);
}

/* ---------------- notes ---------------- */
const NOTE_TEXTS={
  living:{title:'手記 ― 居間にて',body:'この家では、呼ばれても返事をしてはいけない。\n\n襖の向こうの声は、耳の形を覚えるために呼ぶのだそうだ。ばあちゃんは「聞こえないふりが一番の鍵だ」と言っていた。\n\nけれど昨夜、私は呼ばれた。\n私自身の声で。'},
  kitchen:{title:'手記 ― 台所にて',body:'三日目。壁の中から、爪で引っ掻く音がする。音の方を見ると止む。\n\n不思議なことに、耳を澄ませば（Qを長押し）大事なものの在り処まで聞こえてくる気がする。\n\n手記を三枚読んだら仏壇へ。玄関の鍵はいつも、鈴のそばに置いた。'},
  dollroom:{title:'手記 ― 人形の間にて',body:'あの市松人形は、見られている間は決して動かない。動くのは、目を逸らした一瞬だけ。\n\n首がこちらを向いていたら、もう耳を狙われている。\n\n仏壇の鈴が鳴ったら鍵を取りに戻ること。鈴の音は、あの子の耳を一瞬だけ塞ぐ。そして——鍵を取ったら、まっすぐ玄関へ。振り返るな。いや、振り返れ。見続けなければ、近づいてくる。'}
};
function createNote(id,x,y,z,ry){
  const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=ry||0;scene.add(g);
  const paper=new THREE.Mesh(new THREE.BoxGeometry(.34,.012,.24),MAT.paper);paper.rotation.x=0;paper.castShadow=true;g.add(paper);
  const note={id,group:g,collected:false,pos:new THREE.Vector3(x,y,z)};
  notes.push(note);
  const data={id:'note_'+id,active:()=>!note.collected,prompt:()=>'[E] 手記を読む',action:()=>collectNote(note)};
  makeHit(g,0,.12,0,.85,.7,.85,data);
  return note;
}
function collectNote(note){
  note.collected=true;note.group.visible=false;notesFound++;
  AudioSys.paper();updateHUD();
  const t=NOTE_TEXTS[note.id];
  els.noteTitle.textContent=t.title+`（${notesFound} / 3）`;els.noteBody.textContent=t.body;
  mode='reading';els.noteScreen.classList.remove('hidden');
  if(document.pointerLockElement)document.exitPointerLock();
  if(notesFound===1){pendingToast='……どこか遠くで、襖の開く音がした。';pendingAfterNote=()=>{AudioSys.slide(.5);whisperTimer=Math.min(whisperTimer,4);};}
  if(notesFound===2){dollHeadAwake=true;pendingToast='人形の間の方から、木の軋む音がした。';pendingAfterNote=()=>AudioSys.creak();}
  if(notesFound===3){
    keySpawned=true;if(keyMesh)keyMesh.visible=true;
    dollGone=true;if(doll)doll.visible=false;
    pendingToast='仏間の方で、小さな鈴が鳴った。——人形の間の気配が、消えている。';
    pendingAfterNote=()=>{AudioSys.bell(.8);setTimeout(()=>AudioSys.whisper(-.6,.8),900);};
    setObjective('仏間へ行き、仏壇を調べる（鈴のそばに鍵がある）');
  }
}
function pickupKey(){
  hasKey=true;if(keyMesh)keyMesh.visible=false;
  AudioSys.bell(1);AudioSys.paper();
  els.keyState.textContent='🗝 玄関の鍵';
  setObjective('玄関から脱出する ―― 人形は「見ている間」動けない');
  showToast('真鍮の鍵を手に入れた。次の瞬間、蝋燭の火が消えた。',4200);
  if(candleLight)candleLight.intensity=0;candleFlames.forEach(f=>f.visible=false);
  startHunt();
}
function tryExit(){
  if(hasKey){winGame();}
  else{AudioSys.knock();showToast('鍵がかかっている。内側にあるはずの鍵が、見当たらない。',3200);}
}

/* ---------------- navigation graph for doll ---------------- */
const NAV_NODES=[[0,7],[0,4.8],[0,3.1],[0,1.7],[0,0],[0,-2.2],[0,-4],[0,-6.8],[-8,1.7],[-5,1.7],[-2.5,1.7],[2.5,1.7],[5,1.7],[8,1.7],[-5,-3.5],[-5.5,-6],[-8,-4],[-5,-.2],[5,-3.5],[5.5,-5.6],[8,-4],[5,-.2],[-5,5.1],[-8,5],[-5,3.3],[5,5.1],[8,5],[5,3.3]];
const NAV_EDGES=[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[8,9],[9,10],[10,3],[3,11],[11,12],[12,13],[6,14],[6,18],[14,15],[14,16],[14,17],[17,9],[18,19],[18,20],[18,21],[21,12],[24,9],[22,24],[22,23],[22,1],[27,12],[25,27],[25,26],[25,1]];
const NAV_ADJ=NAV_NODES.map(()=>[]);NAV_EDGES.forEach(e=>{NAV_ADJ[e[0]].push(e[1]);NAV_ADJ[e[1]].push(e[0]);});
function nearestNode(x,z){let bi=0,bd=1e9;NAV_NODES.forEach((n,i)=>{const d=dist2(x,z,n[0],n[1]);if(d<bd){bd=d;bi=i;}});return bi;}
function findPath(sx,sz,tx,tz){
  const s=nearestNode(sx,sz),t=nearestNode(tx,tz);
  if(s===t)return[[tx,tz]];
  const prev=new Array(NAV_NODES.length).fill(-1);const q=[s];prev[s]=s;
  while(q.length){const cur=q.shift();if(cur===t)break;NAV_ADJ[cur].forEach(n=>{if(prev[n]===-1){prev[n]=cur;q.push(n);}});}
  if(prev[t]===-1)return[[tx,tz]];
  const path=[];let cur=t;while(cur!==s){path.unshift(NAV_NODES[cur]);cur=prev[cur];}
  path.push([tx,tz]);return path;
}
function startHunt(){
  huntActive=true;dollGone=false;
  // spawn far from player
  const candidates=[[-5,-3.5],[-8,1.7],[-5,5.1],[0,-6.8]];
  let best=candidates[0],bd=-1;candidates.forEach(c=>{const d=dist2(player.pos.x,player.pos.z,c[0],c[1]);if(d>bd){bd=d;best=c;}});
  doll.position.set(best[0],0,best[1]);doll.visible=true;dollState.path=[];dollState.recalc=0;
  setTimeout(()=>AudioSys.whisper(.6,1),500);
}
const _v1=new THREE.Vector3(),_v2=new THREE.Vector3(),_ray=new THREE.Raycaster();
function isDollSeen(){
  if(!doll||!doll.visible)return false;
  _v1.copy(doll.position);_v1.y+=1.0;_v1.project(camera);
  if(_v1.z>1||_v1.x<-1.02||_v1.x>1.02||_v1.y<-1.02||_v1.y>1.02)return false;
  _v2.copy(doll.position);_v2.y+=1.0;
  const dir=_v2.clone().sub(camera.position);const len=dir.length();dir.normalize();
  _ray.set(camera.position,dir);_ray.far=len-.15;
  const hits=_ray.intersectObjects(occluders,false);
  return hits.length===0;
}
function updateDoll(dt){
  if(!doll)return;
  if(!huntActive){
    if(dollHeadAwake&&doll.visible){
      const dx=player.pos.x-doll.position.x,dz=player.pos.z-doll.position.z;
      const targetYaw=Math.atan2(dx,dz)-doll.rotation.y;
      let rel=((targetYaw+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;
      dollHead.rotation.y=lerp(dollHead.rotation.y,clamp(rel,-1.15,1.15),1-Math.exp(-2.2*dt));
    }
    return;
  }
  dollState.seen=isDollSeen();
  const dxp=player.pos.x-doll.position.x,dzp=player.pos.z-doll.position.z;
  const distP=Math.sqrt(dxp*dxp+dzp*dzp);
  els.danger.style.opacity=distP<4?clamp(1-distP/4,0,1)*.95:0;
  if(distP<.72){gameOver();return;}
  // always face player with head
  const targetYaw=Math.atan2(dxp,dzp);
  let dy=((targetYaw-doll.rotation.y+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;
  dollHead.rotation.y=clamp(dy*.8,-1.1,1.1);
  if(dollState.seen)return; // frozen while watched
  dollState.recalc-=dt;
  if(dollState.recalc<=0){dollState.path=findPath(doll.position.x,doll.position.z,player.pos.x,player.pos.z);dollState.pathIdx=0;dollState.recalc=.7;}
  if(!dollState.path.length)return;
  const target=dollState.path[Math.min(dollState.pathIdx,dollState.path.length-1)];
  const dx=target[0]-doll.position.x,dz=target[1]-doll.position.z;const d=Math.hypot(dx,dz);
  if(d<.28){dollState.pathIdx++;return;}
  // open closed doors nearby
  for(const door of doors){
    if(door.target<.5&&dist2(doll.position.x,doll.position.z,door.closed.x,door.closed.z)<1.1){door.target=1;AudioSys.slide(.7);}
    if(door.current<.65&&dist2(doll.position.x,doll.position.z,door.closed.x,door.closed.z)<.55)return; // wait at door
  }
  const vx=dx/d*dollState.speed,vz=dz/d*dollState.speed;
  doll.position.x+=vx*dt;doll.position.z+=vz*dt;
  doll.position.y=Math.sin(performance.now()*.006)*.018; // gliding bob
  const moveYaw=Math.atan2(vx,vz);
  let my=((moveYaw-doll.rotation.y+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;
  doll.rotation.y+=my*(1-Math.exp(-7*dt));
}

/* ---------------- audio (all procedural) ---------------- */
const AudioSys={
  ctx:null,master:null,noiseBuf:null,
  init(){if(this.ctx)return;try{
    const C=window.AudioContext||window.webkitAudioContext;this.ctx=new C();
    this.master=this.ctx.createGain();this.master.gain.value=.85;this.master.connect(this.ctx.destination);
    const len=this.ctx.sampleRate*2;this.noiseBuf=this.ctx.createBuffer(1,len,this.ctx.sampleRate);
    const d=this.noiseBuf.getChannelData(0);for(let i=0;i<len;i++)d[i]=Math.random()*2-1;
    // rain ambience
    const rain=this.ctx.createBufferSource();rain.buffer=this.noiseBuf;rain.loop=true;
    const lp=this.ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=420;
    const rg=this.ctx.createGain();rg.gain.value=.05;rain.connect(lp);lp.connect(rg);rg.connect(this.master);rain.start();
    // low drone
    const osc=this.ctx.createOscillator();osc.type='sine';osc.frequency.value=47;const og=this.ctx.createGain();og.gain.value=.014;osc.connect(og);og.connect(this.master);osc.start();
    const osc2=this.ctx.createOscillator();osc2.type='sine';osc2.frequency.value=94.5;const og2=this.ctx.createGain();og2.gain.value=.006;osc2.connect(og2);og2.connect(this.master);osc2.start();
  }catch(e){}},
  burst(dur,type,freq,gain,pan,freqEnd){
    if(!this.ctx)return;const t=this.ctx.currentTime;
    const src=this.ctx.createBufferSource();src.buffer=this.noiseBuf;src.loop=true;
    const f=this.ctx.createBiquadFilter();f.type=type;f.frequency.setValueAtTime(freq,t);if(freqEnd)f.frequency.exponentialRampToValueAtTime(freqEnd,t+dur);f.Q.value=1.1;
    const g=this.ctx.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(gain,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    let out=g;if(this.ctx.createStereoPanner&&pan){const p=this.ctx.createStereoPanner();p.pan.value=clamp(pan,-1,1);g.connect(p);out=p;}
    src.connect(f);f.connect(g);out.connect(this.master);src.start(t);src.stop(t+dur+.05);
  },
  tone(freq,dur,gain,type,pan,slideTo){
    if(!this.ctx)return;const t=this.ctx.currentTime;const o=this.ctx.createOscillator();o.type=type||'sine';o.frequency.setValueAtTime(freq,t);if(slideTo)o.frequency.exponentialRampToValueAtTime(slideTo,t+dur);
    const g=this.ctx.createGain();g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    let out=g;if(this.ctx.createStereoPanner&&pan){const p=this.ctx.createStereoPanner();p.pan.value=clamp(pan,-1,1);g.connect(p);out=p;}
    o.connect(g);out.connect(this.master);o.start(t);o.stop(t+dur+.05);
  },
  footstep(wood){wood?this.burst(.11,'lowpass',320,.12,0,140):this.burst(.09,'lowpass',210,.07,0,110);if(wood&&Math.random()<.22)this.creak();},
  creak(){this.tone(120+Math.random()*80,.28,.028,'sawtooth',0,70);},
  slide(v){this.burst(.55,'bandpass',500,.14*(v||1),0,180);this.burst(.2,'lowpass',220,.08,0,110);},
  knock(){this.tone(92,.16,.22,'sine',0,55);this.burst(.07,'lowpass',500,.12);},
  paper(){this.burst(.24,'highpass',1600,.10,0,900);},
  bell(v){[1180,1770,2360].forEach((f,i)=>this.tone(f,2.2-i*.45,.07*(v||1)/(i+1),'sine',0));},
  whisper(pan,intensity){
    if(!this.ctx)return;const n=3+Math.floor(Math.random()*3);
    for(let i=0;i<n;i++){setTimeout(()=>this.burst(.16+Math.random()*.14,'bandpass',750+Math.random()*1000,.075*(intensity||1),pan||0,1400+Math.random()*700),i*190);}
  },
  heartbeat(v){this.tone(52,.13,.32*v,'sine',0,38);setTimeout(()=>this.tone(48,.11,.22*v,'sine',0,36),150);},
  scare(){this.burst(1.1,'highpass',900,.5,0,300);this.tone(720,1.0,.22,'sawtooth',0,110);this.tone(760,1.0,.18,'sawtooth',0,95);}
};

/* ---------------- HUD helpers ---------------- */
function setObjective(t){els.objective.textContent=t;}
function updateHUD(){els.noteCount.textContent=`手記 ${notesFound} / 3`;}
function showToast(text,ms){els.toast.textContent=text;els.toast.classList.add('show');toastTimer=(ms||3200)/1000;}
function fmtTime(s){const m=Math.floor(s/60),ss=Math.floor(s%60);return `${m}分${String(ss).padStart(2,'0')}秒`;}

/* ---------------- collision ---------------- */
function collides(x,z){
  if(x<-9.65||x>9.65||z<-7.65||z>7.65)return true;
  const r=player.radius;
  for(const c of colliders){
    const cx=clamp(x,c.minX,c.maxX),cz=clamp(z,c.minZ,c.maxZ);
    if(dist2(x,z,cx,cz)<r*r)return true;
  }
  return false;
}
function isWoodFloor(x,z){
  // corridors + kitchen are wood; big tatami rooms are soft
  if(Math.abs(x)<1.15||(z>1&&z<2.4))return true;
  if(x>1&&z>2.4)return true;
  return false;
}

/* ---------------- interaction scan ---------------- */
const _center=new THREE.Vector2(0,0);
function scanInteract(){
  _ray.setFromCamera(_center,camera);_ray.far=2.7;
  const activeHits=hitMeshes.filter(h=>{const d=h.userData.interact;return d&&(!d.active||d.active())&&h.visible!==false&&isChainVisible(h);});
  const hits=_ray.intersectObjects(activeHits,false);
  let next=null;
  if(hits.length){
    const hitDist=hits[0].distance;
    _ray.far=hitDist-.12;
    const blocked=_ray.intersectObjects(occluders,false);
    if(!blocked.length)next=hits[0].object.userData.interact;
  }
  currentInteract=next;
  if(next){els.prompt.textContent=typeof next.prompt==='function'?next.prompt():next.prompt;els.prompt.classList.add('show');}
  else els.prompt.classList.remove('show');
}
function isChainVisible(o){while(o){if(!o.visible)return false;o=o.parent;}return true;}
function tryInteract(){if(currentInteract&&currentInteract.action)currentInteract.action();}

/* ---------------- listen (ear) mechanic ---------------- */
function currentTargetPos(){
  if(notesFound<3){
    let best=null,bd=1e9;notes.forEach(n=>{if(!n.collected){const d=dist2(player.pos.x,player.pos.z,n.pos.x,n.pos.z);if(d<bd){bd=d;best=n.pos;}}});return best;
  }
  if(!hasKey)return butsudanPos;
  return exitPos;
}
function updateListen(dt){
  const listening=keys['KeyQ']&&mode==='playing';
  if(!listening){els.listen.style.opacity=0;return;}
  const tp=currentTargetPos();if(!tp)return;
  const dx=tp.x-player.pos.x,dz=tp.z-player.pos.z;const dist=Math.hypot(dx,dz);
  const fwd=new THREE.Vector3(-Math.sin(player.yaw),0,-Math.cos(player.yaw));
  const right=new THREE.Vector3(Math.cos(player.yaw),0,-Math.sin(player.yaw));
  const dir=new THREE.Vector3(dx,0,dz).normalize();
  const ang=Math.atan2(dir.dot(right),dir.dot(fwd))*180/Math.PI;
  let word;const a=Math.abs(ang);
  if(a<25)word='まっすぐ前';else if(a<75)word=ang>0?'右前':'左前';else if(a<130)word=ang>0?'右':'左';else word='後ろ';
  const near=dist<3.5?'とても近い':dist<8?'近い':'まだ遠い';
  els.listen.textContent=`👂 ${word}の方から、かすかな音がする……（${near}）`;
  els.listen.style.opacity=1;
  listenPing-=dt;
  if(listenPing<=0){listenPing=1.5;AudioSys.tone(840,0.35,clamp(.055-dist*.002,.012,.05),'sine',Math.sin(ang*Math.PI/180));}
}

/* ---------------- game flow ---------------- */
function startGame(){
  AudioSys.init();if(AudioSys.ctx&&AudioSys.ctx.resume)AudioSys.ctx.resume();
  els.title.classList.add('hidden');els.pause.classList.add('hidden');els.hud.classList.remove('hidden');
  mode='playing';
  if(isTouch){els.touch.classList.remove('hidden');}
  else lockPointer();
  showToast('雨音の向こうで、家のどこかが軋んだ。手記を3枚探そう。',4200);
}
function lockPointer(){
  try{const p=renderer.domElement.requestPointerLock&&renderer.domElement.requestPointerLock();if(p&&p.catch)p.catch(()=>{});}catch(e){}
}
function pauseGame(){
  if(mode!=='playing')return;mode='paused';els.pause.classList.remove('hidden');
}
function resumeGame(){
  AudioSys.init();if(AudioSys.ctx&&AudioSys.ctx.resume)AudioSys.ctx.resume();
  els.pause.classList.add('hidden');mode='playing';if(!isTouch)lockPointer();
}
function closeNote(){
  els.noteScreen.classList.add('hidden');mode='playing';
  if(pendingToast){showToast(pendingToast,4600);pendingToast='';}
  if(pendingAfterNote){const f=pendingAfterNote;pendingAfterNote=null;f();}
  if(!isTouch)lockPointer();
}
function winGame(){
  mode='ended';AudioSys.bell(1.2);
  if(document.pointerLockElement)document.exitPointerLock();
  els.endFace.textContent='🌧';els.endTitle.textContent='脱出成功';
  els.endText.textContent='雨の中へ転がり出る。背後で玄関の扉が、ひとりでに閉まった。——耳元で、最後に小さな声がした。「また、きかせて」。あなたの耳は、まだあなたのものだ。';
  els.endStats.textContent=`クリアタイム：${fmtTime(elapsedPlay)}　手記：${notesFound} / 3`;
  els.end.classList.remove('hidden');els.danger.style.opacity=0;
}
function gameOver(){
  if(mode==='ended')return;mode='ended';AudioSys.scare();
  els.jumpscare.classList.remove('hidden');
  if(document.pointerLockElement)document.exitPointerLock();
  setTimeout(()=>{
    els.jumpscare.classList.add('hidden');
    els.endFace.textContent='👂';els.endTitle.textContent='耳が飾りになった';
    els.endText.textContent='冷たい指が耳たぶに触れた瞬間、雨音も、自分の悲鳴も聞こえなくなった。古民家の床の間には今も、小さな飾りがひとつ増えているという。';
    els.endStats.textContent=`生存時間：${fmtTime(elapsedPlay)}　手記：${notesFound} / 3`;
    els.end.classList.remove('hidden');els.danger.style.opacity=0;
  },1150);
}

/* ---------------- init ---------------- */
function init(){
  renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputEncoding=THREE.sRGBEncoding;
  els.game.appendChild(renderer.domElement);
  scene=new THREE.Scene();scene.background=new THREE.Color(0x020203);scene.fog=new THREE.FogExp2(0x020203,.055);
  camera=new THREE.PerspectiveCamera(74,innerWidth/innerHeight,.05,28);camera.rotation.order='YXZ';scene.add(camera);
  clock=new THREE.Clock();

  scene.add(new THREE.AmbientLight(0x2a3345,.32));
  const hemi=new THREE.HemisphereLight(0x303a4a,0x0c0906,.22);scene.add(hemi);
  // flashlight = the only shadow-casting realtime light
  spot=new THREE.SpotLight(0xffe9bd,2.35,19,.58,.48,1.15);spot.castShadow=true;
  spot.shadow.mapSize.set(1024,1024);spot.shadow.bias=-.00045;spot.shadow.camera.near=.08;spot.shadow.camera.far=19;
  scene.add(spot);spotTarget=new THREE.Object3D();scene.add(spotTarget);spot.target=spotTarget;
  flashQuat=new THREE.Quaternion();

  buildHouse();buildDoll();
  createNote('living',-5.5,.49,5.05,.4);
  createNote('kitchen',9.45,1.0,6.05,-.5);
  createNote('dollroom',-8.7,.74,-.1,.25);

  setObjective('手記を3枚探す（Q長押しで耳を澄ますと方向が分かる）');updateHUD();
  bindEvents();
  animate();
}
function bindEvents(){
  addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
  document.addEventListener('mousemove',e=>{
    if(mode==='playing'&&document.pointerLockElement===renderer.domElement){
      player.yaw-=e.movementX*.0021;player.pitch=clamp(player.pitch-e.movementY*.0021,-1.45,1.45);
    }
  });
  document.addEventListener('pointerlockchange',()=>{
    if(!isTouch&&mode==='playing'&&document.pointerLockElement!==renderer.domElement)pauseGame();
  });
  renderer.domElement.addEventListener('click',()=>{if(mode==='playing'&&!isTouch&&document.pointerLockElement!==renderer.domElement)lockPointer();});
  document.addEventListener('keydown',e=>{
    if(e.repeat){keys[e.code]=true;return;}
    keys[e.code]=true;
    if(mode==='reading'&&(e.code==='KeyE'||e.code==='Enter'||e.code==='Escape')){closeNote();return;}
    if(mode!=='playing')return;
    if(e.code==='KeyF')toggleFlash();
    if(e.code==='KeyE')tryInteract();
  });
  document.addEventListener('keyup',e=>{keys[e.code]=false;});
  $('startBtn').addEventListener('click',startGame);
  $('resumeBtn').addEventListener('click',resumeGame);
  $('noteCloseBtn').addEventListener('click',closeNote);
  $('restartBtn1').addEventListener('click',()=>location.reload());
  $('restartBtn2').addEventListener('click',()=>location.reload());
  bindTouch();
}
function toggleFlash(){
  flashOn=!flashOn;spot.visible=flashOn;els.flash.textContent=flashOn?'🔦 ON':'🔦 OFF';
  AudioSys.burst(.05,'highpass',2400,.08);
}

/* ---------------- touch controls ---------------- */
const touchState={mx:0,mz:0,run:false,lookId:null,lx:0,ly:0,joyId:null};
function bindTouch(){
  if(!isTouch)return;
  const joy=$('joystick'),stick=$('stick');
  const setStick=(dx,dy)=>{stick.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;};
  joy.addEventListener('pointerdown',e=>{touchState.joyId=e.pointerId;joy.setPointerCapture(e.pointerId);});
  joy.addEventListener('pointermove',e=>{
    if(e.pointerId!==touchState.joyId)return;const r=joy.getBoundingClientRect();
    let dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2);const m=Math.hypot(dx,dy),max=42;
    if(m>max){dx=dx/m*max;dy=dy/m*max;}setStick(dx,dy);touchState.mx=dx/max;touchState.mz=-dy/max;
  });
  const joyEnd=e=>{if(e.pointerId===touchState.joyId){touchState.joyId=null;touchState.mx=0;touchState.mz=0;setStick(0,0);}};
  joy.addEventListener('pointerup',joyEnd);joy.addEventListener('pointercancel',joyEnd);
  renderer.domElement.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'){touchState.lookId=e.pointerId;touchState.lx=e.clientX;touchState.ly=e.clientY;}});
  renderer.domElement.addEventListener('pointermove',e=>{
    if(e.pointerId!==touchState.lookId||mode!=='playing')return;
    player.yaw-=(e.clientX-touchState.lx)*.005;player.pitch=clamp(player.pitch-(e.clientY-touchState.ly)*.005,-1.45,1.45);
    touchState.lx=e.clientX;touchState.ly=e.clientY;
  });
  $('btnInteract').addEventListener('click',()=>{if(mode==='reading')closeNote();else tryInteract();});
  $('btnFlash').addEventListener('click',toggleFlash);
  $('btnRun').addEventListener('click',e=>{touchState.run=!touchState.run;e.target.classList.toggle('active',touchState.run);});
}

/* ---------------- per-frame update ---------------- */
function updatePlayer(dt){
  let ix=0,iz=0;
  if(keys['KeyW']||keys['ArrowUp'])iz+=1;if(keys['KeyS']||keys['ArrowDown'])iz-=1;
  if(keys['KeyD']||keys['ArrowRight'])ix+=1;if(keys['KeyA']||keys['ArrowLeft'])ix-=1;
  if(isTouch){ix+=touchState.mx;iz+=touchState.mz;}
  const len=Math.hypot(ix,iz);if(len>1){ix/=len;iz/=len;}
  const running=(keys['ShiftLeft']||keys['ShiftRight']||touchState.run)&&iz>-.1;
  let speed=running?3.75:2.15;if(keys['KeyQ'])speed*=.55;
  const fwd=new THREE.Vector3(-Math.sin(player.yaw),0,-Math.cos(player.yaw));
  const right=new THREE.Vector3(Math.cos(player.yaw),0,-Math.sin(player.yaw));
  const wish=new THREE.Vector3().addScaledVector(fwd,iz*speed).addScaledVector(right,ix*speed);
  const k=1-Math.exp(-10*dt);player.vel.lerp(wish,k);
  const oldX=player.pos.x,oldZ=player.pos.z;
  const nx=player.pos.x+player.vel.x*dt;if(!collides(nx,player.pos.z))player.pos.x=nx;else player.vel.x=0;
  const nz=player.pos.z+player.vel.z*dt;if(!collides(player.pos.x,nz))player.pos.z=nz;else player.vel.z=0;
  const moved=Math.hypot(player.pos.x-oldX,player.pos.z-oldZ);
  player.stepAcc+=moved;
  const stride=running?2.6:2.0;
  if(player.stepAcc>stride&&moved>0){player.stepAcc=0;AudioSys.footstep(isWoodFloor(player.pos.x,player.pos.z));}
  player.bob+=moved*2.7;
  const targetRoll=clamp(-ix*.014,-.02,.02);player.roll=lerp(player.roll,targetRoll,1-Math.exp(-8*dt));
  const bobY=Math.sin(player.bob*2)*.021*clamp(player.vel.length()/2.15,0,1.25)+Math.sin(performance.now()*.0011)*.005;
  camera.position.set(player.pos.x,1.62+bobY,player.pos.z);
  camera.rotation.set(player.pitch,player.yaw,player.roll);
}
function updateFlash(dt){
  if(!spot)return;
  const camQ=camera.quaternion;
  flashQuat.slerp(camQ,1-Math.exp(-17*dt));
  const right=new THREE.Vector3(1,0,0).applyQuaternion(camQ),up=new THREE.Vector3(0,1,0).applyQuaternion(camQ);
  spot.position.copy(camera.position).addScaledVector(right,.17).addScaledVector(up,-.14);
  const dir=new THREE.Vector3(0,0,-1).applyQuaternion(flashQuat);
  spotTarget.position.copy(spot.position).addScaledVector(dir,12);spotTarget.updateMatrixWorld();
  if(huntActive&&flashOn){
    flickerTimer-=dt;
    if(Math.random()<dt*.22)flickerTimer=.1+Math.random()*.15;
    spot.intensity=flickerTimer>0?.55+Math.random()*.5:2.35;
  }else spot.intensity=2.35;
}
function updateDoors(dt){
  doors.forEach(d=>{
    d.current+=(d.target-d.current)*(1-Math.exp(-4.2*dt));
    const e=d.current*d.current*(3-2*d.current)*1.02*d.slideSign;
    if(d.axis==='x')d.group.position.x=d.closed.x+e;else d.group.position.z=d.closed.z+e;
    updateDoorCollider(d);
  });
}
function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(clock.getDelta(),.05);
  const t=clock.elapsedTime;
  if(mode==='title'){
    camera.position.set(player.pos.x,1.62,player.pos.z);
    camera.rotation.set(Math.sin(t*.23)*.04,Math.sin(t*.17)*.35,0);
    player.yaw=camera.rotation.y;player.pitch=0;
    flashQuat.copy(camera.quaternion);
  }
  if(mode==='playing'){
    elapsedPlay+=dt;
    updatePlayer(dt);updateDoll(dt);updateListen(dt);
    interactTimer-=dt;if(interactTimer<=0){interactTimer=.08;scanInteract();}
    // whispers
    if(notesFound>=1){whisperTimer-=dt;if(whisperTimer<=0){whisperTimer=huntActive?6+Math.random()*6:11+Math.random()*10;
      let pan=0,vol=.45;
      if(doll&&doll.visible){const dx=doll.position.x-player.pos.x,dz=doll.position.z-player.pos.z;const right=new THREE.Vector3(Math.cos(player.yaw),0,-Math.sin(player.yaw));const dir=new THREE.Vector3(dx,0,dz).normalize();pan=dir.dot(right);vol=clamp(1.15-Math.hypot(dx,dz)*.06,.3,1);}
      AudioSys.whisper(pan,vol);}}
    // heartbeat near doll in hunt
    if(huntActive&&doll&&doll.visible){
      const d=Math.hypot(doll.position.x-player.pos.x,doll.position.z-player.pos.z);
      heartbeatTimer-=dt;
      if(d<5&&heartbeatTimer<=0){heartbeatTimer=clamp(.42+d*.13,.5,1.1);AudioSys.heartbeat(clamp(1.15-d*.16,.25,1));}
    }
  }
  updateDoors(dt);
  updateFlash(dt);
  if(candleLight&&candleLight.intensity>0){candleLight.intensity=.88+Math.sin(t*11)*.09+Math.sin(t*23+1)*.05;candleFlames.forEach((f,i)=>{f.scale.y=2+Math.sin(t*13+i*2)*.35;});}
  if(keyMesh&&keyMesh.visible){keyMesh.rotation.y+=dt*1.4;keyMesh.position.y=.62+Math.sin(t*2.2)*.025;}
  if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)els.toast.classList.remove('show');}
  renderer.render(scene,camera);
}
/* Debug hooks are exposed only with ?debug=1 (used for automated playthrough tests). */
if(new URLSearchParams(location.search).has('debug')){
  window.MimiGameDebug={
    teleport(x,z,yaw,pitch){player.pos.set(x,0,z);player.yaw=yaw||0;player.pitch=pitch||0;player.vel.set(0,0,0);camera.position.set(x,1.62,z);camera.rotation.set(player.pitch,player.yaw,0);camera.updateMatrixWorld();scanInteract();},
    scan(){scanInteract();return currentInteract?currentInteract.id:null;},
    interact(){tryInteract();},
    closeNote, startGame,
    state(){return {mode,notesFound,hasKey,keySpawned,huntActive,x:+player.pos.x.toFixed(2),z:+player.pos.z.toFixed(2),dollVisible:!!(doll&&doll.visible),dollX:doll?+doll.position.x.toFixed(2):null,dollZ:doll?+doll.position.z.toFixed(2):null};}
  };
}
init();
})();
