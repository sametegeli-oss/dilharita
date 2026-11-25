import json,numpy as np,cv2,os,glob
from PIL import Image
from rembg import remove,new_session
D='/home/claude/dilharita/assets/avatars_v4/teacher/'
face=json.load(open(D+'face.json')); REF=np.array(face['noktalar68'],float)
P=np.array(json.load(open('/tmp/fa/landmarks3.json'))['sac-0'],float)
ST=list(range(27,36))+[0,1,2,14,15,16,36,39,42,45]
def sim(src,dst):
    ms,md=src.mean(0),dst.mean(0);a=src-ms;b=dst-md;U,S,Vt=np.linalg.svd(a.T@b);R=(U@Vt).T
    s=S.sum()/(a**2).sum();t=md-s*R@ms;return np.hstack([s*R,t[:,None]])
M=sim(P[ST],REF[ST]); ses=new_session('isnet-general-use'); os.makedirs('/tmp/fa/vo',exist_ok=True)
for f in sorted(glob.glob('/tmp/fa/vf/*.png')):
    im=np.array(Image.open(f).convert('RGB'))
    w=cv2.warpAffine(im,M,(768,768),flags=cv2.INTER_AREA,borderMode=cv2.BORDER_REPLICATE)
    a=np.array(remove(Image.fromarray(w),session=ses,post_process_mask=False))[...,3]
    Image.fromarray(np.dstack([w,a])).resize((512,512),Image.LANCZOS).save('/tmp/fa/vo/'+os.path.basename(f))
print('ok',M[0,0])
