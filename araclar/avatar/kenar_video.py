"""Video kareleri: saç/omuz kenarındaki beyaz fon artığını temizle (yarı saydam kenarı içeriden boya, alfayı ~2 px daralt)."""
import sys,glob,numpy as np,cv2
from PIL import Image
for f in sorted(glob.glob(sys.argv[1]+'/*.png')):
    a=np.array(Image.open(f).convert('RGBA')); rgb=a[...,:3].copy(); al=a[...,3]
    ic=(al>=245).astype(np.uint8)
    ic=cv2.erode(ic,np.ones((3,3),np.uint8))                       # kesin iç bölge
    bant=((al>0)&(ic==0)).astype(np.uint8)*255
    rgb=cv2.inpaint(rgb,bant,3,cv2.INPAINT_TELEA)                   # kenar rengi içeriden
    al2=cv2.erode(al,np.ones((3,3),np.uint8),iterations=1).astype(np.float32)
    al2=cv2.GaussianBlur(al2,(0,0),0.7)
    Image.fromarray(np.dstack([rgb,al2.clip(0,255).astype(np.uint8)])).save(f)
print('ok')
