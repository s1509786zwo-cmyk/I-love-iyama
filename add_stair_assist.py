from pathlib import Path
p=Path('/home/user/grand_explorer/main.js');s=p.read_text()
s=s.replace('let stone=null,stageText=', 'const stairRuns=[];\nlet stone=null,stageText=')
a=s.index('function cast(origin,dir,length,first=true)');b=s.index('// Capsule-like ray sweeps:',a)
s=s[:a]+'''function rampAt(x,z){return stairRuns.find(r=>x>=r.x0&&x<=r.x1&&Math.abs(z)<=r.halfWidth);}
function rampHeight(r,x){return r.y0+(r.y1-r.y0)*clamp((x-r.x0)/(r.x1-r.x0),0,1);}
function isAssistedRiser(h){const r=rampAt(h.point.x,h.point.z);return r&&h.point.y>=Math.min(r.y0,r.y1)-.25&&h.point.y<=rampHeight(r,h.point.x)+.65;}
function nativeCast(origin,dir,length,first=true){if(!collider)return [];ray.set(origin,dir);ray.near=.001;ray.far=length;ray.firstHitOnly=first;return ray.intersectObject(collider,false);}
function cast(origin,dir,length,first=true){
 let hits=nativeCast(origin,dir,length,first);
 if(!stairRuns.length)return hits;
 // Hidden analytic ramps replace only low native stair risers in these narrow runs.
 // There is no render mesh or coplanar floor overlay.
 if(first&&hits.some(isAssistedRiser))hits=nativeCast(origin,dir,length,false);
 return hits.filter(h=>!isAssistedRiser(h));
}
function floorAt(x,z,from,max){
 const native=cast(new THREE.Vector3(x,from,z),down,max,false).find(h=>h.face.normal.y>.62);
 const r=rampAt(x,z);
 if(r){const y=rampHeight(r,x),distance=from-y;
  if(distance>=-.001&&distance<=max&&(!native||native.point.y<y))return {point:new THREE.Vector3(x,y,z),distance,face:{normal:new THREE.Vector3(-(r.y1-r.y0)/(r.x1-r.x0),1,0).normalize()},assisted:true};
 }
 return native;
}
function inferStairAssist(){
 // Measure the actual cathedral centerline. Fit collision-only inclines to runs
 // of native risers; retain the artist's visible staircase without modifications.
 const samples=[];for(let x=35;x<=74;x+=.10){const h=nativeCast(new THREE.Vector3(x,12,0),down,13,false).find(h=>h.face.normal.y>.62);if(h)samples.push({x,y:h.point.y});}
 const rises=[];for(let i=1;i<samples.length;i++){const dy=samples[i].y-samples[i-1].y;if(dy>.035&&dy<.9)rises.push({i,x:samples[i].x});}
 const groups=[];for(const rise of rises){const g=groups.at(-1);if(g&&rise.x-g.at(-1).x<1.6)g.push(rise);else groups.push([rise]);}
 for(const g of groups){if(g.length<2)continue;const before=samples[g[0].i-1],after=samples[g.at(-1).i];const x0=before.x-.15,x1=after.x+.15;
  if(after.y-before.y<.25||(after.y-before.y)/(x1-x0)>.7)continue;
  stairRuns.push({x0,x1,y0:before.y,y1:after.y,halfWidth:1.55});
 }
}
''' +s[b:]
s=s.replace('await buildCollision();','await buildCollision();inferStairAssist();')
s=s.replace('collisionTriangles:positionCount,cutCount,near:', 'collisionTriangles:positionCount,cutCount,stairRuns:stairRuns.map(r=>({...r})),near:')
p.write_text(s)
