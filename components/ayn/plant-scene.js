// Procedural reverse-osmosis train scene, ported from the original single-page
// Ayn dashboard (`Ayn_ desalination early warning.html`).
//
// The geometry builders, materials, lighting and animation loop below are the
// original Three.js code. Only the surroundings changed: `three` comes from the
// npm package instead of a CDN import map, the scene mounts into a React
// container instead of a global `#v3d` element, and every number reaches it
// through `lib/ayn/scene-bridge.ts`, which maps the dashboard model (plant risk,
// pressure drop, hours to limit) onto the fields the old page computed from its
// snapshot data.
import * as THREE from 'three'
import { createSceneBridge } from '@/lib/ayn/scene-bridge'

/**
 * @param {{
 *   container: HTMLElement,
 *   data: { hour: number, plantId: string },
 *   onOpenTrain: (id: string) => void,
 * }} options
 */
export function mountPlantScene({ container, data, onOpenTrain }) {
  const cl = (v, a, b) => Math.max(a, Math.min(b, v))
  const box = container
  const bridge = createSceneBridge(data, onOpenTrain)
  const SW = () => bridge

  if (!container) throw new Error('The 3D view needs a container element')

  const probe = document.createElement('canvas')
  if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) {
    throw new Error('WebGL is not available in this browser')
  }

  let mounted = true
  let rafId = 0

  try {
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.05;
renderer.outputColorSpace=THREE.SRGBColorSpace;
box.appendChild(renderer.domElement);

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x0a2029);
scene.fog=new THREE.Fog(0x0a2029,55,190);
const cam=new THREE.PerspectiveCamera(38,1,0.05,400);
let az=-0.9,pol=1.15,rad=52;const center=new THREE.Vector3(-3,2,0);
function place(){
  cam.position.set(center.x+rad*Math.sin(pol)*Math.cos(az),center.y+rad*Math.cos(pol),center.z+rad*Math.sin(pol)*Math.sin(az));
  cam.lookAt(center);
}

/* ============ lighting ============ */
scene.add(new THREE.HemisphereLight(0xbdd7dd,0x1c2b31,0.55));
const key=new THREE.DirectionalLight(0xffe0b8,2.6);
key.position.set(30,38,16);
key.castShadow=true;
key.shadow.mapSize.set(2048,2048);
key.shadow.camera.left=-60;key.shadow.camera.right=60;
key.shadow.camera.top=45;key.shadow.camera.bottom=-45;
key.shadow.camera.near=2;key.shadow.camera.far=130;
key.shadow.bias=-0.0004;key.shadow.normalBias=0.035;
key.shadow.camera.updateProjectionMatrix();
scene.add(key);
const rim=new THREE.DirectionalLight(0x8fc7e8,1.0);
rim.position.set(-34,20,-30);scene.add(rim);
scene.add(new THREE.AmbientLight(0x22333a,0.5));

const world=new THREE.Group();scene.add(world);
const css=h=>SW().cssv(h);
const C=h=>new THREE.Color(css(h));
const V=(x,y,z)=>new THREE.Vector3(x,y,z);

/* ============ procedural canvas textures ============ */
function cvs(s){const c=document.createElement("canvas");c.width=c.height=s;return[c,c.getContext("2d")];}
function fbmCanvas(size,base,oct){
  const[c,x]=cvs(size);
  const grids=[];
  for(let o=0;o<oct;o++){
    const n=base<<o,gr=new Float32Array(n*n);
    for(let i=0;i<n*n;i++)gr[i]=Math.random();
    grids.push({n,gr});
  }
  const smp=(gd,n,u,v)=>{
    const iu=Math.floor(u),iv=Math.floor(v),fx=u-iu,fy=v-iv;
    const x0=((iu%n)+n)%n,y0=((iv%n)+n)%n,x1=(x0+1)%n,y1=(y0+1)%n;
    const sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
    return (gd[y0*n+x0]*(1-sx)+gd[y0*n+x1]*sx)*(1-sy)+(gd[y1*n+x0]*(1-sx)+gd[y1*n+x1]*sx)*sy;
  };
  const img=x.createImageData(size,size),d=img.data;
  for(let i=0;i<size;i++)for(let j=0;j<size;j++){
    let a=0,amp=0.5,tot=0;
    for(let o=0;o<oct;o++){a+=smp(grids[o].gr,grids[o].n,j/size*grids[o].n,i/size*grids[o].n)*amp;tot+=amp;amp*=0.55;}
    const v=Math.round(255*(a/tot)),p=(i*size+j)*4;
    d[p]=d[p+1]=d[p+2]=v;d[p+3]=255;
  }
  x.putImageData(img,0,0);return c;
}
function concreteCanvas(size){
  const noise=fbmCanvas(size,4,5),[c,x]=cvs(size);
  x.drawImage(noise,0,0);
  const img=x.getImageData(0,0,size,size),d=img.data;
  for(let p=0;p<d.length;p+=4){
    let v=196+(d[p]-128)*0.9;
    if(Math.random()<0.010)v*=0.80;
    d[p]=d[p+1]=d[p+2]=Math.max(0,Math.min(255,v));
  }
  x.putImageData(img,0,0);
  x.strokeStyle="rgba(18,30,34,0.5)";x.lineWidth=2;x.strokeRect(1,1,size-2,size-2);
  x.strokeStyle="rgba(18,30,34,0.22)";x.lineWidth=1;
  x.beginPath();x.moveTo(size/2,0);x.lineTo(size/2,size);x.moveTo(0,size/2);x.lineTo(size,size/2);x.stroke();
  return c;
}
function streakCanvas(size){
  const[c,x]=cvs(size);
  for(let i=0;i<size;i++){
    const v=200+Math.random()*55|0;
    x.fillStyle="rgb("+v+","+v+","+v+")";x.fillRect(0,i,size,1);
  }
  for(let i=0;i<48;i++){
    const v=190+Math.random()*65|0;
    x.fillStyle="rgba("+v+","+v+","+v+",0.5)";
    x.fillRect(Math.random()*size,Math.random()*size,10+Math.random()*70,1);
  }
  return c;
}
function blobCanvas(){
  const[c,x]=cvs(128);
  const gr=x.createRadialGradient(64,64,6,64,64,62);
  gr.addColorStop(0,"rgba(0,0,0,0.5)");gr.addColorStop(0.65,"rgba(0,0,0,0.26)");gr.addColorStop(1,"rgba(0,0,0,0)");
  x.fillStyle=gr;x.fillRect(0,0,128,128);
  return c;
}
/* galvanised open grating: bearing bars + cross bars */
function gratingCanvas(size){
  const[c,x]=cvs(size);
  x.fillStyle="#2a3438";x.fillRect(0,0,size,size);
  for(let i=0;i<size;i+=18){                       /* bearing bars */
    const v=185+Math.random()*50|0;
    x.fillStyle="rgb("+v+","+v+","+v+")";x.fillRect(i,0,9,size);
  }
  x.fillStyle="rgba(150,160,164,0.85)";
  for(let j=0;j<size;j+=54)x.fillRect(0,j,size,4); /* cross bars */
  return c;
}
/* water normal map: heights from fBm, sobel to normals */
function waterNormalCanvas(size){
  const h=fbmCanvas(size,4,5),[c,x]=cvs(size);
  const hd=h.getContext("2d").getImageData(0,0,size,size).data;
  const img=x.createImageData(size,size),d=img.data;
  const H=(i,j)=>hd[(((j+size)%size)*size+((i+size)%size))*4]/255;
  for(let j=0;j<size;j++)for(let i=0;i<size;i++){
    const dx=H(i+1,j)-H(i-1,j),dy=H(i,j+1)-H(i,j-1);
    let nx=-dx*2.2,ny=-dy*2.2,nz=1;
    const l=Math.hypot(nx,ny,nz);
    const p=(j*size+i)*4;
    d[p]=(nx/l*0.5+0.5)*255;d[p+1]=(ny/l*0.5+0.5)*255;d[p+2]=(nz/l*0.5+0.5)*255;d[p+3]=255;
  }
  x.putImageData(img,0,0);return c;
}
/* spiral-wound membrane element wrap */
function spiralCanvas(w,h){
  const c=document.createElement("canvas");c.width=w;c.height=h;
  const x=c.getContext("2d");
  x.fillStyle="#dde3e1";x.fillRect(0,0,w,h);
  x.strokeStyle="rgba(120,135,140,0.35)";x.lineWidth=1;
  for(let i=0;i<w;i+=7){x.beginPath();x.moveTo(i,0);x.lineTo(i,h);x.stroke();}
  for(let j=0;j<h;j+=7){x.beginPath();x.moveTo(0,j);x.lineTo(w,j);x.stroke();}
  const tan=0.34,p=w/14;
  for(let k=0;k<14;k++){
    x.fillStyle=k%2?"rgba(255,255,255,0.7)":"rgba(168,182,188,0.55)";
    const cx=k*p;
    x.beginPath();
    x.moveTo(cx-3,h);x.lineTo(cx+3,h);x.lineTo(cx+3+h*tan,0);x.lineTo(cx-3+h*tan,0);x.closePath();x.fill();
  }
  x.fillStyle="rgba(70,80,84,0.6)";
  x.fillRect(0,0,w,3);x.fillRect(0,h-3,w,3);
  return c;
}
/* travelling band screen mesh */
function beltCanvas(size){
  const[c,x]=cvs(size);
  x.fillStyle="#39464b";x.fillRect(0,0,size,size);
  x.fillStyle="rgba(190,200,205,0.9)";
  for(let i=8;i<size;i+=16)for(let j=8;j<size;j+=16)x.fillRect(i,j,7,7);
  x.strokeStyle="rgba(60,72,78,0.8)";x.lineWidth=3;
  x.strokeRect(1,1,size-2,size-2);
  return c;
}
function tex(c,srgb){const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;}
const noiseT=tex(fbmCanvas(256,4,5),false);
const concreteT=tex(concreteCanvas(512),true);concreteT.repeat.set(24,15);
const streakT=tex(streakCanvas(256),false);streakT.repeat.set(2,1);
const blobT=new THREE.CanvasTexture(blobCanvas());
const gratingT=tex(gratingCanvas(256),true);
const waterNT=tex(waterNormalCanvas(256),false);waterNT.repeat.set(6,10);
const spiralT=tex(spiralCanvas(256,256),true);spiralT.repeat.set(3,1);
const beltT=tex(beltCanvas(256),true);beltT.repeat.set(2,4);

/* ============ material library ============ */
const MAT={
  concrete:new THREE.MeshStandardMaterial({color:0xffffff,map:concreteT,bumpMap:concreteT,bumpScale:0.35,roughness:0.95,metalness:0}),
  fibreglass:new THREE.MeshPhysicalMaterial({color:0xcfd8d6,roughness:0.42,metalness:0.05,clearcoat:0.75,clearcoatRoughness:0.28,bumpMap:noiseT,bumpScale:0.02,envMapIntensity:1.0}),
  coated:new THREE.MeshPhysicalMaterial({color:0x4cc9c0,roughness:0.5,metalness:0.12,clearcoat:0.5,clearcoatRoughness:0.35,bumpMap:noiseT,bumpScale:0.025,envMapIntensity:0.9}),
  paint:new THREE.MeshStandardMaterial({color:0x3f5a63,roughness:0.72,metalness:0.18,bumpMap:noiseT,bumpScale:0.03,envMapIntensity:0.7}),
  paintLight:new THREE.MeshStandardMaterial({color:0x93a7ab,roughness:0.65,metalness:0.2,bumpMap:noiseT,bumpScale:0.02,envMapIntensity:0.7}),
  stainless:new THREE.MeshStandardMaterial({color:0xc9cfd2,roughness:0.35,metalness:0.92,roughnessMap:streakT,envMapIntensity:1.25}),
  rubber:new THREE.MeshStandardMaterial({color:0x14171a,roughness:0.95,metalness:0}),
  galv:new THREE.MeshStandardMaterial({color:0x9db0b6,roughness:0.5,metalness:0.8,bumpMap:noiseT,bumpScale:0.02,envMapIntensity:1.0}),
  grating:new THREE.MeshStandardMaterial({color:0xaebfc2,map:gratingT,bumpMap:gratingT,bumpScale:0.15,roughness:0.55,metalness:0.75}),
  water:new THREE.MeshPhysicalMaterial({color:0x0b2f3a,roughness:0.16,metalness:0.1,transparent:true,opacity:0.88,normalMap:waterNT,normalScale:new THREE.Vector2(0.7,0.7),envMapIntensity:1.2}),
  dafWater:new THREE.MeshStandardMaterial({color:0x4cc9c0,roughness:0.28,metalness:0.08,bumpMap:noiseT,bumpScale:0.03}),
  dark:new THREE.MeshStandardMaterial({color:0x11181c,roughness:0.9,metalness:0}),
  pipeFeed:new THREE.MeshStandardMaterial({color:0xa8c8dc,roughness:0.5,metalness:0.3,bumpMap:noiseT,bumpScale:0.02,envMapIntensity:0.9}),
  pipeBrine:new THREE.MeshStandardMaterial({color:0xb06a30,roughness:0.55,metalness:0.3,bumpMap:noiseT,bumpScale:0.02,envMapIntensity:0.8}),
  pipePerm:new THREE.MeshPhysicalMaterial({color:0xd8eef2,roughness:0.42,metalness:0.15,clearcoat:0.3,clearcoatRoughness:0.4,bumpMap:noiseT,bumpScale:0.015,envMapIntensity:0.9}),
  pipeDosing:new THREE.MeshStandardMaterial({color:0xd7b23c,roughness:0.55,metalness:0.2,bumpMap:noiseT,bumpScale:0.02,envMapIntensity:0.7}),
  gaugeFace:new THREE.MeshStandardMaterial({color:0xf2f4f2,roughness:0.5,metalness:0}),
  needle:new THREE.MeshStandardMaterial({color:0xc0392b,roughness:0.6,metalness:0.1})
};
const dyn=base=>{const m=base.clone();m.userData.cloned=true;return m;};

