import csv, re, glob, os, json, pickle, copy, sys
import numpy as np, trimesh, fast_simplification
from scipy.spatial import cKDTree

SC = '/tmp/claude-0/-home-claude/319f7e4d-6015-52e4-bf0f-cd2425ea4364/scratchpad'
D = SC + '/bpfull/assets/BodyParts3D_data'
OUT = '/home/claude/lenati/models'
os.makedirs(OUT, exist_ok=True)
cur = json.load(open('/home/claude/lenati/curated.json'))
BODY = cur['BODY']

# ---------- names & ancestry ----------
name, par = {}, {}
for row in csv.reader(open(D + '/FMA.csv')):
    if len(row) >= 3: name[row[0]] = row[1]; par[row[0]] = row[2]
pl = {}
for l in open(D + '/parts_list_e.txt', encoding='utf-8', errors='ignore'):
    p = l.rstrip('\n').split('\t')
    if len(p) >= 2: pl[re.sub(r'\D', '', p[0])] = p[1].strip('"')
def chain(i):
    out, k = [], i
    for _ in range(40):
        if k not in par or par[k] in out: break
        k = par[k]; out.append(k)
    return [name.get(x, x) for x in out]

def sysof(nm, ch):
    n = nm.lower(); s = (n + ' | ' + ' | '.join(ch)).lower()
    if n == 'skin': return 'skin'
    if re.search(r'hair|eyebrow|^ear$|gingiva|labial part', n): return 'skin'
    if re.search(r'ventricle|aqueduct|choroid plexus|central canal|interventricular foramen|pineal|interpeduncular', n) and 'heart' not in s and 'papillary' not in n: return 'nerve'
    if re.search(r'wall of heart|papillary|valve', n): return 'cardio'
    if re.search(r'coronary art|arter|aorta', n): return 'artery'
    if re.search(r'vein|vena|coronary sinus', n): return 'vein'
    if re.search(r'tendon|aponeurosis|tract$|retinaculum|ligament|linea alba|interosseous membrane|taenia', n): return 'ligament' if 'taenia' not in n else 'digest'
    if re.search(r'muscle organ|musculature', s) or re.search(r'muscle|trapezius|spinalis|fasciae latae|sphincter', n): return 'muscle'
    rules = [('nerve', r'neuraxis|brain|gyrus|lobe of cerebr|nerve|ganglion|spinal cord|cerebell|thalam|hippocamp|fornix|optic|eyeball|commissure|colliculus|capsule|habenula|stria|mammillary|tuber cinereum|lamina terminalis|septum pellucidum|white matter|corpus callosum|putamen|pallidus|caudate|amygdala|insula|precuneus|lobule|geniculate|midbrain|pons|medulla'),
      ('resp', r'lung|bronch|trache|laryn|nasal|pharyn|thyroid cartilage'),
      ('digest', r'liver|stomach|intestin|colon|esophag|duoden|jejun|ileum|cecum|appendix|rectum|gallbladder|tongue|tooth|salivary|anal'),
      ('urinary', r'kidney|ureter|bladder|urethra'), ('endocrine', r'adrenal|suprarenal|pituitary|pancrea'),
      ('lymph', r'spleen|thymus|lymph|tonsil'), ('repro', r'testis|prostat|penis|seminal|epididym|deferent'),
      ('ligament', r'cartilage|disk|menisc|joint|labrum'),
      ('bone', r'bone|vertebra|rib\b|rib$|sacrum|coccyx|patella|sternum|manubrium|xiphoid|phalanx|femur|tibia|fibula|humerus|radius|ulna|scapula|clavicle|carpal|tarsal|talus|calcaneus|navicular|cuboid|cuneiform|mandible|maxilla|concha|vomer|axis|atlas')]
    for k, r in rules:
        if re.search(r, s): return k
    return 'ligament'

# ---------- load, transform, decimate ----------
files = sorted(glob.glob(D + '/stl/*.stl'))
parts = []
for f in files:
    i = re.sub(r'\D', '', os.path.basename(f))
    nm = name.get(i) or pl.get(i) or ('Part ' + i)
    nm = nm[0].upper() + nm[1:]
    parts.append({'fma': i, 'name': nm, 'file': f, 'chain': chain(i)})
for p in parts: p['sys'] = sysof(p['name'], p['chain'])

BUDGET = {'skin': 150000, 'muscle': 300000, 'bone': 220000, 'nerve': 70000, 'ligament': 50000, 'cardio': 30000,
          'artery': 30000, 'vein': 25000, 'resp': 40000, 'digest': 50000, 'urinary': 8000, 'endocrine': 6000, 'lymph': 6000, 'repro': 8000}
