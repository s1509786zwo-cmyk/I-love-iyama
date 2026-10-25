from pathlib import Path
p=Path(__file__).parent;s=(p/'main.js').read_text()
s=s.replace('let stairAssist=null;', 'let stairAssist=null,edgeGuard=null;')
s=s.replace('stairAssist=null;portals=[];', 'stairAssist=null;edgeGuard=null;portals=[];')
s=s.replace(" chair:{name:'公式SheenChair'", """ room1:{name:'新マップ1 — 33qxzs',url:'https://files.catbox.moe/33qxzs.glb',chain:true,targetHeight:5.709687522,floorRef:.476,previous:'hub',next:'room2',doors:[{id:'return',point:[1.516,1.8,1.807],normal:[-.668,0,-.744],width:1.25,height:2.55},{id:'next',point:[-5.88,1.8,1.98],normal:[.745,0,-.668],width:1.22,height:2.55}]},
 room2:{name:'新マップ2 — pt7rsw',url:'https://files.catbox.moe/pt7rsw.glb',chain:true,targetHeight:4.708696386,floorRef:.254,previous:'room1',next:'room3',doors:[{id:'return',point:[-1.64,1.55,-2.175],normal:[0,0,1],width:1.25,height:2.5},{id:'next',point:[3.055,1.35,-.30],normal:[-1,0,0],width:.88,height:2.15}]},
 room3:{name:'新マップ3 — wth21z',url:'https://files.catbox.moe/wth21z.glb',chain:true,targetHeight:13.456366956,floorRef:-1.30,previous:'room2',doors:[{id:'return',point:[-8.438,-.06,-7.08],normal:[1,0,0],width:1.15,height:2.25}]},
 chair:{name:'公式SheenChair'""")
s=s.replace("let bytes=await get(cfg.url);", """if(cfg.chain)for(const url of [...rawCache.keys()])if(Object.values(AREA_CONFIG).some(c=>c.chain&&c.url===url)&&url!==cfg.url)rawCache.delete(url);
   let bytes=await get(cfg.url);if(bytes.byteLength<20)throw Error('モデルの応答が空、または破損しています');""")
s=s.replace("if(key==='dungeon'&&new DataView(bytes)","if((key==='dungeon'||cfg.chain)&&new DataView(bytes)")
s=s.replace("const view=json.bufferViews[image.bufferView],source=", "const limit=cfg.chain?2048:1024,view=json.bufferViews[image.bufferView],source=")
s=s.replace('resizeWidth:1024,resizeHeight:1024','resizeWidth:limit,resizeHeight:limit',1).replace('canvas.width=canvas.height=1024;', 'canvas.width=canvas.height=limit;',1)
s=s.replace("'セラーのテクスチャ最適化 '","cfg.name+'：画像最適化 '")
a=s.index('   if(false){');b=s.index('   const manager=',a);s=s[:a]+s[b:]
s=s.replace('function bodyClear(x,y,z){', '''function withinFloorBoundary(x,z){
 if(!edgeGuard)return true;const b=edgeGuard.box,r=C.radius+.03;
 if(x<b.min.x+r||x>b.max.x-r||z<b.min.z+r||z>b.max.z-r)return false;
 for(const [dx,dz]of[[0,0],[r,0],[-r,0],[0,r],[0,-r]]){const f=floorAt(x+dx,z+dz,edgeGuard.y+.5,1.15);if(!f||f.point.y<edgeGuard.y-.55)return false;}return true;
}
function bodyClear(x,y,z){''')
s=s.replace('const target=camera.position.clone();target[axis]+=distance;', 'const target=camera.position.clone();target[axis]+=distance;if(!withinFloorBoundary(target.x,target.z))return;')
s=s.replace("else if(key==='dungeon'){cellarScale(group,cfg);await addExternalBarrels(group);}else humanScale(group,cfg);", "else if(key==='dungeon'){cellarScale(group,cfg);await addExternalBarrels(group);}else if(cfg.chain)scaleChain(group,cfg);else humanScale(group,cfg);")
s=s.replace('installHubOpening(group);}', 'installHubOpening(group);installChainGate();}')
s=s.replace('else installRoomReturn(group);', "else if(cfg.chain)installNativeChainDoors(group,cfg);else installRoomReturn(group);\n if(key==='dungeon')edgeGuard={box:new THREE.Box3().setFromObject(group),y:scaleReport.floorY};")
s=s.replace(" hemi.intensity=key==='dungeon'", " hemi.intensity=cfg.chain?.45:key==='dungeon'").replace("moon.intensity=key==='dungeon'", "moon.intensity=cfg.chain?.15:key==='dungeon'")
s=s.replace('for(const p of portals){const aimed=', '''for(const p of portals){
  if(p.nativeDoor){const at=viewRay.intersectPlane(p.plane,point);if(!at)continue;const delta=at.clone().sub(p.position),distance=camera.position.distanceTo(at);if(distance>2.8||Math.abs(delta.dot(p.right))>p.width/2||Math.abs(delta.y)>p.height/2)continue;const hit=nativeCast(camera.position,direction,distance+.3,true)[0];if(!hit||hit.distance<distance-.24||Math.abs(p.plane.distanceToPoint(hit.point))>.3)continue;if(distance<nearest){nearest=distance;selectedPortal=p;}continue;}
  const aimed=''')