/* ============ flow overlays and fault glows ============ */
/* dash texture: white dashes on black, used as emissiveMap so the dashes read as moving glow */
function dashCanvas(){
  const c=document.createElement("canvas");c.width=128;c.height=16;
  const x=c.getContext("2d");
  x.fillStyle="#000";x.fillRect(0,0,128,16);
  x.fillStyle="#fff";
  [4,44,84].forEach(o=>x.fillRect(o,4,22,8));
  return c;
}
/* radial halo used by fault glows */
function glowCanvas(){
  const[c,x]=cvs(64);
  const gr=x.createRadialGradient(32,32,2,32,32,31);
  gr.addColorStop(0,"rgba(255,255,255,0.9)");gr.addColorStop(0.35,"rgba(255,255,255,0.42)");gr.addColorStop(1,"rgba(255,255,255,0)");
  x.fillStyle=gr;x.fillRect(0,0,64,64);
  return c;
}
const glowT=tex(glowCanvas(),true);
function flowMat(base,emissive){
  const m=base.clone();
  m.emissive=new THREE.Color(emissive);
  m.emissiveIntensity=0.6;
  m.emissiveMap=tex(dashCanvas(),true);
  return m;
}
const FLOW={
  feed:flowMat(MAT.pipeFeed,0x9fd8ff),
  brine:flowMat(MAT.pipeBrine,0xffa04a),
  perm:flowMat(MAT.pipePerm,0xbfefff),
  dosing:flowMat(MAT.pipeDosing,0xffe27a)
};
const FLOWMAT=new Map([[MAT.pipeFeed,FLOW.feed],[MAT.pipeBrine,FLOW.brine],[MAT.pipePerm,FLOW.perm],[MAT.pipeDosing,FLOW.dosing]]);
let flowScale=1;   /* tied to permeate flow in updateColors */
/* fault glow: lazy additive halo sprite attached to the mesh.
   size overrides the default derived from the geometry bounding sphere,
   because long shells must not get a 9 m halo. */
function glowFor(m,size){
  if(m.userData.glow)return m.userData.glow;
  if(!m.geometry.boundingSphere)m.geometry.computeBoundingSphere();
  const bs=m.geometry.boundingSphere.radius*2.6;
  const s=size||cl(bs,0.5,3.2);
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:glowT,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,depthTest:false,fog:false}));
  sp.userData.s=s;
  sp.scale.setScalar(s);
  sp.renderOrder=6;
  m.add(sp);m.userData.glow=sp;
  return sp;
}
const GLOWS=[];
const WATCH=0.25,CRIT=0.6;
function glowSet(mesh,k,rgb,size){
  const sp=glowFor(mesh,size);
  if(k<WATCH){sp.visible=false;return;}
  sp.visible=true;
  const base=0.16+0.5*cl((k-WATCH)/(1-WATCH),0,1);
  sp.material.color.setRGB(rgb[0],rgb[1],rgb[2]);
  sp.material.opacity=base;
  sp.userData.k=k;sp.userData.base=base;
  /* keep the pulse phase across recolours, or playback (a recolour every
     frame) makes critical glows flicker */
  if(sp.userData.phase===undefined)sp.userData.phase=Math.random()*6.28;
  GLOWS.push(sp);
}

/* ============ helper library ============ */
function mesh(geo,mtl,name,ud){
  const m=new THREE.Mesh(geo,mtl);
  m.castShadow=true;m.receiveShadow=true;
  if(name)m.name=name;
  if(ud)Object.assign(m.userData,ud);
  return m;
}
/* curved tube along a Catmull-Rom path: real bends, never sharp joints.
   Service pipes carry a moving dash glow whose speed follows the plant flow. */
function tube(parent,pts,r,mtl,name,rad){
  const curve=new THREE.CatmullRomCurve3(pts.map(p=>V(...p)),false,"centripetal");
  const seg=Math.max(24,Math.round(curve.getLength()*(rad||6)));
  const geo=new THREE.TubeGeometry(curve,seg,r,12,false);
  const fm=FLOWMAT.get(mtl);
  if(fm){   /* stretch u along the path so one shared dash texture animates all runs */
    const uv=geo.attributes.uv,l=curve.getLength()/0.9;
    for(let i=0;i<uv.count;i++)uv.setX(i,uv.getX(i)*l);
    mtl=fm;
  }
  const m=mesh(geo,mtl,name);
  parent.add(m);return m;
}
/* ring + bolt circle (InstancedMesh); z of the group = pipe axis */
const boltGeo=new THREE.CylinderGeometry(0.032,0.032,0.14,6);
const _dummy=new THREE.Object3D();
function flange(parent,pos,dir,r,nm){
  const g=new THREE.Group();g.position.copy(pos);
  g.quaternion.setFromUnitVectors(V(0,0,1),dir.clone().normalize());
  const ring=mesh(new THREE.CylinderGeometry(r*1.45,r*1.45,r*0.55,20),MAT.stainless,nm?nm+"_ring":undefined);
  ring.rotation.x=Math.PI/2;g.add(ring);
  const n=cl(Math.round(r*40),4,12);
  const bolts=new THREE.InstancedMesh(boltGeo,MAT.galv,n);
  for(let i=0;i<n;i++){
    const a=i/n*Math.PI*2;
    _dummy.position.set(Math.cos(a)*r*1.28,Math.sin(a)*r*1.28,0);
    _dummy.rotation.set(Math.PI/2,0,0);
    _dummy.updateMatrix();bolts.setMatrixAt(i,_dummy.matrix);
  }
  bolts.castShadow=true;g.add(bolts);
  if(nm)g.name=nm;
  parent.add(g);return g;
}
/* butterfly valve: body, stem, handwheel with spokes */
function valve(parent,pos,dir,r,nm){
  const g=new THREE.Group();g.position.copy(pos);
  g.quaternion.setFromUnitVectors(V(0,0,1),dir.clone().normalize());
  const body=mesh(new THREE.CylinderGeometry(r*1.5,r*1.5,r*1.1,18),MAT.paint);
  body.rotation.x=Math.PI/2;g.add(body);
  const stem=mesh(new THREE.CylinderGeometry(r*0.22,r*0.22,r*1.5,8),MAT.stainless);
  stem.position.y=r*1.7;g.add(stem);
  const wheel=new THREE.Mesh(new THREE.TorusGeometry(r*1.2,r*0.11,8,22),MAT.paint);
  wheel.rotation.x=Math.PI/2;wheel.position.y=r*2.55;wheel.castShadow=true;g.add(wheel);
  for(let i=0;i<3;i++){
    const sp=mesh(new THREE.BoxGeometry(r*2.3,r*0.05,r*0.05),MAT.paint);
    sp.rotation.y=i*Math.PI/3;sp.position.y=r*2.55;g.add(sp);
  }
  if(nm)g.name=nm;parent.add(g);return g;
}
/* flow meter: spool piece + instrument head */
function flowmeter(parent,pos,dir,r,nm){
  const g=new THREE.Group();g.position.copy(pos);
  g.quaternion.setFromUnitVectors(V(0,0,1),dir.clone().normalize());
  const body=mesh(new THREE.CylinderGeometry(r*1.25,r*1.25,r*2.0,16),MAT.stainless);
  body.rotation.x=Math.PI/2;g.add(body);
  const head=mesh(new THREE.BoxGeometry(0.14,0.2,0.1),MAT.paint);
  head.position.y=r*1.5;g.add(head);
  const win=mesh(new THREE.CylinderGeometry(0.045,0.045,0.02,12),MAT.gaugeFace);
  win.rotation.x=Math.PI/2;win.position.set(0,r*1.5,0.055);g.add(win);
  if(nm)g.name=nm;parent.add(g);return g;
}
/* pressure gauge: stub + body + face + needle; face looks along +dir */
function gauge(parent,pos,dir,nm){
  const g=new THREE.Group();g.position.copy(pos);
  g.quaternion.setFromUnitVectors(V(0,0,1),dir.clone().normalize());
  const stub=mesh(new THREE.CylinderGeometry(0.02,0.02,0.16,8),MAT.stainless);
  stub.rotation.x=Math.PI/2;stub.position.z=-0.06;g.add(stub);
  const body=mesh(new THREE.CylinderGeometry(0.06,0.06,0.06,12),MAT.stainless);
  body.rotation.x=Math.PI/2;body.position.z=0.04;g.add(body);
  const face=mesh(new THREE.CylinderGeometry(0.078,0.078,0.02,16),MAT.gaugeFace);
  face.rotation.x=Math.PI/2;face.position.z=0.085;g.add(face);
  const nd=mesh(new THREE.BoxGeometry(0.012,0.06,0.006),MAT.needle);
  nd.rotation.z=-0.8;nd.position.set(0.012,0.012,0.1);g.add(nd);
  if(nm)g.name=nm;parent.add(g);return g;
}
/* pipe support: post + shoe */
function psupport(parent,x,z,topY,nm){
  const g=new THREE.Group();if(nm)g.name=nm;g.position.set(x,0,z);
  const post=mesh(new THREE.BoxGeometry(0.09,topY,0.09),MAT.paint);
  post.position.y=topY/2;g.add(post);
  const foot=mesh(new THREE.BoxGeometry(0.28,0.05,0.28),MAT.paint);
  foot.position.y=0.025;g.add(foot);
  parent.add(g);return g;
}
/* I-beam profile extruded along z, centred */
function iBeamGeo(len,h,w,t){
  const s=new THREE.Shape(),hw=w/2,hh=h/2;
  s.moveTo(-hw,-hh);s.lineTo(hw,-hh);s.lineTo(hw,-hh+t);s.lineTo(t/2,-hh+t);s.lineTo(t/2,hh-t);
  s.lineTo(hw,hh-t);s.lineTo(hw,hh);s.lineTo(-hw,hh);s.lineTo(-hw,hh-t);s.lineTo(-t/2,hh-t);
  s.lineTo(-t/2,-hh+t);s.lineTo(-hw,-hh+t);s.closePath();
  const g=new THREE.ExtrudeGeometry(s,{depth:len,bevelEnabled:false});
  g.translate(0,0,-len/2);
  return g;
}
function beam(parent,geo,mtl,pos,rot,nm){
  const m=new THREE.Mesh(geo,mtl);
  m.castShadow=true;m.receiveShadow=true;
  if(pos)m.position.set(...pos);
  if(rot)m.rotation.set(...rot);
  if(nm)m.name=nm;
  parent.add(m);return m;
}
/* grating deck; texture repeat matched to size */
function gratingMat(w,d){
  const m=MAT.grating.clone();
  m.map=m.map.clone();m.map.needsUpdate=true;
  m.map.repeat.set(w/0.55,d/0.55);
  m.bumpMap=m.map;
  m.userData.cloned=true;
  return m;
}
function deck(parent,x,y,z,w,d,nm){
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),gratingMat(w,d));
  m.rotation.x=-Math.PI/2;m.position.set(x,y,z);
  m.receiveShadow=true;
  if(nm)m.name=nm;
  parent.add(m);return m;
}
/* handrail: instanced posts + three rails along a polyline of [x,z] */
function handrail(parent,pts,y0,nm){
  const grp=new THREE.Group();if(nm)grp.name=nm;
  const segs=[];
  for(let i=0;i<pts.length-1;i++){
    const a=V(pts[i][0],y0,pts[i][1]),b=V(pts[i+1][0],y0,pts[i+1][1]);
    segs.push([a,b,a.distanceTo(b)]);
  }
  const posts=[];
  for(let i=0;i<segs.length;i++){
    const[a,b,len]=segs[i];const k=Math.max(1,Math.round(len/1.4));
    for(let j=0;j<k;j++)posts.push(a.clone().lerp(b,j/k));
  }
  posts.push(V(pts[pts.length-1][0],y0,pts[pts.length-1][1]));
  const inst=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.025,0.025,1.0,8),MAT.galv,posts.length);
  posts.forEach((p,i)=>{_dummy.position.set(p.x,y0+0.5,p.z);_dummy.rotation.set(0,0,0);_dummy.updateMatrix();inst.setMatrixAt(i,_dummy.matrix);});
  inst.castShadow=true;grp.add(inst);
  [0.32,0.62,0.95].forEach(h=>{
    segs.forEach(([a,b,len])=>{
      const r=mesh(new THREE.CylinderGeometry(0.018,0.018,len,8),MAT.galv);
      r.position.copy(a).lerp(b,0.5);r.position.y=y0+h;
      r.quaternion.setFromUnitVectors(V(0,1,0),b.clone().sub(a).normalize());
      grp.add(r);
    });
  });
  parent.add(grp);return grp;
}
/* caged ladder */
function ladder(parent,x,z,y0,y1,nm,rotY){
  const grp=new THREE.Group();grp.name=nm;grp.position.set(x,y0,z);grp.rotation.y=rotY||0;
  const h=y1-y0;
  [-0.2,0.2].forEach(dx=>{
    const s=mesh(new THREE.BoxGeometry(0.05,h,0.05),MAT.galv);
    s.position.set(dx,h/2,0);grp.add(s);
  });
  const rungs=new THREE.InstancedMesh(new THREE.BoxGeometry(0.36,0.04,0.04),MAT.galv,Math.max(1,Math.floor(h/0.3)));
  for(let i=0;i<rungs.count;i++){_dummy.position.set(0,0.25+i*0.3,0);_dummy.rotation.set(0,0,0);_dummy.updateMatrix();rungs.setMatrixAt(i,_dummy.matrix);}
  rungs.castShadow=true;grp.add(rungs);
  if(h>1.6)for(let k=0;k<3;k++){   /* safety hoops */
    const hoop=new THREE.Mesh(new THREE.TorusGeometry(0.38,0.015,6,18,Math.PI),MAT.galv);
    hoop.position.y=Math.min(y1,h*0.55)+k*0.55;hoop.rotation.z=Math.PI/2;hoop.castShadow=true;grp.add(hoop);
  }
  parent.add(grp);return grp;
}
/* cable tray: U channel + standoffs */
function tray(parent,x0,z0,x1,z1,y,nm){
  const grp=new THREE.Group();if(nm)grp.name=nm;
  const dx=x1-x0,dz=z1-z0,len=Math.hypot(dx,dz),ang=Math.atan2(dx,dz);
  grp.position.set((x0+x1)/2,y,(z0+z1)/2);grp.rotation.y=ang;
  const base=mesh(new THREE.BoxGeometry(0.28,0.02,len),MAT.galv);grp.add(base);
  [-0.13,0.13].forEach(o=>{
    const side=mesh(new THREE.BoxGeometry(0.02,0.08,len),MAT.galv);
    side.position.x=o;grp.add(side);
  });
  const k=Math.max(1,Math.round(len/2));
  for(let i=0;i<=k;i++){
    const p=mesh(new THREE.BoxGeometry(0.05,y,0.05),MAT.galv);
    p.position.set(0,-y/2,-len/2+i*len/k);grp.add(p);
  }
  parent.add(grp);return grp;
}
/* Victaulic-style grooved coupling at a port */
function coupling(parent,pos,dir,r,nm){
  const g=new THREE.Group();g.position.copy(pos);
  g.quaternion.setFromUnitVectors(V(0,0,1),dir.clone().normalize());
  const sleeve=mesh(new THREE.CylinderGeometry(r*1.4,r*1.4,r*1.5,16),MAT.rubber);
  sleeve.rotation.x=Math.PI/2;g.add(sleeve);
  [1,-1].forEach(s=>{
    const lug=mesh(new THREE.BoxGeometry(r*0.5,r*0.5,r*0.3),MAT.galv);
    lug.position.set(0,r*1.55,s*r*0.95);g.add(lug);
    const b=mesh(new THREE.CylinderGeometry(r*0.11,r*0.11,r*0.6,6),MAT.stainless);
    b.position.set(0,r*2.0,s*r*0.95);g.add(b);
  });
  if(nm)g.name=nm;parent.add(g);return g;
}
/* saddle support with cradle; vessel centre at (x,vesselY,z), deck at deckY */
function saddle(parent,x,vesselY,z,r,deckY,nm){
  const g=new THREE.Group();if(nm)g.name=nm;g.position.set(x,vesselY,z);
  const cradle=mesh(new THREE.CylinderGeometry(r+0.02,r+0.02,0.26,14,1,true,Math.PI,Math.PI),MAT.paint);
  cradle.rotation.z=Math.PI/2;g.add(cradle);
  const topL=-(r+0.02),botL=deckY-vesselY;
  const web=mesh(new THREE.BoxGeometry(0.26,Math.max(0.05,topL-botL),0.2),MAT.paint);
  web.position.y=(topL+botL)/2;g.add(web);
  parent.add(g);return g;
}

