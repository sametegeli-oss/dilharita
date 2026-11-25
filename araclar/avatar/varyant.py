import numpy as np,glob,os,subprocess
from PIL import Image
F=[np.array(Image.open(f)).astype(np.float32) for f in sorted(glob.glob('/tmp/fa/u2/*.png'))]
T='/home/claude/dilharita/assets/avatars_v4/teacher/'
for ad,a,b in (('bas-sag-az',17,69),('bas-sag-orta',24,63)):
    a-=1;b-=1; seq=F[:a+1]
    seq+=[F[a]]*2                  # ~0.1 sn bekleme
    seq+=F[a-1::-1]                # dönüş = gidişin tersi: ek yeri yok, son kare taban
    d='/tmp/fa/'+ad; os.makedirs(d,exist_ok=True)
    for i,f in enumerate(seq): Image.fromarray(f.astype(np.uint8)).save(d+'/%03d.png'%(i+1))
    subprocess.run(['ffmpeg','-v','error','-y','-framerate','20','-i',d+'/%03d.png','-c:v','libvpx-vp9','-pix_fmt','yuva420p','-b:v','0','-crf','32','-an',T+ad+'.webm'],check=True)
    print(ad,len(seq),os.path.getsize(T+ad+'.webm'))
