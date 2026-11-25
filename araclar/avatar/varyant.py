"""Dönüş videosundan az/orta/tam (en fazla ~%95) varyantlar: gidiş + 0,1 sn bekleme + gidişin tersi.
Kullanım: python3 varyant.py <kare_klasörü> <önek> [az orta tam kare numaraları]  ör: /tmp/fa/u2 bas-sag 17 24 30"""
import numpy as np,glob,os,subprocess,sys,shutil
from PIL import Image
src,onek=sys.argv[1],sys.argv[2]; ns=[int(x) for x in sys.argv[3:6]]
F=[np.array(Image.open(f)).astype(np.float32) for f in sorted(glob.glob(src+'/*.png'))]
T='/home/claude/dilharita/assets/avatars_v4/teacher/'
for ad,a in ((onek+'-az',ns[0]),(onek+'-orta',ns[1]),(onek,ns[2])):
    a-=1; seq=F[:a+1]+[F[a]]*2+F[a-1::-1]
    d='/tmp/fa/'+ad; shutil.rmtree(d,ignore_errors=True); os.makedirs(d)
    for i,f in enumerate(seq): Image.fromarray(f.astype(np.uint8)).save(d+'/%03d.png'%(i+1))
    subprocess.run(['ffmpeg','-v','error','-y','-framerate','20','-i',d+'/%03d.png','-c:v','libvpx-vp9','-pix_fmt','yuva420p','-b:v','0','-crf','32','-an',T+ad+'.webm'],check=True)
    print(ad,len(seq),os.path.getsize(T+ad+'.webm'))
