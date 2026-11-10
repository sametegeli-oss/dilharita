import json,sys
d=sys.argv[1]; r=json.load(open(d+'/sonuc.json'))
filt=sys.argv[2] if len(sys.argv)>2 else ''
for x in sorted(r,key=lambda x:(x['sayfa'],x['seviye'],x.get('yol'))):
  if filt and x['sayfa']!=filt: continue
  f=[]
  if x.get('atlandi'): f.append('ATLANDI:'+x['atlandi'])
  if x.get('tiklanamadi'): f.append('TIKLANAMADI:'+x['tiklanamadi'][:110])
  if x['hatalar']: f.append('HATA:'+' | '.join(x['hatalar'])[:200])
  if x['diyaloglar']: f.append('DIYALOG:'+' | '.join(x['diyaloglar'])[:160])
  if x['indirmeler']: f.append('INDIR:'+','.join(x['indirmeler']))
  if x.get('yeniSekme'): f.append('SEKME:'+x['yeniSekme'][:60])
  if x.get('gidilen'): f.append('→'+x['gidilen'])
  for p in x.get('yeniPencereler') or []: f.append(f"PENCERE:{p['kim']} {p['w']}x{p['h']}"+(' SIGMIYOR' if p['sigmiyor'] else '')+('' if p['kapat'] else ' KAPATYOK'))
  if x.get('etkisiz'): f.append('ETKISIZ')
  if x.get('kucukHedef'): f.append('KUCUKHEDEF '+str(x.get('boyut')))
  if x.get('tasma'): f.append(f"TASMA:{x['tasma']}")
  if x.get('kucukYazi'): f.append('KUCUKYAZI:'+';'.join(x['kucukYazi'][:3]))
  if x.get('yeniDugmeler'): f.append(f"+{len(x['yeniDugmeler'])}düğme")
  print(x['sayfa'], ' > '.join(m[:28] for m in x['yol']), '::', '  '.join(f))