/* ============ procedural environment map ============ */
function buildEnvMap(){
  const pm=new THREE.PMREMGenerator(renderer);
  const esc=new THREE.Scene();
  const cv=document.createElement("canvas");cv.width=64;cv.height=256;
  const x=cv.getContext("2d");
  const gr=x.createLinearGradient(0,0,0,256);
  gr.addColorStop(0,"#1a2c33");gr.addColorStop(0.42,"#3d616b");gr.addColorStop(0.50,"#7ea6ad");
  gr.addColorStop(0.55,"#27363c");gr.addColorStop(1,"#131b1f");
  x.fillStyle=gr;x.fillRect(0,0,64,256);
  const bg=new THREE.CanvasTexture(cv);
  bg.mapping=THREE.EquirectangularReflectionMapping;
  bg.colorSpace=THREE.SRGBColorSpace;
  esc.background=bg;
  const panel=(w,h,px,py,pz,rx,ry,inten,col)=>{
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),
      new THREE.MeshBasicMaterial({color:new THREE.Color(col).multiplyScalar(inten),side:THREE.DoubleSide}));
    m.position.set(px,py,pz);m.rotation.set(rx,ry,0);esc.add(m);
  };
  panel(8,3, 7,8, 5, -0.9, 0.55, 2.6, "#ffe6c4");
  panel(10,2, -9,6,-7, 1.05,-0.5, 1.6, "#bfe8ff");
  panel(16,1.6, 0,10,0, Math.PI/2,0, 1.3, "#ffffff");
  const rt=pm.fromScene(esc,0.04,0.5,80);
  scene.environment=rt.texture;
  pm.dispose();
}
buildEnvMap();

/* ============ ground, catcher, AO blobs ============ */
function buildGround(){
  const ground=mesh(new THREE.BoxGeometry(96,0.4,56),MAT.concrete,"ground");
  ground.position.set(-3.5,-0.2,0);
  ground.castShadow=false;ground.receiveShadow=false;
  world.add(ground);
  const catcher=new THREE.Mesh(new THREE.PlaneGeometry(94,54),
    new THREE.ShadowMaterial({color:0x000000,opacity:0.42,transparent:true,depthWrite:false,fog:false}));
  catcher.rotation.x=-Math.PI/2;catcher.position.set(-3.5,0.012,0);
  catcher.receiveShadow=true;catcher.name="shadow_catcher";
  world.add(catcher);
}
buildGround();
function blob(x0,z0,w,d){
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),
    new THREE.MeshBasicMaterial({map:blobT,transparent:true,depthWrite:false}));
  m.rotation.x=-Math.PI/2;m.position.set(x0,0.02,z0);m.renderOrder=1;world.add(m);
}
blob(-31,0,7,17);blob(-19,0,12.5,14.5);blob(-5,0,7,15);blob(0.3,-0.5,3.5,4.5);
blob(6.3,-1.5,6,3.8);blob(6.6,3.8,3.4,3.2);blob(14.5,0,9,7.2);
blob(2.2,1.4,3,2.6);blob(24,-2,3.4,3.4);blob(28.6,6,3.4,3.2);

/* ============ intake: pump bay, water, screens, travelling band screen ============ */
function buildIntake(){
  const s=new THREE.Group();s.name="intake";world.add(s);
  /* concrete walls of the pump bay */
  const wallE=mesh(new THREE.BoxGeometry(0.5,2.8,17),MAT.concrete,"bay_wall_east");
  wallE.position.set(-28,1.4,0);wallE.castShadow=false;wallE.receiveShadow=true;s.add(wallE);
  [-8.5,8.5].forEach((z,i)=>{
    const w=mesh(new THREE.BoxGeometry(9,3.2,0.5),MAT.concrete,"bay_wall_"+(i?"n":"s"));
    w.position.set(-32.5,1.6,z);w.castShadow=false;w.receiveShadow=true;s.add(w);
  });
  const floor=mesh(new THREE.BoxGeometry(9,0.3,17),MAT.dark,"bay_floor");
  floor.position.set(-32.2,0.1,0);floor.castShadow=false;floor.receiveShadow=false;s.add(floor);
  /* animated water surface */
  const water=mesh(new THREE.PlaneGeometry(8.6,16.4),MAT.water,"bay_water");
  water.rotation.x=-Math.PI/2;water.position.set(-32.3,1.05,0);
  water.castShadow=false;water.receiveShadow=false;s.add(water);
  /* bar screens — coloured by bloom risk (instanced bars) */
  [-4.6,4.6].forEach((z,i)=>{
    const grp=new THREE.Group();grp.position.set(-29.3,2.1,z);grp.rotation.z=0.42;
    grp.name="bar_screen_frame_"+i;
    [-1.85,1.85].forEach(dx=>{
      const post=mesh(new THREE.BoxGeometry(0.08,4.6,0.1),MAT.galv);
      post.position.set(dx,0,0);grp.add(post);
    });
    [2.3,-2.3].forEach(dy=>{
      const rail=mesh(new THREE.BoxGeometry(3.9,0.08,0.07),MAT.galv);
      rail.position.set(0,dy,0.05);grp.add(rail);
    });
    const bars=new THREE.InstancedMesh(new THREE.BoxGeometry(0.045,4.4,0.045),dyn(MAT.coated),24);
    for(let k=0;k<24;k++){
      _dummy.position.set(-1.7+k*0.148,0,0);
      _dummy.rotation.set(0,0,0);_dummy.updateMatrix();bars.setMatrixAt(k,_dummy.matrix);
    }
    bars.castShadow=true;
    bars.name="intake_screen_"+i;
    bars.userData.bloom=true;
    grp.add(bars);s.add(grp);
  });
  /* travelling band screen at the middle channel */
  const band=new THREE.Group();band.position.set(-29.3,0,0);band.name="intake_screen_2";
  const beltMat=dyn(MAT.coated);
  beltMat.map=beltT;beltMat.map.needsUpdate=true;
  [-0.31,0.31].forEach(zoff=>{
    [1.45,4.75].forEach((wy,k)=>{
      const wheel=mesh(new THREE.CylinderGeometry(0.55,0.55,0.06,20),MAT.stainless,k?"band_wheel_top":"band_wheel_bottom");
      wheel.rotation.x=Math.PI/2;wheel.position.set(0,wy,zoff);band.add(wheel);
      for(let sp=0;sp<4;sp++){
        const spoke=mesh(new THREE.BoxGeometry(1.0,0.05,0.03),MAT.stainless);
        spoke.rotation.z=sp*Math.PI/4;spoke.position.set(0,wy,zoff);band.add(spoke);
      }
    });
  });
  [1, -1].forEach(sgn=>{
    const strip=mesh(new THREE.BoxGeometry(0.06,3.1,0.66),beltMat,sgn>0?"band_belt_front":"band_belt_back");
    strip.position.set(sgn*0.52,3.1,0);strip.userData.bloom=true;band.add(strip);
  });
  [1,-1].forEach(sgn=>{
    const wrap=mesh(new THREE.CylinderGeometry(0.56,0.56,0.66,18,1,true,Math.PI/2,Math.PI),beltMat);
    wrap.rotation.x=Math.PI/2;
    wrap.position.set(0,sgn>0?4.75:1.45,0);
    if(sgn<0)wrap.rotation.z=Math.PI;
    wrap.userData.bloom=true;band.add(wrap);
  });
  [-0.4,0.4].forEach((zoff,i)=>{
    const post=mesh(new THREE.BoxGeometry(0.12,5.6,0.12),MAT.galv,"band_frame_"+i);
    post.position.set(0,2.8,zoff);band.add(post);
  });
  s.add(band);
  /* vertical turbine intake pumps */
  [-4.6,0,4.6].forEach((z,i)=>{
    const col=mesh(new THREE.CylinderGeometry(0.28,0.28,4.0,14),MAT.stainless,"intake_pump_"+i);
    col.position.set(-31,2.6,z);s.add(col);
    const plate=mesh(new THREE.CylinderGeometry(0.55,0.55,0.08,16),MAT.galv);
    plate.position.set(-31,4.66,z);s.add(plate);
    const motor=mesh(new THREE.CylinderGeometry(0.4,0.4,0.85,16),MAT.paintLight,"intake_pump_"+i+"_motor");
    motor.position.set(-31,5.12,z);s.add(motor);
    tube(s,[[-31,4.5,z],[-30.1,4.7,z],[-29.2,3.6,z],[-28.4,2.9,z],[-27.9,2.8,z]],0.16,MAT.pipeFeed,"intake_pump_"+i+"_riser");
  });
  const header=tube(s,[[-27.6,2.8,-4.6],[-27.6,2.8,0],[-27.6,2.8,4.6]],0.3,MAT.pipeFeed,"intake_header");
  tube(s,[[-27.6,2.8,0],[-26.6,2.8,0],[-25.4,2.6,0],[-24.35,2.45,0]],0.38,MAT.pipeFeed,"intake_pipe");
  valve(s,V(-26.6,2.8,0),V(1,0,0),0.38,"intake_valve");
  flowmeter(s,V(-25.4,2.6,0),V(1,0.1,0),0.38,"intake_flowmeter");
  gauge(s,V(-27.6,3.25,-1.5),V(0,1,0.3),"intake_gauge_0");
  gauge(s,V(-27.6,3.25,1.5),V(0,1,-0.3),"intake_gauge_1");
  flange(world,V(-24.5,2.42,0),V(1,0.05,0),0.38,"flange_intake_daf");
  psupport(world,-27.6,-3.4,2.35,"support_intake_0");
  psupport(world,-27.6,3.4,2.35,"support_intake_1");
}

