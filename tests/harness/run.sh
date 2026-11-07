#!/bin/sh
# Build + run the headless smoke harness. Any args are passed to rd.py as report keys.
set -e
R=$HOME/projects/gta1
cd "$R"
awk '/^<script>/{f=1;next}/^<\/script>/{f=0}f' src/gta1.html > /tmp/gta_extract.js
node --check /tmp/gta_extract.js && echo FULL_SYNTAX_OK
cp tests/harness/mk_smoke.js tests/harness/rd.py tests/harness/three128.js /tmp/
node /tmp/mk_smoke.js
cd /tmp
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --use-angle=swiftshader --enable-unsafe-swiftshader \
  --window-size=1280,720 --virtual-time-budget=60000 --dump-dom file:///tmp/gta_smoke.html \
  2>/tmp/chrome.err > /tmp/dom.html
python3 /tmp/rd.py "$@"
