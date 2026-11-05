import json
t=json.load(open('/home/claude/lenati/tree.json')); ids=set()
def w(n): ids.add(n['id']); [w(k) for k in n['kids']]
w(t['BODY'])
M={'bronchus-left':'bronchi','bronchus-right':'bronchi','left-atrium':'heart-wall','eye-left':'eyes','eye-right':'eyes','right-atrium':'heart-wall'}
for k,p in t['PASSAGES'].items(): p['node']=M.get(p['node'],p['node'])
t['TUNNEL_ENTRY']={k:v for k,v in t['TUNNEL_ENTRY'].items() if k in ids}
def c(n):
    if n.get('conn'): n['conn']=list(dict.fromkeys(M.get(x,x) for x in n['conn'] if M.get(x,x) in ids))
    [c(k) for k in n['kids']]
c(t['BODY'])
json.dump(t,open('/home/claude/lenati/tree.json','w'),separators=(',',':'))
open('/home/claude/lenati/data.js','w').write('const TREE='+json.dumps(t,separators=(',',':'))+';\nconst {BODY,PASSAGES,TUNNEL_ENTRY,SYSTEMS,LAYERS,CARE}=TREE;\nconst MODEL_BASE=(window.LENATI_MODEL_BASE||"models/");\n')
print('tree fixed',len(ids))
