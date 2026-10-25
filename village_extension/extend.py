from pathlib import Path
p=Path(__file__).parent;s=(p/'main.js').read_text()
s=s.replace("chair:{name:'公式SheenChair'", "village:{name:'Village — 中世の村・街並み',url:'https://assets.babylonjs.com/meshes/village.glb',targetHeight:5.1225},\n chair:{name:'公式SheenChair'")
s=s.replace('let stairAssist=null;', 'let stairAssist=null,edgeGuard=null;')
s=s.replace('stairAssist=null;portals=[];', 'stairAssist=null;edgeGuard=null;portals=[];')
s=s.replace('function bodyClear(x,y,z){', '''function supportedBoundary(x,z){
 if(!edgeGuard)return true;const b=edgeGuard.box,r=C.radius+.035;
 if(x<b.min.x+r||x>b.max.x-r||z<b.min.z+r||z>b.max.z-r)return false;
 for(const [dx,dz]of[[0,0],[r,0],[-r,0],[0,r],[0,-r]])if(!floorAt(x+dx,z+dz,edgeGuard.y+.48,1.0))return false;
 return true;
}
function bodyClear(x,y,z){''')
s=s.replace('const target=camera.position.clone();target[axis]+=distance;', 'const target=camera.position.clone();target[axis]+=distance;\n if(!supportedBoundary(target.x,target.z))return;')
s=s.replace('else humanScale(group,cfg);\n\n }', "else if(key==='village')villageScale(group);else humanScale(group,cfg);\n\n }")
s=s.replace('installHubOpening(group);}', 'installHubOpening(group);installVillageGate();}')
s=s.replace('else installRoomReturn(group);', "else if(key==='village')installVillageReturn(group);else installRoomReturn(group);\n if(key==='dungeon')edgeGuard={box:new THREE.Box3().setFromObject(group),y:scaleReport.floorY};")
s=s.replace("hemi.intensity=key==='dungeon'", "hemi.intensity=key==='village'?1.25:key==='dungeon'")
s=s.replace("moon.intensity=key==='dungeon'", "moon.intensity=key==='village'?1.6:key==='dungeon'")
s=s.replace(" stage(cfg.name+' · 目線 '", " scene.background.set(key==='village'?0xa4c8df:0x09111c);scene.fog.color.copy(scene.background);scene.fog.density=key==='village'?.003:.005;moon.color.set(key==='village'?0xffedcf:0x9fbfe8);\n stage(cfg.name+' · 目線 '")
a=s.index("}catch(e){error=e;console.error(e);$('fadeLabel')");b=s.index('\n spot.shadow.needsUpdate=true;shadowTime=-1;await fade(0)',a)
old=s[a:b]
# Retain original rollback for old routes; the new external village returns to its source on failure.
old=old.replace("try{await loadArea('corridor');", "try{if(target==='village'){await loadArea(from);restorePose(pose);}else{await loadArea('corridor');")
old=old.replace("routeStack.pop();}catch(rollback)", "routeStack.pop();}}catch(rollback)")
s=s[:a]+old+s[b:]
insert='''
function installVillageGate(){
 const x=13.3,z=0,f=floorAt(x,z,C.floor+.45,1.1);
 if(!f||!bodyClear(x,f.point.y,z))throw Error('村への通路前に安全な足場がありません');
 nativeOpening('villageGate','village','中庭奥の大門：Villageへ',[14.25,f.point.y+1.12,z],[x,f.point.y,z],[.65,2.5,2.6]);
}
function villageScale(root){
 root.scale.setScalar(1);root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(root),height=box.max.y-box.min.y;
 const factor=AREA_CONFIG.village.targetHeight/height;root.scale.setScalar(factor);root.updateMatrixWorld(true);box.setFromObject(root);const center=box.getCenter(new THREE.Vector3());root.position.x-=center.x;root.position.z-=center.z;root.position.y-=box.min.y;root.updateMatrixWorld(true);
 scaleReport={factor,bboxHeight:height*factor,eyeHeight:C.eye,scaleBasis:'source village house walls approximately 3m; entire model uniformly scaled'};
}
function installVillageReturn(root){
 const ground=root.getObjectByName('ground');if(!ground)throw Error('Villageの元の地面がありません');
 const box=new THREE.Box3().setFromObject(ground),x=box.getCenter(new THREE.Vector3()).x,z=box.max.z-3.2;
 const f=floorAt(x,z,1,2);if(!f||!bodyClear(x,f.point.y,z))throw Error('村の入口に安全な足場がありません');
 edgeGuard={box,y:f.point.y};activeSpawn=new THREE.Vector3(x,f.point.y+C.eye,z);activeLook=new THREE.Vector3(x,f.point.y+C.eye,box.min.z+4);
 const portalZ=box.max.z-1.4;nativeOpening('return','hub','村の入口：Sponza中庭へ戻る',[x,f.point.y+1.1,portalZ],[x,f.point.y,z],[2.4,2.5,.7],'return');
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const ctx=canvas.getContext('2d');ctx.fillStyle='rgba(12,20,28,.88)';ctx.fillRect(0,0,512,128);ctx.strokeStyle='#cfb984';ctx.strokeRect(2,2,508,124);ctx.fillStyle='#ffe3a8';ctx.font='bold 30px sans-serif';ctx.textAlign='center';ctx.fillText('SPONZA',256,51);ctx.font='23px sans-serif';ctx.fillText('E : RETURN',256,94);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const marker=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:true}));marker.position.set(x,f.point.y+1.5,portalZ);marker.scale.set(2.1,.525,1);marker.userData.noCollision=true;architecture.add(marker);
}
'''
s=s.replace('function installRoomReturn(root){',insert+'\nfunction installRoomReturn(root){')
# Diagnostics allow regressions of invisible fall guards; not included in release.
s=s.replace('state:()=>({ready,failed', 'state:()=>({edgeGuard:edgeGuard?{min:edgeGuard.box.min.toArray(),max:edgeGuard.box.max.toArray(),y:edgeGuard.y}:null,ready,failed')
(p/'main.js').write_text(s)
s=(p/'template.html').read_text().replace('GRAND ATLAS — 拡張城ハブ','GRAND ATLAS — 城ハブ ＋ Village')
s=s.replace('既存の大回廊・大図書館・休憩室を残し、自分の部屋と地下ワインセラーへの動線を追加。','Sponza中庭・大回廊・大図書館・自分の部屋・休憩室・地下ワインセラーを維持し、外部Villageを追加。')
s=s.replace('中庭側面通路のアーチ型鉄扉 → 大回廊。','中庭奥（開始時の正面方向）の大門付近でE → Village。村の入口のSPONZA表示に近づいてEで帰還。<br>中庭側面通路のアーチ型鉄扉 → 大回廊。')
s=s.replace('<p>暗転約1秒、通信制限90秒、解析制限30秒。','<p>Villageは指定の <a href="https://assets.babylonjs.com/meshes/village.glb">Babylon.js公式village.glb</a> をそのままGLTFLoaderで取得します。建物配置やメッシュは変更せず、BBoxによる均一拡縮のみ。元モデルは約15×16単位の小規模な低ポリ村で、超巨大・写実マップとは称しません。壁を約3mに合わせ、約45×48mの地面にします。村は入口から正確に帰還し、ロード失敗時も元の中庭へ復帰。元の地面を使用し、端からの落下を解析的な境界で防止。ワインセラーも欠けた壁や床の端から落ちないよう、見た目を変えず境界判定を追加しています。未取得のSun Temple／Grand Cisternは実装済みと称しません。</p><p>暗転約1秒、通信制限120秒、解析制限60秒。')
s=s.replace('three.js / three-mesh-bvh: MIT。','Village: <a href="https://github.com/BabylonJS/Assets">BabylonJS/Assets 配布元・利用条件</a>（個別アセットの権利条件を確認してください）。three.js / three-mesh-bvh: MIT。')
(p/'template.html').write_text(s)
assert (p/'maps.js').read_bytes()==Path('/home/user/linked_cellar/maps.js').read_bytes()
