from pathlib import Path
p=Path(__file__).parent;s=Path('/home/user/new_chain/main.js').read_text()
s=s.replace('Math.min(devicePixelRatio,1.5)','Math.min(window.devicePixelRatio,2.0)').replace('Math.min(devicePixelRatio,1.25)','Math.min(window.devicePixelRatio,2.0)')
s=s.replace('t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());','enhanceTexture(t);')
s=s.replace("function normalizeAsset(r,span,cx,baseY)","function enhanceTexture(texture){texture.anisotropy=renderer.capabilities.getMaxAnisotropy();texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;}\nfunction normalizeAsset(r,span,cx,baseY)")
# Retain the original full-resolution images: no downsampling for ANY external map.
a=s.index("   if((key==='dungeon'||cfg.chain)");b=s.index("\n   if(new DataView(bytes)",a);s=s[:a]+'''   if(new DataView(bytes).getUint32(0,true)===0x46546c67&&new DataView(bytes).getUint32(8,true)!==bytes.byteLength)throw Error('GLBが途中で切れています。正常なファイルに差し替えてください');
'''+s[b:]
a=s.index('function installChainGate()');b=s.index('function scaleChain',a)
s=s[:a]+'''// Surveyed Sponza coordinates; only the lion route receives new visible geometry.
function archShape(radius,spring){const shape=new THREE.Shape();shape.moveTo(-radius,0);shape.lineTo(radius,0);shape.lineTo(radius,spring);shape.absarc(0,spring,radius,0,Math.PI,false);shape.closePath();return shape;}
function addLionArch(){
 const gate=new THREE.Group();gate.name='LionWallPortal';gate.position.set(14.2,C.floor,0);gate.rotation.y=Math.PI/2;
 const black=new THREE.Mesh(new THREE.ExtrudeGeometry(archShape(1.3,2.4),{depth:1.4,bevelEnabled:false,curveSegments:32}),new THREE.MeshBasicMaterial({color:0x000000,side:THREE.DoubleSide}));gate.add(black);
 const outline=archShape(1.65,2.4),hole=new THREE.Path(archShape(1.3,2.4).getPoints(48).reverse());outline.holes.push(hole);
 const frame=new THREE.Mesh(new THREE.ExtrudeGeometry(outline,{depth:.5,bevelEnabled:false,curveSegments:32}),new THREE.MeshStandardMaterial({map:stone.map,normalMap:stone.normalMap,roughnessMap:stone.roughnessMap,color:0xaaa493,roughness:1}));frame.position.z=-.12;frame.castShadow=true;frame.receiveShadow=true;gate.add(frame);architecture.add(gate);
}
function installChainGate(){
 const x=13.2,z=0,f=floorAt(x,z,C.floor+.45,1.1);if(!f||!bodyClear(x,f.point.y,z))throw Error('ライオン前に安全な足場がありません');
 nativeOpening('chainGate','room1','大広間へ',[14.16,f.point.y+1.6,z],[x,f.point.y,z],[.08,3.65,2.6]);
}
function installReservedDoor(root){
 let source;root.traverse(o=>{if(!source&&o.isMesh)source=o;});
 const door=source.localToWorld(new THREE.Vector3(-64,100,-650)),stand=new THREE.Vector3(door.x,0,door.z+1.05),f=floorAt(stand.x,stand.z,3,4);
 if(!f||!bodyClear(stand.x,f.point.y,stand.z))throw Error('反対側の鉄扉前に安全な足場がありません');
 nativeOpening('door2',null,'扉を調べる',[door.x,f.point.y+1.15,door.z+.18],[stand.x,f.point.y,stand.z],[1.45,2.4,.55],'reserved');
}
''' +s[b:]
a=s.index(' architecture.add(group);group.updateMatrixWorld(true);group.traverse');b=s.index(' activeArea=key;',a)
s=s[:a]+''' architecture.add(group);group.updateMatrixWorld(true);const seenTextures=new Set();group.traverse(o=>{if(o.isLight){o.visible=false;return;}if(!o.isMesh)return;o.castShadow=o.userData.noCollision!==true;o.receiveShadow=true;o.frustumCulled=true;for(const m of[].concat(o.material))for(const t of Object.values(m)){if(t?.isTexture&&!seenTextures.has(t)){seenTextures.add(t);enhanceTexture(t);}}});
 if(key==='hub')addLionArch();
'''+s[b:]
s=s.replace('installHubOpening(group);installChainGate();','installHubOpening(group);installReservedDoor(group);installChainGate();')
s=s.replace('if(!aimed&&distance>1.65)continue;','if(!aimed)continue;')
s=s.replace("let wood=null,paving=null", "let closedUntil=0;\nlet wood=null,paving=null")
s=s.replace("if(selectedPortal)$('doorPrompt').textContent='Eキー：'+selectedPortal.label;", "if(performance.now()<closedUntil)$('doorPrompt').textContent='扉は固く閉ざされている…';else if(selectedPortal)$('doorPrompt').textContent='Eキー：'+selectedPortal.label;")
s=s.replace("const portal=selectedPortal;if(!portal)return;", "const portal=selectedPortal;if(!portal)return;if(!portal.target){closedUntil=performance.now()+2500;$('doorPrompt').textContent='扉は固く閉ざされている…';return;}")
s=s.replace("activeMeshCount:architecture.children.length,ready", "textureSettings:(()=>{const a=[];architecture.traverse(o=>{for(const m of[].concat(o.material||[]))for(const t of Object.values(m))if(t?.isTexture)a.push({anisotropy:t.anisotropy,mips:t.generateMipmaps,min:t.minFilter,mag:t.magFilter,w:t.image?.width});});return a;})(),maxAnisotropy:renderer.capabilities.getMaxAnisotropy(),dpr:renderer.getPixelRatio(),activeMeshCount:architecture.children.length,ready")
s += "\nif(window.ExplorerDebug)ExplorerDebug.view=(position,look)=>{camera.position.fromArray(position);feet=camera.position.y-C.eye;camera.lookAt(...look);camera.updateMatrixWorld();renderer.render(scene,camera);};\n"
(p/'main.js').write_text(s)
assert (p/'maps.js').read_bytes()==Path('/home/user/new_chain/maps.js').read_bytes()
t=Path('/home/user/new_chain/template.html').read_text();t=t.replace('中庭奥（開始時の正面方向）の大門付近でE：','ライオン位置の黒い石アーチに照準を合わせてE：').replace('中庭側面の既存アーチ鉄扉 → 大回廊。','中庭側面の既存半円アーチ鉄扉（ドア1） → 大回廊。反対側の鉄扉（ドア2）は閉鎖中。').replace('新3マップにはドア','中庭のライオン位置にのみ石枠と完全な黒のアーチを追加しています。新3マップにはドア').replace('新GLBはアプリ側のメモリキャッシュに保持しません。内装画像は最大2048²、セラー画像は最大1024²へ最適化しています。','新GLBはアプリ側のメモリキャッシュに保持しません。元画像の解像度を維持し、全テクスチャに最大異方性フィルタ・ミップマップを適用します。元画像以上の精細さを生成する機能ではありません。').replace('DPR最大1.5','DPR最大2.0（自動品質では負荷に応じて低下）')
(p/'template.html').write_text(t)
