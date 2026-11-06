import re,html,json,sys
h=open('/tmp/dom.html').read()
m=re.search(r'<pre id="out">(.*?)</pre>',h,re.S)
if not m:
    print('NO OUTPUT PRE'); print(h[:1500]); sys.exit(0)
t=html.unescape(m.group(1))
R=json.loads(t.strip()[2:-2])
keys=sys.argv[1:]
if keys: R={k:R.get(k) for k in keys}
print(json.dumps(R,indent=1,sort_keys=False))