/* ============ DAF / flotation ============ */
function buildDAF(){
  const s=new THREE.Group();s.name="daf";world.add(s);
  const wallDefs=[[0.4,3.6,12.8,-24,1.8,0],[0.4,3.6,12.8,-14,1.8,0],[10.4,3.6,0.4,-19,1.8,-6.2],[10.4,3.6,0.4,-19,1.8,6.2]];
  wallDefs.forEach((w,i)=>{
    const wall=mesh(new THREE.BoxGeometry(w[0],w[1],w[2]),MAT.concrete,"daf_wall_"+i);
    wall.position.set(w[3],w[4],w[5]);wall.castShadow=false;wall.receiveShadow=true;s.add(wall);
  });
  const floor=mesh(new THREE.BoxGeometry(9.4,0.25,11.6),MAT.dark,"daf_floor");
  floor.position.set(-19,0.35,0);floor.castShadow=false;floor.receiveShadow=false;s.add(floor);
  /* the flotation water surface carries the bloom-risk colour */
  const water=mesh(new THREE.BoxGeometry(9.2,0.15,11.4),MAT.dafWater,"flotation");
  water.position.set(-19,2.72,0);water.userData.bloom=true;s.add(water);
  /* hanging baffles */
  [0,1,2].forEach(i=>{
    const b=mesh(new THREE.BoxGeometry(0.15,1.4,11.2),MAT.stainless,"daf_baffle_"+i);
    b.position.set(-21.5+i*2.5,2.95,0);s.add(b);
  });
  /* chain skimmer: rails, sprockets, instanced paddles */
  const sk=new THREE.Group();sk.name="daf_skimmer";
  [-4.6,4.6].forEach(zoff=>{
    const rail=mesh(new THREE.CylinderGeometry(0.04,0.04,8.6,10),MAT.stainless);
    rail.rotation.z=Math.PI/2;rail.position.set(-19,3.82,zoff);sk.add(rail);
  });
  [-23,-15].forEach(xx=>{
    [-4.6,4.6].forEach(zoff=>{
      const disc=mesh(new THREE.CylinderGeometry(0.3,0.3,0.05,18),MAT.galv,"daf_skimmer_sprocket");
      disc.rotation.x=Math.PI/2;disc.position.set(xx,3.82,zoff);sk.add(disc);
    });
  });
  const paddles=new THREE.InstancedMesh(new THREE.BoxGeometry(0.1,0.45,9.0),MAT.stainless,7);
  paddles.name="daf_skimmer_paddles";
  for(let k=0;k<7;k++){
    _dummy.position.set(-22.6+k*1.3,3.5,0);
    _dummy.rotation.set(0,0,0);_dummy.updateMatrix();paddles.setMatrixAt(k,_dummy.matrix);
  }
  paddles.castShadow=true;sk.add(paddles);
  s.add(sk);
  /* air saturation vessel with gauge */
  const sat=mesh(new THREE.CylinderGeometry(0.65,0.65,2.6,20),MAT.paintLight,"daf_saturator");
  sat.position.set(-12.6,1.95,4.6);s.add(sat);
  const satDome=mesh(new THREE.SphereGeometry(0.65,20,10,0,Math.PI*2,0,Math.PI/2),MAT.paintLight);
  satDome.position.set(-12.6,3.25,4.6);s.add(satDome);
  [[-0.45,0],[-0.28,-0.36],[0.45,0]].forEach((lg,i)=>{
    const leg=mesh(new THREE.BoxGeometry(0.08,1.3,0.08),MAT.galv,"daf_saturator_leg_"+i);
    leg.position.set(-12.6+lg[0],0.65,4.6+lg[1]);leg.rotation.y=lg[1]<0?0.6:0;s.add(leg);
  });
  gauge(world,V(-11.9,2.6,4.6),V(1,0.4,0),"daf_saturator_gauge");
  tube(world,[[-12.6,0.75,4.6],[-13.4,0.6,4.2],[-14.1,0.85,3.0],[-14.15,1.1,1.2]],0.1,MAT.pipeFeed,"daf_recycle");
  /* effluent trough */
  const weir=mesh(new THREE.BoxGeometry(0.7,0.3,10.4),MAT.stainless,"daf_weir");
  weir.position.set(-14.6,3.35,0);s.add(weir);
}

/* ============ media filters ============ */
function buildMediaFilters(){
  const s=new THREE.Group();s.name="media_filters";world.add(s);
  [-6,0,6].forEach((z,i)=>{
    const sh=mesh(new THREE.CylinderGeometry(1.5,1.5,5.0,26),dyn(MAT.coated),"media_filter_"+i);
    sh.rotation.z=Math.PI/2;sh.position.set(-5,2.35,z);
    sh.userData.bloom=true;s.add(sh);
    [-7.35,-2.65].forEach((cx,k)=>{
      const cap=mesh(new THREE.SphereGeometry(1.5,22,12),MAT.paint,"media_filter_"+i+"_cap_"+k);
      cap.scale.set(0.42,1,1);cap.position.set(cx,2.35,z);s.add(cap);
    });
    [-6.2,-3.8].forEach((sx,k)=>{
      const plinth=mesh(new THREE.BoxGeometry(0.7,0.35,2.9),MAT.concrete,"media_filter_"+i+"_plinth_"+k);
      plinth.position.set(sx,0.17,z);plinth.castShadow=false;plinth.receiveShadow=true;s.add(plinth);
      const sad=mesh(new THREE.BoxGeometry(0.5,0.75,2.6),MAT.paint,"media_filter_"+i+"_saddle_"+k);
      sad.position.set(sx,0.72,z);s.add(sad);
    });
    /* manway on the west dished end */
    flange(world,V(-7.95,2.35,z),V(-1,0,0),0.5,"media_filter_"+i+"_manway");
    /* top nozzles */
    [-6.5,-5,-3.5].forEach((nx,k)=>{
      const st=mesh(new THREE.CylinderGeometry(0.18,0.18,0.5,14),MAT.paintLight,"media_filter_"+i+"_nozzle_"+k);
      st.position.set(nx,4.1,z);s.add(st);
      flange(world,V(nx,4.35,z),V(0,1,0),0.18,"media_filter_"+i+"_nozzle_flange_"+k);
    });
    gauge(world,V(-5,4.35,z),V(1,0.25,0),"media_filter_"+i+"_gauge");
    /* bottom outlet to the header */
    tube(world,[[-2.55,1.7,z],[-2.35,1.15,z],[-2.0,0.85,z],[-1.75,0.8,z]],0.2,MAT.pipeFeed,"media_filter_"+i+"_outlet");
    flange(world,V(-2.45,1.35,z),V(0.4,-1,0),0.2,"media_filter_"+i+"_outlet_flange");
  });
  tube(world,[[-1.75,0.8,-6],[-1.75,0.8,0],[-1.75,0.8,6]],0.28,MAT.pipeFeed,"media_outlet_header");
  psupport(world,-1.75,-3.2,0.72,"support_media_0");
  psupport(world,-1.75,3.2,0.72,"support_media_1");
}

/* ============ cartridge filters ============ */
function buildCartridges(){
  const s=new THREE.Group();s.name="cartridges";world.add(s);
  [-1.2,0.2].forEach((z,i)=>{
    const sh=mesh(new THREE.CylinderGeometry(0.5,0.5,2.2,20),dyn(MAT.coated),"cartridge_"+i);
    sh.position.set(0.3,2.05,z);sh.userData.bloom=true;s.add(sh);
    const lid=mesh(new THREE.SphereGeometry(0.5,20,10,0,Math.PI*2,0,Math.PI/2),MAT.paintLight,"cartridge_"+i+"_lid");
    lid.scale.set(1,0.55,1);lid.position.set(0.3,3.15,z);s.add(lid);
    const clamp=new THREE.Mesh(new THREE.TorusGeometry(0.52,0.045,10,24),MAT.galv,"cartridge_"+i+"_clamp");
    clamp.rotation.x=Math.PI/2;clamp.position.set(0.3,3.13,z);clamp.castShadow=true;s.add(clamp);
    const bolts=new THREE.InstancedMesh(boltGeo,MAT.galv,4);
    bolts.name="cartridge_"+i+"_swing_bolts";
    for(let k=0;k<4;k++){
      const a=k*Math.PI/2;
      _dummy.position.set(0.3+Math.cos(a)*0.52,3.35,z+Math.sin(a)*0.52);
      _dummy.rotation.set(0,0,0);_dummy.updateMatrix();bolts.setMatrixAt(k,_dummy.matrix);
    }
    bolts.castShadow=true;s.add(bolts);
    const foot=mesh(new THREE.SphereGeometry(0.5,20,10,0,Math.PI*2,Math.PI/2,Math.PI/2),MAT.paintLight,"cartridge_"+i+"_foot");
    foot.scale.set(1,0.4,1);foot.position.set(0.3,0.95,z);s.add(foot);
    [[0.5,0.7],[-0.45,0.55],[0,-0.82]].forEach((lg,k)=>{
      const leg=mesh(new THREE.BoxGeometry(0.07,0.72,0.07),MAT.galv,"cartridge_"+i+"_leg_"+k);
      leg.position.set(0.3+lg[0],0.38,z+lg[1]);s.add(leg);
    });
    gauge(world,V(-0.3,2.05,z),V(-1,0.15,0),"cartridge_"+i+"_gauge");
    /* bottom outlet east to the pump suction */
    tube(world,[[0.75,1.0,z],[1.5,0.72,z],[2.2,0.72,z]],0.14,MAT.pipeFeed,"cartridge_"+i+"_outlet");
  });
  tube(world,[[2.2,0.72,-1.2],[2.2,0.72,0.2]],0.14,MAT.pipeFeed,"cartridge_outlet_tee");
}

