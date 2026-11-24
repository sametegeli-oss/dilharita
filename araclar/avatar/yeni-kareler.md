# Deniz — yeni kareler (24 Kasım planı)

Kullanıcı sırası: önce **gözler**, sonra **gülüş**, sonra **dinlerken jestler** (saç düzeltme, eğilme).
Eğilmeler kodla yapıldı (dh-canli-yuz v55, dinleme duruşları). Görsel isteyenler aşağıda.

Hepsi Gemini'de (kullanıcının Chrome'u), referans: nötr taban fotoğrafı (`assets/avatars_v4/teacher/base.webp`,
sayfadan fetch edilip dosya girişine verilir). İstem kalıbı: "Go back to the ORIGINAL photo …"; aynı kadraj, aynı ışık,
aynı gözlük, yalnız istenen bölge değişir. Her istemden sonra sırayı kontrol et.

## 1. Gözler (5 görsel) → göz yaması, `face.json` içinde `bakis` setleri
- `goz-sol`   : eyes look to the viewer's left, head and glasses unchanged
- `goz-sag`   : eyes look to the viewer's right
- `goz-yukari`: eyes look up and slightly to the side, as if recalling something
- `goz-asagi` : eyes look down, lids slightly lowered (reading / thinking)
- `goz-kisik` : eyes narrowed with a gentle squint, as in a warm smile (Duchenne), eyebrows relaxed
Ölçüm: yama ile esnetilmiş bakışı yan yana montajla karşılaştır; daha doğal değilse bağlama.

## 2. Gülüş (4 görsel)
- `gulus-genis` (ağız): broad warm smile showing upper teeth, cheeks raised
- `gulus-gulme` (ağız): laughing, mouth open, teeth visible, natural not exaggerated
- `gulus-goz` (göz): smiling eyes with crow's feet (kullan: `goz-kisik` ile aynı bölge)
- `gulus-kapali` (ağız): closed-mouth big smile
Motora: yeni duygu `gulme` (+ jest `gul`: 1,2 sn gülme ağzı + göz kısma + hafif baş geri).

## 3. Elle saç düzeltme (dinlerken, ara sıra)
Yama ile yapılamaz (el ve kol kadraja girer). İki yol:
a) **Veo video (tercih):** taban fotoğraftan 5–6 sn: "he calmly lifts his right hand, briefly smooths his hair at the side,
   lowers the hand, ends in exactly the starting pose, mouth closed, looking at camera". İlk ve son kare tabana eşit olmalı;
   motor dinlerken 60–90 sn'de bir oynatır, başta/sonda 200 ms çapraz geçiş. Boyut sınırı: ~1,5 MB (720p webm).
b) Video yoksa 4–6 ara kare (el iniş-çıkış) + çapraz geçiş; titreme olursa kullanma.
Önce tek deneme, kullanıcıya göster.
