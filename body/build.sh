#!/bin/bash
# Bundles body/src into body/index.html. Models load from body/models/ at runtime.
set -e; cd "$(dirname "$0")"
{ echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>[hidden]{display:none!important}body{margin:0}:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}</style></head><body>'
  cat src/shell.html; echo "<script>"; cat src/data.js; echo; cat src/app.js; echo "</script></body></html>"; } > index.html
echo "built body/index.html"