CACHE = SC + '/meshcache.pkl'
if os.path.exists(CACHE):
    raw = pickle.load(open(CACHE, 'rb'))
else:
    raw = {}
    for p in parts:
        m = trimesh.load(p['file'], force='mesh')
        v = m.vertices / 1000.0
        V = np.column_stack([v[:, 0], v[:, 2], -(v[:, 1] + 0.100)])
        raw[p['fma']] = (V.astype(np.float32), m.faces.astype(np.int32))
    pickle.dump(raw, open(CACHE, 'wb'))
tot = {}
for p in parts: tot[p['sys']] = tot.get(p['sys'], 0) + len(raw[p['fma']][1])

def decimate(V, F, target):
    target = int(max(target, 60))
    if len(F) <= target: return V, F
    red = 1 - target / len(F)
    v2, f2 = fast_simplification.simplify(V, F, target_reduction=red, agg=5)
    return v2.astype(np.float32), f2.astype(np.int32)

for p in parts:
    V, F = raw[p['fma']]
    ratio = BUDGET.get(p['sys'], 20000) / max(tot[p['sys']], 1)
    tgt = len(F) * ratio
    if p['sys'] != 'skin': tgt = min(max(tgt, 180 if len(F) > 400 else len(F)), 14000)
    else: tgt = {'Skin': len(F)}.get(p['name'], max(tgt, 2500))
    v2, f2 = decimate(V, F, tgt)
    p['V'], p['F'] = v2, f2
    p['center'] = ((v2.min(0) + v2.max(0)) / 2).tolist()
    p['side'] = 'left' if re.search(r'\bleft\b', p['name'].lower()) else ('right' if re.search(r'\bright\b', p['name'].lower()) else None)
print('decimated', sum(len(p['F']) for p in parts))

# ---------- region classification ----------
UP = r'humerus|radius|ulna|scaphoid|lunate|triquetral|pisiform|trapezium|trapezoid|capitate|hamate|metacarpal|finger|thumb'
LO = r'femur|patella|tibia|fibula|talus|calcaneus|navicular|cuboid|cuneiform|metatarsal|toe'
bv, bl = [], []
for p in parts:
    if p['sys'] != 'bone': continue
    n = p['name'].lower()
    lab = 'U' if re.search(UP, n) else ('L' if re.search(LO, n) else 'A')
    if 'phalanx' in n and 'toe' in n: lab = 'L'
    bv.append(p['V']); bl += [lab] * len(p['V'])
bv = np.concatenate(bv); bl = np.array(bl); tree = cKDTree(bv)

def region_of(pt, lab=None):
    x, y, z = pt
    if lab is None: lab = bl[tree.query(pt)[1]]
    s = 'left' if x > 0 else 'right'
    if lab == 'U':
        if y > 1.27: return 'shoulder-' + s
        if abs(y - 1.043) < 0.04: return 'elbow-' + s
        if y > 1.003: return 'upper-arm-' + s
        if y > 0.83: return 'forearm-' + s
        return 'hand-' + s
    if lab == 'L':
        if y > 0.455: return 'thigh-' + s
        if y > 0.37: return 'knee-' + s
        if y > 0.075: return 'leg-' + s
        return 'foot-' + s
    if y > 1.50 or (y > 1.44 and z > -0.02): return 'head'
    if y > 1.345: return 'neck'
    if y > 1.17: return 'thorax'
    if y > 0.967: return 'abdomen'
    return 'pelvis'

# ---------- curated tree edits ----------
NODES = {}
def walk(n, par=None):
    n['parent'] = par['id'] if par else None; NODES[n['id']] = n
    for k in n['kids']: walk(k, n)
walk(BODY)
def find(i): return NODES[i]
def remove(i):
    n = NODES[i]; p = NODES[n['parent']]; p['kids'] = [k for k in p['kids'] if k['id'] != i]
    def dele(x):
        NODES.pop(x['id'], None); [dele(k) for k in x['kids']]
    dele(n)
def add(parent_id, node, index=None):
    node.setdefault('kids', []); node.setdefault('shapes', []); node['parent'] = parent_id
    p = NODES[parent_id]
    if index is None: p['kids'].append(node)
    else: p['kids'].insert(index, node)
    NODES[node['id']] = node; return node
def N(i, nm, common, sysk, what, does, **o):
    d = {'id': i, 'name': nm, 'common': common, 'sys': sysk, 'what': what, 'does': does, 'shapes': [], 'kids': []}; d.update(o); return d

