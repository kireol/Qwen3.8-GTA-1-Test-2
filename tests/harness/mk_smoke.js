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
/* --- TEMPORARY chunk-4c shims, delete this block when 4c lands -----------------
   These names are read by ALREADY-WRITTEN 4b code. A missing one does not just
   no-op, it aborts its caller: clearActors() throws on "bullets" (killing
   populateCity), and killPed() throws in dropMoney() *before* its caller can run
   GS.runOver++/crime(). Declaring them here keeps 4b measurable. A var at this
   level lands in the game IIFE scope, not the driver's inner IIFE. DELETE after 4c. */
var bullets=null,markers=null,pickups=null;
var PRESTUB=['syncCase','aiDrive','aiPed','policeAlarm','tryFire','dropMoney'];
(function(){for(var i=0;i<PRESTUB.length;i++)
  if(!window[PRESTUB[i]])window[PRESTUB[i]]=function(){return 0;};})();
/* ------------------------------------------------------------------ end shim */
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
      trapNew();
      try{stepWorld(1/60);}
      catch(e){H.stepErrs++;if(!stubMissing(e.message))elog('STEP',e);if(H.stepErrs>20)H.stop=true;}
      endFrame();
      if(!H.firstBad){var nb=actorScan();
        if(nb)H.firstBad={frames:H.frames,bad:nb,list:badList(8)};}
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
  /* poison trap: name the exact writer of the first non-finite actor coordinate.
     null/undefined must be caught too: a NaN-only test misses them, yet both
     silently become NaN the moment they reach arithmetic. */
  H.pois=[];H.seenP={};
  function poison(label,fld,nv,prev){
    var key=label+'.'+fld;
    if(H.seenP[key]||H.pois.length>=24)return;
    H.seenP[key]=1;
    H.pois.push(label+'.'+fld+'='+typeof nv+':'+String(nv)+' prev='+String(prev)+' @ '+
      String(new Error().stack||'').split('\n').slice(2,9).map(function(s){
        return s.trim().replace(/^at\s+/,'').replace('file:///tmp/','');}).join(' <- '));
  }
  function trapF(o,label){
    if(!o||o.__trap)return;
    try{o.__trap=1;}catch(e){return;}
    var F=['x','z','y','a','vx','vz','speed','lat','ix','iz','thr','hb','steer','hp'];
    for(var f=0;f<F.length;f++)(function(f){
      var fld=F[f],v=o[fld];
      H.trapN=(H.trapN||0)+1;
      if(typeof v!=='number'||!isFinite(v))poison(label,fld,'INSTALL:'+typeof v,v);
      try{Object.defineProperty(o,fld,{configurable:true,
        get:function(){return v;},
        set:function(nv){
          if(typeof nv!=='number'||!isFinite(nv))poison(label,fld,nv,v);
          v=nv;
        }});}catch(e){
          if(!H.trapErr)H.trapErr=[];
          if(H.trapErr.length<6)H.trapErr.push(label+'.'+fld+':'+(e.message||e));
        }
    })(f);
  }
  function trapNew(){
    trapF(P,'P');
    var i,u;
    for(i=0;i<VEH.length;i++){u=VEH[i].userData;
      if(!u.__trap)trapF(u,'V'+i+':'+u.kind+'|'+u.role+'|'+u.state);}
    for(i=0;i<PED.length;i++){u=PED[i].userData;
      if(!u.__trap)trapF(u,'PED'+i+':'+u.st);}
  }
  function badList(lim){
    var out=[],i,u,q;
    function f(v){return ok(v)?'-':String(v);}
    function d(o){try{var g=Object.getOwnPropertyDescriptor(o,'x');
      return g?(g.get?'accessor':'DATA'):'none';}catch(e){return '?';}}
    function rec(s){if(out.length<lim)out.push(s);}
    for(i=0;i<VEH.length;i++){u=VEH[i].userData;
      if(!ok(u.x)||!ok(u.z)||!ok(u.a)||!ok(u.y)||!ok(u.vx)||!ok(u.vz)||!ok(u.speed))
        rec('V'+i+' '+u.kind+' '+u.role+'/'+u.state+' trap='+(u.__trap?1:0)+' desc='+d(u)+
            ' m='+f(VEH[i].position.x)+','+f(VEH[i].position.z)+
            ' x='+f(u.x)+' z='+f(u.z)+' a='+f(u.a)+' y='+f(u.y)+
            ' vx='+f(u.vx)+' vz='+f(u.vz)+' sp='+f(u.speed)+' hp='+f(u.hp)+
            ' thr='+f(u.thr)+' steer='+f(u.steer));}
    for(i=0;i<PED.length;i++){q=PED[i].userData;
      if(!ok(q.x)||!ok(q.z)||!ok(q.a)||!ok(q.y))
        rec('P'+i+' '+q.st+' trap='+(q.__trap?1:0)+
            ' x='+f(q.x)+' z='+f(q.z)+' a='+f(q.a)+' y='+f(q.y));}
    if(!ok(P.x)||!ok(P.z)||!ok(P.a)||!ok(P.y))
      rec('PLAYER mode='+P.mode+' veh='+(P.veh?VK[P.veh.userData.kind].n:'-')+
          ' x='+f(P.x)+' z='+f(P.z)+' a='+f(P.a)+' y='+f(P.y));
    return out;
  }
  function r1(v){return Math.round(v*100)/100;}
  function r1v(v){return Math.round(v*100)/100;}
  /* Drive integrateVeh directly on a synthetic actor: no scene, no traffic, no
     collisions, no boarding. If d.top does not show up here, the fault is inside
     the integrator; if it does, the fault is in how the world drives it. */
  function vehSim(kind,frames,thr,steer){
    var u={x:0,z:0,y:0,a:0,vx:0,vz:0,speed:0,lat:0,thr:thr,steer:steer||0,hb:0,
           state:'drive',role:'civ',hp:100,lenr:VK[kind].len*0.5,winr:VK[kind].wid*0.5,
           d:VK[kind],mass:VK[kind].mass};
    var m={userData:u};/* integrateVeh takes the mesh, not userData */
    var out=[],a0=u.a,i,j;
    for(i=0;i<frames;i++){for(j=0;j<30;j++)integrateVeh(m,1/60);
      out.push(r1(u.speed));}
    return {k:VK[kind].n,top:VK[kind].top,acc:VK[kind].acc,samp:out,
      a:r1(u.a),dA:r1(u.a-a0),pos:r1(u.x)+','+r1(u.z),
      fin:ok(u.speed)&&ok(u.x)&&ok(u.z)&&ok(u.a)};
  }
  R.pureSim=[vehSim(VTAXI,12,1,0),vehSim(VSPORT,12,1,0),vehSim(VBUS,12,1,0)];
  R.pureRev=[vehSim(VTAXI,6,-1,0)];
  R.pureTurn=[vehSim(VTAXI,4,1,1),vehSim(VTAXI,4,1,-1)];
  R.vkBad=(function(){var bad=[],i,F=['top','acc','brk','grip','mass','hp'];
    for(i=0;i<VK.length;i++)for(var j=0;j<F.length;j++)
      if(!ok(VK[i][F[j]]))bad.push(VK[i].n+'.'+F[j]+'='+VK[i][F[j]]);
    for(i=0;i<VEH.length;i++){var u=VEH[i].userData;
      if(u.d!==VK[u.kind])bad.push('V'+i+' d!='+'VK[kind] '+VK[u.kind].n);}
    return bad;})();
  function parkNear(){for(var i=0;i<VEH.length;i++){var uu=VEH[i].userData;
    if(uu.state==='parked'&&ok(uu.x)&&ok(uu.z))return VEH[i];}return null;}
  function tp(x,z,a){P.x=x;P.z=z;P.a=a;P.y=0.15;P.vx=P.vz=P.ix=P.iz=0;
    if(P.veh&&P.mode==='veh')abandonCar();P.mode='foot';P.veh=null;if(P.g)P.g.visible=true;}
  function onRoad(){var s0=roadSnap(CFG.WX*0.5,CFG.WZ*0.5);return {x:s0.x,z:s0.z,a:headingOf(s0)};}
  function cx(){return (P.mode==='veh'&&P.veh)?P.veh.userData.x:P.x;}
  function cz(){return (P.mode==='veh'&&P.veh)?P.veh.userData.z:P.z;}
  /* Board one specific car deterministically: park it on open road beside the
     player, then press act once. Returns null on success, else a reason. Boarding
     a moving car can never work: vehVsPlayer shoves the player away (and hurts
     him) before the press is ever read. */
  function enterCar(v){
    if(!v)return 'no-car';
    if(P.mode==='veh'){JP.act=1;step(40,null);if(P.mode==='veh')return 'cannot-unboard';}
    var u=v.userData,S=roadSnap(u.x,u.z);
    if(!ok(S.x)||!ok(S.z))return 'roadSnap-bad';
    u.x=S.x;u.z=S.z;u.a=headingOf(S);u.vx=u.vz=0;u.speed=0;u.thr=0;u.steer=0;u.hb=0;
    u.state='parked';u.alive=true;u.hp=u.d.hp;
    if(!ok(u.a))return 'heading-bad';
    tp(u.x+2*Math.cos(u.a+Math.PI/2),u.z+2*Math.sin(u.a+Math.PI/2),u.a);
    step(2,null);JP.act=1;step(8,null);
    if(P.mode!=='veh')return 'no-enter '+JSON.stringify(nearDbg());
    /* tryEnterVehicle picks the NEAREST car, and with ~20 live cars live traffic
       is often closer than the staged one. That is correct game behaviour, so the
       scenario drives whatever it actually boarded; the mismatch is data, not a fault. */
    return null;
  }
  function boardNote(v){
    if(P.mode!=='veh')return 'not-boarded';
    var u=P.veh.userData;
    return VK[u.kind].n+(P.veh===v?'':'(substituted)');
  }
  /* The real regression test for the tryEnterVehicle radius: board from a car that
     is far enough from every other car that "nearest wins" cannot silently pick a
     moving vehicle the player is standing next to. Samples mode every frame so
     "never boarded" and "boarded then ejected (vehicle destroyed)" stay distinct. */
  function boardIsolated(minHp){
    var best=null,bestIso=-1,i,j;
    minHp=minHp||0;
    for(i=0;i<VEH.length;i++){var u=VEH[i].userData;
      if(!u.alive||u.state==='gone'||u.state==='wreck')continue;
      if(!ok(u.x)||!ok(u.z))continue;
      if(u.hp<minHp)continue;/* a BIKE (hp40) wrecks on anything: it cannot show a
                                 sustained crash-deceleration, so ask for a sturdier one */
      var iso=1e9;
      for(j=0;j<VEH.length;j++){
        if(j===i)continue;
        var w=VEH[j].userData;
        if(!w.alive||w.state==='gone'||!ok(w.x)||!ok(w.z))continue;
        var d=Math.sqrt(dist2(u.x,u.z,w.x,w.z));
        if(d<iso)iso=d;
      }
      if(u.state==='parked')iso+=10;/* a parked car will not drift under the player */
      if(iso>bestIso){bestIso=iso;best=VEH[i];}
    }
    if(!best)return {err:'no-car'};
    var bu=best.userData;
    tp(bu.x+2*Math.cos(bu.a+Math.PI/2),bu.z+2*Math.sin(bu.a+Math.PI/2),bu.a);
    step(2,null);
    var seq=[],k;
    JP.act=1;
    for(k=0;k<8;k++){step(1,null);
      seq.push(P.mode==='veh'?'V:'+VK[P.veh.userData.kind].n:'F');}
    return {car:VK[bu.kind].n,st:bu.state,iso:r1(bestIso),seq:seq.join(' '),
      mode:P.mode,got:P.veh?VK[P.veh.userData.kind].n:null,same:P.veh===best,
      hp:GS.hp,wanted:GS.wanted,bad:actorScan()};
  }
  /* Why did a boarding attempt fail / why was the player ejected again? Snapshot
     every candidate tryEnterVehicle could have taken, plus the post-step state. */
  R.enterTrace=[];
  (function(){
    var orig=tryEnterVehicle;
    tryEnterVehicle=function(){
      if(R.enterTrace.length<6){
        var cand=[],i,u,d;
        for(i=0;i<VEH.length;i++){u=VEH[i].userData;
          d=Math.sqrt(dist2(u.x,u.z,P.x,P.z));
          if(d>10)continue;
          cand.push(VK[u.kind].n+'/'+u.state+'/'+u.role+'/hp'+r1(u.hp)+'@'+r1(d));}
        R.enterTrace.push({at:H.frames,px:r1(P.x),pz:r1(P.z),hp:GS.hp,inv:r1(P.inv),
          water:P.inWater,near:cand});
      }
      var before=P.mode,r=orig.apply(this,arguments),after=P.mode;
      if(R.enterTrace.length&&R.enterTrace[R.enterTrace.length-1].res===undefined)
        R.enterTrace[R.enterTrace.length-1].res=(before===after?before:'->'+after);
      return r;
    };
  })();
  function fxRep(){var s=[],i,n=0;
    for(i=0;i<POOL.length;i++){var p=POOL[i],k=0;
      for(var j=0;j<p.live.length;j++)if(p.live[j].on)k++;
      n+=k;s.push(p.name+':'+k);}
    return {pools:POOL.length,decals:DECAL.length,live:s.join(','),on:n,
            skid:!!(FX.skid&&FX.skid.obj),fire:!!(FX.fire&&FX.fire.obj)};}
  function nearDbg(){
    var el=0,bd=1e9,bk='-',st='-',rej={},i,u;
    for(i=0;i<VEH.length;i++){u=VEH[i].userData;
      if(!u.alive){rej.alive=(rej.alive||0)+1;continue;}
      if(u.state==='gone'){rej.gone=(rej.gone||0)+1;continue;}
      if(u.state==='wreck'){rej.wreck=(rej.wreck||0)+1;continue;}
      el++;var d=dist2(u.x,u.z,P.x,P.z);
      if(d<bd){bd=d;bk=VK[u.kind].n;st=u.state;}}
    return {el:el,rej:rej,near:r1(Math.sqrt(bd)),kind:bk,st:st,
            px:r1(P.x),pz:r1(P.z),mode:P.mode,veh:VEH.length};
  }
  /* roadSnap is pure CFG math: scan the whole world box for non-finite output */
  function rsScan(){
    var n=0,bad=[],a,b,x,z,p;
    for(a=0;a<=44;a++)for(b=0;b<=32;b++){
      x=CFG.R0+(CFG.WX-CFG.R0)*a/44;z=CFG.R0+(CFG.WZ-CFG.R0)*b/32;
      p=roadSnap(x,z);
      if(!ok(p.x)||!ok(p.z)){n++;
        if(bad.length<6)bad.push('in '+r1(x)+','+r1(z)+' -> '+p.x+','+p.z+
          ' i='+p.i+' j='+p.j+' ax='+p.ax+' off='+p.off);}
    }
    return {n:n,off:bad,stride:CFG.STRIDE,nx:CFG.NX,nz:CFG.NZ,
            wx:r1(CFG.WX),wz:r1(CFG.WZ),r0:CFG.R0,offs:CFG.LANE_OFF.join('/')};
  }
  /* Nearest point the collider system actually blocks, 16..70 u from (x,z). The
     first CITY.plots entry can be on the far side of the map, so a crash test
     aimed at it never reaches geometry within the frame budget. */
  function nearBlocked(x,z){
    var ring,a,d,px,pz;
    for(ring=16;ring<=70;ring+=6){
      for(a=0;a<24;a++){
        d=a/24*Math.PI*2;px=x+Math.cos(d)*ring;pz=z+Math.sin(d)*ring;
        if(px<4||pz<4||px>CFG.WX-4||pz>CFG.WZ-4)continue;
        if(CITY.C.blocked(px,pz,2.6,0.2))return {x:px,z:pz,ring:ring};
      }
    }
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
  R.frEnter=H.frames;
  var pk=parkNear();
  if(!pk){for(var iv=0;iv<VEH.length;iv++){var vu=VEH[iv].userData;
    if(vu.role==='civ'&&vu.state==='drive'){vu.state='parked';vu.vx=vu.vz=0;vu.thr=0;pk=VEH[iv];break;}}}
  R.parkKind=pk?(pk.userData.state+':'+VK[pk.userData.kind].n):'none';
  R.rsScan=rsScan();
  R.enterPre=nearDbg();
  R.enter=boardIsolated();
  R.enterPost=nearDbg();
  /* The physics scenarios below need *a* car; boarding any live one is fine there. */
  if(P.mode!=='veh'&&pk)R.enterFb=enterCar(pk);
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
    var ferr=enterCar(fr);
    if(ferr)R.driveFree=ferr;
    else{
      var samp=[],sx=cx(),sz=cz();
      R.driveFreeBoard=boardNote(fr);
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
    }
  }else R.driveFree='no-parked';
  /* crash: enter on open road, then aim the car at a building interior.
     NOTE: always read userData, never mesh coords — a wreck skips syncVeh, so
     v.position can be stale while userData is the live simulation state. */
  if(P.mode==='veh'){JP.act=1;step(30,null);}/* the wreck test needs a standing start on foot */
  R.crashBoard=boardIsolated(85);
  if(P.mode!=='veh')R.crash='no-board '+JSON.stringify(R.crashBoard);
  else{
    var cu=P.veh.userData;
    var ib=nearBlocked(cu.x,cu.z);
    if(!ib)R.crash='no-blocked-geometry-in-70u';
    else{
      var ddx=ib.x-cu.x,ddz=ib.z-cu.z,dl2=Math.sqrt(ddx*ddx+ddz*ddz)||1;
      cu.a=Math.atan2(ddz,ddx);cu.vx=ddx/dl2*26;cu.vz=ddz/dl2*26;cu.speed=26;cu.state='drive';cu.thr=1;
      var hp0=GS.hp,vhp0=cu.hp,shk=0,minSp=1e9,cc;
      for(cc=0;cc<8;cc++){/* 8*24 = 320 frames: closes a 16..70 u gap at 26 m/s */
        step(24,{up:1});
        if(GS.camShake>shk)shk=GS.camShake;
        if(Math.abs(cu.speed)<minSp)minSp=Math.abs(cu.speed);
      }
      render();
      var ex=ib.x-cu.x,ez=ib.z-cu.z;
      R.crash={hp:r1(GS.hp),hp0:hp0,state:cu.state,vhp:r1(cu.hp),vhp0:r1(vhp0),
        dmg:r1(vhp0-cu.hp),peakShake:r1(shk),minSpeed:r1(minSp),
        gap0:r1(dl2),gapEnd:r1(Math.sqrt(ex*ex+ez*ez)),
        wanted:GS.wanted,bad:actorScan(),
        tgt:r1(ib.x)+','+r1(ib.z)+'@ring'+ib.ring};
    }
    JP.act=1;step(30,null);
  }
  R.exit={mode:P.mode,veh:VEH.length,bad:actorScan()};
  GS.wp=2;GS.wanted=0;
  var k0=GS.kills,am0=GS.ammo[GS.wp];
  step(60,{fire:1});render();
  R.shoot={wp:GS.wp,ammo0:am0,ammo1:GS.ammo[GS.wp],kills:GS.kills-k0,wanted:GS.wanted,
    ped0:R.pop.ped,ped1:PED.length};
  /* runOver: same lesson as the crash test — board a sturdy isolated car, then
     find the live ped nearest to *that* car, not to some earlier parking spot. */
  if(P.mode==='veh'){JP.act=1;step(30,null);}
  R.runOverBoard=boardIsolated(85);
  if(P.mode!=='veh')R.runOver='no-board '+JSON.stringify(R.runOverBoard);
  else{
    var ru=P.veh.userData, rS=roadSnap(ru.x,ru.z), pv=null, k1=GS.kills, r1o=GS.runOver;
    R.runPre={px:r1(ru.x),pz:r1(ru.z),ox:rS.x,oz:rS.z,i:rS.i,j:rS.j,ax:rS.ax,
      dir:rS.dir,off:rS.off,car:VK[ru.kind].n,st:ru.state,hp:r1(ru.hp)};
    /* Nearest live ped anywhere, no distance cap: an isolated car (the only kind
       that survives this test) parks where traffic is thin, so a 24 u window came
       back empty. This is a unit test of runOver()'s hit + credit path, so it
       relocates a ped into the car's path instead of hoping the sim places one. */
    var pgap=1e9;
    for(var pi=0;pi<PED.length;pi++){var pu=PED[pi].userData;
      if(!pu.alive)continue;
      var pd=Math.hypot(ru.x-pu.x,ru.z-pu.z);
      if(pd<pgap){pgap=pd;pv=PED[pi];}}
    var ppu=pv?pv.userData:null;
    /* 2.5 u ahead plus a 9 m/s standing start: a truck needs ~2 s just to reach
       2.6 m/s, so the throttle-only version spent the whole window accelerating
       and never reached the ped. */
    if(ppu){ppu.x=ru.x+Math.cos(ru.a)*2.5;ppu.z=ru.z+Math.sin(ru.a)*2.5;
      ppu.st='idle';ppu.flee=0;ppu.tx=ppu.x;ppu.tz=ppu.z;
      ru.speed=9;ru.vx=Math.cos(ru.a)*9;ru.vz=Math.sin(ru.a)*9;ru.state='drive';ru.thr=1;}
    step(45,{up:1});render();
    R.runOver={runOver:GS.runOver-r1o,wanted:GS.wanted,kills:GS.kills-k1,
      sp:r1(P.veh?P.veh.userData.speed:0),board:R.runOverBoard,pedGap0:r1(pgap),
      ped:ppu?(ppu.alive?'alive':'dead'):'none',
      gap:ppu?r1(Math.sqrt((ppu.x-ru.x)*(ppu.x-ru.x)+(ppu.z-ru.z)*(ppu.z-ru.z))):null};
    JP.act=1;step(30,null);
  }
  /* Top speed has to respect d.top per kind. One-size-fits-all drag used to pin
     the whole fleet near 6 m/s, which also left police unable to chase anyone.
     VSPORT=5 VCOP=2 VTAXI=1: fast, middle, slow, so scaling is visible. */
  (function(){
    function carOf(k){for(var i=0;i<VEH.length;i++){var u=VEH[i].userData;
      if(u.state!=='gone'&&ok(u.x)&&ok(u.z)&&u.kind===k)return VEH[i];}return null;}
    var want=[5,2,1],out=[],ki;
    for(ki=0;ki<want.length;ki++){
      var car=carOf(want[ki]);
      if(!car){out.push(VK[want[ki]].n+':absent');continue;}
      var cu=car.userData,cS=roadSnap(cu.x,cu.z);
      if(P.mode==='veh'){JP.act=1;step(30,null);}
      if(P.mode!=='foot'){out.push('cannot-unboard');break;}
      cu.x=cS.x;cu.z=cS.z;cu.a=headingOf(cS);cu.vx=cu.vz=0;cu.speed=0;
      cu.thr=0;cu.steer=0;cu.hb=0;cu.state='parked';cu.hp=cu.d.hp;
      tp(cu.x+2*Math.cos(cu.a+Math.PI/2),cu.z+2*Math.sin(cu.a+Math.PI/2),cu.a);
      step(2,null);JP.act=1;step(6,null);
      if(P.mode!=='veh'){out.push(VK[cu.kind].n+':no-enter '+JSON.stringify(nearDbg()));continue;}
      var peak=0,sm=[],s2;
      for(s2=0;s2<14;s2++){step(30,{up:1});
        var spv=P.veh?P.veh.userData.speed:0;
        if(ok(spv))peak=Math.max(peak,spv);sm.push(r1(spv));}
      out.push({k:VK[cu.kind].n,top:cu.d.top,acc:cu.d.acc,peak:r1(peak),
        ratio:r1(peak/cu.d.top),samp:sm.join(' '),fx:fxRep().on});
      if(P.veh){JP.act=1;step(30,null);}
    }
    R.topSpeed=out;
  })();
  var f0=H.frames;
  for(var t=0;t<40;t++){step(30,{up:1,right:(t%3===0)});step(30,{up:1,left:(t%5===0)});render();}
  R.soak={frames:H.frames-f0,veh:VEH.length,ped:PED.length,box:PARKBOX.length,
    bad:actorScan(),hp:GS.hp,wanted:GS.wanted,x:r1(P.x),z:r1(P.z)};
  R.per={frames:H.frames,ms:Date.now()-t0,msPerFrame:r1((Date.now()-t0)/Math.max(1,H.frames))};
}catch(e){
  slog('DRIVER '+(e.message||e)+' | '+String(e.stack||'').split('\n')[1]);
}
R.missing=H.missing;R.prestub=PRESTUB;R.log=H.log;R.errKinds=EKEY;R.pois=H.pois;R.firstBad=H.firstBad;
R.trapErr=H.trapErr;R.trapN=H.trapN;
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
/* A syntax error in the driver kills the ENTIRE inline <script> (game + driver
   share one block), so the page silently renders the boot splash and prints no
   report at all. Compile the driver text before splicing it in. */
new (require('vm').Script)(driver,{filename:'driver.js'});
s=s.replace(TAIL,driver+TAIL);
fs.writeFileSync('/tmp/gta_smoke.html',s);
console.log('smoke written, bytes='+s.length);