# New-chain failure returns to the exact source; existing routes retain existing fallback behavior.
a=s.index("}catch(e){error=e;console.error(e);$('fadeLabel')");b=s.index('\n spot.shadow.needsUpdate=true;shadowTime=-1;await fade(0)',a)
x=s[a:b].replace('読込に失敗しました。大回廊へ戻ります…','読込に失敗しました。安全なエリアへ戻ります…').replace("try{await loadArea('corridor');", "try{if(AREA_CONFIG[target]?.chain||AREA_CONFIG[from]?.chain){await loadArea(from);restorePose(pose);}else{await loadArea('corridor');").replace('routeStack.pop();}catch(rollback)', 'routeStack.pop();}}catch(rollback)')
s=s[:a]+x+s[b:]
insert='''
function installChainGate(){
 const x=13.3,z=0,f=floorAt(x,z,C.floor+.45,1.1);if(!f||!bodyClear(x,f.point.y,z))throw Error('新マップへの既存通路に足場がありません');
 nativeOpening('chainGate','room1','中庭奥の大門：新マップ1へ',[14.25,f.point.y+1.12,z],[x,f.point.y,z],[.65,2.5,2.6]);
}
function scaleChain(root,cfg){
 root.scale.setScalar(1);root.updateMatrixWorld(true);const before=new THREE.Box3().setFromObject(root),size=before.getSize(new THREE.Vector3());const factor=cfg.targetHeight/size.y;root.scale.setScalar(factor);root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(root),center=box.getCenter(new THREE.Vector3());root.position.x-=center.x;root.position.z-=center.z;root.position.y-=cfg.floorRef*factor;root.updateMatrixWorld(true);
 scaleReport={factor,bboxHeight:size.y*factor,eyeHeight:C.eye,floorY:0,sourceFloor:cfg.floorRef,scaleBasis:'full BBox / surveyed original scan dimensions'};
 const seen=new Map();root.traverse(o=>{if(!o.isMesh)return;o.material=[].concat(o.material).map(m=>{if(!m.isMeshBasicMaterial)return m;if(seen.has(m))return seen.get(m);const n=new THREE.MeshStandardMaterial({map:m.map,color:m.color,emissiveMap:m.map,emissive:m.color,emissiveIntensity:.65,roughness:.95,metalness:0,side:m.side,transparent:m.transparent,opacity:m.opacity,alphaTest:m.alphaTest,vertexColors:m.vertexColors});seen.set(m,n);return n;});if(o.material.length===1)o.material=o.material[0];});for(const m of seen.keys())m.dispose();
}
function installNativeChainDoors(root,cfg){
 const factor=root.scale.x,toWorld=arr=>new THREE.Vector3(...arr).multiplyScalar(factor).add(root.position),roomBox=new THREE.Box3().setFromObject(root);
 for(const def of cfg.doors){
  const center=toWorld(def.point),normal=new THREE.Vector3(...def.normal).normalize(),right=new THREE.Vector3().crossVectors(up,normal).normalize(),plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,center);let stand=null;
  for(const distance of[.85,1.05,1.3,1.55,1.8]){for(const side of[0,.2,-.2,.4,-.4]){const p=center.clone().addScaledVector(normal,distance).addScaledVector(right,side),f=floorAt(p.x,p.z,.6,1.3);if(!f||Math.abs(f.point.y)>.5||!bodyClear(p.x,f.point.y,p.z))continue;const eye=new THREE.Vector3(p.x,f.point.y+C.eye,p.z),toward=center.clone().sub(eye),length=toward.length(),hit=nativeCast(eye,toward.normalize(),length+.3,true)[0];if(!hit||hit.distance<length-.25||Math.abs(plane.distanceToPoint(hit.point))>.3)continue;stand=[p.x,f.point.y,p.z];break;}if(stand)break;}
  if(!stand)throw Error(cfg.name+'：本物の扉の前に安全な足場を検出できません（'+def.id+'）');
  nativeOpening(def.id,def.id==='return'?cfg.previous:cfg.next,def.id==='return'?(cfg.previous==='hub'?'本物の入口ドア：Sponza中庭へ戻る':'本物の入口ドア：前の部屋へ戻る'):'次の部屋へ',center.toArray(),stand,[def.width*factor,def.height*factor,.45],def.id==='return'?'return':'enter');
  Object.assign(portals.at(-1),{nativeDoor:true,normal,right,plane,width:def.width*factor,height:def.height*factor});
  if(def.id==='return'){activeSpawn=new THREE.Vector3(stand[0],stand[1]+C.eye,stand[2]);activeLook=activeSpawn.clone().addScaledVector(normal,4);}
 }
 edgeGuard={box:roomBox,y:0};
}
'''
s=s.replace('function installRoomReturn(root){',insert+'\nfunction installRoomReturn(root){')
# Diagnostics only, removed by the production build.
s=s.replace('state:()=>({ready,failed', 'state:()=>({edgeGuard:edgeGuard?{min:edgeGuard.box.min.toArray(),max:edgeGuard.box.max.toArray(),y:edgeGuard.y}:null,activeMeshCount:architecture.children.length,ready,failed')
s=s.replace("portals:portals.map(p=>({id:p.id", "portals:portals.map(p=>({nativeDoor:!!p.nativeDoor,id:p.id")
(p/'main.js').write_text(s)
s=(p/'template.html').read_text().replace('GRAND ATLAS — 拡張城ハブ','GRAND ATLAS — 本物の扉でつなぐ3マップ')
s=s.replace('既存の大回廊・大図書館・休憩室を残し、自分の部屋と地下ワインセラーへの動線を追加。','Sponza中庭・大回廊・大図書館・自分の部屋・休憩室・ワインセラーを維持。中庭奥の既存大門から新しい3マップへ。Villageは削除。')
s=s.replace('中庭側面通路のアーチ型鉄扉 → 大回廊。','中庭奥（開始時の正面方向）の大門付近でE → 33qxzs → pt7rsw → wth21z。新マップでは本物の扉に照準を合わせてE。入口の扉は前のエリアへ、奥・側面の扉は次へ。3つ目は入口の扉で引き返します。<br>中庭側面通路のアーチ型鉄扉 → 大回廊。')
s=s.replace('<p>暗転約1秒、通信制限90秒、解析制限30秒。', '<p>新3マップはユーザー指定のCatbox GLBを直接ロード。新マップにドア・黒アーチ・板・光る入口・床などの描画オブジェクトは追加していません。原モデルの実在する扉を画像とレイキャストで測定し、非描画の解析平面と矩形範囲で照準を判定。手前に家具や壁がある場合は反応しません。全体BBoxと元スキャン寸法による均一拡縮、元の床と壁のBVH、足元から1.65mの目線を使用。写真測量モデル固有の欠損や歪みは新造メッシュで埋めません。端からの落下防止のみ解析的に補助。内装画像は最大2048²へ軽量化、元の家具配置と建築は維持。ベイク画像の見え方を残しながら懐中電灯にも反応する材質を使用。新GLBのメモリキャッシュは1ファイル分に制限します。</p><p>暗転約1秒、通信制限120秒、解析制限60秒。')
s=s.replace('追加エリアの失敗時は大回廊へ復帰。','新3マップの読込失敗時は移動元のエリアと位置・向きに復帰。既存の室への失敗時は大回廊へ復帰。')
s=s.replace('three.js / three-mesh-bvh: MIT。','新3GLB: ユーザー提供URL。原作者・ライセンス未確認、公開・再配布・商用利用前に権利確認が必要。three.js / three-mesh-bvh: MIT。')
(p/'template.html').write_text(s)
assert (p/'maps.js').read_bytes()==Path('/home/user/linked_cellar/maps.js').read_bytes()