# heart restructure
for k in ['right-atrium', 'right-ventricle', 'left-atrium', 'left-ventricle']: remove(k)
h = find('heart'); h['shapes'] = []
add('heart', N('heart-wall', 'Heart wall and chambers', 'Myocardium', 'cardio',
  'The muscular wall around the four chambers: right atrium, right ventricle, left atrium and left ventricle.',
  'Contracts about once a second. The right side pumps to the lungs, the left side to the whole body.', ex=[0, 0, 1]), 0)
add('heart', N('heart-valves', 'Heart valves', '', 'cardio', 'Flaps of tissue at the exits of each chamber.', 'Open to let blood through and snap shut to stop it flowing back. Their closing makes the "lub-dub" sound.', ex=[0, 1, 0.5]))
add('heart', N('papillary-muscles', 'Papillary muscles', '', 'cardio', 'Small muscles inside the ventricles tied to the valve flaps by chordae tendineae.', 'Hold the tricuspid and mitral valves shut so they do not flip back into the atria.', ex=[0, -1, 0.5]))
add('heart', N('coronary-arteries', 'Coronary arteries', '', 'artery', 'The heart\'s own blood supply, branching from the base of the aorta.', 'Feed the heart muscle. A blockage here causes a heart attack.', ex=[1, 0.3, 1]))
add('heart', N('cardiac-veins', 'Cardiac veins', '', 'vein', 'Veins on the heart surface draining into the coronary sinus.', 'Return used blood from the heart muscle to the right atrium.', ex=[-1, 0.3, -0.5]))
add('heart', N('pulmonary-veins', 'Pulmonary veins', '', 'artery', 'Usually four veins entering the left atrium.', 'Carry oxygen-rich blood from the lungs back to the heart.', ex=[0, 0, -1]))
# lungs and airway
for k in ['bronchus-left', 'bronchus-right']: remove(k)
add('thorax', N('bronchi', 'Bronchial tree', 'Bronchi', 'resp', 'The main bronchi and their branches, splitting about 23 times inside the lungs.', 'Conduct air deep into the lungs. The right main bronchus is wider and more vertical, so inhaled objects usually go right.', ex=[0, 0.4, 1]))
add('thorax', N('intercostals', 'Intercostal muscles', '', 'muscle', 'Three layers of muscle between the ribs: external, internal and innermost.', 'Lift and lower the ribs during breathing.', ex=[0, 0, 1.2]))
add('thorax', N('great-vessels', 'Great vessels of the chest', '', 'vein', 'The superior vena cava, brachiocephalic vessels and subclavian vessels.', 'Carry blood between the heart, head and arms.', ex=[0, 1, 0.4]))
# abdomen
for k in ['liver-right-lobe', 'liver-left-lobe', 'stomach-fundus', 'stomach-body', 'stomach-pylorus', 'cecum', 'ascending-colon', 'transverse-colon', 'descending-colon', 'sigmoid-colon', 'abdominal-aorta']: remove(k)
find('large-intestine')['what'] = 'About 1.5 metres: cecum, ascending, transverse, descending and sigmoid colon, framing the small intestine.'
find('stomach')['what'] = 'A J-shaped muscular bag with a fundus, body and pylorus. It expands from about 50 ml to over a litre.'
add('large-intestine', N('appendix', 'Appendix', 'Vermiform appendix', 'digest', 'A narrow tube about 9 cm long hanging from the cecum, rich in immune tissue.', 'May store gut bacteria and supports immunity. A blocked appendix causes appendicitis.', ex=[-1, -1, 0.5]))
add('large-intestine', N('taeniae-coli', 'Taeniae coli', '', 'digest', 'Three ribbons of longitudinal muscle running along the colon.', 'Bunch the colon into pouches called haustra.', ex=[0, 1, 1]))
add('abdomen', N('abdominal-wall', 'Abdominal wall muscles', 'Abs and obliques', 'muscle', 'Rectus abdominis, external and internal obliques and transversus abdominis.', 'Protect the organs, bend and twist the trunk, and raise pressure for coughing and lifting.', ex=[0, 0, 1.3], care='Train the core with planks and controlled lifting, and breathe out on effort.'))
add('abdomen', N('abdominal-arteries', 'Abdominal arteries', '', 'artery', 'Branches of the aorta: celiac, mesenteric, renal and iliac arteries.', 'Feed the gut, kidneys, pelvis and legs.', ex=[0.3, 0, -1]))
add('abdomen', N('abdominal-veins', 'Abdominal veins', '', 'vein', 'Renal, splenic, mesenteric and iliac veins.', 'Return blood toward the inferior vena cava and the liver.', ex=[-0.3, 0, -1]))
add('pancreas', N('pancreatic-duct', 'Pancreatic duct', '', 'endocrine', 'The main duct running the length of the pancreas.', 'Carries digestive enzymes into the duodenum.', ex=[0, 0, 1]))
# pelvis
find('reproductive').update(name='Reproductive organs (male model)', what='The prostate, seminal vesicles, vas deferens, testes and penis of this male body model.', does='Make testosterone and sperm and deliver semen.')
add('pelvis', N('gluteal-muscles', 'Gluteal muscles', 'Buttock muscles', 'muscle', 'Gluteus maximus, medius and minimus plus the deep hip rotators.', 'Extend and steady the hip. Gluteus medius keeps the pelvis level when you stand on one leg.', ex=[0, 0, -1.3]))
add('pelvis', N('urethra', 'Urethra', '', 'urinary', 'The tube carrying urine out of the bladder, about 18 to 20 cm long in males.', 'Drains the bladder. It passes through the prostate and pelvic floor.', ex=[0, -1, 0.5]))
add('pelvis', N('pubic-hair', 'Pubic hair', '', 'skin', 'Coarse hair over the pubic region.', 'Reduces friction and holds scent signals.', attach=True))
# head
for k in ['eye-left', 'eye-right']: remove(k)
add('head', N('eyes', 'Eyeballs', 'Eyes', 'nerve', 'Two globes about 24 mm across with three layers: sclera, uvea and retina.', 'Focus light on the retina, which sends signals down the optic nerves to the occipital lobes.', ex=[0, 0, 1], care='Wear UV-blocking sunglasses, take screen breaks, and get eye exams. They can also reveal diabetes and high blood pressure.'))
add('head', N('teeth', 'Teeth', '', 'digest', 'Twenty-eight teeth in this model: incisors, canines, premolars and molars (wisdom teeth absent).', 'Cut, tear and grind food. Enamel is the hardest substance in the body.', ex=[0, -0.6, 1], care='Brush twice a day with fluoride toothpaste, clean between teeth, and see a dentist regularly.'))
add('head', N('mouth', 'Lips and gums', '', 'digest', 'The lips and the gingiva around the teeth.', 'Seal the mouth, shape speech and protect the tooth roots.', ex=[0, -0.4, 1]))
add('head', N('face-muscles', 'Muscles of facial expression', 'Face muscles', 'muscle', 'Thin muscles that attach to skin, all supplied by the facial nerve (VII).', 'Smile, frown, blink and shape the lips.', ex=[0, 0, 1.4]))
add('head', N('chewing-muscles', 'Muscles of chewing', 'Masseter and temporalis', 'muscle', 'Masseter, temporalis and the two pterygoids, supplied by the trigeminal nerve (V3).', 'Close, open and grind the jaw.', ex=[1, 0, 0]))
add('head', N('scalp-hair', 'Hair', 'Scalp hair and eyebrows', 'skin', 'Keratin fibres growing from about 100,000 scalp follicles, plus the eyebrows.', 'Protects the scalp from sun and cold. Eyebrows steer sweat away from the eyes.', attach=True))
add('head', N('outer-ears', 'Outer ears', 'Auricles', 'skin', 'Elastic cartilage covered in skin.', 'Funnel sound into the ear canal and help tell front from back.', attach=True))
add('head', N('galea', 'Galea aponeurotica', 'Scalp aponeurosis', 'ligament', 'A tough sheet over the skull joining the frontalis and occipitalis muscles.', 'Lets the scalp move and anchors the forehead muscle.', ex=[0, 1, 0]))
find('nasal-cavity').update(name='Nose and nasal cavity', what='Nasal bones, cartilages and three turbinates on each side, split by the septum.')
for lobe, nm, what in [('limbic-system', 'Limbic system', 'The cingulate gyrus, hippocampus, amygdala, fornix and mammillary bodies.'),
                       ('deep-brain', 'Deep brain nuclei', 'The thalamus, hypothalamus, caudate, putamen, globus pallidus and pineal body.'),
                       ('white-matter', 'White matter', 'The corpus callosum, internal capsule and commissures linking brain regions.'),
                       ('ventricles', 'Ventricles', 'Four connected fluid spaces inside the brain.'),
                       ('optic-pathway', 'Optic pathway', 'The optic nerves, chiasm and tracts.'),
                       ('insula-lobes', 'Insula', 'A lobe of cortex folded deep inside the lateral fissure.')]:
    does = {'limbic-system': 'Handles emotion, motivation and the forming of new memories.', 'deep-brain': 'Relays sensation (thalamus), runs hormones and body temperature (hypothalamus) and fine-tunes movement (basal ganglia).',
            'white-matter': 'Carries signals between the two hemispheres and between cortex and brainstem.', 'ventricles': 'Make and circulate cerebrospinal fluid, which cushions the brain.',
            'optic-pathway': 'Carries signals from both eyes to the thalamus and visual cortex. Fibres from the inner half of each retina cross at the chiasm.',
            'insula-lobes': 'Senses taste, heartbeat, gut feelings and disgust.'}[lobe]
    add('brain', N(lobe, nm, '', 'nerve', what, does, ex=None))
