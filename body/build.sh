#!/bin/bash
# Bundles body/src into body/index.html. micro.js (the scale descent) is spliced into app.js at /*MICRO*/.
set -e; cd "$(dirname "$0")"
python3 - <<'PY'
app=open('src/app.js').read().replace('/*MICRO*/',open('src/micro.js').read())
head='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>[hidden]{display:none!important}body{margin:0}:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}</style></head><body>'
open('index.html','w').write(head+open('src/shell.html').read()+"<script>"+open('src/data.js').read()+"\n"+app+"</script></body></html>")
PY
echo "built body/index.html"
