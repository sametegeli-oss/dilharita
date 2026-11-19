import json, numpy as np, cv2, os, sys
from PIL import Image
from rembg import remove, new_session
D='/home/claude/dilharita/assets/avatars_v4/teacher/'
G='/tmp/fa/yeni2/'
L=json.load(open('/tmp/fa/landmarks3.json'))
face=json.load(open(D+'face.json'))
REF=np.array(face['noktalar68'],float)
ST=list(range(27,36))+[0,1,2,14,15,16,36,39,42,45]
ses=new_session('isnet-general-use')
def sim(src,dst):
    mu_s,mu_d=src.mean(0),dst.mean(0); a=src-mu_s; b=dst-mu_d
    U,S,Vt=np.linalg.svd(a.T@b); R=(U@Vt).T
    if np.linalg.det(R)<0: Vt[-1]*=-1; R=(U@Vt).T
    s=S.sum()/(a**2).sum(); t=mu_d-s*R@mu_s
    return np.hstack([s*R,t[:,None]])
def hizala(ad, hedef):
    P=np.array(L[ad],float); M=sim(P[ST],hedef[ST])
    im=np.array(Image.open(G+ad+'.png').convert('RGB'))
    w=cv2.warpAffine(im,M,(768,768),flags=cv2.INTER_AREA if M[0,0]<1 else cv2.INTER_CUBIC,borderMode=cv2.BORDER_REPLICATE)
    return w,(M[:,:2]@P.T).T+M[:,2]
def on_plan(ad,rgb):
    yol=f'/tmp/fa/fg/{ad}.png'
    if os.path.exists(yol): return np.array(Image.open(yol)).astype(np.float32)/255
    o=np.array(remove(Image.fromarray(rgb),session=ses,post_process_mask=False))[...,3]
    Image.fromarray(o).save(yol); return o.astype(np.float32)/255
def daralt(m01,px,blur):
    k=cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(2*px+1,2*px+1))
    return cv2.GaussianBlur(cv2.erode((m01*255).astype(np.uint8),k).astype(np.float32),(0,0),blur)/255
def maske_agiz(Q):
    m=np.zeros((768,768),np.float32); jaw=Q[3:14]; ust=np.array([[Q[13][0],Q[33][1]+4],[Q[3][0],Q[33][1]+4]])
    cv2.fillPoly(m,[np.vstack([jaw,ust]).astype(np.int32)],1); return cv2.GaussianBlur(m,(0,0),9)
def maske_goz(Q):
    m=np.zeros((768,768),np.float32)
    for ids in ([36,37,38,39,40,41],[42,43,44,45,46,47]):
        c=Q[ids].mean(0); w=(Q[ids][:,0].max()-Q[ids][:,0].min())*0.85; h=w*0.55
        cv2.ellipse(m,(int(c[0]),int(c[1])),(int(w),int(h)),0,0,360,1,-1)
    return cv2.GaussianBlur(m,(0,0),6)
def renk_esle(src,dst,m):
    band=(m>0.05)&(m<0.6)
    if band.sum()<50: return src
    out=src.astype(np.float32)
    for c in range(3): out[...,c]*=(dst[...,c][band].mean()+1)/(src[...,c][band].mean()+1)
    return np.clip(out,0,255).astype(np.uint8)
def rampa(h,w,k=24):
    y=np.minimum(np.arange(h),np.arange(h)[::-1]); x=np.minimum(np.arange(w),np.arange(w)[::-1])
    r=np.minimum(np.clip(y/k,0,1)[:,None],np.clip(x/k,0,1)[None,:]); return r*r*(3-2*r)
AG=(237,404,593,650); GZ=(261,268,552,355)
duyguDosya={k:v['dosya'] for k,v in face['duygular'].items()}
alfa={f:np.array(Image.open(D+f).convert('RGBA'))[...,3].astype(np.float32)/255 for f in duyguDosya.values()}
def yama(src,base,m,k,yol):
    x0,y0,x1,y1=k; s=renk_esle(src,base,m); mm=m[y0:y1,x0:x1]*rampa(y1-y0,x1-x0)
    Image.fromarray(np.dstack([s[y0:y1,x0:x1],(mm*255).astype(np.uint8)]),'RGBA').save(yol,quality=86,method=6)
SESLER=['a','e','i','o','u','mbp','fv','l','th','sz','sc','tdn','kg']
for d in sys.argv[1:]:
    brgb,bQ=hizala('duygu-'+d,REF)
    kull=[x for x,s in face['duyguAgiz'].items() if s==d] or [d]
    sil=daralt(np.minimum.reduce([alfa[duyguDosya[x]] for x in kull])>0.8,7,3)
    set_={}
    for v in SESLER:
        ad=f'{d}-{v}'
        if ad not in L or not L[ad]: continue
        rgb,Q=hizala(ad,bQ); fg=daralt(on_plan(ad,rgb)>0.5,6,3)
        m=np.maximum(maske_agiz(Q),maske_agiz(bQ))*fg*sil
        yama(rgb,brgb,m,AG,D+f'{ad}.webp'); set_[v]={'dosya':f'{ad}.webp','x':AG[0],'y':AG[1]}
    if set_: face['agizSetleri'][d]=set_
    ad=f'{d}-kirp'
    if ad in L and L[ad]:
        kk=[x for x,s in face['duyguKirpma'].items() if s==d] or [d]
        silk=daralt(np.minimum.reduce([alfa[duyguDosya[x]] for x in kk])>0.8,7,3)
        rgb,Q=hizala(ad,bQ); fg=daralt(on_plan(ad,rgb)>0.5,6,3)
        m=np.maximum(maske_goz(Q),maske_goz(bQ))*fg*silk
        yama(rgb,brgb,m,GZ,D+f'{ad}.webp'); face['kirpma'][d]={'dosya':f'{ad}.webp','x':GZ[0],'y':GZ[1]}
    print(d,sorted(set_), 'kirp' if d in face['kirpma'] else '', flush=True)
json.dump(face,open(D+'face.json','w'),ensure_ascii=False,separators=(',',':'))