find('heart')['conn'] = ['aorta', 'pulmonary-trunk', 'lung-left', 'lung-right', 'brainstem']
find('esophagus')['conn'] = ['stomach', 'heart-wall']
find('femoral-artery-left')['conn'] = ['abdominal-arteries']; find('femoral-artery-right')['conn'] = ['abdominal-arteries']
for k in ['kidney-left', 'kidney-right']: find(k)['conn'] = ['abdominal-arteries', 'ivc', 'adrenal-' + k.split('-')[1]]
find('aorta')['conn'] = ['carotid-left', 'abdominal-arteries']
find('lung-left')['conn'] = ['bronchi', 'pulmonary-trunk', 'heart']; find('lung-right')['conn'] = ['bronchi', 'pulmonary-trunk', 'heart']
for s in ['left', 'right']:
    for k in ['femoral-condyles-', 'tibial-plateau-']: remove(k + s)

# ---------- matching rules (first match wins) ----------
R = [
 ('skin-region', r'^skin$'), ('scalp-hair', r'head hairs|eyebrows'), ('pubic-hair', r'pubic hairs'), ('outer-ears', r'^ear$'),
 ('mouth', r'gingiva|labial part'), ('teeth', r'tooth'), ('eyes', r'eyeball'), ('galea', r'epicranius'),
 ('nasal-cavity', r'nasal (bone|cartilage)|nasal concha'),
 ('mandible', r'^mandible$'),
 ('skull', r'frontal bone|parietal bone|occipital bone|temporal bone|sphenoid|ethmoid|maxilla|zygomatic bone|lacrimal|palatine bone|vomer|skull|cranium'),
 ('chewing-muscles', r'masseter|temporalis|pterygoid'),
 ('face-muscles', r'frontalis|occipitalis|orbicularis|zygomaticus|risorius|buccinator|levator labii|depressor|mentalis|nasalis|procerus|corrugator|levator anguli|auricular|platysma'),
 ('frontal-lobe', r'frontal gyrus|precentral|orbital gyri|straight gyrus'), ('parietal-lobe', r'postcentral|supramarginal|angular gyrus|parietal lobule|precuneus'),
 ('temporal-lobe-{s}', r'temporal gyrus|fusiform'), ('occipital-lobe', r'occipital lobe'), ('cerebellum', r'cerebellum'),
 ('brainstem', r'midbrain|pons|medulla oblongata|cerebral peduncle|colliculus|interpeduncular'),
 ('limbic-system', r'cingulate|hippocamp|amygdala|fornix|mammillary|parahippocampal|stria terminalis'),
 ('deep-brain', r'thalamus|hypothalamus|caudate|putamen|pallidus|pineal|habenula|geniculate|tuber cinereum|stria medullaris'),
 ('white-matter', r'corpus callosum|internal capsule|commissure|white matter|septum pellucidum|lamina terminalis'),
 ('ventricles', r'ventricle|aqueduct|choroid|central canal|interventricular foramen'),
 ('optic-pathway', r'optic'), ('insula-lobes', r'insula|short gyrus'), ('pituitary', r'pituitary'),
 ('cervical-spine', r'cervical vertebra|^atlas|^axis$|disk of axis|disk of .* cervical'), ('larynx', r'thyroid cartilage'),
 ('carotid-{s}', r'common carotid'), ('jugular-{s}', r'internal jugular'),
 ('heart-wall', r'wall of heart'), ('heart-valves', r'valve'), ('papillary-muscles', r'papillary'),
 ('coronary-arteries', r'coronary artery|of left coronary|of right coronary'), ('cardiac-veins', r'cardiac vein|coronary sinus|veins of left ventricle'),
 ('aorta', r'aorta'), ('pulmonary-trunk', r'pulmonary artery'), ('pulmonary-veins', r'pulmonary vein'),
 ('lung-left-upper', r'upper lobe of left lung'), ('lung-left-lower', r'lower lobe of left lung'), ('lung-right-upper', r'upper lobe of right lung'),
 ('lung-right-middle', r'middle lobe of right lung'), ('lung-right-lower', r'lower lobe of right lung'),
 ('trachea', r'^trachea'), ('bronchi', r'bronchus'), ('esophagus', r'esophagus'), ('diaphragm', r'diaphragm'), ('thymus', r'thymus'),
 ('intercostals', r'intercostal muscle'),
 ('great-vessels', r'superior vena cava|brachiocephalic|subclavian'),
 ('sternum', r'manubrium|body of sternum|xiphoid'), ('rib-cage', r'\brib$|costal cartilage'),
 ('thoracic-spine', r'thoracic vertebra'), ('lumbar-spine', r'lumbar vertebra'),
 ('liver', r'^liver'), ('gallbladder', r'gallbladder'), ('stomach', r'^stomach'), ('spleen', r'spleen'), ('pancreatic-duct', r'pancreatic duct'), ('pancreas', r'^pancreas'),
 ('duodenum', r'duodenum'), ('jejunum', r'jejunum'), ('ileum', r'ileum'), ('appendix', r'appendix'), ('taeniae-coli', r'taenia'), ('large-intestine', r'^colon'),
 ('kidney-{s}', r'kidney'), ('ureter-{s}', r'ureter'), ('adrenal-{s}', r'adrenal'), ('ivc', r'inferior vena cava'),
 ('abdominal-arteries', r'celiac|mesenteric artery|renal artery|iliac artery|hepatic artery|splenic artery|gastric artery'),
 ('abdominal-veins', r'renal vein|splenic vein|mesenteric vein|iliac vein'),
 ('abdominal-wall', r'oblique|rectus abdominis|transversus abdominis|pyramidalis|linea alba'),
 ('bladder', r'urinary bladder'), ('urethra', r'urethra'), ('rectum', r'rectum'),
 ('reproductive', r'prostate|seminal|deferent|testis|epididymis|penis'),
 ('pelvic-floor', r'levator ani|coccygeus|puborectalis|pubococcygeus|iliococcygeus|anal sphincter|tendinous arch'),
 ('hip-bone-{s}', r'hip bone'), ('sacrum', r'sacrum|coccyx'),
 ('gluteal-muscles', r'gluteus|piriformis|gemellus|obturator|quadratus femoris'),
 ('clavicle-{s}', r'clavicle'), ('scapula-{s}', r'scapula'), ('deltoid-{s}', r'deltoid'),
 ('rotator-cuff-{s}', r'supraspinatus|infraspinatus|teres minor|subscapularis'),
 ('humerus-{s}', r'humerus'), ('biceps-{s}', r'biceps brachii'), ('triceps-{s}', r'triceps'),
 ('radius-{s}', r'^(left|right) radius$'), ('ulna-{s}', r'^(left|right) ulna$'),
 ('forearm-flexors-{s}', r'flexor carpi|palmaris longus|flexor digitorum superficialis|flexor digitorum profundus|flexor pollicis longus|pronator'),
 ('forearm-extensors-{s}', r'extensor carpi|extensor digitorum|extensor digiti minimi|extensor indicis|extensor pollicis|abductor pollicis longus|brachioradialis|supinator|anconeus'),
 ('carpals-{s}', r'scaphoid|lunate|triquetral|pisiform|trapezium|trapezoid|capitate|hamate'),
 ('thumb-{s}', r'phalanx of (left|right) thumb|first metacarpal'), ('metacarpals-{s}', r'metacarpal'), ('fingers-{s}', r'phalanx of .*(finger)'),
 ('femur-{s}', r'^(left|right) femur$'), ('patella-{s}', r'patella'), ('tibia-{s}', r'^(left|right) tibia$'), ('fibula-{s}', r'^(left|right) fibula$'),
 ('quadriceps-{s}', r'rectus femoris|vastus'), ('hamstrings-{s}', r'biceps femoris|semitendinosus|semimembranosus'),
 ('adductors-{s}', r'adductor (longus|brevis|magnus|minimus)|gracilis|pectineus'),
 ('calf-{s}', r'gastrocnemius|soleus|plantaris'), ('tibialis-anterior-{s}', r'tibialis anterior'), ('achilles-{s}', r'calcaneal tendon'),
 ('talus-{s}', r'\btalus'), ('calcaneus-{s}', r'\bcalcaneus'), ('metatarsals-{s}', r'metatarsal'), ('toes-{s}', r'phalanx of .*toe'),
]
assign = {}
for p in parts:
    n = p['name'].lower()
    for nid, rx in R:
        if re.search(rx, n):
            if '{s}' in nid:
                s = p['side'] or ('left' if p['center'][0] > 0 else 'right'); nid = nid.replace('{s}', s)
            if nid == 'skin-region' or nid in NODES: assign[p['fma']] = nid; break
    p['node'] = assign.get(p['fma'])

