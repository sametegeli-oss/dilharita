import sys
from PIL import Image
D='/home/claude/dilharita/assets/avatars_v4/teacher/'
bg=(22,28,38,255); k=[x.split(':') for x in sys.argv[1:]]
out=Image.new('RGB',(400*4,305*((len(k)+3)//4)))
for i,(d,v) in enumerate(k):
  b=Image.open(D+f'duygu-{d}.webp').convert('RGBA'); c=Image.new('RGBA',b.size,bg); c.alpha_composite(b)
  p=Image.open(D+f'{d}-{v}.webp').convert('RGBA'); c.alpha_composite(p,(261,268) if v=='kirp' else (237,404))
  out.paste(c.convert('RGB').crop((180,360,600,680)).resize((400,305)),((i%4)*400,(i//4)*305))
out.save('/tmp/gor.png')
