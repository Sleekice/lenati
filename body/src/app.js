// ===== Lenati engine =====
(function(){
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = s=>document.querySelector(s);
const V3 = (a)=>new THREE.Vector3(a[0],a[1],a[2]);

// ---------- registry ----------
const NODES={}, LIST=[];
(function reg(nd,parent,depth){
  nd.parent=parent; nd.depth=depth; NODES[nd.id]=nd; LIST.push(nd);
  nd.region = depth===1?nd:(parent?parent.region:null);
  nd.kids.forEach(k=>reg(k,nd,depth+1));
})(BODY,null,0);
LIST.forEach((nd,i)=>{
  const base = nd.c || (nd.region&&nd.region.c) || BODY.c;
  nd.jc = nd.c ? nd.c.slice() : [base[0]+0.012*nd.depth*Math.sin(i*1.7), base[1]+0.012*nd.depth*Math.cos(i*1.3)];
  nd.t=nd.depth===0?1:0; nd.target=nd.t; nd.off=new THREE.Vector3(); nd.reveal=1; nd.dir=new THREE.Vector3(); nd.center=new THREE.Vector3(0,0.85,0); nd.radius=0.85;
});

// ---------- renderer ----------
const canvas=$('#scene');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.autoClear=false;
renderer.outputEncoding=THREE.sRGBEncoding; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=0.92;
renderer.physicallyCorrectLights=false;
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(40,1,0.001,30);
camera.position.set(0.7,1.15,2.6);
const controls=new THREE.OrbitControls(camera,canvas);
controls.target.set(0,0.86,0); controls.enableDamping=true; controls.dampingFactor=0.09;
controls.screenSpacePanning=true; controls.minDistance=0.004; controls.maxDistance=7; controls.zoomSpeed=1.1;
// image-based light: soft studio room for realistic reflections on wet tissue
const pmrem=new THREE.PMREMGenerator(renderer);
scene.environment=pmrem.fromScene(new THREE.RoomEnvironment(),0.04).texture;
scene.add(new THREE.HemisphereLight(0xf4ecff,0x2a1a1c,0.35));
const key=new THREE.DirectionalLight(0xfff0e0,1.25); key.position.set(1.5,3,2.5); scene.add(key);
const rim=new THREE.DirectionalLight(0x9fdcd6,0.7); rim.position.set(-2,1.5,-2.5); scene.add(rim);
const fill=new THREE.DirectionalLight(0xffe6dc,0.25); fill.position.set(0,-1,2); scene.add(fill);

// ---------- fractal backdrop ----------
const bgScene=new THREE.Scene(), bgCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
const bgU={uRes:{value:new THREE.Vector2(1,1)},uTime:{value:0},uC:{value:new THREE.Vector2(-0.8,0.156)},uMix:{value:0},uInt:{value:0.55}};
bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({uniforms:bgU,depthTest:false,depthWrite:false,
  vertexShader:'void main(){gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader:`precision highp float;uniform vec2 uRes;uniform float uTime;uniform vec2 uC;uniform float uMix;uniform float uInt;
  void main(){vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y;
   vec2 pm=vec2(-uv.y,uv.x)*1.75+vec2(-0.42+0.02*sin(uTime*.05),0.015*cos(uTime*.04));
   vec2 pj=uv*2.9; pj*=mat2(cos(uTime*.02),-sin(uTime*.02),sin(uTime*.02),cos(uTime*.02));
   vec2 q=mix(pm,pj,uMix); vec2 z=q*uMix; vec2 c=mix(q,uC,uMix);
   float n=0.; bool esc=false;
   for(int i=0;i<140;i++){ z=vec2(z.x*z.x-z.y*z.y,2.*z.x*z.y)+c; if(dot(z,z)>256.){esc=true;break;} n+=1.; }
   vec3 bg=vec3(0.035,0.038,0.07);
   vec3 col=bg;
   if(esc){ float sn=n-log2(log2(dot(z,z)))+4.; float t=sqrt(sn/140.);
     vec3 a=vec3(0.18,0.55,0.6), b=vec3(0.88,0.66,0.42);
     vec3 pal=mix(a,b,.5+.5*sin(t*9.+uTime*.15));
     col=bg+pal*pow(t,1.35)*1.15*uInt; }
   else { col=bg*0.7; }
   float vig=1.-.55*dot(uv,uv); gl_FragColor=vec4(col*vig,1.);}`})));

// ---------- geometry ----------
const SPH=new THREE.SphereGeometry(1,28,18);
function capsuleGeo(r,len){const pts=[];const h=len/2;
  for(let i=0;i<=8;i++){const a=-Math.PI/2+i/8*Math.PI/2;pts.push(new THREE.Vector2(Math.cos(a)*r,-h+Math.sin(a)*r));}
  for(let i=0;i<=8;i++){const a=i/8*Math.PI/2;pts.push(new THREE.Vector2(Math.cos(a)*r,h+Math.sin(a)*r));}
  return new THREE.LatheGeometry(pts,18);}
function shapeMesh(sp,mat){let m;
  if(sp.t==='e'){m=new THREE.Mesh(SPH,mat);m.position.fromArray(sp.c);m.scale.fromArray(sp.s);}
  else if(sp.t==='s'){const a=V3(sp.a),b=V3(sp.b),d=b.clone().sub(a),L=d.length();
    m=new THREE.Mesh(capsuleGeo(sp.r,L),mat);m.position.copy(a).add(b).multiplyScalar(.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());}
  else {m=new THREE.Mesh(new THREE.TorusGeometry(sp.R,sp.r,10,40),mat);m.position.fromArray(sp.c);m.rotation.x=Math.PI/2;m.scale.set(1,sp.sc,1);}
  return m;}

// ---------- realistic materials ----------
// look per tissue: [colour, roughness, translucency (subsurface glow), micro-bump strength, bump scale]
const LOOK={skin:[0xb27458,0.56,0.38,0.16,1400],hair:[0x2a1c14,0.62,0.05,0.5,3000],muscle:[0x93302f,0.36,0.3,0.35,700],bone:[0xe3d4b6,0.62,0.12,0.25,900],
  ligament:[0xd8dccf,0.34,0.25,0.2,900],cardio:[0x8e2430,0.3,0.3,0.25,600],artery:[0xb8262c,0.28,0.25,0.12,500],vein:[0x37509f,0.3,0.25,0.12,500],
  nerve:[0xd6b0a6,0.45,0.35,0.3,500],resp:[0xd48c8e,0.5,0.45,0.25,500],digest:[0xbb6f58,0.3,0.35,0.25,500],urinary:[0x8a3a2c,0.32,0.3,0.2,500],
  endocrine:[0xc99a6a,0.4,0.35,0.25,600],lymph:[0x7a2738,0.35,0.3,0.2,600],repro:[0xc78a86,0.35,0.35,0.2,600],body:[0xffffff,0.5,0,0,500]};
const IDLOOK={liver:[0x6f2a20,0.28,0.25,0.2,500],spleen:[0x5e1c2b],gallbladder:[0x5c7a3c,0.2],'kidney-left':[0x7a3326],'kidney-right':[0x7a3326],
  teeth:[0xf1e8d4,0.18,0.15,0.08],'scalp-hair':'hair','pubic-hair':'hair',eyes:[0xf2eee8,0.08,0.2,0.02],brain:[0xd8b2a8,0.42],pancreas:[0xd9ad78,0.45],
  stomach:[0xc47d6e],'small-intestine':[0xd49580],'large-intestine':[0xbf8466],bladder:[0xd3a07c],'heart-wall':[0x8d2330,0.3],diaphragm:[0x8a2e2e],
  'lung-left':[0xd99393,0.55,0.5],'lung-right':[0xd99393,0.55,0.5],larynx:[0xdcd3c2,0.4],trachea:[0xe0c4bb,0.4],bronchi:[0xe6cbbf,0.4],thymus:[0xd6a58e],
  'outer-ears':'skin',mouth:[0xb85a5a,0.3,0.4],tongue:[0xc06a6a,0.3,0.4],galea:[0xd9ddd2,0.4]};
function lookFor(nd){ for(let a=nd;a;a=a.parent){ const l=IDLOOK[a.id]; if(l) return typeof l==='string'?LOOK[l]:Object.assign([...LOOK[nd.sys]||LOOK.body],l.map((v,i)=>v===undefined?(LOOK[nd.sys]||LOOK.body)[i]:v)); }
  return LOOK[nd.sys]||LOOK.body; }
const NOISE=`float h3(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float n3(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
 return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}`;
function tissueMaterial(nd){
  const [col,rough,sss,bump,freq]=lookFor(nd);
  const m=new THREE.MeshStandardMaterial({color:new THREE.Color(col).convertSRGBToLinear(),roughness:rough,metalness:0.0,transparent:true,opacity:1,envMapIntensity:nd.sys==='skin'?0.45:0.85});
  if(nd.shapes.length&&!nd.mesh){ m.userData.schem=true; m.emissive=new THREE.Color(0x000000); }
  m.userData.u={uSSS:{value:sss},uBump:{value:bump},uFreq:{value:freq}};
  m.onBeforeCompile=sh=>{ Object.assign(sh.uniforms,m.userData.u);
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vObjP;').replace('#include <begin_vertex>','#include <begin_vertex>\nvObjP=position;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vObjP;uniform float uSSS,uBump,uFreq;\n'+NOISE)
     .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
       { vec3 q=vObjP*uFreq; float e=.35; float b0=n3(q)+.5*n3(q*2.3);
         vec3 g=vec3(n3(q+vec3(e,0,0))-n3(q-vec3(e,0,0)),n3(q+vec3(0,e,0))-n3(q-vec3(0,e,0)),n3(q+vec3(0,0,e))-n3(q-vec3(0,0,e)));
         normal=normalize(normal-uBump*g*0.6); diffuseColor.rgb*=0.9+0.2*b0; }`)
     .replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
       { float ndv=saturate(dot(normal,normalize(vViewPosition)));
         float rimF=pow(1.-ndv,2.2);
         vec3 scatter=diffuseColor.rgb*vec3(1.0,0.42,0.32);
         reflectedLight.indirectDiffuse+=scatter*uSSS*(0.35+0.9*rimF); }`);
  };
  return m;}

const meshes=[];
LIST.forEach(nd=>{
  const sys=SYSTEMS[nd.sys]; nd.layer=sys.layer; if(nd.attach) nd.layer=nd.parent.layer;
  nd.group=new THREE.Group(); scene.add(nd.group);
  nd.own = !!(nd.mesh||nd.shapes.length);
  if(!nd.own) return;
  nd.mat=tissueMaterial(nd); nd.baseColor=nd.mat.color.clone();
  nd.shapes.forEach(sp=>{const m=shapeMesh(sp,nd.mat);m.userData.node=nd;nd.group.add(m);meshes.push(m);});
});
// load the real anatomy (BodyParts3D) region by region
const MODEL_FILES=[...new Set(LIST.filter(n=>n.mesh).map(n=>n.mesh))];
function loadModels(onProgress){
  const loader=new THREE.GLTFLoader(); if(window.MeshoptDecoder) loader.setMeshoptDecoder(MeshoptDecoder);
  let done=0;
  return Promise.all(MODEL_FILES.map(f=>new Promise(res=>{
    const onLoad=g=>{ g.scene.updateMatrixWorld(true);
      g.scene.traverse(o=>{ if(!o.isMesh) return; const id=o.name&&NODES[o.name]?o.name:(o.parent&&NODES[o.parent.name]?o.parent.name:null); const nd=NODES[id]; if(!nd||!nd.mat) return;
        const m=new THREE.Mesh(o.geometry,nd.mat); m.applyMatrix4(o.matrixWorld); m.userData.node=nd; nd.group.add(m); meshes.push(m); });
      done++; onProgress(done/MODEL_FILES.length); res(); };
    const onErr=err=>{console.error('model',f,err);done++;onProgress(done/MODEL_FILES.length);res();};
    // models ship as base64 text so the artifact host can serve them
    const src=window.LENATI_INLINE&&window.LENATI_INLINE[f];
    (src?Promise.resolve(src):fetch(MODEL_BASE+f+'.txt').then(r=>{ if(!r.ok) throw new Error(r.status); return r.text(); })).then(t=>{
      const bin=atob(t.trim()); const u=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
      loader.parse(u.buffer,'',onLoad,onErr); }).catch(onErr);
  })));}
const lineMat=new THREE.LineBasicMaterial({color:0xe9b877,transparent:true,opacity:0.5});
function finishGeometry(){
  // centres bottom-up
  const box=new THREE.Box3();
  for(let i=LIST.length-1;i>=0;i--){ const nd=LIST[i]; const b=new THREE.Box3();
    if(nd.own){ nd.group.updateMatrixWorld(true); b.setFromObject(nd.group); }
    nd.kids.forEach(k=>{ if(k.box&&!k.box.isEmpty()) b.union(k.box); });
    nd.box=b; if(b.isEmpty()){ nd.center=nd.parent?new THREE.Vector3():new THREE.Vector3(0,0.85,0); nd.radius=0.01; continue; }
    const sph=new THREE.Sphere(); b.getBoundingSphere(sph); nd.center=sph.center.clone(); nd.radius=Math.max(sph.radius,0.0008); }
  LIST.forEach(nd=>{ if(!nd.parent) return;
    let d = nd.ex? V3(nd.ex) : nd.center.clone().sub(nd.parent.center);
    if(nd.ex&&nd.kidsAuto) d=nd.center.clone().sub(nd.parent.center);
    if(d.lengthSq()<1e-10) d.set(0,0,1);
    nd.dir=d.normalize(); if(nd.attach) nd.dir.set(0,0,0); });
  LIST.forEach(nd=>{ if(!nd.parent||nd.parent.depth===0||nd.attach) return;
    const g=new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3));
    nd.line=new THREE.Line(g,lineMat.clone()); nd.line.visible=false; scene.add(nd.line); });
}

// ---------- state ----------
const state={explode:1,layers:{surface:true,muscle:true,skeleton:true,organ:true,vessel:true,nerve:true},
  selected:BODY,hover:null,lastExpanded:null,mode:'body',dim:0,study:null};
const layerOn=nd=>nd.layer==='surface'?state.layers.surface: !!state.layers[nd.layer];

function offsetsFor(useTarget){
  const out={};
  LIST.forEach(nd=>{
    if(!nd.parent){out[nd.id]=new THREE.Vector3();return;}
    const p=nd.parent, pt=useTarget?p.target:p.t;
    const o=out[p.id].clone();
    if(p.depth>0&&!nd.attach&&pt>0){ layoutKids(p); if(nd.lay) o.addScaledVector(nd.lay,state.explode*pt); }
    if(nd.userOff) o.add(nd.userOff);
    out[nd.id]=o;});
  return out;}
// ---------- expansion layout ----------
// Spread a parent's children just far enough that their boxes no longer overlap, then stop.
// Each child starts on its own direction away from the parent, gets pushed out of any neighbour it collides with,
// is pulled gently back toward home so nothing drifts far, and is capped at about one parent-size away.
function layoutKids(p){
  if(p.layDone) return; p.layDone=true;
  const kids=p.kids.filter(k=>!k.attach&&k.box&&!k.box.isEmpty());
  if(!kids.length) return;
  const PAD=0.005+p.radius*0.05, SHRINK=0.93;
  const items=kids.map(k=>{ const c=new THREE.Vector3(), h=new THREE.Vector3(); k.box.getCenter(c); k.box.getSize(h).multiplyScalar(0.5*SHRINK);
    return {k,c,h,o:k.dir.clone().multiplyScalar(p.radius*0.2+k.radius*0.15)}; });
  const maxD=Math.max(p.radius*1.3,0.03);
  const tmp=new THREE.Vector3();
  for(let it=0;it<220;it++){
    let moved=0;
    for(let i=0;i<items.length;i++) for(let j=i+1;j<items.length;j++){
      const A=items[i],B=items[j];
      const dx=(A.c.x+A.o.x)-(B.c.x+B.o.x), dy=(A.c.y+A.o.y)-(B.c.y+B.o.y), dz=(A.c.z+A.o.z)-(B.c.z+B.o.z);
      const px=A.h.x+B.h.x+PAD-Math.abs(dx), py=A.h.y+B.h.y+PAD-Math.abs(dy), pz=A.h.z+B.h.z+PAD-Math.abs(dz);
      if(px<=0||py<=0||pz<=0) continue;
      // separate along the axis needing the smallest move, nudged by each part's preferred outward direction
      // prefer sideways and vertical moves so the spread reads from the front; front-to-back costs more
      tmp.set(0,0,0); const sx=px, sy=py*1.15, sz=pz*1.9, best=Math.min(sx,sy,sz); let m;
      if(best===sx){ m=px; tmp.x=Math.sign(dx||(A.k.dir.x-B.k.dir.x)||1); } else if(best===sy){ m=py; tmp.y=Math.sign(dy||(A.k.dir.y-B.k.dir.y)||1); } else { m=pz; tmp.z=Math.sign(dz||(A.k.dir.z-B.k.dir.z)||1); }
      const wa=B.k.radius/(A.k.radius+B.k.radius), wb=1-wa; // the smaller part moves more
      A.o.addScaledVector(tmp,m*0.52*wa*2); B.o.addScaledVector(tmp,-m*0.52*wb*2); moved++;
    }
    items.forEach(I=>{ I.o.multiplyScalar(0.985); if(I.o.length()>maxD) I.o.setLength(maxD); });
    if(!moved&&it>5) break;
  }
  items.forEach(I=>{ I.k.lay=I.o; });
}
function overlapReport(p){ // for checking: count child pairs whose shrunk boxes still overlap
  layoutKids(p); const kids=p.kids.filter(k=>k.lay); let n=0,maxOff=0;
  const b=kids.map(k=>{const c=new THREE.Vector3(),h=new THREE.Vector3();k.box.getCenter(c).add(k.lay);k.box.getSize(h).multiplyScalar(0.465);maxOff=Math.max(maxOff,k.lay.length()/p.radius);return {c,h};});
  for(let i=0;i<b.length;i++)for(let j=i+1;j<b.length;j++){const A=b[i],B=b[j];
    if(Math.abs(A.c.x-B.c.x)<A.h.x+B.h.x&&Math.abs(A.c.y-B.c.y)<A.h.y+B.h.y&&Math.abs(A.c.z-B.c.z)<A.h.z+B.h.z)n++;}
  return {kids:kids.length,overlaps:n,maxOffsetInParentSizes:+maxOff.toFixed(2)}; }
function anyExpanded(){return LIST.some(nd=>nd.depth>0&&nd.target>0.5);}
function inLineage(nd){ // ancestor-or-self of expanded, or descendant of expanded
  for(let a=nd;a;a=a.parent){ if(a.depth>0&&a.target>0.5&&a!==nd) return true; }
  const st=[nd]; while(st.length){const x=st.pop(); if(x.target>0.5&&x.depth>0) return true; x.kids.forEach(k=>st.push(k));}
  return false;}
let lineageCache=new Set();
function refreshLineage(){ const le=state.lastExpanded;
  if(!le){lineageCache=new Set(LIST.filter(inLineage).map(n=>n.id));return;}
  const set=new Set(); for(let a=le;a;a=a.parent) set.add(a.id);
  const st=[le]; while(st.length){const x=st.pop(); set.add(x.id); x.kids.forEach(k=>st.push(k));}
  lineageCache=set; }

function expand(nd){ if(!nd||!nd.kids.length) return;
  for(let a=nd;a&&a.depth>0;a=a.parent) a.target=1;
  state.lastExpanded=nd; refreshLineage(); updateUI(); }
function retract(nd){ if(!nd) return;
  const st=[nd]; while(st.length){const x=st.pop(); if(x.depth>0)x.target=0; if(x!==nd) x.userOff=null; x.kids.forEach(k=>st.push(k));}
  state.lastExpanded = nd.parent&&nd.parent.depth>0&&nd.parent.target>0.5?nd.parent:null; refreshLineage(); updateUI(); }
function collapseAll(){ LIST.forEach(nd=>{if(nd.depth>0)nd.target=0; nd.userOff=null;}); state.lastExpanded=null; refreshLineage(); select(BODY,true); }

// ---------- camera flight ----------
let flight=null;
function flyTo(nd){
  const offs=offsetsFor(true); const c=nd.center.clone().add(offs[nd.id]);
  let r=nd.radius; if(nd.target>0.5&&nd.kids.length){ layoutKids(nd); r=Math.max(r,...nd.kids.map(k=>(k.lay?k.lay.length()*state.explode:0)+k.radius)); }
  if(nd.depth===0) r=1.0;
  const dist=Math.max(r/Math.sin(camera.fov*Math.PI/360)*1.15,0.006);
  const dir=camera.position.clone().sub(controls.target).normalize();
  flight={t:0,dur:RM?0.01:0.95,fromP:camera.position.clone(),fromT:controls.target.clone(),toT:c,toP:c.clone().addScaledVector(dir,dist)};}

// ---------- selection ----------
let selSet=new Set(), hoverSet=new Set();
const SEL_TINT=new THREE.Color(0xe7ad6c).convertSRGBToLinear();
function subtree(nd){const s=new Set();if(nd.depth===0)return s;const st=[nd];while(st.length){const x=st.pop();s.add(x.id);x.kids.forEach(k=>st.push(k));}return s;}
function select(nd,fly){
  state.selected=nd; selSet=nd.isMicro?new Set():subtree(nd); if(fly){ if(nd.isMicro) flyMicro(nd); else flyTo(nd); }
  try{ history.replaceState(null,'',nd.depth===0?location.pathname+location.search:'#'+nd.id);}catch(e){}
  updateUI(); renderCard(nd); if(typeof updateLadder==='function') updateLadder(); }
function reveal(id){ if(MNODES[id]){ revealMicro(MNODES[id]); return; } const nd=NODES[id]; if(!nd) return;
  if(state.mode==='micro'){ exitMicro(nd); return; }
  for(let a=nd.parent;a&&a.depth>0;a=a.parent) a.target=1;
  if(nd.parent&&nd.parent.depth>0) state.lastExpanded=nd.parent;
  refreshLineage(); if(state.mode==='tunnel') exitTunnel(true); select(nd,true); openCard(); }

// ---------- picking ----------
const ray=new THREE.Raycaster(), mouse=new THREE.Vector2();
function pick(ev){const r=canvas.getBoundingClientRect();
  mouse.set(((ev.clientX-r.left)/r.width)*2-1,-((ev.clientY-r.top)/r.height)*2+1);
  ray.setFromCamera(mouse,state.mode==='tunnel'?tcam:camera);
  if(state.mode==='tunnel'){const h=ray.intersectObjects(spotMeshes,false);return h.length?h[0].object.userData.spot:null;}
  if(state.mode==='micro'){ if(!curW) return null; const h=ray.intersectObjects(curW.pick,false); lastHit=h.length?h[0].point.clone():null; return h.length?h[0].object.userData.node:null; }
  const cand=meshes.filter(m=>m.visible&&m.userData.node.mat.opacity>0.4);
  const h=ray.intersectObjects(cand,false); if(!h.length) return null;
  return resolvePick(h[0].object.userData.node);}
function chainOf(nd){const c=[];for(let a=nd;a&&a.depth>0;a=a.parent)c.unshift(a);return c;}
// the part you click resolves to the outermost structure that is still closed; clicking the same thing again goes one level deeper
function resolvePick(leaf){ if(ev_exact) return leaf; const c=chainOf(leaf);
  for(let i=0;i<c.length;i++){ const a=c[i];
    if(a.attach) continue;
    if(a.target>0.5) continue;
    if(a.own&&!layerOn(a)&&i<c.length-1) continue;
    if(a===state.selected&&i<c.length-1) continue;
    return a; }
  return leaf; }
let ev_exact=false, lastHit=null;

// ---------- tunnel ----------
const tscene=new THREE.Scene(); tscene.background=new THREE.Color(0x07060b);
const tcam=new THREE.PerspectiveCamera(72,1,0.01,80);
const TK=26, TR=0.36; const spotMeshes=[]; const passages={};
const haloTex=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');
  const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,214,150,1)');gr.addColorStop(.35,'rgba(240,170,100,.55)');gr.addColorStop(1,'rgba(240,170,100,0)');
  g.fillStyle=gr;g.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);})();
Object.entries(PASSAGES).forEach(([id,p])=>{
  const curve=new THREE.CatmullRomCurve3(p.pts.map(q=>V3(q).multiplyScalar(TK)),false,'centripetal');
  const seg=Math.max(80,p.pts.length*40);
  const geo=new THREE.TubeGeometry(curve,seg,TR,28,false); const len=curve.getLength();
  const mat=new THREE.ShaderMaterial({side:THREE.BackSide,uniforms:{uA:{value:new THREE.Vector3(...p.col[0])},uB:{value:new THREE.Vector3(...p.col[1])},
    uRing:{value:p.ring},uFold:{value:p.fold},uLen:{value:len},uC:{value:new THREE.Vector2(...NODES[p.node].jc)},uTime:{value:0}},
    vertexShader:'varying vec2 vUv;varying vec3 vW;void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader:`uniform vec3 uA,uB;uniform float uRing,uFold,uLen,uTime;uniform vec2 uC;varying vec2 vUv;varying vec3 vW;
    void main(){float ang=vUv.y*6.2831853;float s=vUv.x*uLen;
     float rings=uRing*smoothstep(.62,.95,.5+.5*sin(s*21.));
     float folds=uFold*(.5+.5*sin(ang*9.+sin(s*2.3)*1.7))*(.6+.4*sin(s*5.+ang*2.));
     vec2 z=vec2(cos(ang),sin(ang))*.8+vec2(sin(s*.35+uTime*.1),cos(s*.27))*.35;float n=0.;
     for(int i=0;i<36;i++){z=vec2(z.x*z.x-z.y*z.y,2.*z.x*z.y)+uC;if(dot(z,z)>16.)break;n+=1.;}
     float j=n/36.;
     vec3 col=mix(uB,uA,.3+.7*folds);col=mix(col,vec3(.94,.9,.84),rings*.85);
     col+=vec3(.25,.6,.62)*j*.18;
     float d=length(vW-cameraPosition);col*=min(1.0,1.15*exp(-d*.17))+.03;
     gl_FragColor=vec4(col,1.);}`});
  const mesh=new THREE.Mesh(geo,mat); tscene.add(mesh);
  const P={id,def:p,curve,geo,len,mat,spots:[]};
  p.spots.forEach(([sid,u,ang])=>{ if(!NODES[sid]) return;
    const i=Math.round(u*seg), N=geo.normals[i], B=geo.binormals[i];
    const pos=curve.getPointAt(u).add(N.clone().multiplyScalar(Math.cos(ang)*TR*0.8)).add(B.clone().multiplyScalar(Math.sin(ang)*TR*0.8));
    const core=new THREE.Mesh(new THREE.SphereGeometry(0.035,14,10),new THREE.MeshBasicMaterial({color:0xffd9a0}));
    core.position.copy(pos); core.userData.spot={node:NODES[sid],P,u};
    const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:haloTex,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
    halo.scale.setScalar(0.32); core.add(halo); tscene.add(core); spotMeshes.push(core); P.spots.push(core);});
  passages[id]=P;});
tscene.add(new THREE.AmbientLight(0xffffff,0.6));
const tun={P:null,u:0,hist:[],walk:0,yaw:0,pitch:0,atEnd:false};
function enterTunnel(pid,u){
  const go=()=>{state.mode='tunnel'; tun.P=passages[pid]; tun.u=u||0; tun.hist=[]; tun.yaw=tun.pitch=0; tun.atEnd=false;
    document.body.classList.add('in-tunnel'); closeFlower(); updateTunnelHud(); renderCard(NODES[tun.P.def.node]);};
  portal(go);}
function exitTunnel(silent){
  const go=()=>{const nd=tun.P?NODES[tun.P.def.node]:BODY; state.mode='body'; document.body.classList.remove('in-tunnel');
    $('#choices').hidden=true; if(!silent){ for(let a=nd.parent;a&&a.depth>0;a=a.parent)a.target=1; refreshLineage(); select(nd,true);} };
  if(silent) go(); else portal(go);}
function portal(cb){ if(RM){cb();return;} const el=$('#portal'); el.classList.remove('run'); void el.offsetWidth; el.classList.add('run'); setTimeout(cb,520);}
function choose(pid){ tun.hist.push(tun.P.id); tun.P=passages[pid]; tun.u=0; tun.atEnd=false; $('#choices').hidden=true; updateTunnelHud(); renderCard(NODES[tun.P.def.node]);}
function goBackPassage(){ if(!tun.hist.length) return false; tun.P=passages[tun.hist.pop()]; tun.u=0.98; tun.atEnd=false; $('#choices').hidden=true; updateTunnelHud(); return true;}
function arriveEnd(){ if(tun.atEnd) return; tun.atEnd=true; const d=tun.P.def;
  const box=$('#choices'); box.innerHTML='';
  if(d.next){ if(!d.next.junction){ choose(d.next.options[0]); return; }
    const here=tun.P.curve.getPointAt(1), tan=tun.P.curve.getTangentAt(1);
    const right=new THREE.Vector3().crossVectors(tan,new THREE.Vector3(0,1,0));
    const opts=d.next.options.map(o=>{const q=passages[o].curve.getPointAt(0.25).sub(here);
      const side=q.dot(right)>0?'Right':'Left'; const fwd=Math.abs(q.dot(right))<0.06*TK; return {o,side:fwd?(q.z>0?'Front':'Back'):side};});
    if(opts.length===2&&opts[0].side===opts[1].side){opts[0].side+=' (front)';opts[1].side+=' (back)';}
    const h=document.createElement('p'); h.className='ch-title'; h.textContent='Junction. Choose a passage.'; box.appendChild(h);
    const row=document.createElement('div'); row.className='ch-row'; box.appendChild(row);
    opts.forEach(({o,side})=>{const b=document.createElement('button'); b.className='door';
      b.innerHTML=`<span class="door-side">${side}</span><span class="door-name">${passages[o].def.label||passages[o].def.name}</span>`;
      b.onclick=()=>choose(o); row.appendChild(b);});
  } else {
    box.innerHTML=`<p class="ch-title">End of passage</p><p class="ch-text">${d.end||''}</p>`;
    const row=document.createElement('div'); row.className='ch-row';
    const b=document.createElement('button'); b.className='btn'; b.textContent='Walk back'; b.onclick=()=>{tun.u=0.97;tun.atEnd=false;box.hidden=true;};
    const x=document.createElement('button'); x.className='btn primary'; x.textContent='Exit to body'; x.onclick=()=>exitTunnel(false);
    row.append(b,x); box.appendChild(row);
  }
  box.hidden=false; }
function updateTunnelHud(){ $('#t-name').textContent=tun.P.def.name;
  const crumbs=[...tun.hist.map(h=>passages[h].def.name),tun.P.def.name]; $('#t-path').textContent=crumbs.join(' › '); }

// ---------- UI: breadcrumb, card, labels, flower ----------
const pathOf=nd=>{const p=[];for(let a=nd;a;a=a.parent)p.unshift(a);return p;};
function updateUI(){
  const bc=$('#crumbs'); bc.innerHTML='';
  pathOf(state.selected).forEach((a,i,arr)=>{const b=document.createElement('button');b.className='crumb';b.textContent=a.depth===0?'Body':a.name;
    if(i===arr.length-1)b.setAttribute('aria-current','true'); b.onclick=()=>{ if(state.mode==='micro'){ crumbMicro(a); return; } if(a.depth===0) collapseAll(); else {retractBelow(a);select(a,true);} }; bc.appendChild(b);});
  $('#btn-collapse').disabled=!anyExpanded();
}
function retractBelow(a){a.kids.forEach(k=>retract(k));}
function crumbMicro(a){
  if(!a.isMicro){ exitMicro(a); return; }
  if(a.isWorld){ const i=mstack.lastIndexOf(a.world); if(i===mstack.length-1){ select(a,false); flyMicro(a); openCard(); return; }
    if(i>=0){ mstack.length=i+1; const w=WORLDS[a.world]; zoomTransition(null,()=>showWorld(w,w.node.parent,{instant:true}),-1); } return; }
  revealMicro(a); }
function chip(id,label){const nd=NODES[id]||MNODES[id];if(!nd)return '';return `<button class="chip" data-go="${id}">${label||nd.name}</button>`;}
function careFor(nd){ if(nd.isMicro&&!['tissue','cell'].includes(WORLDS[nd.world].level)) return null; for(let a=nd;a;a=a.parent){if(a.care)return {text:a.care,from:a===nd?null:a};}return null;}
function renderCard(nd){
  const card=$('#card'); const sys=SYSTEMS[nd.sys];
  const where=pathOf(nd).map(a=>a.depth===0?'Body':a.name).join(' › ');
  const kids=nd.kids.map(k=>chip(k.id)).join('');
  const conn=(nd.conn||[]).filter(c=>NODES[c]).map(c=>chip(c)).join('');
  const care=careFor(nd); const hist=nd.hist||[];
  const tEntry=TUNNEL_ENTRY[nd.id];
  card.innerHTML=`
   <div class="card-head">
     <p class="eyebrow"><span class="dot" style="background:#${(sys.color).toString(16).padStart(6,'0')}"></span>${nd.depth===0?'Lenati atlas':nd.isWorld?(LEVELS[LEVEL_IX[WORLDS[nd.world].level]][1]+' level · '+sys.name):(nd.sys==='skin'?'Body region':sys.name)}</p>
     <h2>${nd.name}</h2>${nd.common?`<p class="common">${nd.common}</p>`:''}
     <p class="where"><span class="lbl">You are here</span>${where}</p>
     <div class="card-tools"><button class="icon-btn" id="card-min" aria-label="Minimise card" title="Minimise">−</button><button class="icon-btn" id="card-close" aria-label="Close card" title="Close">✕</button></div>
   </div>
   <div class="card-body">
     <details open><summary>What is it?</summary><p>${nd.what}</p></details>
     <details open><summary>What does it do?</summary><p>${nd.does}</p></details>
     ${nd.size?`<details open><summary>Size</summary><p>${nd.size}</p></details>`:''}
     ${kids?`<details open><summary>Inside it <span class="count">${nd.kids.length}</span></summary><div class="chips">${kids}</div></details>`:''}
     ${conn?`<details open><summary>Connected to</summary><div class="chips">${conn}</div></details>`:''}
     ${care?`<details><summary>How to care for it</summary><p>${care.text}</p>${care.from?`<p class="note">From the ${care.from.name} card.</p>`:''}</details>`:''}
     ${nd.isMicro&&nd.src?`<details><summary>Sources</summary><ul class="srcs">${nd.src.map(x=>`<li>${x}</li>`).join('')}</ul></details>`:''}
     ${hist.length?`<details><summary>How we learned about it</summary><ol class="timeline">${hist.map(h=>`<li><span class="yr">${h[0]}</span><span>${h[1]}</span></li>`).join('')}</ol></details>`:''}
   </div>
   <div class="card-actions">
     ${nd.micro&&WORLDS[nd.micro]?`<button class="btn primary" data-act="deeper">Zoom into ${WORLDS[nd.micro].name.toLowerCase()} ↓</button>`:''}
     ${nd.isMicro&&!nd.isWorld&&!nd.micro?`<span class="endnote">This is as deep as this part goes.</span>`:''}
     ${nd.kids.length&&state.mode==='body'?(nd.target>0.5?`<button class="btn" data-act="retract">Retract</button>`:`<button class="btn ${nd.micro?'':'primary'}" data-act="expand">Expand</button>`):''}
     ${tEntry&&state.mode==='body'?`<button class="btn" data-act="enter">Walk inside</button>`:''}
     ${state.mode==='body'&&nd.depth>0?`<button class="btn ghost" data-act="focus">Focus</button>`:''}
   </div>
   <p class="note small">${nd.isMicro?'Modelled from published measurements. Shapes are simplified and colours chosen for clarity, not true colour. ':''}${nd.auto?`Name and class from the Foundational Model of Anatomy${nd.fma?' (FMA '+nd.fma+')':''}. A full card is coming. `:''}${nd.shapes&&nd.shapes.length?'Shown as a simplified shape; this structure is not in the scan-based model set. ':''}Study draft: check facts against your textbook.</p>`;
  card.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>reveal(b.dataset.go));
  card.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>act(b.dataset.act,nd));
  $('#card-close').onclick=e=>{e.stopPropagation();closeCard();};
  $('#card-min').onclick=e=>{e.stopPropagation();setMin(!card.classList.contains('min'));};
  card.querySelector('.card-head').onclick=e=>{ if(card.classList.contains('min')&&!e.target.closest('button')) setMin(false); };
  syncCardClass();
}
function setMin(m){ const c=$('#card'); c.classList.toggle('min',m); const b=$('#card-min'); if(b){b.textContent=m?'+':'−';b.setAttribute('aria-label',m?'Expand card':'Minimise card');b.title=m?'Expand':'Minimise';} syncCardClass(); }
function syncCardClass(){ const c=$('#card'); document.body.classList.toggle('card-open',c.classList.contains('open')&&!c.classList.contains('min')); document.body.classList.toggle('card-min',c.classList.contains('open')&&c.classList.contains('min')); }
function openCard(){ $('#card').classList.add('open'); setMin(false); }
function closeCard(){ $('#card').classList.remove('open'); setMin(false); }
function act(a,nd){
  if(a==='expand'){expand(nd);flyTo(nd);renderCard(nd);}
  else if(a==='retract'){retract(nd);flyTo(nd);renderCard(nd);}
  else if(a==='enter'){const e=TUNNEL_ENTRY[nd.id];enterTunnel(e[0],e[1]);}
  else if(a==='focus'){flyTo(nd);}
  else if(a==='deeper'){goDeeper(nd);}
  else if(a==='card'){renderCard(nd);openCard();}
  else if(a==='links'){pulse(nd);}
  closeFlower();
}
let pulseSet=[],pulseT=0;
function pulse(nd){pulseSet=(nd.conn||[]).map(c=>NODES[c]).filter(Boolean);pulseT=2.4;}

const flower=$('#flower');
function openFlower(nd,x,y){
  const items=[['card','Card',true],['expand','Expand',nd.kids.length&&nd.target<0.5],['retract','Retract',nd.target>0.5],
    ['enter','Walk in',!!TUNNEL_ENTRY[nd.id]],['focus','Focus',true],['links','Links',!!(nd.conn&&nd.conn.length)],['deeper','Deeper',!!nd.micro]];
  const R=46; flower.innerHTML=`<p class="fl-name">${nd.name}</p>`;
  const svg=`<svg class="fl-svg" viewBox="-110 -110 220 220" aria-hidden="true">${[[0,0],...[0,1,2,3,4,5].map(i=>[Math.cos(i*Math.PI/3-Math.PI/2)*R,Math.sin(i*Math.PI/3-Math.PI/2)*R])].map(([cx,cy])=>`<circle cx="${cx}" cy="${cy}" r="${R}"/>`).join('')}<circle cx="0" cy="0" r="${R*2}" class="outer"/></svg>`;
  flower.insertAdjacentHTML('beforeend',svg);
  items.forEach((it,i)=>{const b=document.createElement('button');b.className='petal';b.textContent=it[1];b.disabled=!it[2];
    const ang=i===0?null:(i-1)*Math.PI/3-Math.PI/2; const px=i===0?0:Math.cos(ang)*R*1.62, py=i===0?0:Math.sin(ang)*R*1.62;
    b.style.transform=`translate(calc(${px}px - 50%),calc(${py}px - 50%))`;
    b.onclick=()=>{ if(it[0]==='close') closeFlower(); else if(it[0]==='card'){renderCard(nd);openCard();closeFlower();} else act(it[0],nd);};
    flower.appendChild(b);});
  const W=innerWidth,H=innerHeight; x=Math.min(Math.max(x,120),W-120); y=Math.min(Math.max(y,140),H-120);
  flower.style.left=x+'px'; flower.style.top=y+'px'; flower.hidden=false; requestAnimationFrame(()=>flower.classList.add('show'));}
function closeFlower(){flower.classList.remove('show');flower.hidden=true;}

// labels for children of last expanded
const labelBox=$('#labels'); const labelEls={};
function labelFor(nd){ if(!labelEls[nd.id]){const b=document.createElement('button');b.className='lab';b.textContent=nd.name;
  b.onclick=()=>{ if(b._moved){b._moved=false;return;} select(nd,false);openCard();};
  b.addEventListener('pointerdown',e=>{ if(state.mode==='body'&&(moveMode||e.shiftKey)){ e.preventDefault(); b._moved=true; startMove(nd,e);} });
  labelBox.appendChild(b); labelEls[nd.id]=b;} return labelEls[nd.id]; }

// ---------- input ----------
let down=null, dragged=false;
// ---------- move parts by hand ----------
// Turn on "Move parts" (or hold Shift) and drag any visible part; it slides in the plane facing you.
let moveMode=false, mover=null; const dragPlane=new THREE.Plane(), hitP=new THREE.Vector3();
function setMoveMode(on){ moveMode=on; const b=$('#btn-move'); if(b){ b.setAttribute('aria-pressed',on); b.classList.toggle('primary',on); b.textContent=on?'Moving parts: on':'Move parts'; } canvas.style.cursor=on?'move':'grab'; }
function rayToPlane(e){ const r=canvas.getBoundingClientRect(); mouse.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1); ray.setFromCamera(mouse,camera); return ray.ray.intersectPlane(dragPlane,hitP)?hitP.clone():null; }
canvas.addEventListener('pointerdown',e=>{
  if(state.mode!=='body'||!(moveMode||e.shiftKey)||e.button!==0) return;
  const nd=pick(e); if(!nd||nd.depth===0) return;
  e.stopImmediatePropagation(); startMove(nd,e);
},true);
function startMove(nd,e){ controls.enabled=false; closeFlower();
  const c=nd.center.clone().add(nd.off); dragPlane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()).negate(),c);
  const start=rayToPlane(e); if(!start){controls.enabled=true;return;}
  mover={nd,last:start,id:e.pointerId}; canvas.setPointerCapture(e.pointerId); select(nd,false); $('#btn-reset-moves').disabled=false; }
canvas.addEventListener('pointermove',e=>{ if(!mover) return; const p=rayToPlane(e); if(!p) return;
  const d=p.clone().sub(mover.last); mover.last=p; mover.nd.userOff=(mover.nd.userOff||new THREE.Vector3()).add(d); },true);
const endMove=e=>{ if(!mover) return; try{canvas.releasePointerCapture(mover.id);}catch(_){} mover=null; controls.enabled=true; down=null; };
canvas.addEventListener('pointerup',endMove,true); canvas.addEventListener('pointercancel',endMove,true);
function resetMoves(){ LIST.forEach(n=>n.userOff=null); $('#btn-reset-moves').disabled=true; }

canvas.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};dragged=false; if(state.mode==='tunnel'){tun.drag={x:e.clientX,y:e.clientY,yaw:tun.yaw,pitch:tun.pitch};}});
canvas.addEventListener('pointermove',e=>{
  if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>5) dragged=true;
  if(state.mode==='tunnel'&&tun.drag){tun.yaw=Math.max(-1.1,Math.min(1.1,tun.drag.yaw-(e.clientX-tun.drag.x)*0.004));tun.pitch=Math.max(-0.8,Math.min(0.8,tun.drag.pitch-(e.clientY-tun.drag.y)*0.004));}
  if(e.pointerType==='mouse'&&!down){const h=pick(e); setHover(h,e);} });
addEventListener('pointerup',e=>{ if(state.mode==='tunnel') tun.drag=null; ev_exact=e.altKey;
  if(down&&!dragged&&e.target===canvas){ const h=pick(e);
    if(state.mode==='tunnel'){ if(h){renderCard(h.node);openCard();} }
    else if(state.mode==='micro'){ if(trans) {} else if(h){ select(h,false); openCard(); } }
    else if(h){ if(state.study&&state.study.kind==='find'){studyAnswer(h);} else { select(h,false); renderCard(h); openFlower(h,e.clientX,e.clientY);} }
    else closeFlower(); }
  down=null; });
canvas.addEventListener('dblclick',e=>{ if(state.mode==='micro'){ const h=pick(e); if(h&&h.micro) goDeeper(h,lastHit); else if(h) flyMicro(h); return; } if(state.mode!=='body')return; const h=pick(e); if(h){ closeFlower(); if(h.kids.length){expand(h);select(h,true);openCard();} else {select(h,true);openCard();} }});
const tip=$('#tip');
function setHover(nd,e){
  if(state.mode==='micro'){ state.hover=nd; canvas.style.cursor=nd?'pointer':'grab'; if(nd){tip.hidden=false;tip.innerHTML=`<b>${nd.name}</b>${nd.micro?`<span>Double-click to zoom in</span>`:(nd.common?`<span>${nd.common}</span>`:'')}`;tip.style.left=e.clientX+'px';tip.style.top=e.clientY+'px';} else tip.hidden=true; return; }
  if(state.mode==='tunnel'){ canvas.style.cursor=nd?'pointer':'grab'; if(nd){tip.hidden=false;tip.textContent=nd.node.name;tip.style.left=e.clientX+'px';tip.style.top=e.clientY+'px';} else tip.hidden=true; return; }
  if(state.hover!==nd) hoverSet=nd?subtree(nd):new Set();
  state.hover=nd; canvas.style.cursor=moveMode?'move':(nd?'pointer':'grab');
  if(nd&&!(state.study&&state.study.hideLabels)){tip.hidden=false;tip.innerHTML=`<b>${nd.name}</b>${nd.common?`<span>${nd.common}</span>`:''}`;tip.style.left=e.clientX+'px';tip.style.top=e.clientY+'px';} else tip.hidden=true;}
canvas.addEventListener('pointerleave',()=>{tip.hidden=true;});
const keys={};
addEventListener('keydown',e=>{ if(e.target.matches('input'))return; keys[e.key.toLowerCase()]=true;
  if(state.mode==='tunnel'){ if(e.key==='Escape') exitTunnel(false);
    if(!$('#choices').hidden){const btns=[...document.querySelectorAll('#choices .door')]; if(btns.length&&(e.key==='ArrowLeft'||e.key==='a'))btns[0].click(); if(btns.length>1&&(e.key==='ArrowRight'||e.key==='d'))btns[1].click();}
    return; }
  if(state.mode==='micro'){ if(e.key==='Escape'||e.key==='Backspace') goUp(); if(e.key.toLowerCase()==='e'&&state.selected.micro) goDeeper(state.selected); return; }
  if(e.key==='Escape'){ closeFlower(); const s=state.selected;
    if(s.target>0.5){retract(s);flyTo(s);renderCard(s);} else if(s.parent&&s.parent.depth>0){retract(s.parent);select(s.parent,true);} else collapseAll(); }
  if(e.key.toLowerCase()==='e'&&state.selected.kids.length){expand(state.selected);flyTo(state.selected);renderCard(state.selected);}
  if(e.key.toLowerCase()==='f') flyTo(state.selected);
});
addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false;});

// panels
$('#btn-collapse').onclick=()=>{collapseAll();$('#btn-reset-moves').disabled=true;};
$('#btn-move').onclick=()=>setMoveMode(!moveMode);
$('#btn-reset-moves').onclick=resetMoves;
$('#btn-walk').onclick=()=>enterTunnel('oral',0);
$('#t-exit').onclick=()=>exitTunnel(false);
['#t-fwd','#t-back'].forEach((s,i)=>{const b=$(s);const d=i?-1:1;
  b.addEventListener('pointerdown',ev=>{ev.preventDefault();tun.walk=d;}); ['pointerup','pointerleave','pointercancel'].forEach(t=>b.addEventListener(t,()=>{tun.walk=0;}));});
$('#explode').oninput=e=>{state.explode=+e.target.value;};
$('#fractal').onchange=e=>{fractalTarget=+e.target.value;};
let fractalTarget=0.55;
const lw=$('#layers');
LAYERS.forEach(l=>{const id='layer-'+l.id; lw.insertAdjacentHTML('beforeend',`<label class="tog" for="${id}"><input type="checkbox" id="${id}" checked><span>${l.name}</span></label>`);
  $('#'+id).onchange=e=>{state.layers[l.id]=e.target.checked;};});
$('#btn-inside').onclick=()=>{const on=!state.layers.surface; state.layers.surface=on; $('#layer-surface').checked=on; $('#btn-inside').textContent=on?'See inside':'Show surface';};
$('#panel-toggle').onclick=()=>document.body.classList.toggle('panel-open');
$('#views').querySelectorAll('button').forEach(b=>b.onclick=()=>{const v=b.dataset.v;const d=camera.position.distanceTo(controls.target);
  const dirs={front:[0,0,1],back:[0,0,-1],left:[1,0,0],right:[-1,0,0]};const dv=V3(dirs[v]);
  flight={t:0,dur:RM?0.01:0.8,fromP:camera.position.clone(),fromT:controls.target.clone(),toT:controls.target.clone(),toP:controls.target.clone().addScaledVector(dv,d)};});

// search
const sIn=$('#search'), sRes=$('#search-results');
sIn.addEventListener('input',()=>{const q=sIn.value.trim().toLowerCase(); sRes.innerHTML='';
  if(q.length<2){sRes.hidden=true;return;}
  const match=nd=>nd.name.toLowerCase().includes(q)||(nd.common||'').toLowerCase().includes(q);
  const hits=[...LIST.filter(nd=>nd.depth>0&&match(nd)).slice(0,6),...MLIST.filter(match).slice(0,4)].slice(0,9);
  hits.forEach(nd=>{const b=document.createElement('button');b.className='res';b.innerHTML=`<b>${nd.name}</b><span>${nd.isMicro?(nd.isWorld?LEVELS[LEVEL_IX[WORLDS[nd.world].level]][1]+' level':WORLDS[nd.world].name):(nd.common||SYSTEMS[nd.sys].name)}</span>`;
    b.onclick=()=>{sRes.hidden=true;sIn.value='';reveal(nd.id);}; sRes.appendChild(b);});
  if(!hits.length) sRes.innerHTML='<p class="res-none">No match. Try a common name like kneecap or windpipe.</p>';
  sRes.hidden=false;});
sIn.addEventListener('keydown',e=>{if(e.key==='Enter'){const f=sRes.querySelector('.res');if(f)f.click();} if(e.key==='Escape'){sRes.hidden=true;sIn.blur();}});

// ---------- study mode ----------
const studyBox=$('#study');
$('#btn-study').onclick=()=>{ if(state.study){endStudy();return;} state.study={score:0,total:0,hideLabels:true}; document.body.classList.add('studying'); $('#btn-study').textContent='End study'; nextQuestion(); };
function visibleCandidates(){return LIST.filter(nd=>nd.mat&&nd.depth>0&&nd.group.visible&&nd.mat.opacity>0.6&&layerOn(nd));}
function nextQuestion(){ const pool=visibleCandidates(); if(pool.length<2){studyBox.innerHTML='<p>Expand a region so there is something to identify.</p>';studyBox.hidden=false;return;}
  const target=pool[Math.floor(Math.random()*pool.length)]; const kind=state.study.total%2===0?'name':'find';
  state.study.target=target; state.study.kind=kind; state.study.answered=false;
  const others=LIST.filter(x=>x!==target&&x.depth>0&&x.sys===target.sys).sort(()=>Math.random()-.5).slice(0,3);
  while(others.length<3){const r=LIST[1+Math.floor(Math.random()*(LIST.length-1))]; if(r!==target&&!others.includes(r))others.push(r);}
  const opts=[target,...others].sort(()=>Math.random()-.5);
  if(kind==='name'){ studyBox.innerHTML=`<p class="q-kind">Name it</p><p class="q">What is the glowing structure?</p><div class="opts">${opts.map(o=>`<button class="opt" data-id="${o.id}">${o.name}</button>`).join('')}</div><p class="q-score">${state.study.score} of ${state.study.total} correct</p>`;
    studyBox.querySelectorAll('.opt').forEach(b=>b.onclick=()=>studyAnswer(NODES[b.dataset.id],b)); flyTo(target.depth>1?target.parent:target);}
  else studyBox.innerHTML=`<p class="q-kind">Find it</p><p class="q">Click the <b>${target.name}</b>.</p><p class="q-score">${state.study.score} of ${state.study.total} correct</p><button class="btn ghost" id="q-skip">Show me</button>`;
  const sk=$('#q-skip'); if(sk) sk.onclick=()=>studyAnswer(null);
  studyBox.hidden=false; }
function studyAnswer(nd,btn){ const s=state.study; if(!s||s.answered) return; s.answered=true; s.total++;
  const ok=nd===s.target; if(ok) s.score++;
  const fb=ok?`<p class="fb ok">Correct. ${s.target.name}${s.target.common?' ('+s.target.common+')':''}.</p>`:`<p class="fb no">${nd?'That is the '+nd.name+'. ':''}The answer is the ${s.target.name}.</p>`;
  studyBox.insertAdjacentHTML('beforeend',fb+`<p class="fb-what">${s.target.what}</p><button class="btn primary" id="q-next">Next question</button>`);
  if(btn) btn.classList.add(ok?'right':'wrong');
  $('#q-next').onclick=nextQuestion; s.kind='done'; }
function endStudy(){ state.study=null; studyBox.hidden=true; document.body.classList.remove('studying'); $('#btn-study').textContent='Study mode'; }

// ---------- minimap ----------
const mmDot=$('#mm-dot'), mmSel=$('#mm-sel');

// ---------- loop ----------
function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);camera.aspect=tcam.aspect=w/h;camera.updateProjectionMatrix();tcam.updateProjectionMatrix();bgU.uRes.value.set(w*renderer.getPixelRatio(),h*renderer.getPixelRatio());}
addEventListener('resize',resize); resize();
const clock=new THREE.Clock(); let time=0;
const tmpV=new THREE.Vector3();
function frame(){
  const dt=Math.min(clock.getDelta(),0.05); time+=dt; bgU.uTime.value=time;
  bgU.uInt.value+=(fractalTarget-bgU.uInt.value)*Math.min(1,dt*4);
  stepTransition(dt);
  if(state.mode==='body') stepBody(dt); else if(state.mode==='micro') stepMicro(dt); else stepTunnel(dt);
  if(zU.uA.value>0.002){ zU.uRes=bgU.uRes; renderer.clearDepth(); renderer.render(zScene,bgCam); }
  requestAnimationFrame(frame);}
function stepBody(dt){
  const k=RM?1:Math.min(1,dt*5.5);
  LIST.forEach(nd=>{nd.t+=(nd.target-nd.t)*k; if(Math.abs(nd.target-nd.t)<0.001)nd.t=nd.target;});
  const offs=offsetsFor(false); const dimOn=anyExpanded(); state.dim+=((dimOn?1:0)-state.dim)*k;
  LIST.forEach(nd=>{ const p=nd.parent;
    if(!p){nd.reveal=1;}
    else if(nd.attach){ nd.reveal=p.reveal; }
    else { const open=Math.max(p.t, (p.own&&!layerOn(p))?1:0, p.own?0:1, p.depth===0?1:0); nd.reveal=p.reveal*open; }
    nd.off.copy(offs[nd.id]); nd.group.position.copy(nd.off);
    nd.vis=nd.reveal;
    if(!nd.mat) return;
    let op = nd.attach ? (p.opNow||0) : nd.reveal*(1-0.9*nd.t)*(layerOn(nd)?1:0);
    if(nd.mat.userData.schem) op*=0.62;
    const dimmed=state.dim>0.01&&!lineageCache.has(nd.id); if(dimmed&&!nd.attach) op*=1-0.9*state.dim;
    nd.opNow=op; nd.vis=op;
    nd.mat.opacity=op; nd.group.visible=op>0.012; nd.mat.depthWrite=op>0.6; nd.mat.transparent=op<0.995;
    let em=0, sel=selSet.has(nd.id)&&!(state.selected.target>0.5&&nd!==state.selected); if(sel) em=0.3; else if(hoverSet.has(nd.id)) em=0.16;
    if(pulseT>0&&pulseSet.includes(nd)) em=Math.max(em,0.45*(0.5+0.5*Math.sin(time*9)));
    if(state.study&&state.study.target===nd&&state.study.kind==='name') em=0.5*(0.55+0.45*Math.sin(time*5));
    if(nd.mat.userData.schem) em=Math.max(em,0.18);
    nd.mat.emissive.copy(nd.baseColor).multiplyScalar(em);
    if(sel) nd.mat.emissive.add(SEL_TINT.clone().multiplyScalar(0.7+0.12*Math.sin(time*3)));
    if(nd.line){ const vis=p.t>0.02&&nd.reveal>0.02&&op>0.05; nd.line.visible=vis;
      if(vis){const a=nd.line.geometry.attributes.position; tmpV.copy(nd.center).add(offs[p.id]); a.setXYZ(0,tmpV.x,tmpV.y,tmpV.z); tmpV.copy(nd.center).add(nd.off); a.setXYZ(1,tmpV.x,tmpV.y,tmpV.z); a.needsUpdate=true; nd.line.material.opacity=0.55*p.t*nd.reveal*(dimmed?0.15:1);}}
  });
  if(pulseT>0) pulseT-=dt;
  if(flight){flight.t+=dt/flight.dur; const e=flight.t>=1?1:1-Math.pow(1-flight.t,3);
    camera.position.lerpVectors(flight.fromP,flight.toP,e); controls.target.lerpVectors(flight.fromT,flight.toT,e); if(flight.t>=1)flight=null;}
  controls.update();
  const dist=camera.position.distanceTo(controls.target); camera.near=Math.max(0.00015,dist*0.02); camera.far=Math.max(10,dist*60); camera.updateProjectionMatrix();
  // fractal morph toward selected region's Julia set
  const sel=state.selected; const wantMix=sel.depth===0?0:Math.min(1,0.55+0.15*sel.depth);
  const kk=Math.min(1,dt*1.6); bgU.uMix.value+=(wantMix-bgU.uMix.value)*kk; bgU.uC.value.x+=(sel.jc[0]-bgU.uC.value.x)*kk; bgU.uC.value.y+=(sel.jc[1]-bgU.uC.value.y)*kk;
  renderer.clear(); renderer.render(bgScene,bgCam); renderer.clearDepth(); renderer.render(scene,camera);
  // labels
  const le=state.lastExpanded; const showLab=le&&le.t>0.6&&!(state.study&&state.study.hideLabels);
  const want=new Set();
  if(showLab) le.kids.forEach(k=>{ if(k.attach||(k.vis||0)<0.4) return; tmpV.copy(k.center).add(k.off).project(camera);
    if(tmpV.z>1) return; const el=labelFor(k); want.add(k.id); el.hidden=false;
    el._x=(tmpV.x*.5+.5)*canvas.clientWidth; el._y=(-tmpV.y*.5+.5)*canvas.clientHeight;});
  // keep labels from piling on each other: place top to bottom, sliding a label down until it has room
  const placed=[]; [...want].map(id=>labelEls[id]).sort((a,b)=>a._y-b._y).forEach(el=>{
    const w=el.offsetWidth||90, hh=(el.offsetHeight||22)+3; let y=el._y-hh;
    for(let n=0;n<12;n++){ const hit=placed.find(r=>Math.abs(r.x-el._x)<(r.w+w)/2+4&&Math.abs(r.y-y)<hh); if(!hit) break; y=hit.y+hh; }
    placed.push({x:el._x,y,w}); el.style.transform=`translate(${el._x}px,${y}px) translate(-50%,0)`; });
  Object.entries(labelEls).forEach(([id,el])=>{ if(!want.has(id)) el.hidden=true; });
  // minimap
  mmDot.setAttribute('cx',controls.target.x); mmDot.setAttribute('cy',-controls.target.y);
  const sc=state.selected.center.clone().add(state.selected.off); mmSel.setAttribute('cx',sc.x); mmSel.setAttribute('cy',-sc.y);
  mmSel.setAttribute('r',Math.max(0.025,Math.min(0.25,state.selected.radius))); mmSel.style.opacity=state.selected.depth?1:0;
  updateScaleBar(1);
}
function stepTunnel(dt){
  let w=tun.walk; if(keys['w']||keys['arrowup'])w=1; if(keys['s']||keys['arrowdown'])w=-1;
  if(w&&$('#choices').hidden===false&&w>0&&tun.atEnd) w=0;
  if(w){ const du=w*1.5*dt/tun.P.len; tun.u+=du;
    if(tun.u>=1){tun.u=1;arriveEnd();}
    else if(tun.u<=0){ tun.u=0; if(!goBackPassage()){ tun.u=0; } }
    else if(w<0&&tun.atEnd){tun.atEnd=false;$('#choices').hidden=true;} }
  const P=tun.P; const u=Math.min(tun.u,0.999), pos=P.curve.getPointAt(u), ahead=P.curve.getPointAt(Math.min(u+0.02,1));
  if(u>0.985){ahead.copy(pos).add(P.curve.getTangentAt(u));}
  tcam.position.copy(pos); tcam.up.set(0,1,0); tcam.lookAt(ahead);
  tcam.rotateY(tun.yaw); tcam.rotateX(tun.pitch);
  Object.values(passages).forEach(Q=>Q.mat.uniforms.uTime.value=time);
  spotMeshes.forEach((s,i)=>{const k=1+0.15*Math.sin(time*3+i); s.children[0].scale.setScalar(0.32*k);});
  renderer.clear(); renderer.render(tscene,tcam);
  // hotspot labels
  const want=new Set();
  P.spots.forEach(s=>{ const d=s.position.distanceTo(tcam.position); if(d>5.5) return; tmpV.copy(s.position).project(tcam); if(tmpV.z>1||Math.abs(tmpV.x)>1.1||Math.abs(tmpV.y)>1.1)return;
    const nd=s.userData.spot.node; const el=labelFor(nd); want.add(nd.id); el.hidden=false;
    el.style.transform=`translate(${(tmpV.x*.5+.5)*canvas.clientWidth}px,${(-tmpV.y*.5+.5)*canvas.clientHeight}px) translate(-50%,-160%)`;});
  Object.entries(labelEls).forEach(([id,el])=>{ if(!want.has(id)) el.hidden=true; });
  $('#t-scale').textContent=`Passage width about ${Math.round(TR*2/TK*1000)} mm`;
  const bp=pos.clone().divideScalar(TK); mmDot.setAttribute('cx',bp.x); mmDot.setAttribute('cy',-bp.y); mmSel.style.opacity=0;
}

/*MICRO*/
// ---------- boot ----------
renderCard(BODY); updateUI();
const loadEl=document.querySelector('.loading');
loadModels(p=>{ loadEl.textContent='Loading the body · '+Math.round(p*100)+'%'; }).then(()=>{
  finishGeometry(); document.body.classList.add('loaded');
  const h=decodeURIComponent(location.hash.slice(1)); if(h&&(NODES[h]||MNODES[h])) setTimeout(()=>reveal(h),300);
});
addEventListener('hashchange',()=>{const id=decodeURIComponent(location.hash.slice(1)); if((NODES[id]||MNODES[id])&&state.selected.id!==id) reveal(id);});
document.body.classList.add('ready');
window.__lenati={buildWorld,WORLDS,MNODES,goDeeper,goUp,exitMicro,jumpToWorld,revealMicro,get curW(){return curW;},pick,resolvePick,overlapReport,NODES,LIST,meshes,state,expand,select,reveal,enterTunnel,exitTunnel,tun,passages,camera,controls};
requestAnimationFrame(frame);
})();