# ---------- skin split ----------
SKIN_NODES = ['head', 'neck', 'thorax', 'abdomen', 'pelvis'] + [a + '-' + s for s in ['left', 'right'] for a in ['shoulder', 'upper-arm', 'elbow', 'forearm', 'hand', 'thigh', 'knee', 'leg', 'foot']]
geom = {}   # node id -> (V,F)
skin = next(p for p in parts if p['name'] == 'Skin')
cent = skin['V'][skin['F']].mean(1); lab = bl[tree.query(cent)[1]]
regs = np.array([region_of(c, l) for c, l in zip(cent, lab)])
SKT = {'head': 36000, 'neck': 6000, 'thorax': 14000, 'abdomen': 12000, 'pelvis': 9000}
for r in SKIN_NODES:
    m = regs == r
    if not m.any(): continue
    F = skin['F'][m]; used = np.unique(F); remap = -np.ones(len(skin['V']), int); remap[used] = np.arange(len(used))
    V2, F2 = skin['V'][used], remap[F].astype(np.int32)
    t = SKT.get(r) or (7000 if r.startswith('hand') else 5000 if r.startswith('foot') else 3200)
    import pyfqmr
    sim = pyfqmr.Simplify(); sim.setMesh(V2.astype(np.float64), F2)
    sim.simplify_mesh(target_count=int(t), aggressiveness=6, preserve_border=True, verbose=False)
    v3, f3, _ = sim.getMesh(); geom[r] = (v3.astype(np.float32), f3.astype(np.int32))
