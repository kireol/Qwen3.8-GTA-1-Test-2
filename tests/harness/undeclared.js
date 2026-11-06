/* Heuristic undeclared-global finder for the single-file game script.
   Collects names introduced by var/function/params/catch, then reports bare
   assignment targets that were never introduced.  Strict mode makes those a
   ReferenceError at runtime, which node --check cannot detect. */
var fs=require('fs');
var src=fs.readFileSync('/tmp/gta_extract.js','utf8');
var lines=src.split('\n');

var declared=Object.create(null);
function addAll(list){
  for(var i=0;i<list.length;i++){
    var n=String(list[i]).trim().replace(/[=:,).]+$/,'');
    if(/^[A-Za-z_$][\w$]*$/.test(n))declared[n]=1;
  }
}
/* var declarations (possibly comma chained) */
var re=/\bvar\s+([^;\n]+)/g,m;
while((m=re.exec(src))){
  var parts=m[1].split(/,(?![^(){}[\]]*[)\]}])/);
  addAll(parts.map(function(p){return p.split('=')[0];}));
}
/* function declarations and their parameters */
re=/\bfunction\s*([A-Za-z_$][\w$]*)?\s*\(([^)]*)\)/g;
while((m=re.exec(src))){
  if(m[1])declared[m[1]]=1;
  addAll((m[2]||'').split(','));
}
/* arrow params, catch bindings, for-in/of bindings */
re=/(?:\bcatch\s*\(\s*([A-Za-z_$][\w$]*)|(?:^|[^\w.])([A-Za-z_$][\w$]*)\s*=>|\bfor\s*\(\s*(?:var\s+)?([A-Za-z_$][\w$]*)\s+(?:in|of)\b)/g;
while((m=re.exec(src))){
  addAll([m[1],m[2],m[3]].filter(Boolean));
}
/* properties and keywords to ignore */
var IGNORE='if else return typeof new delete void in of do while for switch case default break continue this null true false function var let const try catch finally throw instanceof typeof undefined NaN Infinity window document Math JSON Object Array String Number Boolean Date console THREE'.split(' ');
for(var k=0;k<IGNORE.length;k++)declared[IGNORE[k]]=1;

var suspect=[];
/* bare assignment / increment / compound-assignment targets */
re=/(^|[\s;{}(,?&|:!~+\-*\/%])([A-Za-z_$][\w$]*)\s*(?:=(?!=)|\+\+|--|\+=|-=|\*=|\/=|%=|\|=|&=)(?![ =~])/g;
for(var ln=0;ln<lines.length;ln++){
  var L=lines[ln];
  if(/^\s*(\/\/|\*|\/\*)/.test(L))continue;
  var s=L.replace(/'[^']*'/g,"''").replace(/"[^"]*"/g,'""').replace(/\/\/.*$/,'');
  var mm;
  var r2=/(^|[^\w.$])([A-Za-z_$][\w$]*)\s*(?:=(?!=)|\+\+|--|\+=|-=|\*=|\/=|%=)(?![ =~])/g;
  while((mm=r2.exec(s))){
    var name=mm[2];
    if(declared[name])continue;
    if(/^(GL_OES|WEBGL)/.test(name))continue;
    suspect.push((ln+1)+': '+name+'   |   '+L.trim().slice(0,110));
  }
}
/* dedupe by name+line */
var seen=Object.create(null),out=[];
for(var i=0;i<suspect.length;i++)if(!seen[suspect[i]]){seen[suspect[i]]=1;out.push(suspect[i]);}
console.log('declared names: '+Object.keys(declared).length);
console.log('suspect undeclared assignments: '+out.length);
for(var j=0;j<out.length;j++)console.log('  '+out[j]);