/* ============ high-pressure pump skid ============ */
function buildPump(){
  const s=new THREE.Group();s.name="pump_skid_assembly";world.add(s);
  const base=mesh(new THREE.BoxGeometry(5.0,0.25,2.4),MAT.paint,"pump_skid");
  base.position.set(6.4,0.125,-1.5);base.castShadow=false;base.receiveShadow=true;s.add(base);
  [[4.2,-2.6],[8.6,-2.6],[4.2,-0.4],[8.6,-0.4]].forEach((ft,i)=>{
    const foot=mesh(new THREE.BoxGeometry(0.3,0.14,0.3),MAT.paint,"pump_skid_foot_"+i);
    foot.position.set(ft[0],0.05,ft[1]);foot.castShadow=false;s.add(foot);
  });
  /* multistage pump body */
  const body=mesh(new THREE.CylinderGeometry(0.3,0.3,1.9,20),MAT.paint,"hp_pump");
  body.rotation.z=Math.PI/2;body.position.set(5.5,0.95,-1.5);s.add(body);
  const stages=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.4,0.4,0.1,20),MAT.stainless,6);
  stages.name="hp_pump_stages";
  for(let k=0;k<6;k++){
    _dummy.position.set(4.85+k*0.26,0.95,-1.5);
    _dummy.rotation.set(0,0,Math.PI/2);_dummy.updateMatrix();stages.setMatrixAt(k,_dummy.matrix);
  }
  stages.castShadow=true;s.add(stages);
  const bearing=mesh(new THREE.CylinderGeometry(0.24,0.24,0.34,14),MAT.stainless,"hp_pump_bearing");
  bearing.rotation.z=Math.PI/2;bearing.position.set(4.35,0.95,-1.5);s.add(bearing);
  /* suction and discharge */
  const suc=mesh(new THREE.CylinderGeometry(0.17,0.17,0.4,14),MAT.paintLight,"pump_suction");
  suc.rotation.z=Math.PI/2;suc.position.set(4.15,0.95,-1.5);s.add(suc);
  flange(world,V(3.98,0.95,-1.5),V(-1,0,0),0.17,"flange_pump_suction");
  tube(s,[[6.3,1.1,-1.5],[6.3,1.95,-1.5]],0.2,MAT.pipeFeed,"pump_discharge");
  flange(world,V(6.3,1.5,-1.5),V(0,1,0),0.2,"flange_pump_discharge_0");
  valve(world,V(6.3,1.95,-1.5),V(0,1,0),0.2,"pump_discharge_valve");
  gauge(world,V(6.55,1.55,-1.35),V(1,0.35,-0.35),"pump_discharge_gauge");
  gauge(world,V(4.15,1.3,-1.3),V(0,1,-0.4),"pump_suction_gauge");
  /* coupling + guard */
  const coup=mesh(new THREE.CylinderGeometry(0.2,0.2,0.14,16),MAT.stainless,"pump_coupling");
  coup.rotation.z=Math.PI/2;coup.position.set(6.62,0.95,-1.5);s.add(coup);
  const guard=mesh(new THREE.CylinderGeometry(0.42,0.42,0.6,18,1,true,0,Math.PI),MAT.rubber,"pump_guard");
  guard.rotation.z=Math.PI/2;guard.position.set(6.62,0.95,-1.5);s.add(guard);
  /* motor with fins */
  const motor=mesh(new THREE.CylinderGeometry(0.44,0.44,1.45,20),MAT.paintLight,"motor");
  motor.rotation.z=Math.PI/2;motor.position.set(7.62,0.95,-1.5);s.add(motor);
  const fins=new THREE.InstancedMesh(new THREE.BoxGeometry(0.03,0.1,1.3),MAT.paintLight,16);
  fins.name="motor_fins";
  for(let k=0;k<16;k++){
    const a=k/16*Math.PI*2;
    _dummy.position.set(7.62,0.95+Math.cos(a)*0.5,-1.5+Math.sin(a)*0.5);
    _dummy.rotation.set(0,0,Math.PI/2);_dummy.updateMatrix();fins.setMatrixAt(k,_dummy.matrix);
  }
  fins.castShadow=true;s.add(fins);
  [6.95,8.3].forEach((bx,k)=>{
    const bell=mesh(new THREE.CylinderGeometry(0.47,0.47,0.12,20),MAT.paintLight,"motor_bell_"+k);
    bell.rotation.z=Math.PI/2;bell.position.set(bx,0.95,-1.5);s.add(bell);
  });
  const term=mesh(new THREE.BoxGeometry(0.3,0.18,0.24),MAT.paint,"motor_terminal");
  term.position.set(7.62,1.45,-1.5);s.add(term);
  /* control panel */
  const panel=mesh(new THREE.BoxGeometry(0.7,1.5,0.35),MAT.paint,"hp_pump_panel");
  panel.position.set(9.1,0.95,-0.85);s.add(panel);
  const door=mesh(new THREE.BoxGeometry(0.62,1.3,0.02),MAT.paintLight,"hp_pump_panel_door");
  door.position.set(9.1,0.95,-0.66);s.add(door);
  const lights=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03,0.03,0.02,10),MAT.gaugeFace,3);
  lights.name="hp_pump_panel_lights";
  for(let k=0;k<3;k++){
    _dummy.position.set(8.85+k*0.2,1.5,-0.64);
    _dummy.rotation.set(Math.PI/2,0,0);_dummy.updateMatrix();lights.setMatrixAt(k,_dummy.matrix);
  }
  s.add(lights);
  [[8.82,-0.72],[9.38,-0.98]].forEach((lg,k)=>{
    const leg=mesh(new THREE.BoxGeometry(0.06,0.2,0.06),MAT.galv,"hp_pump_panel_leg_"+k);
    leg.position.set(lg[0],0.07,lg[1]);leg.castShadow=false;s.add(leg);
  });
  /* pipework from the pump: ERD interconnect stays static, feed manifold link is per-plant */
  tube(world,[[7.0,2.2,-1.5],[7.9,2.2,0.6],[7.9,1.0,3.0],[7.2,0.78,3.5],[6.6,0.78,3.8]],0.18,MAT.pipeFeed,"pipe_pump_erd");
  flange(world,V(7.0,2.2,-1.5),V(1,0,0),0.2,"flange_pump_feed_tee");
  valve(world,V(7.9,1.5,2.4),V(0,-0.5,1),0.18,"erd_feed_valve");
}

/* ============ energy recovery device: bank of vertical pressure exchangers ============ */
function buildERD(){
  const s=new THREE.Group();s.name="energy_recovery";world.add(s);
  [[6.2,3.6],[6.2,4.2],[7.0,3.6],[7.0,4.2]].forEach((p,i)=>{
    const v=mesh(new THREE.CylinderGeometry(0.38,0.38,2.0,18),MAT.paint,"erd_vessel_"+i);
    v.position.set(p[0],1.6,p[1]);s.add(v);
    [2.62,0.58].forEach((py,k)=>{
      const port=mesh(new THREE.CylinderGeometry(0.42,0.42,0.08,18),MAT.galv,"erd_vessel_"+i+"_port_"+k);
      port.position.set(p[0],py,p[1]);s.add(port);
      const n=6,bolts=new THREE.InstancedMesh(boltGeo,MAT.stainless,n);
      for(let b=0;b<n;b++){
        const a=b/n*Math.PI*2;
        _dummy.position.set(p[0]+Math.cos(a)*0.44,py+(k?0.06:-0.06),p[1]+Math.sin(a)*0.44);
        _dummy.rotation.set(0,0,0);_dummy.updateMatrix();bolts.setMatrixAt(b,_dummy.matrix);
      }
      bolts.castShadow=true;s.add(bolts);
    });
  });
  tube(world,[[6.6,2.75,3.4],[6.6,2.75,4.4]],0.18,MAT.pipeBrine,"erd_top_manifold");
  tube(s,[[6.6,0.78,3.4],[6.6,0.78,4.4]],0.18,MAT.pipeFeed,"erd_bottom_manifold");
  [[6.2,3.6],[6.2,4.2],[7.0,3.6],[7.0,4.2]].forEach((p,i)=>{
    tube(s,[[p[0],2.62,p[1]],[p[0]+(6.6-p[0])*0.5,2.7,p[1]],[6.6,2.75,p[1]]],0.12,MAT.pipeBrine,"erd_vessel_"+i+"_top_stub");
    tube(s,[[p[0],0.66,p[1]],[p[0]+(6.6-p[0])*0.5,0.72,p[1]],[6.6,0.78,p[1]]],0.12,MAT.pipeFeed,"erd_vessel_"+i+"_bottom_stub");
  });
  gauge(world,V(6.6,2.95,3.65),V(1,0.3,0),"erd_gauge_0");
  gauge(world,V(6.6,2.95,4.15),V(1,0.3,0),"erd_gauge_1");
  /* frame */
  [[5.8,3.2],[5.8,4.6],[7.4,3.2],[7.4,4.6]].forEach((p,i)=>{
    const post=mesh(new THREE.BoxGeometry(0.08,2.5,0.08),MAT.galv,"erd_frame_post_"+i);
    post.position.set(p[0],1.25,p[1]);s.add(post);
  });
  [[3.2,0],[4.6,0],[3.2,Math.PI/2],[4.6,Math.PI/2]].forEach((br,k)=>{
    const rail=mesh(new THREE.BoxGeometry(1.76,0.08,0.08),MAT.galv,"erd_frame_rail_"+k);
    rail.position.set(6.6,2.62,br[0]);
    if(br[1])rail.rotation.y=Math.PI/2;
    s.add(rail);
  });
}

/* ============ chemical dosing skid ============ */
function buildDosing(){
  const s=new THREE.Group();s.name="dosing_skid";world.add(s);
  const base=mesh(new THREE.BoxGeometry(1.6,0.12,1.0),MAT.paint,"dosing_skid_base");
  base.position.set(2.2,0.06,1.4);base.castShadow=false;base.receiveShadow=true;s.add(base);
  [0.45,-0.4].forEach((zoff,i)=>{
    const drum=mesh(new THREE.CylinderGeometry(0.26,0.26,0.8,16),MAT.pipeDosing,"dosing_drum_"+i);
    drum.position.set(2.2,0.52,1.4+zoff);s.add(drum);
    const dcap=mesh(new THREE.CylinderGeometry(0.26,0.26,0.06,16),MAT.paint,"dosing_drum_cap_"+i);
    dcap.position.set(2.2,0.94,1.4+zoff);s.add(dcap);
    const pump=mesh(new THREE.BoxGeometry(0.3,0.28,0.22),MAT.paintLight,"dosing_pump_"+i);
    pump.position.set(2.2,0.26,1.4+zoff*0.2);s.add(pump);
    tube(s,[[2.2,0.2,1.4+zoff],[2.2,0.16,1.4+zoff*0.3]],0.03,MAT.pipeDosing,"dosing_suction_"+i);
  });
  /* antiscalant to the cartridge inlet; coagulant to the DAF */
  tube(world,[[2.4,0.4,1.3],[1.5,0.55,0.3],[0.95,2.4,-0.5],[0.95,2.5,-0.5]],0.035,MAT.pipeDosing,"pipe_dosing_feed");
  tube(world,[[2.0,0.4,1.55],[1.2,0.4,1.9],[-4,0.4,2.4],[-16,0.4,3.0],[-23.5,2.3,2.4]],0.035,MAT.pipeDosing,"pipe_dosing_daf");
  psupport(world,-4,2.4,0.42,"support_dosing_0");
  psupport(world,-16,3.0,0.42,"support_dosing_1");
  gauge(world,V(1.5,0.75,0.3),V(-1,0.5,0),"dosing_gauge");
}

/* ============ permeate tank and brine outfall ============ */
function buildTankOutfall(){
  const s=new THREE.Group();s.name="permeate_storage";world.add(s);
  const tank=mesh(new THREE.CylinderGeometry(1.05,1.05,2.9,26),MAT.pipePerm,"permeate_tank");
  tank.position.set(24,1.75,-2);s.add(tank);
  const dome=mesh(new THREE.SphereGeometry(1.05,26,12,0,Math.PI*2,0,Math.PI/2),MAT.pipePerm,"permeate_tank_dome");
  dome.scale.set(1,0.5,1);dome.position.set(24,3.2,-2);s.add(dome);
  const skirt=mesh(new THREE.CylinderGeometry(1.1,1.15,0.3,26),MAT.paint,"permeate_tank_skirt");
  skirt.position.set(24,0.15,-2);s.add(skirt);
  ladder(world,25.1,-2,0,3.0,"permeate_tank_ladder",Math.PI);
  gauge(world,V(22.9,2.2,-2),V(-1,0.3,0),"permeate_tank_gauge");
  /* outfall culvert */
  const o=new THREE.Group();o.name="outfall";o.position.set(29,0,6);world.add(o);
  [-0.85,0.85].forEach((zoff,i)=>{
    const wall=mesh(new THREE.BoxGeometry(2.6,1.3,0.3),MAT.concrete,"outfall_wall_"+i);
    wall.position.set(0,0.65,zoff);wall.castShadow=false;wall.receiveShadow=true;o.add(wall);
  });
  const ofloor=mesh(new THREE.BoxGeometry(2.6,0.25,2.0),MAT.dark,"outfall_floor");
  ofloor.position.set(0,0.35,0);ofloor.castShadow=false;ofloor.receiveShadow=false;o.add(ofloor);
  const owater=mesh(new THREE.PlaneGeometry(2.3,1.55),MAT.water,"outfall_water");
  owater.rotation.x=-Math.PI/2;owater.position.set(0,0.95,0);owater.castShadow=false;owater.receiveShadow=false;o.add(owater);
  const grate=deck(o,0,1.32,0,2.4,1.6,"outfall_grate");
}

/* ============ static pipes that do not depend on the number of trains ============ */
function buildStaticPipes(){
  /* cartridge outlet header -> pump suction */
  tube(world,[[2.2,0.72,-0.5],[3.2,0.82,-1.2],[3.95,0.95,-1.5]],0.15,MAT.pipeFeed,"pipe_feed_pump");
  flange(world,V(3.95,0.95,-1.5),V(-1,0,0),0.15,"flange_feed_pump");
  valve(world,V(2.9,0.78,-0.85),V(0.7,-0.15,-0.7),0.15,"cartridge_outlet_valve");
  /* ERD brine outlet to the outfall */
  tube(world,[[6.6,2.75,3.4],[6.0,2.6,2.9],[5.4,2.0,3.4],[7.0,1.3,4.6],[10.5,1.0,5.2],[15,0.85,6.0],[22,0.85,6.0],[26.6,0.85,6.0],[28.0,0.85,6.0]],0.24,MAT.pipeBrine,"pipe_outfall");
  flange(world,V(27.9,0.85,6.0),V(1,0,0),0.24,"flange_outfall");
  valve(world,V(9.6,1.15,4.75),V(0.5,-0.4,0.75),0.24,"outfall_valve");
  psupport(world,10.5,5.2,0.85,"support_outfall_0");
  psupport(world,15,6.0,0.7,"support_outfall_1");
  psupport(world,22,6.0,0.7,"support_outfall_2");
}

buildIntake();
buildDAF();
buildMediaFilters();
buildCartridges();
buildPump();
buildERD();
buildDosing();
buildTankOutfall();
buildStaticPipes();

