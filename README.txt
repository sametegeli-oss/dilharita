AI PROMPT EDIT + TÜRKÇE/İNGİLİZCE TTS PAKETİ

İstek:
- AI öğretmen ve tüm sohbetlerde promptu kullanıcı edit edebilsin.
- Sohbet bundan sonraki mesajlarda kaydedilen prompta göre devam etsin.
- Öğretmen konuyu mutlaka Türkçe anlatsın.
- Cevaptaki Türkçe kısımlar Türkçe, İngilizce kısımlar İngilizce okunsun.

Yüklenecek dosyalar:
/dilharita/index-app.html
/dilharita/word-direct-tools.js
/dilharita/ai-teacher-prompt-tts.js
/dilharita/index-app-ogretmen-analiz-buttons.js

Ne değişti:
1) index-app.html içine ai-teacher-prompt-tts.js bağlandı.
2) word-direct-tools.js içinde her AI paneline "Promptu Düzenle" alanı eklendi.
3) AI Test, Benzer, Hikaye, Podcast, Konuşma, Cümle Yaz, Partner artık kaydedilen prompta göre cevap verir.
4) AI öğretmen ve fetch tabanlı sohbet çağrılarında sistem promptuna kullanıcı promptu eklenir.
5) Cevap okuma iki dilli oldu:
   - Türkçe açıklama tr-TR
   - İngilizce örnekler en-US

Opsiyonel:
Ayrı chatteacher / teacher sayfalarına da eklemek için:
opsiyonel_yamali_sohbet_sayfalari klasöründeki örnek HTML'leri kullanabilirsin.
Mevcut çalışan sayfaları ezmek istemiyorsan sadece bu script satırını o sayfalarda </body> öncesine ekle:
<script src="./ai-teacher-prompt-tts.js?v=1"></script>

Yükledikten sonra Ctrl+F5 yap.
