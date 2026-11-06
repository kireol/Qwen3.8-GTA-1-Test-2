const fs=require('fs');
const SRC='$HOME/projects/gta1/src/gta1.html';
let s=fs.readFileSync(SRC,'utf8');
const CDN='https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
if(s.indexOf(CDN)<0)throw new Error('CDN tag not found');
s=s.replace(CDN,'three128.js');
const TAIL='\n})();\n</script>';
if(s.split(TAIL).length-1!==1)throw new Error('tail anchor not unique');

const driver=String.raw`
/* ------------------------------------------------------- smoke driver */
var UI={w:1280,h:720};/* game-scope: onResize() writes UI.w/UI.h */
(function(){
var H={log:[],missing:{},frames:0,errs:0,stepErrs:0,rendErrs:0,stop:false};
window.__H=H;
function slog(x){if(H.log.length<40)H.log.push(String(x).slice(0,200));}
addEventListener('error',function(e){H.errs++;slog('ERR '+(e.message||e)+' @'+(e.lineno||''));});
function stubMissing(msg){
  var m=/([A-Za-z_$][\w$]*) is not defined/.exec(msg||'');
  if(!m)return null;
  var n=m[1];H.missing[n]=(H.missing[n]||0)+1;
  if(!window[n]){window[n]=function(){return 0;};slog('MISSING '+n);}
  return n;
}
var R={};
try{
  var EKEY={};
  function elog(kind,e){
    var st=String(e.stack||'').split('\n'),l1=(st[1]||'').trim(),l2=(st[2]||'').trim();
    var key=(e.message||e)+' @ '+l1;
    EKEY[key]=(EKEY[key]||0)+1;
    if(EKEY[key]===1)slog(kind+' '+(e.message||e)+' @ '+l1+' ~ '+l2);
  }
  function step(n,keys){
    for(var i=0;i<n;i++){
      if(H.stop)return;
      for(var q in KEY)KEY[q]=0;/* never leak held keys between scenarios */
      if(keys)for(var k in keys){if(keys[k]){if(!KEY[k])JP[k]=1;KEY[k]=1;}}
      H.frames++;
      try{stepWorld(1/60);}
      catch(e){H.stepErrs++;if(!stubMissing(e.message))elog('STEP',e);if(H.stepErrs>20)H.stop=true;}
      endFrame();
    }
  }
  function render(){if(H.stop)return;try{renderer.render(scene,camera);}catch(e){H.rendErrs++;if(H.rendErrs===1)slog('RSTACK '+String(e.stack||'').split('\n').slice(1,7).join(' <- '));if(!stubMissing(e.message))elog('RENDER',e);}}
  function tryRender(){try{renderer.render(scene,camera);return 'ok';}catch(e){return (e.message||String(e))+' @ '+String(e.stack||'').split('\n').slice(1,5).join(' <- ');}}
  /* NaN source trap: Builder.prototype.tri is the only door static verts go through.
     args: 0-8 pos, 9-14 uv, 15-17 colour arrays, 18-20 normal */
  R.nanSrc=[];R.nanTot={pos:0,uv:0,col:0,nrm:0,tris:0};
  (function(){
    var B=Builder.prototype,orig=B.tri,seen={},per={pos:0,uv:0,col:0,nrm:0};
    function clsOf(cls){return cls.indexOf('col')>=0?'col':(cls.indexOf('uv')>=0?'uv':(cls.indexOf('nrm')>=0?'nrm':'pos'));}
    B.tri=function(){
      var a=arguments,pos=0,uv=0,col=0,nrm=0,i;
      for(i=0;i<9;i++)if(!isFinite(a[i]))pos++;
      for(i=9;i<15;i++)if(!isFinite(a[i]))uv++;
      for(i=15;i<18;i++){var c=a[i];if(!c||!isFinite(c[0])||!isFinite(c[1])||!isFinite(c[2]))col++;}
      for(i=18;i<21;i++)if(a[i]!==undefined&&a[i]!==null&&!isFinite(a[i]))nrm++;
      var tot=pos+uv+col+nrm;
      if(tot){
        R.nanTot.tris++;R.nanTot.pos+=pos;R.nanTot.uv+=uv;R.nanTot.col+=col;R.nanTot.nrm+=nrm;
        var cls=(pos?'pos':'')+(uv?'+uv':'')+(col?'+col':'')+(nrm?'+nrm':'');
        var ck=clsOf(cls);
        var st=String(new Error().stack||'').split('\n').slice(2,8).map(function(x){return x.trim().replace(/^at\s+/,'');}).join(' < ');
        var key=cls+' @ '+st;
        if(!seen[key]&&per[ck]<4){
          seen[key]=1;per[ck]++;
          var samp=[];
          for(i=0;i<Math.min(a.length,21);i++){var v=a[i];
            samp.push(Array.isArray(v)?'['+v.map(function(y){return isFinite(y)?r1v(y):String(y);}).join(',')+']':(isFinite(v)?r1v(v):String(v)));}
          R.nanSrc.push({cls:cls,n:tot,built:this.count,chain:st.slice(0,150),args:samp.join(' ').slice(0,220)});
        }
        seen[key]=(seen[key]||0)+1;
      }
      return orig.apply(this,a);
    };
  })();
  function audit(){
    var t={},bad=[],seenB={};
    scene.traverse(function(o){
      t[o.type]=(t[o.type]||0)+1;
      var g=o.geometry;
      if(g){
        if(!g.attributes||!g.attributes.position)bad.push('nopos:'+o.type+':'+(o.name||''));
        else{
          var keys=Object.keys(g.attributes);
          for(var a=0;a<keys.length;a++){
            var at=g.attributes[keys[a]];
            if(!at||!at.array||at.array.length>400000)continue;
            var cnt=0;
            for(var k=0;k<at.array.length;k++)if(!isFinite(at.array[k]))cnt++;
            if(cnt){
              var mt=(o.material&&o.material.type)||'-',key=keys[a]+'/'+at.itemSize+'/'+mt;
              if(!seenB[key]){seenB[key]=1;
                bad.push('nan '+key+' n='+cnt+' '+Math.round(at.array.length/at.itemSize)+'vtx '+
                  (o.name||'')+'@'+Math.round(o.position.x)+','+Math.round(o.position.z));}
            }
          }
        }
        if(g.index&&!g.index.array)bad.push('badidx:'+o.type);
      }
      if(o.material){
        var ms=Array.isArray(o.material)?o.material:[o.material];
        for(var j=0;j<ms.length;j++){var m=ms[j];
          if(!m)bad.push('nullmat:'+o.type);
          else if(m.isShaderMaterial&&(!m.uniforms||!m.vertexShader||!m.fragmentShader))bad.push('badshader:'+o.type);
        }
      }
      if(!o.matrix||!o.matrixWorld)bad.push('nomat4:'+o.type);
    });
    return {n:scene.children.length,types:t,bad:bad.slice(0,14)};
  }
  function matProbe(){
    var seen=[],objs=[],out=[];
    scene.traverse(function(o){
      if(!o.material||!(o.isMesh||o.isPoints||o.isSprite||o.isLine))return;
      var ms=Array.isArray(o.material)?o.material:[o.material];
      for(var i=0;i<ms.length;i++){var m=ms[i];
        if(m&&seen.indexOf(m)<0){seen.push(m);objs.push(o);}}
    });
    for(var q=0;q<seen.length;q++){
      var m=seen[q],rep=objs[q],n=0,list=[];
      scene.traverse(function(x){
        if(x.material===m){n++;list.push(x);}
      });
      var stash=[];
      scene.traverse(function(x){stash.push(x,x.visible);});
      for(var s=1;s<stash.length;s+=2)stash[s-1].visible=false;
      for(var i2=0;i2<list.length;i2++)list[i2].visible=true;
      var msg='ok';
      try{renderer.render(scene,camera);}catch(e){msg=String(e.message||e).slice(0,48);}
      for(var s2=1;s2<stash.length;s2+=2)stash[s2-1].visible=stash[s2];
      out.push(q+':'+m.type+'/'+rep.type+'<'+(rep.parent?rep.parent.type:'?')+'>'+n+':'+msg);
    }
    return out;
  }
  function ok(v){return typeof v==='number'&&isFinite(v);}
  function actorScan(){
    var bad=0,i;
    for(i=0;i<VEH.length;i++){var u=VEH[i].userData;
      if(!ok(u.x)||!ok(u.z)||!ok(u.a)||!ok(u.y)||!ok(u.vx)||!ok(u.vz)||!ok(u.speed))bad++;}
    for(i=0;i<PED.length;i++){var q=PED[i].userData;
      if(!ok(q.x)||!ok(q.z)||!ok(q.a)||!ok(q.y))bad++;}
    if(!ok(P.x)||!ok(P.z)||!ok(P.a)||!ok(P.y))bad++;
    if(!ok(GS.hp)||!ok(GS.cash))bad++;
    return bad;
  }
  function r1(v){return Math.round(v*100)/100;}
  function r1v(v){return Math.round(v*100)/100;}
  function parkNear(){for(var i=0;i<VEH.length;i++)if(VEH[i].userData.state==='parked')return VEH[i];return null;}
  function tp(x,z,a){P.x=x;P.z=z;P.a=a;P.y=0.15;P.vx=P.vz=P.ix=P.iz=0;
    if(P.veh&&P.mode==='veh')abandonCar();P.mode='foot';P.veh=null;if(P.g)P.g.visible=true;}
  function onRoad(){var s0=roadSnap(CFG.WX*0.5,CFG.WZ*0.5);return {x:s0.x,z:s0.z,a:headingOf(s0)};}
  function cx(){return (P.mode==='veh'&&P.veh)?P.veh.userData.x:P.x;}
  function cz(){return (P.mode==='veh'&&P.veh)?P.veh.userData.z:P.z;}
  function fxRep(){var s=[],i;
    for(i=0;i<POOL.length;i++){var p=POOL[i];
      s.push(p.name+':'+(typeof p.live==='function'?p.live():(p.live===undefined?'?':p.live)));}
    return {pools:POOL.length,decals:DECAL.length,live:s.join(','),
            skid:!!(FX.skid&&FX.skid.obj),fire:!!(FX.fire&&FX.fire.obj)};}
  function insideBuilding(){
    var pl=CITY.plots;
    for(var i=0;i<pl.length;i++)if(pl[i].t!=='sea'&&pl[i].t!=='park'&&ok(pl[i].x)&&ok(pl[i].z))
      return {x:pl[i].x,z:pl[i].z,t:pl[i].t};
    return null;
  }
  var t0=Date.now();
  try{initGL();}catch(e){slog('FATAL initGL '+(e.message||e));}
  R.gl={three:THREE.REVISION,gl:!!(renderer&&renderer.getContext()),cam:!!camera};
  try{buildCity(0);}catch(e){slog('FATAL buildCity '+(e.message||e));}
  R.city={stat:staticMeshes.length,plots:CITY.plots.length,spawn:CITY.spawn.length,bad:actorScan()};
  try{initFX();}catch(e){slog('FATAL initFX '+(e.message||e));}
  var p0=roadSnap(CFG.WX*0.5,CFG.WZ*0.5);
  spawnPlayer(p0.x,p0.z,headingOf(p0));
  R.render0=tryRender();R.audit0=audit();
  try{populateCity();}catch(e){slog('populateCity '+(e.message||e));}
  GS.mode='play';GS.hp=100;GS.ammo=[0,999,999,999,999];
  R.pop={veh:VEH.length,ped:PED.length,box:PARKBOX.length,bad:actorScan()};
  step(60,null);render();
  R.render1=tryRender();R.audit1=audit();R.probe=matProbe();
  R.fx0=fxRep();
  R.idle={veh:VEH.length,ped:PED.length,bad:actorScan(),hp:GS.hp,x:r1(P.x),z:r1(P.z)};
  var x0=P.x,z0=P.z;
  step(90,{up:1});render();
  R.walk={dz:r1(P.z-z0),dx:r1(P.x-x0),mode:P.mode,bad:actorScan()};
  x0=P.x;z0=P.z;step(60,{up:1,run:1});
  R.run={dz:r1(P.z-z0),dx:r1(P.x-x0)};
  /* movement is screen-relative: up = world +z, left = world -x */
  var rd=onRoad();
  tp(rd.x,rd.z,rd.a);
  R.epre={x:r1(P.x),z:r1(P.z)};
  step(600,{left:1,run:1});render();
  R.edgeWest={x:r1(P.x),z:r1(P.z),hp:GS.hp,inWater:P.inWater,a:r1(P.a),bad:actorScan()};
  tp(rd.x,rd.z,rd.a);
  step(600,{up:1,run:1});render();
  R.edgeNorth={x:r1(P.x),z:r1(P.z),hp:GS.hp,inWater:P.inWater,a:r1(P.a),bad:actorScan()};
  var pk=parkNear();
  if(!pk){for(var iv=0;iv<VEH.length;iv++){var vu=VEH[iv].userData;
    if(vu.role==='civ'&&vu.state==='drive'){vu.state='parked';vu.vx=vu.vz=0;vu.thr=0;pk=VEH[iv];break;}}}
  R.parkKind=pk?(pk.userData.state+':'+VK[pk.userData.kind].n):'none';
  if(pk){var pu=pk.userData;tp(pu.x+2.2,pu.z,pu.a+Math.PI/2);step(2,null);JP.act=1;step(4,null);}
  R.enter={mode:P.mode,kind:P.veh?VK[P.veh.userData.kind].n:null,bad:actorScan()};
  step(120,{up:1});render();
  R.drive={sp:r1(P.veh?P.veh.userData.speed:0),x:r1(cx()),z:r1(cz()),hp:GS.hp,
    wanted:GS.wanted,bad:actorScan(),veh:VEH.length,ped:PED.length};
  var a0=P.veh?P.veh.userData.a:0,x1d=cx(),z1d=cz();
  step(180,{up:1,left:1});render();
  R.turnLeft={da:r1(P.veh?(P.veh.userData.a-a0):0),dx:r1(cx()-x1d),dz:r1(cz()-z1d),bad:actorScan()};
  step(90,{down:1});step(60,{brake:1});
  R.braked={sp:r1(P.veh?P.veh.userData.speed:0)};
  step(120,{down:1});
  R.reverse={sp:r1(P.veh?P.veh.userData.speed:0)};
  /* free-road physics: no traffic, no walls, straight ahead */
  if(P.veh){JP.act=1;step(30,null);}
  var fr=parkNear();
  if(fr){
    var fu=fr.userData,rs=roadSnap(fu.x,fu.z);
    fu.x=rs.x;fu.z=rs.z;fu.a=headingOf(rs);fu.vx=fu.vz=0;fu.speed=0;fu.thr=0;
    fu.state='parked';
    tp(fu.x+2.0*Math.cos(fu.a+Math.PI/2),fu.z+2.0*Math.sin(fu.a+Math.PI/2),fu.a);
    step(2,null);JP.act=1;step(6,null);
    if(P.mode==='veh'){
      var samp=[],sx=cx(),sz=cz();
      for(var sm=0;sm<7;sm++){step(30,{up:1});
        samp.push('t='+((sm+1)*0.5)+'s sp='+(P.veh?r1(P.veh.userData.speed):'-')+' d='+r1(Math.sqrt((cx()-sx)*(cx()-sx)+(cz()-sz)*(cz()-sz))));}
      R.driveFree={kind:VK[P.veh.userData.kind].n,top:VK[P.veh.userData.kind].top,samp:samp};
      var dA=P.veh.userData.a,dX=cx(),dZ=cz();
      step(120,{up:1,left:1});render();
      R.driveFreeTurn={da:r1(P.veh.userData.a-dA),dx:r1(cx()-dX),dz:r1(cz()-dZ),sp:r1(P.veh.userData.speed),fx:fxRep()};
      R.render2=tryRender();
      step(180,{brake:1});
      R.driveFreeStop={sp:r1(P.veh.userData.speed)};
      JP.act=1;step(30,null);
    }else R.driveFree='no-enter';
  }else R.driveFree='no-parked';
  /* crash: enter on open road, then aim the car at a building interior */
  var ib=insideBuilding();
  var cv=parkNear();
  if(!cv){for(var ci=0;ci<VEH.length;ci++)if(VEH[ci].userData.state!=='gone'){cv=VEH[ci];break;}}
  if(ib&&cv&&P.mode==='foot'){
    var cu=cv.userData,cS=roadSnap(cv.x,cv.z);
    cu.x=cS.x;cu.z=cS.z;cu.a=headingOf(cS);cu.vx=cu.vz=0;cu.speed=0;cu.thr=0;cu.state='parked';
    cu.hp=100;cu.state='parked';
    tp(cu.x+2.0*Math.cos(cu.a+Math.PI/2),cu.z+2.0*Math.sin(cu.a+Math.PI/2),cu.a);
    step(2,null);JP.act=1;step(6,null);
    if(P.mode==='veh'){
      var ddx=ib.x-cu.x,ddz=ib.z-cu.z,dl2=Math.sqrt(ddx*ddx+ddz*ddz)||1;
      cu.a=Math.atan2(ddz,ddx);cu.vx=ddx/dl2*26;cu.vz=ddz/dl2*26;cu.speed=26;cu.state='drive';cu.thr=1;
      step(90,{up:1});render();
      R.crash={hp:GS.hp,state:cu.state,vhp:r1(cu.hp),shake:r1(GS.camShake),
        bad:actorScan(),x:r1(cu.x),z:r1(cu.z),tgt:r1(ib.x)+','+r1(ib.z)+'/'+ib.t};
      JP.act=1;step(30,null);
    }else R.crash='no-enter';
  }else R.crash='skip';
  R.exit={mode:P.mode,veh:VEH.length,bad:actorScan()};
  GS.wp=2;GS.wanted=0;
  var k0=GS.kills,am0=GS.ammo[GS.wp];
  step(60,{fire:1});render();
  R.shoot={wp:GS.wp,ammo0:am0,ammo1:GS.ammo[GS.wp],kills:GS.kills-k0,wanted:GS.wanted,
    ped0:R.pop.ped,ped1:PED.length};
  /* runOver: straight down a road at speed, peds spawned by maintain */
  if(P.mode==='foot'){
    var rv=null;
    for(var ri=0;ri<VEH.length;ri++)if(VEH[ri].userData.state!=='gone'){rv=VEH[ri];break;}
    if(rv){
      var ru=rv.userData,rS=roadSnap(P.x,P.z);
      ru.x=rS.x;ru.z=rS.z;ru.a=headingOf(rS);ru.vx=Math.cos(ru.a)*18;ru.vz=Math.sin(ru.a)*18;
      ru.speed=18;ru.state='drive';ru.thr=1;
      tp(ru.x+2.0*Math.cos(ru.a+Math.PI/2),ru.z+2.0*Math.sin(ru.a+Math.PI/2),ru.a);
      step(2,null);JP.act=1;step(6,null);
      if(P.mode==='veh'){
        var k1=GS.kills,r1o=GS.runOver,pv=null;
        for(var pi=0;pi<PED.length;pi++)if(PED[pi].userData.alive){pv=PED[pi];break;}
        var ppu=pv?pv.userData:null;
        if(ppu){ppu.x=ru.x+Math.cos(ru.a)*9;ppu.z=ru.z+Math.sin(ru.a)*9;
          ppu.st='idle';ppu.flee=0;ppu.tx=ppu.x;ppu.tz=ppu.z;}
        step(60,{up:1});render();
        R.runOver={runOver:GS.runOver-r1o,wanted:GS.wanted,kills:GS.kills-k1,
          sp:r1(P.veh?P.veh.userData.speed:0),
          ped:ppu?(ppu.alive?'alive':'dead'):'none',
          gap:ppu?r1(Math.sqrt((ppu.x-ru.x)*(ppu.x-ru.x)+(ppu.z-ru.z)*(ppu.z-ru.z))):null};
      }
      else R.runOver='no-enter';
      if(P.veh){JP.act=1;step(30,null);}
    }else R.runOver='no-veh';
  }else R.runOver='on-foot';
  var f0=H.frames;
  for(var t=0;t<40;t++){step(30,{up:1,right:(t%3===0)});step(30,{up:1,left:(t%5===0)});render();}
  R.soak={frames:H.frames-f0,veh:VEH.length,ped:PED.length,box:PARKBOX.length,
    bad:actorScan(),hp:GS.hp,wanted:GS.wanted,x:r1(P.x),z:r1(P.z)};
  R.per={frames:H.frames,ms:Date.now()-t0,msPerFrame:r1((Date.now()-t0)/Math.max(1,H.frames))};
}catch(e){
  slog('DRIVER '+(e.message||e)+' | '+String(e.stack||'').split('\n')[1]);
}
R.missing=H.missing;R.log=H.log;R.errKinds=EKEY;
R.counts={errs:H.errs,stepErrs:H.stepErrs,rendErrs:H.rendErrs,frames:H.frames,stop:H.stop};
try{
  var b1=document.getElementById('boot'),b2=document.getElementById('ov');
  if(b1)b1.style.display='none';if(b2)b2.style.display='none';
  var pre=document.createElement('pre');
  pre.id='out';pre.textContent='@@'+JSON.stringify(R)+'@@';
  document.body.appendChild(pre);
}catch(e){}
})();
`;
s=s.replace(TAIL,driver+TAIL);
fs.writeFileSync('/tmp/gta_smoke.html',s);
console.log('smoke written, bytes='+s.length);
