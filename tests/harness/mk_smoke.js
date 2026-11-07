const fs=require('fs');
const SRC='$HOME/projects/gta1/src/gta1.html';
let s=fs.readFileSync(SRC,'utf8');
const CDN='https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
if(s.indexOf(CDN)<0)throw new Error('CDN tag not found');
s=s.replace(CDN,'three128.js');
/* Chunk 5 ends with `if(!window.__GTA_TEST__)boot();`. Without this flag boot()
   would build the city on rAF ticks and race the driver's own initGL/buildCity. */
s=s.replace('<script src="three128.js"></script>',
            '<script src="three128.js"></script>\n<script>window.__GTA_TEST__=1;</script>');
const TAIL='\n})();\n</script>';
if(s.split(TAIL).length-1!==1)throw new Error('tail anchor not unique');

const driver=String.raw`
/* ------------------------------------------------------- smoke driver */
/* Chunk 5 owns UI at game scope (var UI={w:1280,h:720}) and initGL() below runs
   onResize(), which overwrites UI.w/UI.h with the real window size. A second
   declaration here would only shadow the game's object behind its back. */
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
  /* Chunk 4c put real steering on the traffic (aiDrive used to be a stubbed
     no-op, so every AI car sat still forever), which broke the old free-road
     assumption: the staged car now has something living in its lane. These two
     probes make the failure legible instead of showing a mystery speed of 0.07. */
  /* hh/hm default to vehicle-probe size; the gun test passes (0.15,0.15) because
     blocked() is height-gated and a bolt flies under a 1.9 m probe. */
  function wallAhead(x,z,a,d,hh,hm){
    var H=(hh===undefined)?1.9:hh,M=(hm===undefined)?0.2:hm;
    for(var s=1.5;s<=d;s+=1.5)
      if(CITY.C.blocked(x+Math.cos(a)*s,z+Math.sin(a)*s,H,M))return r1(s);
    return 0;
  }
  function vehAhead(x,z,a,d){
    var out=[],i,f=Math.cos(a),g=Math.sin(a),u,dx,dz,al,side;
    for(i=0;i<VEH.length;i++){
      u=VEH[i].userData;
      if(VEH[i]===P.veh||!u.alive||u.state==='gone'||u.state==='wreck')continue;
      dx=u.x-x;dz=u.z-z;al=dx*f+dz*g;side=Math.abs(dx*g-dz*f);
      if(al>0&&al<d&&side<2.4)out.push(VK[u.kind].n+'/'+u.state+'@'+r1(al));
    }
    return out;
  }
  /* Empty the lane the staged car is about to drive down. roadSnap picks its
     lane direction at random, so screening before enterCar is useless -- the
     heading changes under the test. This is the same "relocate the world to
     unit-test one function" trick runOver already uses with a ped. */
  function clearLane(x,z,a,d){
    var n=0,i,j,f=Math.cos(a),g=Math.sin(a),u,dx,dz,al,side,sgn;
    for(i=0;i<VEH.length;i++){
      u=VEH[i].userData;
      if(VEH[i]===P.veh||!u.alive||u.state==='gone')continue;
      dx=u.x-x;dz=u.z-z;al=dx*f+dz*g;side=dx*g-dz*f;
      if(al>-4&&al<d&&Math.abs(side)<4.5){
        sgn=side<0?-1:1;u.x+=g*11*sgn;u.z-=f*11*sgn;
        u.vx=u.vz=0;u.speed=0;u.thr=0;u.steer=0;u.hb=1;u.state='parked';n++;
      }
    }
    for(j=0;j<PED.length;j++){
      u=PED[j].userData;
      if(!u.alive)continue;
      dx=u.x-x;dz=u.z-z;al=dx*f+dz*g;side=dx*g-dz*f;
      if(al>-4&&al<d&&Math.abs(side)<4.5){
        sgn=side<0?-1:1;u.x+=g*9*sgn;u.z-=f*9*sgn;u.tx=u.x;u.tz=u.z;n++;
      }
    }
    return n;
  }
  /* Both free-road scenarios (driveFree, topSpeed) need ~60 m of empty corridor.
     roadSnap() cannot be used to stage them: it picks dir and the lane offset
     with Math.random(), so the same call twice can face the car into a wall
     (that is exactly what the 10 m corridor / 0.37 top-speed-ratio runs were).
     Assuming the map centre is a street was wrong too -- one run staged a car
     with geometry 1.5 m in front of it. So probe the street lattice (street
     centre lines are x = i*CFG.STRIDE and z = j*CFG.STRIDE) and stage only where
     a corridor is verified open in both directions. Deterministic by design:
     no RNG, so a bad number here is a physics regression, not a bad draw.
     NOTE wallAhead() returns 0 for "nothing blocked within d" -- that must be
     compared as the full distance, or the test steers the car INTO the wall. */
  function findCorridor(){
    var g=60,best=null,bs=-1,i,j,x,z,wf,wb,sc;
    for(j=0;j<=CFG.NZ;j++){
      for(i=0;i<CFG.NX;i++){
        x=Math.round((i+0.5)*CFG.STRIDE);z=Math.round(j*CFG.STRIDE);
        wf=wallAhead(x,z,0,g);wb=wallAhead(x,z,Math.PI,g);
        sc=Math.min(wf||g,wb||g);
        if(sc>bs){bs=sc;best={x:x,z:z,a:wf>=g?0:(wb>=g?Math.PI:(wf>=wb?0:Math.PI))};}
      }
    }
    for(i=0;i<=CFG.NX;i++){
      for(j=0;j<CFG.NZ;j++){
        x=Math.round(i*CFG.STRIDE);z=Math.round((j+0.5)*CFG.STRIDE);
        wf=wallAhead(x,z,Math.PI/2,g);wb=wallAhead(x,z,-Math.PI/2,g);
        sc=Math.min(wf||g,wb||g);
        if(sc>bs){bs=sc;best={x:x,z:z,a:wf>=g?Math.PI/2:(wb>=g?-Math.PI/2:(wf>=wb?Math.PI/2:-Math.PI/2))};}
      }
    }
    if(best)best.wall=bs;
    return best;
  }
  function stageCar(car){
    var u=car.userData,g=60,c=findCorridor();
    u.x=c.x;u.z=c.z;u.a=c.a;u.y=0;u.vx=u.vz=0;u.speed=0;u.thr=0;u.steer=0;u.hb=0;
    u.state='parked';
    var pre=wallAhead(u.x,u.z,u.a,g);
    var n=clearLane(u.x,u.z,u.a,70);
    var wf=wallAhead(u.x,u.z,u.a,g);
    /* pre vs wall isolates whether clearLane() itself is what closes the
       corridor (blocked() counts parked cars/boxes, not only buildings), and
       the heading in at shows which scan leg and direction was chosen. */
    return {wall:wf||g,pre:pre||g,avail:c.wall,pushed:n,
      at:r1(u.x)+','+r1(u.z)+'/'+r1(u.a)};
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
      var samp=[],sx,sz;
      R.driveFreeBoard=boardNote(fr);
      /* Corridor staging (see stageCar): without it the curve measures the
         collision resolver, not integrateVeh. */
      var fu0=P.veh.userData;
      var stg=stageCar(P.veh);
      sx=cx();sz=cz();
      for(var sm=0;sm<7;sm++){step(30,{up:1});
        samp.push('t='+((sm+1)*0.5)+'s sp='+(P.veh?r1(P.veh.userData.speed):'-')+' d='+r1(Math.sqrt((cx()-sx)*(cx()-sx)+(cz()-sz)*(cz()-sz))));}
      R.driveFree={kind:VK[P.veh.userData.kind].n,top:VK[P.veh.userData.kind].top,samp:samp,
        pushed:stg.pushed,wall:stg.wall,pre:stg.pre,avail:stg.avail,at:stg.at,
        wallEnd:wallAhead(cx(),cz(),P.veh?P.veh.userData.a:0,40)||40,
        cars:vehAhead(sx,sz,fu0.a,40)};
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
  /* Weapons are exercised in the chunk-4c block near the end (it needs a live
     bullet pool, which only exists once something has actually been fired). */
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
     the whole fleet near 6 m/s, which also left police unable to chase anyone. */
  (function(){
    function carOf(k){for(var i=0;i<VEH.length;i++){var u=VEH[i].userData;
      if(u.state==='gone'||u.state==='wreck'||u.kind!==k)continue;
      if(ok(u.x)&&ok(u.z))return VEH[i];}return null;}
    /* Which kinds the city actually put on the road varies with the crowd RNG
       (SPORT is rare, and the crash/runOver tests consume cars), so a fixed
       [VSPORT,VCOP,VTAXI] list came back "SPORT:absent". Test the three fastest
       kinds present instead -- the assertion is "peak respects d.top", and it
       still covers the fast/middle/slow tiers because top is what we sort on. */
    function liveKinds(){
      var seen={},out=[],i,u;
      for(i=0;i<VEH.length;i++){u=VEH[i].userData;
        if(u.state==='gone'||u.state==='wreck'||!ok(u.x)||!ok(u.z))continue;
        if(!seen[u.kind]){seen[u.kind]=1;out.push(u.kind);}}
      out.sort(function(a,b){return VK[b].top-VK[a].top;});
      return out;
    }
    var kinds=liveKinds(),out=[],ki;
    for(ki=0;ki<3&&ki<kinds.length;ki++){
      var car=carOf(kinds[ki]);
      if(!car){out.push(VK[kinds[ki]].n+':absent');continue;}
      var cu=car.userData,st;
      if(P.mode==='veh'){JP.act=1;step(30,null);}
      if(P.mode!=='foot'){out.push('cannot-unboard');break;}
      cu.hp=cu.d.hp;
      st=stageCar(car);
      tp(cu.x+2*Math.cos(cu.a+Math.PI/2),cu.z+2*Math.sin(cu.a+Math.PI/2),cu.a);
      step(2,null);JP.act=1;step(6,null);
      if(P.mode!=='veh'){out.push(VK[cu.kind].n+':no-enter '+JSON.stringify(nearDbg()));continue;}
      var peak=0,sm=[],s2;
      for(s2=0;s2<14;s2++){step(30,{up:1});
        var spv=P.veh?P.veh.userData.speed:0;
        if(ok(spv))peak=Math.max(peak,spv);sm.push(r1(spv));}
      out.push({k:VK[cu.kind].n,top:cu.d.top,acc:cu.d.acc,peak:r1(peak),
        ratio:r1(peak/cu.d.top),samp:sm.join(' '),wall:st.wall,pre:st.pre,
        avail:st.avail,at:st.at,pushed:st.pushed,fx:fxRep().on});
      if(P.veh){JP.act=1;step(30,null);}
    }
    R.topSpeed={fleet:kinds.map(function(k){return VK[k].n+':'+VK[k].top;}),runs:out};
  })();
  var f0=H.frames;
  for(var t=0;t<40;t++){step(30,{up:1,right:(t%3===0)});step(30,{up:1,left:(t%5===0)});render();}
  R.soak={frames:H.frames-f0,veh:VEH.length,ped:PED.length,box:PARKBOX.length,
    bad:actorScan(),hp:GS.hp,wanted:GS.wanted,x:r1(P.x),z:r1(P.z)};
  /* ---- chunk 4c: guns, police, death, missions. These run LAST: they move
     GS.wanted/GS.mode/GS.mission around, which must not perturb anything above. */
  /* The 2400-frame soak walks the player through traffic and can legitimately
     end dead; tryFire ignores input while dead, so wait out the respawn rather
     than reporting a phantom 0-shot window. */
  if(GS.mode==='dead'){R.soakDied=1;step(180,null);}
  if(P.mode==='veh'){JP.act=1;step(30,null);}
  /* Deterministic hit. Relocate the nearest live ped onto the muzzle line (same
     trick runOver uses): with a random crowd a miss only proves bullets expire,
     which is exactly the bug (endpoint tunnelling) this test exists to catch. */
  (function(){
    /* Stage on a verified-open corridor before shooting. blocked() is height-gated
       (0.15 for a bolt) and counts parked vehicles too, so firing from wherever the
       2400-frame soak happened to stop -- i.e. in traffic -- killed every bolt on
       frame 1. The tell was live spark+dust FX with kills:0 and probe after1:0.
       Probe at BULLET height, not the 1.9 m vehicle height the drive tests use.
       wallAhead() returns 0 for "clear within d", so a hit must be non-zero. */
    var gst=null;
    for(var gi=0;gi<=CFG.NX&&!gst;gi++){
      for(var gj=0;gj<=CFG.NZ;gj++){
        var gxp=Math.round((gi+0.5)*CFG.STRIDE),gzp=Math.round(gj*CFG.STRIDE);
        if(gxp<CFG.R0||gxp>CFG.WX||gzp<CFG.R0||gzp>CFG.WZ)continue;
        for(var gk=0;gk<2;gk++){
          var ga=gk?Math.PI:0,wf=wallAhead(gxp,gzp,ga,24,0.15,0.15);
          if(wf&&wf<24)continue;
          tp(gxp,gzp,ga);
          gst={x:gxp,z:gzp,a:ga,pushed:clearLane(gxp,gzp,ga,26),
               wall:r1(wallAhead(gxp,gzp,ga,24,0.15,0.15)||24)};
          break;
        }
      }
    }
    var tgt=null,gap=1e9,i,u;
    for(i=0;i<PED.length;i++){u=PED[i].userData;
      if(!u.alive||u.kind==='cop')continue;
      var gd=Math.hypot(P.x-u.x,P.z-u.z);
      if(gd<gap){gap=gd;tgt=PED[i];}}
    /* Pools are lazy (gun()/pkp()), so touch the accessors before measuring; and
       a soak respawn leaves wp=fists with zero uzi ammo, which would turn the
       fire loop into a no-op that reads like "0 shots" instead of a real test. */
    GS.ammo[2]=200;setWpn(2);
    var am0=GS.ammo[GS.wp],k0=GS.kills,c0=GS.cash,pk0=pkp().count(),pl=0,drain=0;
    if(tgt){
      var aim=Math.atan2(tgt.userData.z-P.z,tgt.userData.x-P.x);
      P.a=aim;
      tgt.userData.x=P.x+Math.cos(aim)*3.4;tgt.userData.z=P.z+Math.sin(aim)*3.4;
      tgt.userData.tx=tgt.userData.x;tgt.userData.tz=tgt.userData.z;
      tgt.userData.st='idle';tgt.userData.flee=0;
      /* Sample every frame, not every 5. A 112 m/s bolt crosses the 3.4 m gap in
         2 frames and is retired by the hit, so step-boundary sampling of a
         5-frame loop can legitimately read 0 live bullets (bulletsPeak:0 with
         kills:6) -- that measured the sampler, not the pool. */
      for(var g=0;g<70;g++){step(1,{fire:1});var cg=gun().count();if(cg>pl)pl=cg;}
      step(150,null);/* > the uzi bolt's 1.2 s life: the pool must drain itself */
      drain=gun().count();
      /* Decisive probe. Fire through the same accessor tryFire uses, then read
         count() before any step() can retire the bolt. probeNow 0 with probeFire 1
         means tryFire writes a pool this harness cannot see; probeNow 1 with
         bulletsPeak 0 means the game retires bolts inside their own spawn frame. */
      var gp=gunPos(),pf=gun().fire(gp.x,gp.y,gp.z,gp.a,112,14,1.2,0.02,0,null,'p');
      var pnow=gun().count();
      step(1,null);
      var p1=gun().count();
      var wd=WDEF[GS.wp];
      R.gunProbe={fire:pf,now:pnow,after1:p1,muzzleY:r1(gp.y),
        gun:WNAME[GS.wp]+'/spd'+wd.spd+'/dmg'+wd.dmg+'/L'+wd.life+'/rate'+wd.rate,
        poolSame:gun()===gun()?1:0};
    }
    R.guns={mode:P.mode,wp:GS.wp,pedGap0:r1(gap),stage:gst,
      ammo0:am0,ammo1:GS.ammo[GS.wp],shots:am0-GS.ammo[GS.wp],
      bulletsPeak:pl,bulletsNow:drain,
      kills:GS.kills-k0,wanted:GS.wanted,heat:r1(GS.heat),
      cash0:c0,cashDelta:r1(GS.cash-c0),pickups0:pk0,pickups1:pkp().count(),
      bad:actorScan(),fx:fxRep(),render:tryRender()};
  })();
  /* Police: wanted 3 must raise the fleet to the cap, and dropping the heat must
     demote every car again (demotePolice), otherwise the city saturates at 4 cops
     forever. P.inv keeps the cops shooting the player out of this test. */
  (function(){
    GS.wanted=3;GS.heat=20;P.inv=60;
    var peak=0,i,n;
    for(i=0;i<10;i++){step(30,null);n=countPolice();if(n>peak)peak=n;}
    var cars=0,copPeds=0;
    for(i=0;i<VEH.length;i++){var u=VEH[i].userData;
      if(u.role==='police'&&u.alive&&u.state!=='gone'&&u.state!=='wreck')cars++;}
    for(i=0;i<PED.length;i++)if(PED[i].userData.alive&&PED[i].userData.kind==='cop')copPeds++;
    var atPeak={cars:cars,cap:copCap(),copPeds:copPeds,wanted:GS.wanted,hp:r1(GS.hp)};
    GS.wanted=0;GS.heat=0;
    step(600,null);
    R.police={peakCars:peak,atPeak:atPeak,afterCars:countPolice(),
      wanted:GS.wanted,afterPeds:copPeds===0?0:(function(){var c=0;
        for(var q=0;q<PED.length;q++)if(PED[q].userData.alive&&PED[q].userData.kind==='cop')c++;
        return c;})(),
      hp:r1(GS.hp),bad:actorScan(),fx:fxRep()};
    P.inv=0;
  })();
  /* Death -> WASTED -> auto-respawn, through the real hurtPlayer path (no direct
     killPlayer/respawnPlayer calls). Catches the corpse still being simulated. */
  (function(){
    if(P.mode==='veh'){JP.act=1;step(30,null);}
    GS.mode='play';GS.hp=1;P.inv=0;GS.wanted=0;GS.heat=0;
    var lv0=GS.lives,x0=r1(P.x),z0=r1(P.z);
    hurtPlayer(500,'harness');
    var dead={mode:GS.mode,hp:GS.hp,lives0:lv0,lives:GS.lives,die:r1(C4C.die)};
    step(60,null);
    var mid={mode:GS.mode,moved:r1(Math.hypot(P.x-x0,P.z-z0))};
    step(180,null);
    R.death={dead:dead,mid:mid,mode:GS.mode,hp:GS.hp,
      moved:r1(Math.hypot(P.x-x0,P.z-z0)),lives:GS.lives,inv:r1(P.inv),
      wp:GS.wp,ammo:GS.ammo.join('/'),wanted:GS.wanted,bad:actorScan(),fx:fxRep()};
  })();
  /* Payphone -> dwell -> brief -> auto-begin. LAST, because a live mission makes
     every later marker/pickup count non-comparable; state restored after. */
  (function(){
    function mkVis(){var o={},q;
      for(q=0;q<MKTAG.length;q++){var g=scene.getObjectByName('marker_'+MKTAG[q]);
        o[MKTAG[q]]=g?(g.visible?'on':'off'):'absent';}
      return o;}
    var ph=null,i;
    /* The soak can walk the player across a payphone and open its brief, which
       clears ph.on permanently. Rebuild the board with the game's own
       resetCityJobs() rather than fabricating a phone, so "no usable phone"
       still means the job placement itself is broken. */
    GS.mission=null;GS.brief=null;GS.briefT=0;C4C.job=0;
    clearEnvelopeFlags();markersClear();
    resetCityJobs();
    if(P.mode!=='foot'){JP.act=1;step(30,null);}
    for(i=0;i<PHONES.length;i++)if(PHONES[i].on){ph=PHONES[i];break;}
    if(!ph){R.jobs={reason:'no-phone-on',phones:PHONES.length,
      plots:CITY.plots.length,brief:!!GS.brief,mi:GS.missionIdx};return;}
    GS.mode='play';GS.hp=100;P.inv=0;GS.wanted=0;GS.heat=0;
    markersClear();
    tp(ph.x-1.3,ph.z,0);
    step(6,null);
    var vis0=mkVis();
    step(30,null);/* dwell crosses 0.32 s somewhere in here */
    var dial={brief:!!GS.brief,briefT:r1(GS.briefT),mi:GS.missionIdx,
      phoneOn:ph.on,jobClock:C4C.job>0};
    step(450,null);/* 7.5 s: the 7 s brief clock must have begun the mission */
    var m=GS.mission;
    var live=m?{kind:m.kind,name:m.name,need:m.need,lim:m.lim,got:m.got,t:r1(m.t),
      obj:r1(dist2(P.x,P.z,m.tx,m.tz)),cash:GS.cash,envelopes:(function(){var c=0,L=pkp().list;
        for(var q=0;q<L.length;q++)if(L[q].on&&L[q].note)c++;return c;})()}:null;
    var vis1=mkVis();
    step(240,null);
    R.jobs={phones:PHONES.length,phone:r1(ph.x)+','+r1(ph.z),visNear:vis0,dial:dial,
      mission:live,visMission:vis1,stillRunning:!!GS.mission,wanted:GS.wanted,
      bad:actorScan(),fx:fxRep()};
    GS.mission=null;GS.brief=null;GS.briefT=0;C4C.job=0;GS.mode='play';GS.wanted=0;GS.heat=0;
    clearEnvelopeFlags();markersClear();
  })();
  /* ================= chunk 5: shipped main loop, HUD paint, mode machine =========
     Chunk 5 owns the first rAF loop the file ever had -- before it the driver WAS
     the main loop. So these scenarios call tick(), the real frame body (uiStep +
     gated stepWorld + drawFrame + render + endFrame), never stepWorld directly.
     Every scenario has its own try/catch: a broken one must still leave R.audit2
     and R.per to be written. */
  (function(){
    var C={};
    /* Proof that a screen really painted. getImageData is transform-free and
       always reads DEVICE pixels while drawFrame works in CSS px under the DPR
       transform onResize installs; headless Chrome runs at dpr 1, where the two
       spaces coincide. Sample every 7th device row, every 16th device column. */
    function ink(){
      try{
        var d=OX.getImageData(0,0,OV.width,OV.height).data;
        var n=0,y,x,b;
        for(y=0;y<OV.height;y+=7){
          b=y*OV.width*4;
          for(x=0;x<OV.width;x+=16)if(d[b+x*4+3]>8)n++;
        }
        return n;
      }catch(e){return 'ink-fail:'+(e.message||e);}
    }
    function samples(){
      var n=0,y;
      for(y=0;y<OV.height;y+=7)n+=Math.ceil(OV.width/16);
      return n;
    }
    /* One shipped frame. Keys are HELD (KEY) only, never just-pressed (JP): with
       no edge, uiStep cannot fire newGame/selectCity/advanceCity out of a paint. */
    function fr(n,keys){
      for(var i=0;i<n;i++){
        if(H.stop)return;
        for(var q in KEY)KEY[q]=0;
        if(keys)for(var k in keys)if(keys[k])KEY[k]=1;
        H.frames++;trapNew();
        try{tick(1/60);}
        catch(e){H.stepErrs++;if(!stubMissing(e.message))elog('TICK',e);
                 if(H.stepErrs>20)H.stop=true;}
      }
      for(var q2 in KEY)KEY[q2]=0;
    }
    /* Neutral staging. C4C.die>0 is not decoration: killPlayer() returns early on
       it, so the player cannot die and leave the mode under test, and missionStep
       cannot respawn him out of 'dead' into 'play' on frame 1 -- which would make
       a correct input gate look like a broken one. GS.fade must be 0 or ink()
       would measure the black wipe, not the HUD underneath it. */
    function stage(mode){
      C4C.die=9;GS.hp=100;GS.wanted=0;GS.heat=0;
      GS.mode=mode;GS.modeT=0;GS.fade=0;
    }
    function paint(mode){stage(mode);fr(2,null);return ink();}
    var MODES=['play','title','map','pause','dead','over','complete'];
    /* All axes held at once: gx/gz cancel inside footMove, so this scenario
       cannot walk the player out of the world box while still leaving every raw
       key reader live for the gate to count. */
    var ALLK={up:1,down:1,left:1,right:1,run:1,fire:1,act:1,brake:1};

    /* --- 1. the input gate. footMove/driveInput read RAW keys (kd, not jp), so
       before the chunk-5 gate a title card or pause screen could steer the
       actor. Wrapping the bindings is the same trick R.enterTrace uses, and the
       counter is its own positive control: a rejected patch throws here. --- */
    var oFoot=footMove,oDrive=driveInput,nFoot=0,nDrive=0;
    try{
      footMove=function(){nFoot++;return oFoot.apply(this,arguments);};
      driveInput=function(){nDrive++;return oDrive.apply(this,arguments);};
      C.gate={patched:'ok'};
      if(P.mode!=='foot')tp(cx(),cz(),P.a);
      for(var i1=0;i1<MODES.length;i1++){
        stage(MODES[i1]);nFoot=0;nDrive=0;
        fr(30,ALLK);
        C.gate[MODES[i1]]={foot:nFoot,drive:nDrive,mode:GS.mode};
      }
      /* driveInput is the other raw reader, so the gate has to hold for the
       * throttle as well as the legs -- and boarding needs mode 'play', since
       * tryEnterVehicle is only reachable through footMove. */
      stage('play');C4C.die=0;
      var br=boardIsolated(85);
      C.gate.board=br?(br.car||br.err||'?'):'none';
      if(P.mode==='veh'){
        for(var i2=0;i2<MODES.length;i2++){
          stage(MODES[i2]);nFoot=0;nDrive=0;
          fr(30,ALLK);
          C.gate['veh_'+MODES[i2]]={foot:nFoot,drive:nDrive,mode:GS.mode};
        }
      }
      var bad1=[];
      for(var i3=0;i3<MODES.length;i3++){
        var mo=MODES[i3],g0=C.gate[mo],g1=C.gate['veh_'+mo];
        if(mo==='play'){
          if(!g0.foot)bad1.push('onfoot-play:0');
          if(g1&&!g1.drive)bad1.push('inveh-play:0');
        }else{
          if(g0.foot)bad1.push(mo+':foot'+g0.foot);
          if(g1&&g1.drive)bad1.push(mo+':drive'+g1.drive);
        }
      }
      C.gateBad=bad1;
    }catch(e){C.gateErr=(e.message||e)+' | '+String(e.stack||'').split('\n')[1];}
    footMove=oFoot;driveInput=oDrive;
    if(P.mode==='veh'){JP.act=1;step(40,null);}/* unboard via the game's own F/E */
    stage('play');C4C.die=0;

    /* --- 2. per-screen paint. ink() counts non-transparent overlay pixels the
       HUD actually put there: drawFrame clears the canvas first, so anything
       measured is chunk-5 output and nothing else. samples() is the denominator
       (1280x720 -> 8343), so map/over should saturate and the play HUD should
       not, because it only owns the top strip plus the bars. --- */
    try{
      var sc={},mi4;
      GS.mission=null;GS.brief=null;GS.briefT=0;GS.done=[];GS.lives=3;
      for(mi4=0;mi4<MODES.length;mi4++)sc[MODES[mi4]]=paint(MODES[mi4]);
      /* The brief curtain is a drawHUD branch, not a mode: play + brief text and
         no live mission is the only state in which it paints. */
      GS.brief='DELIVER THE PARCELS. DO NOT BE SEEN.';GS.briefT=6.9;
      stage('play');fr(2,null);sc.brief=ink();
      GS.brief=null;GS.briefT=0;
      /* The say() banner is another drawHUD branch. */
      say('BANNER TEST',2.6);stage('play');fr(2,null);sc.banner=ink();
      GS.msgT=0;GS.msg='';
      /* Death overlay: red wash, plus the continue prompt only while lives remain. */
      GS.lives=0;sc.deadNoContinue=paint('dead');GS.lives=3;
      var tot=samples(),fr2={};
      for(mi4=0;mi4<MODES.length;mi4++)
        fr2[MODES[mi4]]=Math.round(sc[MODES[mi4]]/tot*1000)/1000;
      C.screens=sc;C.samples=tot;C.frac=fr2;
      C.paintBad=(function(){var b=[],q;
        for(q in sc)if(typeof sc[q]!=='number'||sc[q]<=0)b.push(q+'='+sc[q]);
        return b;})();
      stage('play');
    }catch(e){C.screensErr=(e.message||e)+' | '+String(e.stack||'').split('\n')[1];}

    /* --- 3. uiStep timer decay. say()/bigMsg() set these and nothing in chunks
       1-4c ever lowered them, so the first banner stuck for the whole session. --- */
    try{
      GS.mission=null;GS.brief=null;GS.briefT=0;GS.done=[];
      stage('play');GS.fade=1;say('DECAY',1.0);bigMsg('BIG','SUB');
      GS.msgT=1;GS.bigT=1;
      var mt0=GS.modeT;
      uiStep(0.5);
      C.decay={msgT:r1(GS.msgT),bigT:r1(GS.bigT),fade:r1(GS.fade),
               modeT:r1(GS.modeT-mt0),mode:GS.mode};
    }catch(e){C.decayErr=String(e.message||e);}

    /* --- 4. city-cleared path, driven the way a player drives it: uiStep in
       'play' with all six jobs done and no mission running. Must arm the next
       city, because newGame() clamps its argument to HUDC.unlocked-1. --- */
    try{
      GS.mission=null;GS.brief=null;GS.briefT=0;GS.done=[];
      stage('play');GS.score=1000;
      var i5;for(i5=0;i5<MISSION_N;i5++)GS.done.push(i5);
      var un0=HUDC.unlocked;
      uiStep(1/60);
      C.complete={mode:GS.mode,done:GS.done.length,bonus:GS.bonus,score:GS.score,
                  unlocked:HUDC.unlocked,wasUnlocked:un0,hi:HUDC.hi,newHi:GS.newHi};
      /* advanceCity() is the only other writer of GS.cityScore, and it used to
         reseed it from the cumulative GS.score -- which is the very number
         drawComplete labels 'THIS CITY'. It must reset like newGame() does.
         This is also the completion path's only rebuild, so it proves
         rebuildCity() survives a live 'complete' -> 'play' hand-off. */
      var cs0=GS.cityScore,city0=GS.city;
      advanceCity();
      C.advance={mode:GS.mode,fromCity:city0,city:GS.city,th:TH.name,
        chapter:TH.chapter,cityScore:GS.cityScore,wasCityScore:cs0,score:GS.score,
        done:GS.done.length,unlocked:HUDC.unlocked,sel:HUDC.sel,
        fade:r1(GS.fade),veh:VEH.length,ped:PED.length,phones:PHONES.length,
        statics:staticMeshes.length,bad:actorScan()};
    }catch(e){C.completeErr=String(e.message||e);}

    /* --- 5. the real end-of-run path. respawnPlayer() never inspects GS.lives,
       so the lives gate inside missionStep's dead branch is the ONLY thing that
       can end a run; before chunk 5 the last life respawned forever. over2 is
       the positive control: same frames, one life left, must respawn. --- */
    try{
      GS.mode='dead';GS.lives=0;C4C.die=0.01;GS.fade=0;
      step(2,null);
      C.over1={mode:GS.mode,lives:GS.lives,bonus:GS.bonus,score:GS.score,
               hi:HUDC.hi,newHi:GS.newHi};
      /* The control has to re-enter 'dead': gameOver() already moved the run out
         of that mode, and the lives branch only runs inside missionStep's dead
         handler -- leaving mode 'over' would measure nothing and look like a bug. */
      GS.lives=2;GS.mode='dead';GS.fade=0;C4C.die=0.01;
      step(2,null);
      C.over2={mode:GS.mode,hp:GS.hp,lives:GS.lives,ammo:GS.ammo.join('/'),
               invP:r1(P.inv),bad:actorScan()};
    }catch(e){C.overErr=(e.message||e)+' | '+String(e.stack||'').split('\n')[1];}
    stage('play');

    /* --- 6. the def.brief fix. beginMission used to read m.brief where m is the
       RUN record, so the banner printed the literal word "undefined". Assert the
       banner text equals missionDefs()[idx].brief, not merely that it is set. --- */
    try{
      GS.mission=null;GS.brief=null;GS.briefT=0;C4C.job=0;
      clearEnvelopeFlags();markersClear();
      resetCityJobs();
      var phb=null,i6;
      for(i6=0;i6<PHONES.length;i6++)if(PHONES[i6].on){phb=PHONES[i6];break;}
      if(!phb)C.briefFix={err:'no-phone-on',phones:PHONES.length};
      else{
        stage('play');C4C.die=0;P.inv=0;
        GS.msg='SENTINEL';GS.msgT=0;
        var wasOn=phb.on;/* openBrief() consumes the pickup, so read it first */
        openBrief(phb);
        var f6=0;
        while(!GS.mission&&f6<480){step(1,null);f6++;}
        var m6=GS.mission,def6=missionDefs(GS.city)[GS.missionIdx];
        C.briefFix={phoneWasOn:wasOn,phoneAfter:phb.on,frames:f6,started:!!m6,
          kind:m6?m6.kind:null,name:m6?m6.name:null,
          msg:GS.msg,msgIsBrief:GS.msg===def6.brief,
          saysUndefined:/undefined/.test(GS.msg+''),
          briefText:def6.brief?def6.brief.slice(0,48):null,
          bad:actorScan()};
      }
    }catch(e){C.briefFixErr=(e.message||e)+' | '+String(e.stack||'').split('\n')[1];}

    /* --- 7. newGame(1) LAST: a full SAN ANDREAS rebuild through the chunk-5
       transition chain (clearActors + buildCity + spawnPlayer + populateCity).
       This is the first time city 1 has ever been built. It also leaves the city
       that R.audit2 audits a different one from every earlier run, so audit2 is
       deliberately not comparable to the chunk-4c baseline; R.newgame.statics is
       the proof the rebuild really happened. --- */
    try{
      var pol=0,i7;
      newGame(1);
      for(i7=0;i7<VEH.length;i7++)if(VEH[i7].userData.role==='police')pol++;
      C.newgame={th:TH.name,chapter:TH.chapter,city:GS.city,mode:GS.mode,
        unlocked:HUDC.unlocked,sel:HUDC.sel,
        veh:VEH.length,ped:PED.length,box:PARKBOX.length,phones:PHONES.length,
        police:pol,statics:staticMeshes.length,plots:CITY.plots.length,
        spawn:CITY.spawn.length,
        score:GS.score,cash:GS.cash,lives:GS.lives,cityScore:GS.cityScore,
        done:GS.done.length,ammo:GS.ammo.join('/'),wp:GS.wp,
        big:GS.big,msg:GS.msg,fade:r1(GS.fade),
        bad:actorScan(),fx:fxRep().on};
    }catch(e){C.newgameErr=(e.message||e)+' | '+String(e.stack||'').split('\n')[1];}

    R.c5=C;
  })();
  R.audit2=audit();
  R.per={frames:H.frames,ms:Date.now()-t0,msPerFrame:r1((Date.now()-t0)/Math.max(1,H.frames))};
}catch(e){
  slog('DRIVER '+(e.message||e)+' | '+String(e.stack||'').split('\n')[1]);
}
R.missing=H.missing;R.log=H.log;R.errKinds=EKEY;R.pois=H.pois;R.firstBad=H.firstBad;
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
