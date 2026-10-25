from pathlib import Path
p=Path('/home/user/playable_game/src/game.js');s=p.read_text()
s=s.replace("const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints>0;","const isTouch = matchMedia('(pointer: coarse)').matches;")
s=s.replace('let notesFound=0,','let hasStoreKey=false,storeUnlocked=false;\nlet notesFound=0,')
s=s.replace('roughness:.92,metalness:0','roughness:.82,metalness:0,bumpMap:t,bumpScale:.018,roughnessMap:t')
s=s.replace('wood:mat(texWood),woodFloor:mat(texWood,0xffffff,5,4)','wood:mat(texWood,0xffffff,1,1,{roughness:.62,bumpScale:.025}),woodFloor:mat(texWood,0xffffff,5,4,{roughness:.58,bumpScale:.035})')
s=s.replace("g.fillStyle='#96965f'","g.fillStyle='#929072'")
s=s.replace('for(let y=0;y<h;y+=7)', 'for(let y=0;y<h;y+=3)')
s=s.replace('emissiveIntensity:.32,roughness:.8','emissiveIntensity:.10,roughness:.92,transparent:true,opacity:.87,side:THREE.DoubleSide')
s=s.replace("  return grp;\n}\nfunction makeHit", "  for(let i=0;i<=4;i++)addBox(.028,1.4,.045,(-(w||1.7)/2+.07)+i*((w||1.7)-.14)/4,0,.085,MAT.darkWood,{parent:grp});\n  for(let i=0;i<=5;i++)addBox((w||1.7)-.14,.025,.045,0,-.7+i*.28,.085,MAT.darkWood,{parent:grp});\n  return grp;\n}\nfunction makeHit")
s=s.replace("function toggleDoor(d,byPlayer){\n", "function toggleDoor(d,byPlayer){\n  if(d.id==='store'&&!storeUnlocked){if(!hasStoreKey){showToast('納戸は施錠されている。座敷のタンスに鍵があるはずだ。');AudioSys.knock();return;}storeUnlocked=true;showToast('納戸の鍵を使った。奥から冷たい空気が流れ出す。');}\n")
s=s.replace("wallRun('x',-8,-10,10,[],.28);","wallRun('x',-8,-10,10,[{c:0,w:1.6}],.28);")
s=s.replace("wallRun('z',-10,-8,8,[],.28);","wallRun('z',-10,-8,8,[{c:5,w:1.4},{c:-4,w:1.4}],.28);")
s=s.replace("wallRun('z',10,-8,8,[],.28);","wallRun('z',10,-8,8,[{c:5,w:1.4},{c:-4,w:1.4}],.28);")
s=s.replace('  buildProps();','  buildProps();buildExtension();')
s=s.replace('  AudioSys.paper();updateHUD();','  AudioSys.paper();AudioSys.fadeLayer(notesFound);updateHUD();')
s=s.replace("  if(x<-9.65||x>9.65||z<-7.65||z>7.65)return true;","  const inMain=x>-12.7&&x<12.7&&z>-10.7&&z<7.65;\n  const inStore=x>-3.7&&x<3.7&&z>-17.7&&z<=-10.7;\n  if(!inMain&&!inStore)return true;")
s=s.replace("  if(notesFound<3){","  if(!hasStoreKey&&notesFound>=2)return new THREE.Vector3(-8.3,1,5);\n  if(hasStoreKey&&!storeUnlocked&&notesFound>=2)return new THREE.Vector3(0,1,-11);\n  if(notesFound<3){",1)
s=s.replace("    this.master=this.ctx.createGain();", "    this.layers=[];\n    this.master=this.ctx.createGain();")
s=s.replace('rain.start();','rain.start();this.layers.push(rg);')
s=s.replace('osc.start();','osc.start();this.layers.push(og);')
s=s.replace('osc2.start();','osc2.start();this.layers.push(og2);')
s=s.replace('  burst(dur,type',"  fadeLayer(n){if(!this.ctx||!this.layers)return;const g=this.layers[n-1];if(g){g.gain.cancelScheduledValues(this.ctx.currentTime);g.gain.setTargetAtTime(0,this.ctx.currentTime,.8);}},\n  burst(dur,type")
s=s.replace("  mode='playing';\n  if(isTouch)","  player.yaw=0;player.pitch=0;\n  mode='playing';\n  if(isTouch)")
s=s.replace("if(p&&p.catch)p.catch(()=>{});", "if(p&&p.catch)p.catch(()=>showToast('マウスロックを許可してください。別タブで開くと正常に操作できます。',6500));")
s=s.replace("  document.addEventListener('pointerlockchange',()=>{", "  document.addEventListener('pointerlockerror',()=>showToast('マウスロックが許可されていません。HTMLをブラウザで直接開いてください。',6500));\n  addEventListener('blur',()=>{Object.keys(keys).forEach(k=>keys[k]=false);});\n  document.addEventListener('pointerlockchange',()=>{")
s=s.replace("renderer.domElement.addEventListener('click',()=>{if(mode==='playing'&&!isTouch&&document.pointerLockElement!==renderer.domElement)lockPointer();});", "renderer.domElement.addEventListener('click',()=>{if(mode!=='playing'||isTouch)return;if(document.pointerLockElement!==renderer.domElement)lockPointer();else{scanInteract();tryInteract();}});")
s=s.replace('0x2a3345,.32','0x788fac,.24').replace('0x303a4a,0x0c0906,.22','0x576c8d,0x18120b,.24')
s=s.replace('  // flashlight =',"  const moon=new THREE.DirectionalLight(0x8aaee0,.28);moon.position.set(12,18,-8);scene.add(moon);\n  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;\n  // flashlight =")
s=s.replace("  buildHouse();buildDoll();","  buildHouse();buildDoll();doll.position.set(0,0,-16);\n  extendNavigation();")
s=s.replace("createNote('dollroom',-8.7,.74,-.1,.25)","createNote('dollroom',-2.4,.74,-15.5,.25)")
s=s.replace("  setObjective('手記を3枚探す", "  batchStatic();\n  setObjective('手記を3枚探す")
s=s.replace("  renderer.render(scene,camera);","  updateRain(dt);\n  renderer.render(scene,camera);")
s=s.replace("dollroom:{title:'手記 ― 人形の間にて'", "dollroom:{title:'手記 ― 奥の納戸にて'")
# reduce third note spawn objective ambiguity
s=s.replace("const candidates=[[-5,-3.5],[-8,1.7],[-5,5.1],[0,-6.8]];","const candidates=[[0,-16],[-11.5,-9.5],[11.5,-9.5]];")
# append helpers before init invocation
insert=r'''
/* Enlarged estate: east/west engawa + north corridor + locked storehouse. */
let rainLines=null;
function buildExtension(){
  floorRect(-11.5,-1.5,3,13,MAT.woodFloor);floorRect(11.5,-1.5,3,13,MAT.woodFloor);
  floorRect(0,-9.5,26,3,MAT.woodFloor);
  floorRect(-11.5,6.5,3,3,MAT.woodFloor);floorRect(11.5,6.5,3,3,MAT.woodFloor);
  floorRect(0,-14.5,8,7,mat(texTatami,0xd4cba3,4,6));
  wallRun('x',-11,-13,13,[{c:0,w:1.25}]);
  wallRun('x',-18,-4,4,[]);wallRun('z',-4,-18,-11,[]);wallRun('z',4,-18,-11,[]);
  wallRun('x',8,-13,-10,[]);wallRun('x',8,10,13,[]);
  for(const x of [-13,13]){
    // Open shutter slits expose the garden without allowing the player outside.
    addBox(.15,.72,19,x,.36,-1.5,MAT.darkWood,{collider:true});
    addBox(.18,.35,19,x,2.55,-1.5,MAT.beam);
    for(let z=-10;z<=8;z+=2.25){addBox(.18,2.7,.16,x,1.35,z,MAT.beam);}
    for(let z=-9;z<8;z+=1.1){addBox(.09,1.6,.08,x,1.55,z,MAT.darkWood);}
  }
  for(const x of [-11.5,11.5]){
    const c=addBox(3,.08,19,x,2.75,-1.5,MAT.darkWood);
    for(let z=-10;z<8;z+=2.8)addBox(3,.12,.18,x,2.55,z,MAT.beam);
  }
  addBox(26,.09,3,0,2.75,-9.5,MAT.darkWood);addBox(8,.10,7,0,2.75,-14.5,MAT.darkWood);
  const door=createDoor('store',0,-10.93,'x',1,0,'納戸の引き戸');
  door.group.children.filter(m=>m.material===MAT.fusuma).forEach(m=>m.material=MAT.darkWood);
  addBox(.15,.24,.05,.38,1.1,-10.82,MAT.metal);
  addBox(1.2,.65,.7,0,.325,-16,MAT.darkWood,{collider:true});
  tansu(-2.5,-15.5,0);tansu(2.7,-16.5,0);
  // Small brass store key on the front-room cabinet.
  const kg=new THREE.Group();kg.position.set(-8.3,1.25,5);scene.add(kg);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.08,.018,6,12),MAT.gold);kg.add(ring);
  addBox(.025,.20,.025,0,-.15,0,MAT.gold,{parent:kg});
  makeHit(kg,0,0,0,.65,.65,.65,{id:'store_key',active:()=>!hasStoreKey,prompt:()=>'[E / 左クリック] 納戸の鍵を拾う',action:()=>{hasStoreKey=true;kg.visible=false;AudioSys.paper();els.keyState.textContent='🗝 納戸の鍵';showToast('納戸の鍵を手に入れた。北の回廊の中央へ。');}});
  // damp stone garden, shrubs, and rain, all procedural
  for(const side of [-1,1]){
    floorRect(side*17,0,7,28,mat(texStone,0x42515a,3,8),-.025);
    for(let j=0;j<10;j++){
      const rock=new THREE.Mesh(new THREE.IcosahedronGeometry(.4+(j%3)*.17,0),mat(texStone,0x4c5651));
      rock.position.set(side*(15+(j%3)*1.2),.15,-13+j*2.1);rock.scale.set(1.3,.6,1);scene.add(rock);
    }
  }
  const verts=new Float32Array(500*6);
  for(let i=0;i<500;i++){const x=(i%2?1:-1)*(13.4+Math.random()*8),y=Math.random()*6,z=-18+Math.random()*32;verts.set([x,y,z,x-.035,y-.25,z],i*6);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(verts,3));
  rainLines=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:0x93aec7,transparent:true,opacity:.24}));scene.add(rainLines);
}
function updateRain(dt){if(!rainLines)return;const a=rainLines.geometry.attributes.position;for(let i=0;i<a.count;i+=2){let y=a.getY(i)-dt*6;if(y<-.2)y=6;a.setY(i,y);a.setY(i+1,y-.25);}a.needsUpdate=true;}
function extendNavigation(){
  const chain=(pts,connect)=>{let prev=connect;for(const pt of pts){const n=NAV_NODES.length;NAV_NODES.push(pt);NAV_ADJ.push([]);if(prev!==null){NAV_ADJ[prev].push(n);NAV_ADJ[n].push(prev);}prev=n;}return prev;};
  const west=chain([[-11.5,5],[-11.5,-4],[-11.5,-9.5],[0,-9.5],[11.5,-9.5],[11.5,-4],[11.5,5]],23);
  NAV_ADJ[west].push(26);NAV_ADJ[26].push(west);
  const north=NAV_NODES.findIndex(n=>n[0]===0&&n[1]===-9.5);
  NAV_ADJ[north].push(7);NAV_ADJ[7].push(north);
  chain([[0,-11.8],[0,-14],[0,-16]],north);
  // Cross-links from the old rooms to the engawa.
  for(const [a,b] of [[16,29],[20,33]]){NAV_ADJ[a].push(b);NAV_ADJ[b].push(a);}
}
/* Merge noninteractive static details by material and spatial cell.
   Each cell retains built-in frustum culling; raycast occluders remain separate.
   No unsafe hiding of rooms / interactive objects through doorways. */
function batchStatic(){
  const groups=new Map();
  scene.children.slice().forEach(m=>{
    if(!m.isMesh||!m.geometry.attributes.normal||m===keyMesh||occluders.includes(m)||hitMeshes.includes(m)||candleFlames.includes(m))return;
    if(m.geometry.index===null)return;
    const k=m.material.uuid+':'+Math.floor(m.position.x/5)+':'+Math.floor(m.position.z/5);
    if(!groups.has(k))groups.set(k,[]);groups.get(k).push(m);
  });
  for(const list of groups.values()){
    if(list.length<3)continue;
    const positions=[],normals=[],uvs=[];
    for(const m of list){m.updateMatrixWorld(true);const g=m.geometry.toNonIndexed();g.applyMatrix4(m.matrixWorld);positions.push(...g.attributes.position.array);normals.push(...g.attributes.normal.array);uvs.push(...g.attributes.uv.array);g.dispose();}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.computeBoundingSphere();
    const m=new THREE.Mesh(g,list[0].material);m.castShadow=true;m.receiveShadow=true;scene.add(m);list.forEach(o=>scene.remove(o));
  }
}
'''
s=s.replace('\ninit();\n})();', '\n'+insert+'\ninit();\n})();')
p.write_text(s)
