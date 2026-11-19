"""Yeni duygu tabanları: Gemini fotoğrafını tabana (REF) hizala, arka planı sil, kenarı temizle, face.json'a ekle.
Kullanım: python3 isle4.py dinleyen:__notr__ sefkatli:anlayisli ...   (ad:ödünç ağız seti)"""
import json, sys, os, numpy as np, cv2
from PIL import Image
from rembg import remove, new_session
D = '/home/claude/dilharita/assets/avatars_v4/teacher/'
G = '/tmp/fa/yeni2/'
L = json.load(open('/tmp/fa/landmarks3.json'))
face = json.load(open(D + 'face.json'))
REF = np.array(face['noktalar68'], float)
ST = list(range(27, 36)) + [0, 1, 2, 14, 15, 16, 36, 39, 42, 45]
ses = new_session('isnet-general-use')

def sim(src, dst):
    mu_s, mu_d = src.mean(0), dst.mean(0); a = src - mu_s; b = dst - mu_d
    U, S, Vt = np.linalg.svd(a.T @ b); R = (U @ Vt).T
    if np.linalg.det(R) < 0: Vt[-1] *= -1; R = (U @ Vt).T
    s = S.sum() / (a ** 2).sum(); t = mu_d - s * R @ mu_s
    return np.hstack([s * R, t[:, None]])

def hizala(ad):
    P = np.array(L[ad], float); M = sim(P[ST], REF[ST])
    im = np.array(Image.open(G + ad + '.png').convert('RGB'))
    w = cv2.warpAffine(im, M, (768, 768), flags=cv2.INTER_AREA if M[0, 0] < 1 else cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    return w, (M[:, :2] @ P.T).T + M[:, 2]

def fon_sil(rgb):
    o = np.array(remove(Image.fromarray(rgb), session=ses, post_process_mask=False))
    a = cv2.GaussianBlur(o[..., 3].astype(np.float32), (0, 0), 0.8); a = np.clip((a - 10) * 1.08, 0, 255).astype(np.uint8)
    fill = cv2.inpaint(rgb, (a < 10).astype(np.uint8), 5, cv2.INPAINT_TELEA)
    return np.dstack([fill, a])

def kenar_temizle(rgba):   # kenar.py ile aynı: yarı saydam kenar rengini içeriden doldur, alfayı ~1 px daralt
    al = rgba[..., 3]; ic = (al >= 250).astype(np.uint8)
    kenar = ((al > 0) & (al < 250)).astype(np.uint8)
    kenar = cv2.dilate(kenar, np.ones((3, 3), np.uint8)) & (al > 0)
    rgb = cv2.inpaint(rgba[..., :3].copy(), (kenar & (1 - ic)).astype(np.uint8) * 255, 4, cv2.INPAINT_TELEA) if kenar.any() else rgba[..., :3]
    al2 = cv2.erode(al, np.ones((3, 3), np.uint8))
    al2 = (al.astype(np.float32) * 0.35 + al2.astype(np.float32) * 0.65).astype(np.uint8)
    return np.dstack([rgb, al2])

for arg in sys.argv[1:]:
    d, odunc = arg.split(':')
    rgb, Q = hizala('duygu-' + d)
    rgba = kenar_temizle(fon_sil(rgb))
    Image.fromarray(rgba, 'RGBA').save(D + f'duygu-{d}.webp', quality=84, method=6)
    face['duygular'][d] = {'dosya': f'duygu-{d}.webp', 'noktalar68': [[round(x, 1), round(y, 1)] for x, y in Q]}
    if odunc == '__notr__': face['duyguAgiz'].pop(d, None)       # nötr ağız parçaları (parcalar)
    else: face['duyguAgiz'][d] = odunc
    face['duyguKirpma'][d] = d
    print(d, os.path.getsize(D + f'duygu-{d}.webp'), '→ ağız:', odunc, flush=True)
json.dump(face, open(D + 'face.json', 'w'), ensure_ascii=False, separators=(',', ':'))