/* ============ cartridge inlet header (static) ============ */
tube(world,[[-1.75,0.8,-0.5],[-0.4,0.8,-0.5],[-0.4,2.5,-0.5],[0.95,2.5,-0.5]],0.16,MAT.pipeFeed,"pipe_media_cartridge");
tube(world,[[0.95,2.5,-1.2],[0.95,2.5,0.2]],0.12,MAT.pipeFeed,"cartridge_inlet_header");
[-1.2,0.2].forEach((z,i)=>{
  tube(world,[[0.95,2.5,z],[0.8,2.5,z]],0.09,MAT.pipeFeed,"cartridge_"+i+"_inlet");
  flange(world,V(0.9,2.5,z),V(-1,0,0),0.09,"flange_cartridge_"+i+"_inlet");
});
flange(world,V(0.95,2.5,-0.5),V(0,1,0),0.16,"flange_media_cartridge");
valve(world,V(-0.4,1.5,-0.5),V(0,0.6,0.35),0.16,"media_cartridge_valve");

/* ============ membrane vessels: real proportions, one group per train ============
   A seawater RO vessel: about 0.2 m across, 7 membrane elements, ~7 m long. */
const vessels=new THREE.Group();vessels.name="vessels";world.add(vessels);
let curPlant=null,cutaway=false;
/* chlorophyll bloom haze in the pump bay: drifting additive points,
   density and brightness follow the chlorophyll at the active intake */
let bloomPts=null,bloomVel=null;
function buildBloomParticles(){
  const N=420,pos=new Float32Array(N*3);
  bloomVel=new Float32Array(N*3);
  for(let i=0;i<N;i++){
    pos[i*3]=-35.6+Math.random()*5.6;
    pos[i*3+1]=1.08+Math.random()*0.42;
    pos[i*3+2]=-7.4+Math.random()*14.8;
    bloomVel[i*3]=(Math.random()-0.5)*0.09;
    bloomVel[i*3+1]=(Math.random()-0.5)*0.02;
    bloomVel[i*3+2]=(Math.random()-0.5)*0.09;
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute("position",new THREE.BufferAttribute(pos,3));
  const mat=new THREE.PointsMaterial({color:0x9fd45c,size:0.09,transparent:true,opacity:0,
    blending:THREE.AdditiveBlending,depthWrite:false,sizeAttenuation:true});
  bloomPts=new THREE.Points(geo,mat);
  bloomPts.name="intake_bloom_particles";
  bloomPts.userData.n=N;
  bloomPts.frustumCulled=false;
  world.add(bloomPts);
}
buildBloomParticles();
function label(txt){
  const cv=document.createElement("canvas");cv.width=128;cv.height=64;
  const c=cv.getContext("2d");c.font="700 30px Figtree, sans-serif";c.textAlign="center";
  c.fillStyle=txCol;c.fillText(txt,64,42);
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv),transparent:true}));
  sp.scale.set(1.7,0.85,1);sp.userData={cv,txt};return sp;
}
function buildVessels(pid){
  curPlant=pid;
  setOutlines([]);selTrain=null;
  while(vessels.children.length){
    const old=vessels.children[0];
    old.traverse(o=>{
      if(o.isMesh){o.geometry.dispose();if(o.material&&o.material.userData&&o.material.userData.cloned)o.material.dispose();}
      if(o.isSprite){if(o.material.map&&o.material.map!==glowT)o.material.map.dispose();o.material.dispose();}
    });
    vessels.remove(old);
  }
  const trains=SW().trains.filter(r=>r.p===pid);
  const n=trains.length,rowHalf=(n-1)/2,zSpan=rowHalf+0.9;
  /* --- row structure --- */
  const st=new THREE.Group();st.name="vessel_row_structure";vessels.add(st);
  deck(st,14.5,0.32,0,8.0,zSpan*2,"vessel_row_deck");
  [-zSpan,zSpan].forEach(zz=>beam(st,iBeamGeo(8.2,0.2,0.12,0.02),MAT.paint,[14.5,0.2,zz],[0,Math.PI/2,0]));
  [11.3,14.5,17.7].forEach(xx=>beam(st,iBeamGeo(zSpan*2,0.16,0.1,0.015),MAT.paint,[xx,0.09,0]));
  /* elevated access walkway on the feed side with handrails and ladders */
  deck(st,10.45,1.0,0,1.2,zSpan*2,"vessel_row_walkway");
  handrail(st,[[9.85,-zSpan],[11.05,-zSpan]],1.0,"vessel_row_rail_s");
  handrail(st,[[9.85,zSpan],[11.05,zSpan]],1.0,"vessel_row_rail_n");
  handrail(st,[[9.85,-zSpan],[9.85,zSpan]],1.0,"vessel_row_rail_w");
  ladder(st,10.45,-zSpan,0,1.0,"vessel_row_ladder_s");
  ladder(st,10.45,zSpan,0,1.0,"vessel_row_ladder_n",Math.PI);
  tray(st,19.7,-zSpan,19.7,zSpan,1.65,"vessel_row_cable_tray");
  /* --- manifolds: feed, brine, permeate --- */
  tube(st,[[10.5,1.42,-zSpan-0.15],[10.5,1.42,zSpan+0.15]],0.2,MAT.pipeFeed,"feed_manifold");
  flange(st,V(10.5,1.42,-zSpan-0.15),V(0,0,-1),0.2,"flange_feed_man_west");
  psupport(st,10.5,-zSpan*0.5,1.16,"support_feed_man_0");
  psupport(st,10.5,zSpan*0.5,1.16,"support_feed_man_1");
  tube(st,[[18.7,1.42,-zSpan-0.15],[18.7,1.42,zSpan+0.15]],0.2,MAT.pipeBrine,"brine_manifold");
  flange(st,V(18.7,1.42,zSpan+0.15),V(0,0,1),0.2,"flange_brine_man_east");
  psupport(st,18.7,-zSpan*0.5,1.16,"support_brine_man_0");
  psupport(st,18.7,zSpan*0.5,1.16,"support_brine_man_1");
  tube(st,[[19.4,2.05,-zSpan-0.15],[19.4,2.05,zSpan+0.15]],0.13,MAT.pipePerm,"permeate_manifold");
  flange(st,V(19.4,2.05,-zSpan-0.15),V(0,0,-1),0.13,"flange_perm_man_west");
  psupport(st,19.4,-zSpan*0.5,1.78,"support_perm_man_0");
  psupport(st,19.4,zSpan*0.5,1.78,"support_perm_man_1");
  /* --- pipes that link the manifolds to the static plant --- */
  tube(st,[[6.3,2.2,-1.5],[7.6,2.2,-1.5],[9.2,2.05,-2.5],[10.5,1.7,-zSpan-0.15]],0.2,MAT.pipeFeed,"pipe_pump_feed");
  flange(st,V(10.4,1.72,-zSpan-0.15),V(0.3,-0.6,0),0.2,"flange_pump_feed_man");
  valve(st,V(8.0,2.2,-1.9),V(0.5,0,-0.85),0.2,"feed_header_valve");
  flowmeter(st,V(9.5,2.0,-2.7),V(0.8,-0.1,-0.5),0.2,"feed_flowmeter");
  tube(st,[[18.7,1.42,zSpan+0.15],[19.6,1.3,zSpan+0.7],[19.6,1.1,4.6],[9.5,1.1,5.0],[7.6,1.1,4.6],[6.9,1.8,4.35],[6.6,2.4,4.3],[6.6,2.75,4.4]],0.2,MAT.pipeBrine,"pipe_erd_brine");
  valve(st,V(19.6,1.2,4.0),V(0,-0.3,-1),0.2,"brine_erd_valve");
  tube(st,[[19.4,2.05,zSpan+0.15],[21.0,2.1,zSpan+0.3],[22.6,2.3,0.5],[23.6,3.3,-1.2],[24.0,3.55,-2.0]],0.16,MAT.pipePerm,"pipe_perm_tank");
  flange(st,V(23.95,3.5,-2.0),V(0.15,-1,0.1),0.16,"flange_perm_tank");
  /* --- one vessel group per train --- */
  trains.forEach((r,i)=>{
    const z=(i-rowHalf)*1.0;
    const grp=new THREE.Group();grp.name="vessel_"+r.id;grp.userData.train=r.id;
    /* shell (tinted by the worst element risk) and dished caps */
    const shell=mesh(new THREE.CylinderGeometry(0.145,0.145,7.0,24),dyn(MAT.fibreglass),"vessel_"+r.id+"_shell",
      {train:r.id,shell:true,base:new THREE.Color(0xcfd8d6)});
    shell.rotation.z=Math.PI/2;shell.position.set(14.5,1.42,z);
    grp.add(shell);
    const capA=mesh(new THREE.SphereGeometry(0.145,20,12),MAT.paintLight,"vessel_"+r.id+"_endfeed",{train:r.id});
    capA.scale.set(0.55,1,1);capA.position.set(10.93,1.42,z);grp.add(capA);
    const capB=mesh(new THREE.SphereGeometry(0.145,20,12),MAT.paintLight,"vessel_"+r.id+"_endbrine",{train:r.id});
    capB.scale.set(0.55,1,1);capB.position.set(18.07,1.42,z);grp.add(capB);
    /* ports: feed axially in, brine axially out, permeate out of the brine end */
    tube(grp,[[10.85,1.42,z],[10.72,1.42,z]],0.055,MAT.pipeFeed,"vessel_"+r.id+"_feed_port");
    coupling(grp,V(10.79,1.42,z),V(-1,0,0),0.055,"vessel_"+r.id+"_feed_coupling");
    flange(grp,V(10.74,1.42,z),V(-1,0,0),0.055,"vessel_"+r.id+"_feed_flange");
    tube(grp,[[18.09,1.42,z],[18.5,1.42,z]],0.07,MAT.pipeBrine,"vessel_"+r.id+"_brine_port");
    coupling(grp,V(18.28,1.42,z),V(1,0,0),0.07,"vessel_"+r.id+"_brine_coupling");
    flange(grp,V(18.42,1.42,z),V(1,0,0),0.07,"vessel_"+r.id+"_brine_flange");
    tube(grp,[[18.09,1.42,z],[18.3,1.42,z],[18.6,1.42,z],[18.85,1.75,z],[19.1,2.05,z],[19.25,2.05,z]],0.032,MAT.pipePerm,"vessel_"+r.id+"_perm_pipe");
    /* retaining straps and saddles */
    [12.6,16.4].forEach((sx,k)=>{
      const strap=new THREE.Mesh(new THREE.TorusGeometry(0.155,0.012,8,22),MAT.stainless,"vessel_"+r.id+"_strap_"+k);
      strap.rotation.y=Math.PI/2;strap.position.set(sx,1.42,z);strap.castShadow=true;grp.add(strap);
    });
    saddle(grp,11.9,1.42,z,0.145,0.32,"vessel_"+r.id+"_saddle_0");
    saddle(grp,17.1,1.42,z,0.145,0.32,"vessel_"+r.id+"_saddle_1");
    /* the 7 spiral-wound elements, seen in cutaway */
    const elems=[];
    for(let k=1;k<=7;k++){
      const eg=new THREE.Group();
      eg.name="vessel_"+r.id+"_element_"+k;
      eg.position.set(11.9+(k-1)*0.945,1.42,z);
      eg.userData={train:r.id,el:k};
      const wrap=mesh(new THREE.CylinderGeometry(0.118,0.118,0.86,18),dyn(MAT.fibreglass),
        "vessel_"+r.id+"_element_"+k+"_wrap",{train:r.id,el:k});
      wrap.material.map=spiralT;wrap.material.map.needsUpdate=true;
      wrap.rotation.z=Math.PI/2;
      eg.add(wrap);
      [-0.46,0.46].forEach((dx,j)=>{
        const ec=mesh(new THREE.CylinderGeometry(0.121,0.121,0.05,18),MAT.paintLight,"vessel_"+r.id+"_element_"+k+"_cap_"+j);
        ec.rotation.z=Math.PI/2;ec.position.x=dx;eg.add(ec);
        const stub=mesh(new THREE.CylinderGeometry(0.022,0.022,0.15,10),MAT.pipePerm,"vessel_"+r.id+"_element_"+k+"_stub_"+j);
        stub.rotation.z=Math.PI/2;stub.position.x=dx>0?dx+0.08:dx-0.08;eg.add(stub);
      });
      elems.push(eg);
      eg.visible=cutaway;   /* wrap meshes start hidden; cutaway reveals them */
      grp.add(eg);
    }
    grp.userData.shell=shell;grp.userData.elems=elems;
    const lb=label(r.id);lb.position.set(14.5,2.15,z);grp.add(lb);
    vessels.add(grp);
  });
}
function applyCutaway(){
  vessels.children.forEach(grp=>{
    if(!grp.userData.train)return;
    if(grp.userData.shell)grp.userData.shell.visible=!cutaway;
    if(grp.userData.elems)grp.userData.elems.forEach(e=>e.visible=cutaway);
  });
}
function setColor(m,rgb){m.material.color.setRGB(rgb[0],rgb[1],rgb[2])}
function updateColors(){
  if(!SW())return;
  const bg=C("--pn").multiplyScalar(0.62);
  scene.background=bg;
  if(scene.fog)scene.fog.color.copy(bg);
  const gnd=world.getObjectByName("ground");if(gnd)gnd.material.color.copy(C("--land"));
  const t=SW().t();
  const bloom=SW().intakeRisk(curPlant),bcol=SW().riskRGB(bloom);
  const bloomSize=o=>{
    const n=o.name||"";
    if(n.indexOf("flotation")===0)return 3.6;
    if(n.indexOf("media_filter")===0)return 2.4;
    if(n.indexOf("cartridge")===0)return 1.15;
    if(n.indexOf("intake_screen")===0)return 2.6;
    if(n.indexOf("band_")===0)return 1.8;
    return null;
  };
  GLOWS.length=0;
  world.traverse(o=>{
    if(o.isMesh&&o.userData&&o.userData.bloom){setColor(o,bcol);glowSet(o,bloom,bcol,bloomSize(o));}
  });
  /* pump-bay bloom particles: density and glow follow chlorophyll at this intake */
  if(bloomPts){
    const plant=SW().plants.find(p2=>p2.id===curPlant);
    const chl=plant?plant.chl[cl(Math.round(t),0,72)]||0:0;
    bloomPts.material.opacity=cl(chl/1.5,0,1)*0.55;
    bloomPts.geometry.setDrawRange(0,Math.round(bloomPts.userData.n*cl(chl/2.5,0.06,1)));
  }
  /* flow speed follows the plant's permeate flux */
  const txCol=SW().cssv("--tx");
  const trains=SW().trains.filter(r2=>r2.p===curPlant);
  let fAvg=0;if(trains.length)fAvg=trains.reduce((a,r2)=>a+SW().stateAt(r2,t).flux,0)/trains.length;
  flowScale=0.45+0.55*cl(fAvg/450,0,1);
  vessels.children.forEach(grp=>{
    if(!grp.userData.train)return;
    const train=SW().trains.find(r2=>r2.id===grp.userData.train);
    const er=SW().elemRisks(train,t);
    let worst=0;
    er.elems.forEach(v=>{if(v>worst)worst=v});
    const rcA=SW().riskRGB(worst);
    const rc=new THREE.Color(rcA[0],rcA[1],rcA[2]);
    grp.traverse(o=>{
      if(o.isMesh&&o.userData&&o.userData.el){
        const k=er.elems[o.userData.el-1],kcol=SW().riskRGB(k);
        setColor(o,kcol);
        glowSet(o,k,kcol,0.42);
      }
      if(o.isMesh&&o.userData&&o.userData.shell){
        o.material.color.copy(o.userData.base).lerp(rc,0.55);
        glowSet(o,worst,rcA,0.55);
      }
      /* redraw a vessel label only when its colour changes: a canvas redraw
         and texture upload per label per frame is what made playback stutter */
      if(o.isSprite&&o.userData&&o.userData.txt&&o.userData.drawn!==txCol){
        o.userData.drawn=txCol;
        const c=o.userData.cv.getContext("2d");
        c.clearRect(0,0,128,64);
        c.font="700 30px Figtree, sans-serif";c.textAlign="center";
        c.fillStyle=txCol;c.fillText(o.userData.txt,64,42);
        o.material.map.needsUpdate=true;
      }
    });
  });
}

