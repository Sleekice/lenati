import csv, re, glob, os, json, hashlib
SC='/tmp/claude-0/-home-claude/319f7e4d-6015-52e4-bf0f-cd2425ea4364/scratchpad'
D=SC+'/bpfull/assets/BodyParts3D_data'
OUT=os.environ.get('OUT','/home/claude/lenati-gh/body/ASSET_INVENTORY.csv')
name={}
for row in csv.reader(open(D+'/FMA.csv')):
    if len(row)>=2: name[row[0]]=row[1]
pl={}
for l in open(D+'/parts_list_e.txt',encoding='utf-8',errors='ignore'):
    p=l.rstrip('\n').split('\t')
    if len(p)>=2: pl[re.sub(r'\D','',p[0])]=p[1].strip('"')
t=json.load(open('/home/claude/lenati/tree.json'))
parent={}; node={}
def w(n,par=None):
    node[n['id']]=n; parent[n['id']]=par
    for k in n['kids']: w(k,n['id'])
w(t['BODY'])
top={}
def tp(n,r=None):
    top[n['id']]=r
    for k in n['kids']: tp(k, r or (n['id'] if n['id']!='body' else None) or k['id'])
tp(t['BODY'])
# FMA id -> lenati node id (auto leaves are fma<ID>; single-part nodes were merged into their curated node)
fma2node={}
for nid,n in node.items():
    if n.get('fma'): fma2node[n['fma']]=nid
import importlib.util
reg_sha={}
for f in glob.glob('/home/claude/lenati/models/*.txt'):
    reg_sha[os.path.basename(f)[:-4]]=hashlib.sha256(open(f,'rb').read()).hexdigest()
# rebuild the single-part merges the same way build_mesh.py assigned them
spec=importlib.util.spec_from_file_location('x','/dev/null')
rows=[]
assign=json.load(open('/home/claude/lenati/assign.json')) if os.path.exists('/home/claude/lenati/assign.json') else {}
for f in sorted(glob.glob(D+'/stl/*.stl')):
    i=re.sub(r'\D','',os.path.basename(f)); nm=name.get(i) or pl.get(i) or ('Part '+i)
    nid=fma2node.get(i) or assign.get(i,'')
    region=top.get(nid,'') if nid else ''
    if nm=='Skin': nid='skin (split by region)'; region='all regions'
    rows.append({
     'asset_id':'bp3d-fma'+i,'anatomical_term':nm,'representation':'scientific-mesh (decimated)',
     'source_url':'https://github.com/Kevin-Mattheus-Moerman/BodyParts3D/blob/f0eeb6e843380cfe6b83797cf8c3e1af74de5e61/assets/BodyParts3D_data/stl/'+os.path.basename(f),
     'source_id':'FMA'+i,'source_version':'BodyParts3D release 3.0 (20110915), 95% reduced OBJ set via STL conversion, repo commit f0eeb6e',
     'downloaded_at':'2026-11-04','license':'CC BY-SA 2.1 JP','license_url':'https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en',
     'authors':'The Database Center for Life Science (BodyParts3D); STL conversion by Kevin M. Moerman',
     'attribution_text':'BodyParts3D, (c) The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan',
     'derivative_changes':'axes remapped to Y-up metres; quadric decimation (fast-simplification; skin regions with pyfqmr, borders locked); skin split into body regions by nearest bone; grouped under Lenati node; glTF + meshopt compression; base64 text; colour assigned at runtime',
     'quality_level':'measured source, unreviewed derivative','reviewer':'','reviewed_at':'',
     'anatomical_parent_id':nid,'mesh_file':('body/models/'+region+'.txt') if region and region!='all regions' else 'body/models/*.txt',
     'source_checksum_sha256':hashlib.sha256(open(f,'rb').read()).hexdigest(),
     'mesh_file_checksum_sha256':reg_sha.get(region,'') if region else ''})
os.makedirs(os.path.dirname(OUT),exist_ok=True)
with open(OUT,'w',newline='') as fh:
    wr=csv.DictWriter(fh,fieldnames=list(rows[0].keys())); wr.writeheader(); wr.writerows(rows)
print(len(rows),'rows;',sum(1 for r in rows if not r['anatomical_parent_id']),'without lenati node')
