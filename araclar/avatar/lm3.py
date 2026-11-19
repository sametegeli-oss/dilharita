import asyncio, json, os
from playwright.async_api import async_playwright
_old=json.load(open('/tmp/fa/landmarks3.json')) if os.path.exists('/tmp/fa/landmarks3.json') else {}
F=sorted(x[:-4] for x in os.listdir('/tmp/fa/yeni2') if x.endswith('.png') and x[:-4] not in _old)
print(len(F),'yeni')
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=swiftshader','--enable-unsafe-swiftshader'])
        pg=await b.new_page(); await pg.goto('http://localhost:8771/lm3.html'); await pg.wait_for_timeout(800)
        r=await pg.evaluate("F=>go(F)", F)
        old=json.load(open('/tmp/fa/landmarks3.json')) if os.path.exists('/tmp/fa/landmarks3.json') else {}
        old.update(r); json.dump(old,open('/tmp/fa/landmarks3.json','w'))
        print({k:(len(v) if v else None) for k,v in r.items()}); await b.close()
asyncio.run(main())
