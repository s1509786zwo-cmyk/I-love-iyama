import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, basename } from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const hash=b=>createHash('sha256').update(b).digest('hex');
function requireOK(ok,message){if(!ok)throw Error(message);}
try {
 const manifest=JSON.parse(readFileSync(resolve(root,'assets/dehaar.manifest.json'),'utf8'));
 const expected='ab30453bf313e4ce758d206c51d3ac81b1e9aaf9384e2c5e6d5a1ac24866c295';
 requireOK(manifest.format==='split-glb-v1'&&manifest.parts.length===4,'Wrong manifest / four bin files are required.');
 requireOK(manifest.byteLength===32290368&&manifest.sha256===expected,'Wrong original GLB size or SHA-256.');
 const parts=manifest.parts.map(part=>{
  requireOK(basename(part.file)===part.file,'Invalid part filename.');
  const path=resolve(root,'assets',part.file);
  requireOK(statSync(path).size===part.byteLength,'Wrong part size: '+part.file+' — upload the real bin, not a Git LFS pointer.');
  const bytes=readFileSync(path);
  requireOK(hash(bytes)===part.sha256,'SHA-256 mismatch: '+part.file);
  requireOK(bytes.length<=8*1024*1024,'Part exceeds 8 MiB.');
  console.log('OK',part.file,bytes.length,'bytes');return bytes;
 });
 const bytes=Buffer.concat(parts);
 requireOK(bytes.length===32290368&&hash(bytes)===expected,'Reconstructed original GLB does not match.');
 requireOK(bytes.subarray(0,4).toString()==='glTF'&&bytes.readUInt32LE(4)===2&&bytes.readUInt32LE(8)===bytes.length,'Invalid GLB header.');
 const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
 requireOK(json.images.length===3,'Expected three original embedded images.');
 const html=readFileSync(resolve(root,'index.html'),'utf8');
 requireOK(html.includes('partsManifest: MODEL_ASSET_BASE + "dehaar.manifest.json"'),'index.html is not the split-asset build.');
 requireOK(html.includes('fetchOriginalSplitGLB(cfg.partsManifest'),'Split loader missing.');
 console.log('PASS: exact original GLB, 32,290,368 bytes, SHA256 '+expected);
 console.log('No GLB conversion, image resize, texture recompression, or mesh simplification.');
} catch(error) {
 console.error('\nDEPLOYMENT STOPPED: '+error.message);
 console.error('Upload index.html, vercel.json, package.json, scripts and the entire assets folder at the repository root.');
 process.exitCode=1;
}