/* cutaway toggle lives inside the viewport */
const bar=document.createElement("div");
bar.style.cssText="position:absolute;top:8px;right:8px;display:flex;gap:6px;z-index:2;pointer-events:none";
const cutBtn=document.createElement("button");
cutBtn.className="s";
cutBtn.textContent="Cutaway";
cutBtn.style.cssText="font-size:12px;padding:3px 10px;pointer-events:auto;opacity:0.85";
function syncCut(){cutBtn.style.background=cutaway?"#e6f1ee":"";cutBtn.style.color=cutaway?"var(--background)":""}
cutBtn.onclick=()=>{cutaway=!cutaway;syncCut();setOutlines([]);selTrain=null;applyCutaway()};
bar.appendChild(cutBtn);box.appendChild(bar);

/* ============ selection outline: inverted-hull highlight, hover + click ============ */
const outlineMatH=new THREE.MeshBasicMaterial({color:0x8fd8cf,side:THREE.BackSide,transparent:true,opacity:0.5,fog:false});
const outlineMatS=new THREE.MeshBasicMaterial({color:0xf2b84b,side:THREE.BackSide,transparent:true,opacity:0.85,fog:false});
let outlineMeshes=[],selTrain=null;
function setOutlines(list,strong){
  outlineMeshes.forEach(o=>scene.remove(o));outlineMeshes=[];
  (list||[]).forEach(m=>{
    if(!m||!m.isMesh||!m.geometry||m.isInstancedMesh)return;
    const o=new THREE.Mesh(m.geometry,strong?outlineMatS:outlineMatH);
    m.updateWorldMatrix(true,false);
    m.matrixWorld.decompose(o.position,o.quaternion,o.scale);
    o.scale.multiplyScalar(strong?1.10:1.045);
    o.renderOrder=3;o.castShadow=false;o.receiveShadow=false;
    scene.add(o);outlineMeshes.push(o);
  });
}
/* ============ component labels ============ */
const lp=(a,b,k)=>a+(b-a)*k;
const HS=[
 /* the band screen is an open frame, so hang the label on its moving belt instead */
 {key:"screens",label:"Intake screens",targets:["intake_screen_0","intake_screen_1","intake_screen_2"],anchorName:"band_belt_front",dir:[-52,-30]},
 {key:"daf",label:"Flotation (DAF)",targets:["flotation"],dir:[-46,-30]},
 {key:"media",label:"Media filters",targets:["media_filter_0","media_filter_1","media_filter_2"],dir:[-46,-30]},
 {key:"cartridges",label:"Cartridge filters",targets:["cartridge_0","cartridge_1"],dir:[14,-32]},
 {key:"pump",label:"HP pump skid",targets:["pump_skid_assembly"],dir:[34,-28]},
 {key:"erd",label:"Energy recovery",targets:["energy_recovery"],dir:[58,-50]},
 {key:"dosing",label:"Dosing skid",targets:["dosing_skid"],dir:[18,-32]},
 {key:"perm",label:"Permeate tank",targets:["permeate_tank","permeate_tank_dome","permeate_tank_skirt","permeate_tank_ladder"],dir:[30,-28]},
 {key:"outfall",label:"Brine outfall",targets:["outfall"],dir:[24,16]}
];
let labelAnchors=[],flyAnim=null;
/* The biggest whole unit among the named parts (one media filter rather than the
   pair, the screen frame rather than its bare bars). Measuring each part on its
   own keeps the centre of the box on the equipment: a union across several pods
   lands in the empty gap between them. */
function biggestUnit(targets){
  const b=new THREE.Box3();
  let best=null,bestSize=0;
  targets.forEach(nm=>{
    const o=world.getObjectByName(nm);if(!o)return;
    b.setFromObject(o);            /* recursive, in world space */
    if(b.isEmpty())return;
    const s=b.getSize(new THREE.Vector3());
    const size=s.x*s.y*s.z;
    if(size>bestSize){bestSize=size;best=b.clone()}
  });
  return best;
}
/* Each floating label hangs on the middle of the equipment it names: an anchor
   at the centre of a box is always over the object, while a bbox top can float
   over a gap (the open frame of the intake screens) or inside a wall. Anchors
   are rebuilt with the vessel row so they survive a plant switch. */
function buildLabelAnchors(){
  /* Groups carry their own offsets (the intake bay, the outfall), so make every
     world matrix current before measuring anything. */
  world.updateMatrixWorld(true);
  labelAnchors=HS.map(h=>{
    const piece=biggestUnit(h.anchorName?[h.anchorName]:h.targets);
    const anchor=new THREE.Vector3();
    if(piece){piece.getCenter(anchor);anchor.y+=0.2}
    return{...h,anchor};
  });
}
/* ============ camera fly and presets ============ */
function wrapA(d){while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;return d}
function flyTo(azT,polT,radT,cT){
  flyAnim={a0:az,a1:az+wrapA(azT-az),p0:pol,p1:polT,r0:rad,r1:radT,
    c0:center.clone(),c1:new THREE.Vector3(cT[0],cT[1],cT[2]),t0:performance.now(),dur:900};
}
/* The hall is about 70 units long, so a fixed radius cropped the intake bay on
   wide canvases. Fit the camera to the plant instead: keep the angle, then solve
   the distance that projects every corner of the plant inside the frustum. */
/* Every piece of equipment, as its own world-space box. Fitting the union of
   these is much tighter than fitting one box around the whole site, whose empty
   corners would push the camera back. */
function plantPieces(){
  const b=new THREE.Box3(),pieces=[];
  world.traverse(o=>{
    if(!o.isMesh||!o.geometry)return;
    o.updateWorldMatrix(true,false);
    b.setFromObject(o);
    if(b.isEmpty()||b.max.y<0.05)return;   /* ground slab, water sheets, decals */
    pieces.push(b.clone());
  });
  return pieces;
}
/* Overview adapts to the viewport aspect. On wide canvases look across the hall
   rather than along it: from the old angle the whole intake bay sat behind the
   filters, so its label dot landed on equipment in front (or on bare floor).
   On narrow canvases look down the hall, where a broadside view cannot fit.

   The distance is solved from the plant's own boxes, then the look-at point is
   nudged so the *projected* plant sits in the middle of the frame: the union
   box centre is not the centre of the picture in perspective, and the old code
   left a whole empty margin on one side while the plant hugged the other. */
function overviewPreset(){
  const w=Math.max(1,box.clientWidth),h=Math.max(1,box.clientHeight);
  const aspect=w/h;
  const azT=aspect<1.15?0.14:1.15,polT=aspect<1.15?1.12:1.02;
  const pieces=plantPieces();
  if(!pieces.length)return{az:azT,pol:polT,rad:56,c:[-3,2,0]};
  const bb=pieces.reduce((acc,p)=>acc.union(p),new THREE.Box3());
  const c=bb.getCenter(new THREE.Vector3());
  const vT=Math.tan(cam.fov*Math.PI/360);
  const hT=vT*Math.max(0.5,aspect);
  const dir=new THREE.Vector3(Math.sin(polT)*Math.cos(azT),Math.cos(polT),Math.sin(polT)*Math.sin(azT)).normalize();
  const fwd=dir.clone().negate();
  const right=new THREE.Vector3().crossVectors(fwd,new THREE.Vector3(0,1,0)).normalize();
  const up=new THREE.Vector3().crossVectors(right,fwd).normalize();
  /* Every corner in view-plane coordinates: x across the screen, y up the
     screen, z along the view axis. Panning the look-at point shifts x and y but
     never z, so the depths are measured once and reused. */
  const pts=[],q=new THREE.Vector3();
  pieces.forEach(b=>{
    for(let i=0;i<8;i++){
      q.set(i&1?b.max.x:b.min.x,i&2?b.max.y:b.min.y,i&4?b.max.z:b.min.z).sub(c);
      pts.push({x:q.dot(right),y:q.dot(up),z:q.dot(fwd)});
    }
  });
  const fit=()=>{
    let r=0;
    for(const p of pts){
      /* distance along the view axis needed for this corner to stay in frame */
      r=Math.max(r,Math.max(Math.abs(p.x)/hT,Math.abs(p.y)/vT)*1.05-p.z);
    }
    return r;
  };
  let rad=fit();
  for(let k=0;k<3;k++){
    let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
    for(const p of pts){
      const d=rad+p.z;
      if(d<=cam.near)continue;
      const sx=p.x/(d*hT),sy=p.y/(d*vT);
      if(sx<x0)x0=sx;if(sx>x1)x1=sx;
      if(sy<y0)y0=sy;if(sy>y1)y1=sy;
    }
    if(!isFinite(x0)||!isFinite(y0))break;
    const mx=(x0+x1)/2,my=(y0+y1)/2;
    if(Math.abs(mx)<0.004&&Math.abs(my)<0.004)break;
    const dx=mx*hT*rad,dy=my*vT*rad;
    c.addScaledVector(right,dx).addScaledVector(up,dy);
    for(const p of pts){p.x-=dx;p.y-=dy;}
    rad=fit();
  }
  return{az:azT,pol:polT,rad:cl(rad,12,180),c:[c.x,c.y,c.z]};
}
/* Apply the fitted overview. Used at mount, whenever the canvas changes size,
   and by the Overview button. */
function fitOverview(animate){
  const p=overviewPreset();
  if(animate){flyTo(p.az,p.pol,p.rad,p.c);return}
  az=p.az;pol=p.pol;rad=p.rad;center.set(p.c[0],p.c[1],p.c[2]);place();
}
const PRESETS={
  vessels:{az:-1.15,pol:1.18,rad:15,c:[14.5,1.5,0]},
  intake:{az:-0.65,pol:1.22,rad:16,c:[-29.5,2.5,0]},
  pump:{az:-1.55,pol:1.15,rad:13,c:[6.6,1.6,1.6]}
};

