import sys,glob,os
from PIL import Image,ImageDraw
files=sys.argv[3:]; out=sys.argv[1]; kirp=int(sys.argv[2])
per=6
for g in range(0,len(files),per):
    ims=[]
    for f in files[g:g+per]:
        im=Image.open(f).convert('RGB'); im=im.crop((0,0,im.width,min(im.height,kirp)))
        ims.append((os.path.basename(f),im))
    cols=3; rows=(len(ims)+cols-1)//cols
    W=360; H=kirp
    o=Image.new('RGB',(cols*(W+8),rows*(H+22)),'white'); d=ImageDraw.Draw(o)
    for k,(n,im) in enumerate(ims):
        x=(k%cols)*(W+8); y=(k//cols)*(H+22)
        d.text((x+2,y+2),n[:55],fill='black'); o.paste(im,(x,y+20))
    o=o.resize((o.width*6//10,o.height*6//10))
    o.save(f'{out}-{g//per+1:02d}.png')
print('ok')
