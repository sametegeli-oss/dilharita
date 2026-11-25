import sys,glob,numpy as np
from PIL import Image
src,out=sys.argv[1],sys.argv[2]
B=np.array(Image.open('/home/claude/dilharita/assets/avatars_v4/teacher/base.webp').convert('RGBA').resize((512,512),Image.LANCZOS)).astype(np.float32)
F=[np.array(Image.open(f)).astype(np.float32) for f in sorted(glob.glob(src+'/*.png'))]
m=(B[...,3]>200)&(F[0][...,3]>200)
k=np.array([(B[...,c][m].mean()+1)/(F[0][...,c][m].mean()+1) for c in range(3)]); print('renk',k)
N=len(F); E=6
for i,f in enumerate(F):
    f[...,:3]=np.clip(f[...,:3]*k,0,255)
    w=0.0
    if i<E: w=1-i/E
    if i>=N-E: w=max(w,(i-(N-E-1))/E)
    w=w*w*(3-2*w)
    if i==0 or i==N-1: w=1
    g=f*(1-w)+B*w
    Image.fromarray(g.astype(np.uint8)).save(out+'/%03d.png'%(i+1))
print(N)