/* ============ picking + hand-written controls ============ */
function ownerOf(o){
  for(let p=o;p;p=p.parent)if(p.userData&&p.userData.train)return{train:p.userData.train};
  return null;
}
function pickAt(e){
  const rect=dom.getBoundingClientRect();
  const ndc=new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
  const ray=new THREE.Raycaster();ray.setFromCamera(ndc,cam);
  const vis=o=>{for(let p=o;p;p=p.parent){if(p.visible===false)return false}return true};
  const hit=ray.intersectObjects(vessels.children,true)
    .find(h=>!h.object.isSprite&&vis(h.object)&&ownerOf(h.object));
  if(!hit)return null;
  const own=ownerOf(hit.object);own.obj=hit.object;return own;
}
let down=null,moved=0,userMoved=false;
const dom=renderer.domElement;
dom.style.touchAction="none";
dom.addEventListener("pointerdown",e=>{down={x:e.clientX,y:e.clientY};moved=0;flyAnim=null;dom.setPointerCapture(e.pointerId)});
dom.addEventListener("pointermove",e=>{
  if(down){   /* drag to orbit */
    const dx=e.clientX-down.x,dy=e.clientY-down.y;moved+=Math.abs(dx)+Math.abs(dy);
    az-=dx*0.0052;pol=cl(pol-dy*0.0052,0.25,1.45);
    down={x:e.clientX,y:e.clientY};if(dx||dy)userMoved=true;place();
    return;
  }
  /* hover: outline the vessel under the pointer */
  const hit=pickAt(e);
  if(hit){
    if(hit.train!==selTrain)setOutlines([hit.obj],false);
    dom.style.cursor="pointer";
  }else{
    if(!selTrain)setOutlines([]);
    dom.style.cursor="grab";
  }
});
dom.addEventListener("pointerup",e=>{
  down=null;
  if(moved>6)return;
  const hit=pickAt(e);
  if(hit){
    selTrain=hit.train;setOutlines([hit.obj],true);
    SW().open(selTrain);   /* clicking a vessel opens its drawer */
  }
});
dom.addEventListener("pointerleave",()=>{if(!selTrain)setOutlines([])});
dom.addEventListener("wheel",e=>{e.preventDefault();flyAnim=null;userMoved=true;rad=cl(rad*Math.exp(e.deltaY*0.001),6,140);place()},{passive:false});

function resize(){
  const w=box.clientWidth,h=box.clientHeight;
  if(w<1||h<1)return;
  /* updateStyle must stay on: the drawing buffer is w*dpr wide, and a canvas
     with no CSS size lays itself out at its buffer size. On a scaled Windows
     display that made the canvas 25-50% larger than the card, so the scene was
     cropped and every label (positioned in CSS pixels) missed its equipment. */
  renderer.setSize(w,h);
  cam.aspect=w/h;cam.updateProjectionMatrix();
  /* Keep the plant framed when the window, the breakpoint or the sidebar
     changes size — unless the operator has orbited or zoomed to a view of
     their own, which must survive a resize. */
  if(!userMoved&&!flyAnim)fitOverview(false);
}
const resizeObs=new ResizeObserver(resize);resizeObs.observe(box);
window.addEventListener("resize",resize);

/* ============ floating labels with leader lines, hidden when crowded ============ */
const NSvg="http://www.w3.org/2000/svg";
const lblLayer=document.createElement("div");lblLayer.className="v3dlbl";box.appendChild(lblLayer);
const lblSvg=document.createElementNS(NSvg,"svg");lblSvg.setAttribute("class","v3dls");box.appendChild(lblSvg);
const lblObjs=[
 {key:"screens",t:"Intake screens"},{key:"daf",t:"Flotation (DAF)"},{key:"media",t:"Media filters"},
 {key:"cartridges",t:"Cartridge filters"},{key:"pump",t:"HP pump skid"},{key:"erd",t:"Energy recovery"},
 {key:"dosing",t:"Dosing skid"},{key:"perm",t:"Permeate tank"},{key:"outfall",t:"Brine outfall"}
].map(L=>{
  const d=document.createElement("div");d.className="lb";d.textContent=L.t;
  /* Measure once while hidden: clamping needs the real box, and measuring it
     inside the animation loop would force a layout on every frame. */
  d.style.visibility="hidden";d.style.display="block";lblLayer.appendChild(d);
  const lw=d.offsetWidth||56,lh=d.offsetHeight||18;
  d.style.display="none";d.style.visibility="";
  const ln=document.createElementNS(NSvg,"line");
  /* A literal colour: var() is not resolved inside SVG presentation attributes,
     which left every leader line unstroked. */
  ln.setAttribute("stroke","#8aa6ac");ln.setAttribute("stroke-width","1");ln.style.display="none";lblSvg.appendChild(ln);
  const dot=document.createElementNS(NSvg,"circle");
  dot.setAttribute("r","2.2");dot.setAttribute("fill","#8aa6ac");dot.style.display="none";lblSvg.appendChild(dot);
  return{L,d,ln,dot,on:false,lw,lh};
});
function updateLabels(){
  const w=box.clientWidth,h=box.clientHeight;
  if(!w||!h||!labelAnchors.length)return;
  /* The viewBox has to follow both dimensions: an aspect-only resize left the
     leader lines drawn against a stale height. */
  if(+lblSvg.getAttribute("width")!==w||+lblSvg.getAttribute("height")!==h){
    lblSvg.setAttribute("width",w);lblSvg.setAttribute("height",h);
    lblSvg.setAttribute("viewBox","0 0 "+w+" "+h);
  }
  /* Project with the camera of THIS frame. Calling this before renderer.render
     meant the camera matrices were a frame old, so labels trailed the plant
     while it was orbited. */
  cam.updateMatrixWorld();
  const v=new THREE.Vector3(),cand=[];
  lblObjs.forEach(o=>{
    const hs=labelAnchors.find(x=>x.key===o.L.key);
    o.on=false;
    if(!hs||!hs.anchor)return;
    /* Camera space first: an anchor behind the camera projects to a mirrored
       point on the opposite side of the frame, which sent labels flying. */
    v.copy(hs.anchor).applyMatrix4(cam.matrixWorldInverse);
    if(v.z>-0.2)return;
    v.applyMatrix4(cam.projectionMatrix);
    const sx=(v.x*0.5+0.5)*w,sy=(-v.y*0.5+0.5)*h;
    if(sx<-6||sx>w+6||sy<-6||sy>h+6)return;
    /* The tuned offset lives on the anchor entry (HS), not on the label list:
       reading it from the wrong object gave every label the same default and
       stacked the middle of the plant with overlapping boxes. */
    cand.push({o,sx,sy,dir:hs.dir});
  });
  cand.sort((a,b)=>a.sy-b.sy);
  const placed=[];
  cand.forEach(c=>{
    const dir=c.dir||[0,-30];
    /* translate(-50%,-100%) grows a label up and sideways from its point, so
       clamp against its measured box or edge labels get cut off. */
    const half=c.o.lw/2+3,full=c.o.lh+3;
    const lx=cl(c.sx+dir[0],half,w-half);
    let ly=cl(c.sy+dir[1],full,h-4);
    /* Slide to the nearest free row, alternating above and below the anchor, so
       a label stays as close to its equipment as the crowding allows. Hiding
       every label that lands near another one left the busiest parts of the
       plant unnamed. */
    const clash=()=>placed.some(p=>Math.abs(p.lx-lx)<96&&Math.abs(p.ly-ly)<20);
    if(clash()){
      const base=ly;
      let found=false;
      for(let step=1;step<=6&&!found;step++){
        for(const row of [base-step*22,base+step*22]){
          if(row<full||row>h-4)continue;
          ly=row;
          if(!clash()){found=true;break}
        }
      }
      if(!found)ly=base;
    }
    c.o.on=!clash();
    if(!c.o.on)return;
    placed.push({lx,ly});
    c.o.d.style.display="block";c.o.d.style.left=lx+"px";c.o.d.style.top=ly+"px";
    c.o.ln.setAttribute("x1",c.sx);c.o.ln.setAttribute("y1",c.sy);
    c.o.ln.setAttribute("x2",lx);c.o.ln.setAttribute("y2",ly+2);
    c.o.ln.style.display="block";
    c.o.dot.setAttribute("cx",c.sx);c.o.dot.setAttribute("cy",c.sy);c.o.dot.style.display="block";
  });
  lblObjs.forEach(o=>{
    if(!o.on){o.d.style.display="none";o.ln.style.display="none";o.dot.style.display="none"}
  });
}

buildVessels(data.plantId);
buildLabelAnchors();
updateColors();applyCutaway();
/* resize() fits the overview too, so the very first frame is framed to the box
   rather than to a default radius. */
resize();

/* ambient motion: water ripple, band screen, skimmer travel, pipe flow dashes,
   fault-glow pulse, chlorophyll drift */
let tPrev=0,skPh=0;
(function loop(t){
  if(!mounted)return;
  rafId=requestAnimationFrame(loop);
  try{
  const dt=Math.min(0.05,((t||0)-tPrev)/1000||0.016);tPrev=t||0;
  if(dt>0){
    if(waterNT){waterNT.offset.x+=dt*0.014;waterNT.offset.y+=dt*0.010;}
    if(beltT)beltT.offset.y+=dt*0.10;
    /* flow dashes, speed per service scaled by the plant flux */
    FLOW.feed.emissiveMap.offset.x-=dt*0.22*flowScale;
    FLOW.perm.emissiveMap.offset.x-=dt*0.22*flowScale;
    FLOW.brine.emissiveMap.offset.x-=dt*0.13*flowScale;
    FLOW.dosing.emissiveMap.offset.x-=dt*0.06*flowScale;
    /* critical fault glows pulse slowly */
    const now=(t||0)/1000;
    for(let i=0;i<GLOWS.length;i++){
      const sp=GLOWS[i],ud=sp.userData;
      if(ud.k>=CRIT){
        const s=0.7+0.3*Math.sin(now*1.6+ud.phase);
        sp.material.opacity=ud.base*s;
        sp.scale.setScalar(ud.s*(1+0.07*(s-0.7)));
      }
    }
    /* chlorophyll drift in the pump bay */
    if(bloomPts&&bloomPts.material.opacity>0.01){
      const p=bloomPts.geometry.attributes.position;
      for(let i=0;i<p.count;i++){
        let x=p.getX(i)+bloomVel[i*3]*dt,y=p.getY(i)+bloomVel[i*3+1]*dt,z=p.getZ(i)+bloomVel[i*3+2]*dt;
        if(x<-36.2)x=29.4;else if(x>29.8)x=-35.8;
        if(y<1.06)y=1.52;else if(y>1.55)y=1.08;
        if(z<-7.6)z=7.6;else if(z>7.6)z=-7.5;
        p.setXYZ(i,x,y,z);
      }
      p.needsUpdate=true;
    }
    /* DAF skimmer travel */
    skPh=(skPh+dt*0.09)%1;
    const sk=world.getObjectByName("daf_skimmer_paddles");
    if(sk){
      for(let k=0;k<sk.count;k++){
        const x=-22.6+(((skPh+k/sk.count)%1))*6.6;
        _dummy.position.set(x,3.5,0);_dummy.rotation.set(0,0,0);_dummy.updateMatrix();
        sk.setMatrixAt(k,_dummy.matrix);
      }
      sk.instanceMatrix.needsUpdate=true;
    }
  }
  /* camera fly easing, then floating labels, then the frame */
  if(flyAnim){
    const k2=cl(((t||0)-flyAnim.t0)/flyAnim.dur,0,1);
    const e2=k2<0.5?2*k2*k2:1-Math.pow(-2*k2+2,2)/2;
    az=lp(flyAnim.a0,flyAnim.a1,e2);pol=lp(flyAnim.p0,flyAnim.p1,e2);rad=lp(flyAnim.r0,flyAnim.r1,e2);
    center.copy(flyAnim.c0).lerp(flyAnim.c1,e2);place();
    if(k2>=1)flyAnim=null;
  }
  /* the frame first, then the labels: they are projected from the matrices the
     renderer has just refreshed, so they sit exactly on their equipment */
  renderer.render(scene,cam);
  updateLabels();
  }catch(err){console.error('AYN_FRAME_ERROR',err);mounted=false}
})(0);

    /* ============ handle for the React wrapper ============ */
    const api = {
      update() {
        if (!curPlant) return
        updateColors()
      },
      setPlant(pid) {
        buildVessels(pid)
        updateColors()
        applyCutaway()
        buildLabelAnchors()
      },
      setView(preset) {
        if (preset === 'overview') {
          /* Back to the fitted view, and re-enable framing on resize. */
          userMoved = false
          fitOverview(true)
          return
        }
        const p = PRESETS[preset]
        if (p) {
          userMoved = true
          flyTo(p.az, p.pol, p.rad, p.c)
        }
      },
      dispose() {
        mounted = false
        cancelAnimationFrame(rafId)
        resizeObs.disconnect()
        window.removeEventListener('resize', resize)
        scene.traverse((o) => {
          if (!o.isMesh && !o.isPoints) return
          if (o.geometry) o.geometry.dispose()
          const materials = Array.isArray(o.material) ? o.material : [o.material]
          for (const m of materials) {
            if (!m) continue
            for (const key of ['map', 'emissiveMap', 'normalMap', 'bumpMap', 'roughnessMap']) {
              const tex = m[key]
              if (tex && tex.dispose) tex.dispose()
            }
            m.dispose()
          }
        })
        renderer.dispose()
        box.replaceChildren()
      },
    }

    return api
  } catch (err) {
    console.error('Ayn 3D plant view failed to initialise', err)
    throw err
  }
}