print('skin pieces', {k: len(v[1]) for k, v in geom.items()})

# ---------- build leaves ----------
CAT = {'muscle': 'Skeletal muscle. It contracts to move or steady the bones it attaches to.',
       'bone': 'Bone. It gives the body its frame, protects softer tissue and anchors muscles.',
       'ligament': 'Connective tissue that binds, cushions or transmits force between structures.',
       'artery': 'Carries blood away from the heart.', 'vein': 'Carries blood back toward the heart.',
       'nerve': 'Part of the nervous system, carrying or processing signals.', 'cardio': 'Part of the heart\'s pumping structure.',
       'resp': 'Part of the respiratory system.', 'digest': 'Part of the digestive system.', 'urinary': 'Part of the urinary system.',
       'endocrine': 'Part of the endocrine system.', 'lymph': 'Part of the immune system.', 'repro': 'Part of the reproductive system.', 'skin': 'Part of the body surface.'}
RNAME = {r: NODES[r]['name'] for r in SKIN_NODES}
def leaf(p, parent):
    ch = [c for c in p['chain'] if c.lower() != p['name'].lower() and not c.startswith('http')]
    cat = ch[0] if ch else ''
    region = region_of(p['center'])
    what = (f'{p["name"]} is classed as: {cat.lower()}.' if cat else p['name'] + '.') + f' Found in the {RNAME[region].lower()}.'
    return N('fma' + p['fma'], p['name'], '', p['sys'], what, CAT.get(p['sys'], ''), auto=True, fma=p['fma'])
