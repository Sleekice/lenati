import re,glob,os,json
T='/tmp/claude-0/-home-claude/319f7e4d-6015-52e4-bf0f-cd2425ea4364/scratchpad/t/node_modules/three'
h=open('/home/claude/lenati/lenati.html').read()
libs={'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js':T+'/build/three.min.js'}
for m in re.findall(r'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/[^"]+',h): libs[m]=T+'/examples/js/'+m.split('/examples/js/')[1]
for url,path in libs.items():
    h=h.replace(f'<script src="{url}"></script>','<script>'+open(path).read().replace('</script','<\\/script')+'</script>')
inline={os.path.basename(f)[:-4]:open(f).read() for f in glob.glob('/home/claude/lenati/models/*.txt')}
h=h.replace('<canvas id="scene"','<script>window.LENATI_INLINE='+json.dumps(inline)+';</script>\n<canvas id="scene"',1)
doc='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>[hidden]{display:none!important}body{margin:0}</style></head><body>'+h+'</body></html>'
open('/home/claude/lenati/Lenati-offline.html','w').write(doc)
print(round(len(doc)/1e6,1),'MB')
