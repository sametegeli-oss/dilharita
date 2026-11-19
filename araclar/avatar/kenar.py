import json, numpy as np, cv2
from PIL import Image
D='/home/claude/dilharita/assets/avatars_v4/teacher/'
face=json.load(open(D+'face.json'))
def oku(f): return np.array(Image.open(D+f).convert('RGBA'))
def yaz(a,f,q=86): Image.fromarray(a,'RGBA').save(D+f,quality=q,method=6)
# 1) taban fotoğraflar: kenar renklerini içeriden doldur, alfayı 1 px daralt
tabanlar=['base.webp']+[v['dosya'] for v in face['duygular'].values()]
alfa={}
for f in tabanlar:
    a=oku(f); al=a[...,3]
    ic=(al>=250).astype(np.uint8)
    kenar=((al>0)&(al<250)).astype(np.uint8)
    kenar=cv2.dilate(kenar,np.ones((3,3),np.uint8))&(al>0)
    rgb=cv2.inpaint(a[...,:3].copy(),(kenar&(1-ic)).astype(np.uint8)*255,4,cv2.INPAINT_TELEA) if kenar.any() else a[...,:3]
    # dış kenar pikselleri içerideki en yakın renkle
    al2=cv2.erode(al,np.ones((3,3),np.uint8))
    al2=((al.astype(np.float32)*0.35+al2.astype(np.float32)*0.65)).astype(np.uint8)
    a2=np.dstack([rgb,al2]); yaz(a2,f,84 if f!='base.webp' else 88); alfa[f]=al2
    print(f,'kenar pikseli',int(kenar.sum()))
# 2) yamalar: alfayı kullanıldığı taban(lar)ın silüetiyle sınırla
duyguDosya={k:v['dosya'] for k,v in face['duygular'].items()}
def tabanlarOf(set_):
    if set_=='__notr__': return ['base.webp']
    kull=[d for d,s in face.get('duyguAgiz',{}).items() if s==set_] or [set_]
    return [duyguDosya[d] for d in kull if d in duyguDosya] or ['base.webp']
def kirp(p, x, y, tbl):
    a=oku(p['dosya'] if isinstance(p,dict) else p); h,w=a.shape[:2]
    lim=np.minimum.reduce([alfa[t][y:y+h,x:x+w] for t in tbl]).astype(np.float32)/255
    lim=cv2.erode((lim*255).astype(np.uint8),np.ones((5,5),np.uint8)).astype(np.float32)/255   # silüetin 2 px içinde kal
    a[...,3]=(a[...,3].astype(np.float32)*lim).astype(np.uint8); return a
n=0
for s,set_ in face.get('agizSetleri',{}).items():
    for k,p in set_.items():
        if k=='th' and p['dosya'].endswith('-l.webp') and s!='mutlu': pass
        a=kirp(p,p['x'],p['y'],tabanlarOf(s)); yaz(a,p['dosya']); n+=1
for k,p in face.get('kirpma',{}).items():
    kull=[d for d,s in face.get('duyguKirpma',{}).items() if s==k] or [k]
    a=kirp(p,p['x'],p['y'],[duyguDosya[d] for d in kull if d in duyguDosya]); yaz(a,p['dosya']); n+=1
for k,p in face.get('parcalar',{}).items():
    if isinstance(p,dict) and 'dosya' in p and 'x' in p:
        a=kirp(p,p['x'],p['y'],['base.webp']+list(duyguDosya.values())); yaz(a,p['dosya']); n+=1
print('yama',n)