GROUPW = {'muscle': 'muscles', 'bone': 'bones', 'ligament': 'ligaments and cartilage', 'artery': 'arteries', 'vein': 'veins', 'nerve': 'nervous structures',
          'cardio': 'heart structures', 'resp': 'airway structures', 'digest': 'digestive structures', 'urinary': 'urinary structures', 'endocrine': 'glands', 'lymph': 'immune organs', 'repro': 'reproductive structures', 'skin': 'surface structures'}
mapped = {}
for p in parts:
    if p['name'] == 'Skin': continue
    mapped.setdefault(p['node'] or ('@' + region_of(p['center'])), []).append(p)
for nid, ps in mapped.items():
    if nid.startswith('@'):
        reg = nid[1:]; bysys = {}
        for p in ps: bysys.setdefault(p['sys'], []).append(p)
        for sk, lst in bysys.items():
            target = reg
            if len(lst) >= 3:
                gid = reg + '-' + sk + 's'
                if gid not in NODES:
                    add(reg, N(gid, (RNAME[reg] + ' ' + GROUPW[sk]).replace('Thorax', 'Chest').replace('Abdomen', 'Abdominal'), '', sk,
                               f'The {GROUPW[sk]} of the {RNAME[reg].lower()} not covered by the other groups here: {len(lst)} parts.',
                               'Open it to see each one by name.', auto=True))
                target = gid
            for p in lst:
                lf = add(target, leaf(p, target)); geom[lf['id']] = (p['V'], p['F'])
        continue
    node = NODES[nid]
    if len(ps) == 1 and not node.get('_haskid'):
        geom[nid] = (ps[0]['V'], ps[0]['F']); node['shapes'] = []
    else:
        node['shapes'] = []
        for p in ps:
            lf = add(nid, leaf(p, nid)); geom[lf['id']] = (p['V'], p['F'])

