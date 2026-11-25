import numpy as np,cv2,sys,glob,os
from PIL import Image
src,out=sys.argv[1],sys.argv[2]; os.makedirs(out,exist_ok=True)
B=np.array(Image.open('/home/claude/dilharita/assets/avatars_v4/teacher/base.webp').convert('RGBA').resize((512,512),Image.LANCZOS))
g1=cv2.cvtColor(B[...,:3],cv2.COLOR_RGB2GRAY).astype(np.float32)
m=np.zeros((512,512),np.uint8); m[60:380,120:400]=1
fs=sorted(glob.glob(src+'/*.png')); P=[]
for f in fs:
    F=np.array(Image.open(f).convert('RGBA')); g2=cv2.cvtColor(F[...,:3],cv2.COLOR_RGB2GRAY).astype(np.float32)
    p=None
    try:
        _,W=cv2.findTransformECC(g1,g2,np.eye(2,3,dtype=np.float32),cv2.MOTION_AFFINE,(cv2.TERM_CRITERIA_EPS|cv2.TERM_CRITERIA_COUNT,150,1e-6),m,5)
        s=np.sqrt(abs(np.linalg.det(W[:,:2])))
        if 0.96<s<1.04 and np.abs(W[:,2]).max()<25 and np.abs(np.abs(W[0,0])-np.abs(W[1,1]))<0.03:
            r=(warped:=cv2.warpAffine(F[...,:3],W,(512,512),flags=cv2.WARP_INVERSE_MAP))
            if np.abs(cv2.cvtColor(r,cv2.COLOR_RGB2GRAY).astype(float)-g1)[m>0].mean()<14: p=[s,W[0,2],W[1,2]]
    except cv2.error: pass
    P.append(p)
idx=[i for i,p in enumerate(P) if p]; print('guvenilir',len(idx),'/',len(P))
A=np.array([P[i] for i in idx]); full=np.stack([np.interp(range(len(P)),idx,A[:,j]) for j in range(3)],1)
k=np.ones(5)/5; full=np.stack([np.convolve(np.pad(full[:,j],2,mode='edge'),k,mode='valid') for j in range(3)],1)
for f,(s,tx,ty) in zip(fs,full):
    W=np.array([[s,0,tx],[0,s,ty]],np.float32)
    F=np.array(Image.open(f).convert('RGBA'))
    Image.fromarray(cv2.warpAffine(F,W,(512,512),flags=cv2.INTER_LINEAR|cv2.WARP_INVERSE_MAP,borderMode=cv2.BORDER_REPLICATE)).save(out+'/'+os.path.basename(f))
print('ilk',full[0].round(3),'son',full[-1].round(3),'max kayma',np.abs(full[:,1:]).max().round(1))
