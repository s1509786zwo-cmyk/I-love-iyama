from pathlib import Path
p=Path('/home/user/door_explorer/main.js');s=p.read_text()
s=s.replace("import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';", "import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';\nimport {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';\nimport {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';")
s=s.replace("if(!ready)return;setMenu(false)","if(!ready||transitioning)return;setMenu(false)")
s=s.replace("velocity.set(0,0,0);setMenu(true);", "velocity.set(0,0,0);if(!transitioning)setMenu(true);")
s=s.replace("keys.add(e.code);if(e.code==='Space'", "keys.add(e.code);if(e.code==='KeyE'&&!e.repeat&&controls.isLocked&&!transitioning)useDoor();if(e.code==='Space'")
s=s.replace("if(e.code==='Space'&&!e.repeat&&controls.isLocked)", "if(e.code==='Space'&&!e.repeat&&controls.isLocked&&!transitioning)")
s=s.replace("function reset(){camera.position.copy(spawn);camera.lookAt(7,C.floor+2.1,0);flashQ.copy(camera.quaternion);feet=C.floor;", "function reset(){camera.position.copy(activeSpawn||spawn);if(activeLook)camera.lookAt(activeLook);else camera.lookAt(7,C.floor+2.1,0);flashQ.copy(camera.quaternion);feet=camera.position.y-C.eye;")
s=s.replace('function inferStairAssist(){', 'function inferStairAssist(range){\n if(!range)return;')
s=s.replace('for(let x=35;x<=74;x+=.10)', 'for(let x=range[0];x<=range[1];x+=.10)')
a=s.index('// Culling changes rendering only.');b=s.index('const shadowPosition=',a)
part=Path('/home/user/door_explorer/area-system.js.part').read_text()
s=s[:a]+part+'''\nasync function init(){try{
 stage('共通PBRを準備し、Sponza回廊を読み込みます…');
 [stone,wood]=await Promise.all([pbr('castle_brick_01'),pbr('old_wood_floor')]);
 rememberShared(stone);rememberShared(wood);wood.color.set(0x9e7952);wood.roughness=.85;
 doorIron=rememberShared(new THREE.MeshStandardMaterial({map:wood.map,roughnessMap:wood.roughnessMap,normalMap:wood.normalMap,color:0x463c2e,metalness:.7,roughness:.5}));
 await loadArea('hub');$('start').disabled=false;$('start').textContent='探索をはじめる';
 }catch(e){failed=true;console.error(e);stage('読込失敗：'+e.message);$('retry').classList.remove('hidden');}}
''' +s[b:]
s=s.replace('if(ready&&controls.isLocked)move(dt);', "if(ready&&controls.isLocked&&!transitioning){move(dt);interactionTime-=dt;if(interactionTime<=0){interactionTime=.08;scanDoor();}}else $('doorPrompt').textContent='';")
s=s.replace('updateVisibility();renderer.render(scene,camera);','renderer.render(scene,camera);')
s=s.replace('if(ready&&autoQuality&&controls.isLocked&&adaptTime>3)', 'if(ready&&!transitioning&&autoQuality&&controls.isLocked&&adaptTime>3)')
s=s.replace('${Math.round(renderer.info.render.triangles/1000)}k tris · DPR ${dpr.toFixed(2)}','${Math.round(renderer.info.render.triangles/1000)}k tris · DPR ${dpr.toFixed(2)} · ${activeArea.toUpperCase()}')
s=s.replace('state:()=>({ready,failed,stage:stageText,', 'state:()=>({ready,failed,transitioning,area:activeArea,cache:[...rawCache.keys()],gpu:{...renderer.info.memory},doors:doors.map(d=>({id:d.id,target:d.target,position:d.group.position.toArray(),stand:d.stand})),stage:stageText,')
s=s.replace('clear(x,y,z){return bodyClear(x,y,z);}', '''faceDoor(id){const d=doors.find(d=>d.id===id);if(!d)throw Error('Door not found');camera.position.set(d.stand[0],d.stand[1]+C.eye,d.stand[2]);feet=d.stand[1];grounded=true;verticalVelocity=0;velocity.set(0,0,0);camera.lookAt(d.group.localToWorld(new THREE.Vector3(0,1.45,.20)));camera.updateMatrixWorld();scanDoor();return {selected:selectedDoor?.id,prompt:$('doorPrompt').textContent};},
 useDoor,clear(x,y,z){return bodyClear(x,y,z);}''')
# Freeze look during fade, preserving the current lock without requesting it from an async callback.
s=s.replace('transitioning=true;keys.clear();', 'transitioning=true;controls.enabled=false;keys.clear();')
s=s.replace('await fade(0);transitioning=false;keys.clear();', 'await fade(0);transitioning=false;controls.enabled=true;keys.clear();')
p.write_text(s)