# ---------- reposition stand-ins ----------
def shape_center(n):
    pts = []
    for sp in n['shapes']:
        if sp['t'] == 'e' or sp['t'] == 't': pts.append(sp['c'])
        else: pts += [sp['a'], sp['b']]
    return np.mean(pts, 0) if pts else None
def real_center(nid):
    ids = []
    def coll(n):
        if n['id'] in geom: ids.append(n['id'])
        for k in n['kids']: coll(k)
    coll(NODES[nid])
    if not ids: return None
    V = np.concatenate([geom[i][0] for i in ids]); return (V.min(0) + V.max(0)) / 2
orig = {}
def worig(n):
    orig[n['id']] = shape_center(n); [worig(k) for k in n['kids']]
cur0 = json.load(open('/home/claude/lenati/curated.json'))['BODY']; worig(cur0)
ANCH = {}
for s in ['left', 'right']:
    for k in ['medial-meniscus-', 'lateral-meniscus-', 'acl-', 'pcl-', 'mcl-', 'lcl-']: ANCH[k + s] = 'patella-' + s
    for k in ['renal-cortex-', 'renal-medulla-', 'renal-pelvis-']: ANCH[k + s] = 'kidney-' + s
    for k in ['sciatic-nerve-', 'femoral-artery-']: ANCH[k + s] = 'femur-' + s
    for k in ['arm-nerves-', 'brachial-artery-']: ANCH[k + s] = 'humerus-' + s
    ANCH['plantar-fascia-' + s] = 'calcaneus-' + s
for k in ['nephron', 'glomerulus', 'proximal-tubule', 'loop-of-henle', 'distal-tubule', 'collecting-duct']: ANCH[k] = 'kidney-left'
for k in ['epiglottis', 'vocal-cords', 'thyroid', 'pharynx']: ANCH[k] = 'larynx'
ANCH['tongue'] = 'mandible'; ANCH['ear-left'] = ANCH['ear-right'] = 'skull'; ANCH['sa-node'] = 'heart'
standins = []
for nid, n in NODES.items():
    if not n['shapes']: continue
    a = ANCH.get(nid)
    if not a: standins.append(nid); continue
    rc = real_center(a); oc = orig.get(a)
    if a == 'heart': oc = np.array([0.025, 1.29, 0.03])
    if a == 'skull': oc = np.array([0, 1.655, -0.005])
    if rc is None or oc is None: standins.append(nid + '(noanchor)'); continue
    d = (rc - oc)
    for sp in n['shapes']:
        for key in ('c', 'a', 'b'):
            if key in sp: sp[key] = (np.array(sp[key]) + d).round(4).tolist()
for nid in standins:
    if '(' not in nid: NODES[nid]['shapes'] = []
print('cleared stand-ins:', len(standins))

# ---------- write GLBs per top region ----------
top = {}
def mark(n, t):
    top[n['id']] = t
    for k in n['kids']: mark(k, t if t else n['id'])
for k in BODY['kids']: mark(k, k['id'])
scenes = {}
for nid, (V, F) in geom.items():
    t = top[nid]
    mesh = trimesh.Trimesh(V, F, process=True)
    mesh.merge_vertices()
    _ = mesh.vertex_normals
    scenes.setdefault(t, trimesh.Scene()).add_geometry(mesh, node_name=nid, geom_name=nid)
    NODES[nid]['mesh'] = t
for t, sc in scenes.items():
    sc.export(OUT + '/raw-' + t + '.glb', include_normals=True)

# ---------- write tree ----------
def clean(n):
    n.pop('parent', None); n.pop('_haskid', None)
    for k in n['kids']: clean(k)
clean(BODY)
for pas in cur['PASSAGES'].values():
    pas['spots'] = [[{'bronchus-left': 'bronchi', 'bronchus-right': 'bronchi', 'left-atrium': 'heart-wall', 'stomach-fundus': 'stomach', 'stomach-body': 'stomach', 'stomach-pylorus': 'stomach'}.get(s[0], s[0])] + s[1:] for s in pas['spots']]
    pas['spots'] = [s for s in pas['spots'] if s[0] in NODES]
te = cur['TUNNEL_ENTRY']; te['bronchi'] = ['bronchus-l', 0.1]
for k in ['bronchus-left', 'bronchus-right']: te.pop(k, None)
cur['BODY'] = BODY
cnt = len(NODES)
json.dump(cur, open('/home/claude/lenati/tree.json', 'w'), separators=(',', ':'))
print('nodes', cnt, 'meshes', len(geom), 'tris', sum(len(g[1]) for g in geom.values()))
