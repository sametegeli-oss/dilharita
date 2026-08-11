/* ═══════════════════════════════════════════════════════════════
   ATLAS · AI KÖPRÜSÜ
   Tasarım kararları (eskisinde yaşanan hataların panzehiri):
   1) Persona sızmaz. Öğretmen promptu yalnız öğretmen ekranlarına
      girer; doktor/otel/havaalanı senaryolarına ASLA eklenmez.
   2) Dil kuralı senaryoya göre seçilir. Öğretmen → anlatım Türkçe.
      Rol yapma → İngilizce kalır, yoksa alıştırmanın kendisi ölür.
   3) Üçüncü dil yasak. Çok dilli modeller araya İspanyolca kelime
      sızdırabiliyor; kural açıkça yazılı.
   4) Anahtar yoksa uygulama ölmez. Yerel veriden (aiExplain,
      commonMistake, collocations) çevrimdışı açıklama üretilir.
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var SAGLAYICI = {
    groq: {
      ad: 'Groq', url: 'https://api.groq.com/openai/v1/chat/completions',
      modeller: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'openai/gpt-oss-120b'],
      anahtarYeri: 'https://console.groq.com/keys', bicim: 'openai'
    },
    gemini: {
      ad: 'Google Gemini', url: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
      modeller: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'],
      anahtarYeri: 'https://aistudio.google.com/apikey', bicim: 'gemini'
    },
    openai: {
      ad: 'OpenAI uyumlu', url: '', modeller: ['gpt-4o-mini'],
      anahtarYeri: '', bicim: 'openai'
    }
  };

  /* ───── kurallar ───────────────────────────────────────────── */
  function ortakKural() {
    return [
      'KESİN KURAL: Yalnızca Türkçe ve İngilizce kullan.',
      'Üçüncü bir dilden tek kelime bile yazma (İspanyolca, Almanca, Fransızca dahil).',
      'Emoji kullanma. Markdown başlık kullanma.',
      'Öğrettiğin İngilizce cümleleri ve örnekleri çift köşeli parantez içine al: [[like this]].',
      'Bu işaretleme seslendirmenin İngilizceyi doğru sesle okuması içindir; her İngilizce parçayı işaretle.'
    ].join(' ');
  }

  function dilKurali(senaryo) {
    var ogretmenMi = !senaryo || senaryo.ogretmen;
    if (ogretmenMi) {
      return [
        'Öğrenci Türkçe konuşuyor ve İngilizce öğreniyor.',
        'Açıklama, düzeltme, yönerge, soru ve övgünün TAMAMI Türkçe olacak.',
        'İngilizce kalan tek şey öğrettiğin malzemedir: hedef cümleler, örnekler, kelimeler.',
        'Dilbilgisini asla İngilizce anlatma.'
      ].join(' ');
    }
    return [
      'This is a role-play speaking practice. Stay in English.',
      'Speak naturally, in short turns, like a real person in this situation.',
      'If the learner makes a mistake, keep the conversation going; correct briefly and naturally, in English.',
      'Do not switch to Turkish unless the learner is completely stuck and asks for help.'
    ].join(' ');
  }

  function ogretmenKurali() {
    return [
      'Sen deneyimli bir İngilizce öğretmenisin. Öğrencin Türk.',
      'Bir hata gördüğünde şu yapıyı kullan:',
      '1) Ne yanlış, kısaca.',
      '2) Kural ve NEDENİ: 2-3 cümle Türkçe. "Böyle olmalı" deme, "neden böyle" anlat.',
      '3) Doğru cümle: [[...]]',
      '4) Aynı kuralla ikinci bir örnek: [[...]] ve altında Türkçesi.',
      '5) Öğrenciden aynı yapıyla yeni bir cümle kurmasını iste.',
      'Hata yoksa övgüyü kısa tut ve yapıyı bir adım ileri taşıyan yeni bir soru sor.',
      'Ders veriyormuş gibi uzun uzun anlatma; karşılıklı konuşma tonunu koru.'
    ].join(' ');
  }

  /* ───── senaryolar ─────────────────────────────────────────── */
  var SENARYOLAR = [
    {
      kod: 'ogretmen', ad: 'İngilizce Öğretmeni', ikon: '👩‍🏫', ogretmen: true,
      alt: 'Türkçe anlatır, İngilizce öğretir',
      acilis: 'Merhaba! Ben senin İngilizce öğretmeninim. Bugün ne çalışmak istersin — bir konu söyle, ya da aklındaki bir cümleyi İngilizce kurmayı dene, birlikte düzeltelim.',
      sistem: 'Öğrencinin seviyesi {seviye}. Ona uygun kelime ve yapı seç.'
    },
    {
      kod: 'havaalani', ad: 'Havaalanı', ikon: '✈️',
      alt: 'Check-in, güvenlik, kapı',
      acilis: 'Good morning! May I see your passport and ticket, please?',
      sistem: 'You are a calm, professional airline check-in agent at an international airport. Handle check-in, baggage, seat selection, boarding gate and delays. Learner level: {seviye}.'
    },
    {
      kod: 'otel', ad: 'Otel', ikon: '🏨',
      alt: 'Rezervasyon, oda, şikâyet',
      acilis: 'Good evening, and welcome. Do you have a reservation with us?',
      sistem: 'You are a polite hotel receptionist. Handle reservations, room types, check-in/out, complaints and local recommendations. Learner level: {seviye}.'
    },
    {
      kod: 'doktor', ad: 'Doktor', ikon: '🩺',
      alt: 'Şikâyet, muayene, reçete',
      acilis: 'Hello, please have a seat. What seems to be the problem today?',
      sistem: 'You are a calm, reassuring family doctor. Ask about symptoms, duration, medication and give simple advice. Never give real medical diagnosis; this is a language exercise. Learner level: {seviye}.'
    },
    {
      kod: 'restoran', ad: 'Restoran', ikon: '🍽️',
      alt: 'Sipariş, menü, hesap',
      acilis: "Good evening! Here's the menu. Can I get you something to drink while you decide?",
      sistem: 'You are a friendly waiter in a mid-range restaurant. Take orders, explain dishes, handle special requests and the bill. Learner level: {seviye}.'
    },
    {
      kod: 'is', ad: 'İş görüşmesi', ikon: '💼',
      alt: 'Mülakat, özgeçmiş, maaş',
      acilis: 'Thanks for coming in. Could you start by telling me a little about yourself?',
      sistem: 'You are a hiring manager conducting a job interview in English. Ask realistic interview questions, follow up on answers. Learner level: {seviye}.'
    },
    {
      kod: 'arkadas', ad: 'Günlük sohbet', ikon: '☕',
      alt: 'Serbest konuşma',
      acilis: "Hey! Good to see you. How's your week going so far?",
      sistem: 'You are a friendly native English speaker having a casual conversation. Keep turns short and ask follow-up questions. Learner level: {seviye}.'
    },
    {
      kod: 'alisveris', ad: 'Alışveriş', ikon: '🛍️',
      alt: 'Beden, fiyat, iade',
      acilis: 'Hi there! Are you looking for anything in particular today?',
      sistem: 'You are a helpful shop assistant. Handle sizes, colours, prices, discounts, returns. Learner level: {seviye}.'
    }
  ];

  /* ───── çağrı ──────────────────────────────────────────────── */
  function ayar() { return Atlas.Ayar.al(); }
  function anahtarVar() { return !!(ayar().aiAnahtar || '').trim(); }

  function cagir(mesajlar, secenek) {
    secenek = secenek || {};
    var denetleyici = new AbortController(), zamanAsimi = false;
    var zamanlayici = setTimeout(function () { zamanAsimi = true; denetleyici.abort(); }, secenek.zamanAsimi || 25000);
    if (secenek.sinyal) {
      if (secenek.sinyal.aborted) denetleyici.abort();
      else secenek.sinyal.addEventListener('abort', function () { denetleyici.abort(); }, { once: true });
    }
    function bitir(p) {
      return p.catch(function (h) {
        if (h && h.name === 'AbortError') throw { kod: zamanAsimi ? 'zaman-asimi' : 'iptal' };
        throw h;
      }).finally(function () { clearTimeout(zamanlayici); });
    }
    var a = ayar();
    var s = SAGLAYICI[a.aiSaglayici] || SAGLAYICI.groq;
    var anahtar = (a.aiAnahtar || '').trim();
    if (!anahtar) return Promise.reject({ kod: 'anahtar-yok' });

    if (s.bicim === 'gemini') {
      var url = s.url.replace('{model}', a.aiModel || s.modeller[0]) + '?key=' + encodeURIComponent(anahtar);
      var sistem = mesajlar.filter(function (m) { return m.role === 'system'; }).map(function (m) { return m.content; }).join('\n\n');
      var icerik = mesajlar.filter(function (m) { return m.role !== 'system'; }).map(function (m) {
        return { role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] };
      });
      return bitir(fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        signal: denetleyici.signal,
        body: JSON.stringify({
          contents: icerik,
          systemInstruction: sistem ? { parts: [{ text: sistem }] } : undefined,
          generationConfig: { temperature: secenek.sicaklik == null ? 0.6 : secenek.sicaklik, maxOutputTokens: secenek.uzunluk || 900 }
        })
      }).then(kontrol).then(function (j) {
        var c = j.candidates && j.candidates[0];
        return ((c && c.content && c.content.parts) || []).map(function (p) { return p.text || ''; }).join('').trim();
      }));
    }

    var uc = s.url || (a.aiUrl || '');
    if (!uc) return Promise.reject({ kod: 'uc-nokta-yok' });
    return bitir(fetch(uc, {
      method: 'POST',
      signal: denetleyici.signal,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + anahtar },
      body: JSON.stringify({
        model: a.aiModel || s.modeller[0],
        messages: mesajlar,
        temperature: secenek.sicaklik == null ? 0.6 : secenek.sicaklik,
        max_tokens: secenek.uzunluk || 900
      })
    }).then(kontrol).then(function (j) {
      return ((j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '').trim();
    }));
  }

  function kontrol(r) {
    if (r.ok) return r.json();
    return r.text().then(function (t) {
      var kod = r.status === 401 || r.status === 403 ? 'anahtar-gecersiz'
        : r.status === 429 ? 'kota' : 'sunucu';
      throw { kod: kod, durum: r.status, metin: t.slice(0, 300) };
    });
  }

  /* ───── yüksek seviye işlevler ─────────────────────────────── */
  var AI = {
    SAGLAYICI: SAGLAYICI,
    SENARYOLAR: SENARYOLAR,
    anahtarVar: anahtarVar,
    cagir: cagir,

    senaryoBul: function (kod) {
      return SENARYOLAR.find(function (s) { return s.kod === kod; }) || SENARYOLAR[0];
    },

    /* sohbet — persona sızdırmaz */
    sohbet: function (senaryo, gecmis, kullaniciMesaji) {
      var pr = Atlas.Profil.al();
      var sistem = [
        senaryo.sistem.replace('{seviye}', pr.seviye || 'A2'),
        dilKurali(senaryo),
        ortakKural()
      ];
      /* öğretmen promptu YALNIZCA öğretmen senaryosuna girer */
      if (senaryo.ogretmen) sistem.push(ogretmenKurali());

      var mesajlar = [{ role: 'system', content: sistem.join('\n\n') }];
      gecmis.slice(-14).forEach(function (m) {
        mesajlar.push({ role: m.ben ? 'user' : 'assistant', content: m.metin });
      });
      mesajlar.push({ role: 'user', content: kullaniciMesaji });
      return cagir(mesajlar, { sicaklik: senaryo.ogretmen ? 0.4 : 0.8, uzunluk: senaryo.ogretmen ? 800 : 350 });
    },

    /* cümle analizi — öğretmen ekranı */
    analiz: function (cumle) {
      var pr = Atlas.Profil.al();
      var sistem = [
        'Sen bir İngilizce öğretmenisin. Öğrencin Türk, seviyesi ' + (pr.seviye || 'A2') + '.',
        dilKurali(null), ortakKural(),
        'Verilen İngilizce cümleyi şu başlıklarla çözümle. Başlıkları aynen kullan, her biri yeni satırda:',
        'ÇEVİRİ:', 'YAPI:', 'ZAMAN:', 'KELİMELER:', 'KALIPLAR:', 'SIK HATA:', 'BENZER CÜMLE:',
        'Her başlığın altında 1-3 cümle yaz. Uzun paragraf yazma.'
      ].join('\n');
      return cagir([
        { role: 'system', content: sistem },
        { role: 'user', content: cumle }
      ], { sicaklik: 0.3, uzunluk: 900 });
    },

    /* hakemlik — kullanıcının farklı yazdığı cevap geçerli mi?
       İlk kelime ayrıştırılabilir kalır, arkasına öğretici kısım gelir. */
    hakem: function (dogru, cevap) {
      var sistem = [
        'İki İngilizce cümle vereceğim: DOĞRU ve ÖĞRENCİ.',
        'İlk satırın SADECE şu üç kelimeden biri olsun: EVET, HAYIR, YAZIM',
        'EVET = anlam ve dilbilgisi doğru, farklı ama geçerli bir söyleyiş.',
        'YAZIM = doğru ama küçük bir yazım/noktalama hatası var.',
        'HAYIR = dilbilgisi veya anlam hatalı.',
        'İkinci satırdan itibaren Türkçe açıklama yaz:',
        'ne yanlış, NEDEN yanlış (kuralı anlat), doğru cümle [[...]], aynı kuralla ikinci örnek [[...]], varsa daha doğal söyleyiş.',
        ortakKural()
      ].join('\n');
      return cagir([
        { role: 'system', content: sistem },
        { role: 'user', content: 'DOĞRU: ' + dogru + '\nÖĞRENCİ: ' + cevap }
      ], { sicaklik: 0.2, uzunluk: 700 }).then(function (m) {
        var ilk = (m.split('\n')[0] || '').toUpperCase();
        var karar = ilk.indexOf('EVET') > -1 ? 'evet' : ilk.indexOf('YAZIM') > -1 ? 'yazim' : 'hayir';
        return { karar: karar, not: m.split('\n').slice(1).join('\n').trim() || m };
      });
    },

    /* kişiye özel modül üretimi */
    modulUret: function (konu, seviye, adet) {
      adet = adet || 10;
      var sistem = [
        'Bir İngilizce öğrenme modülü üreteceksin.',
        'Sadece geçerli JSON dizisi döndür. Açıklama, markdown, kod bloğu yazma.',
        'Her öğe: {"en":"...","tr":"...","grammar":"...","aiExplain":"...","commonMistake":"..."}',
        '"tr" Türkçe çeviri, "grammar" cümlenin yapısı (kısa), "aiExplain" 2-3 cümlelik Türkçe açıklama,',
        '"commonMistake" Türklerin bu yapıda yaptığı tipik hata.',
        'Seviye: ' + seviye + '. Konu: ' + konu + '. Adet: ' + adet + '.',
        'Cümleler günlük hayatta gerçekten kullanılan cümleler olsun.'
      ].join('\n');
      return cagir([
        { role: 'system', content: sistem },
        { role: 'user', content: konu }
      ], { sicaklik: 0.7, uzunluk: 2400 }).then(function (m) {
        var t = m.replace(/```json?/gi, '').replace(/```/g, '').trim();
        var b = t.indexOf('['), s = t.lastIndexOf(']');
        if (b < 0 || s < 0) throw { kod: 'ayristirilamadi', metin: t.slice(0, 200) };
        return JSON.parse(t.slice(b, s + 1));
      });
    },

    /* günün özeti / koç yorumu */
    gunOzeti: function () {
      var g = Atlas.Gunluk.gun(), s = Atlas.SRS.sayim(), e = Atlas.Hata.egilim().slice(0, 3);
      var sistem = 'Sen kısa konuşan bir çalışma koçusun. Türkçe yaz. En fazla 4 cümle. ' +
        'Övgü ve somut bir sonraki adım ver. Abartma, klişe kullanma. ' + ortakKural();
      var veri = 'Bugün ' + (g.sayac || 0) + ' tekrar, ' + (g.dogru || 0) + ' doğru, ' + (g.yanlis || 0) + ' yanlış. ' +
        'Toplam ' + s.toplam + ' kalem, ' + s.ogrenildi + ' kalıcı, ' + s.vade + ' vadesi gelmiş. ' +
        'Seri: ' + Atlas.Seri.canli() + ' gün. ' +
        (e.length ? 'En çok takıldığı konular: ' + e.map(function (x) { return x.ad + ' (' + x.n + ')'; }).join(', ') : '');
      return cagir([{ role: 'system', content: sistem }, { role: 'user', content: veri }], { sicaklik: 0.6, uzunluk: 300 });
    },

    /* ───── çevrimdışı düşüş — yerel veriden açıklama ──────── */
    yerelAciklama: function (c) {
      if (!c) return '';
      var p = [];
      if (c.aiExplain) p.push(c.aiExplain);
      if (c.grammar) p.push('Yapı: ' + c.grammar + '.');
      if (c.tense) p.push('Zaman: ' + c.tense + '.');
      if (c.commonMistake) p.push('Sık yapılan hata: ' + c.commonMistake);
      if (c.collocations) p.push('Birlikte kullanılan kalıplar: ' + c.collocations + '.');
      if (!p.length) p.push('Bu cümle için hazır açıklama yok. AI anahtarı eklersen ayrıntılı çözümleme alabilirsin.');
      return p.join(' ');
    },

    hataMesaji: function (h) {
      var k = (h && h.kod) || '';
      if (k === 'anahtar-yok') return 'AI anahtarı tanımlı değil. Ayarlar → Yapay zekâ bölümünden ekleyebilirsin. Anahtarsız da çalışabilirsin: açıklamalar yerel veriden gelir.';
      if (k === 'zaman-asimi') return 'AI yanıtı 25 saniyede gelmedi. Tekrar deneyebilir veya isteği iptal edebilirsin.';
      if (k === 'iptal') return 'AI isteği iptal edildi.';
      if (k === 'anahtar-gecersiz') return 'Anahtar reddedildi. Ayarlardan kontrol et.';
      if (k === 'kota') return 'Sağlayıcı hız sınırına takıldı. Bir dakika bekleyip tekrar dene.';
      if (k === 'ayristirilamadi') return 'Model beklenen biçimde cevap vermedi. Tekrar dene.';
      if (k === 'destek-yok') return 'Tarayıcın bu özelliği desteklemiyor.';
      return 'Bağlantı kurulamadı. İnternet yoksa uygulama çevrimdışı modda çalışmaya devam eder.';
    },

    /* [[ ]] işaretlerini ekrandan kaldır, İngilizceyi vurgula */
    balonMetni: function (metin) {
      var g = document.createElement('div');
      var son = 0, re = /\[\[([\s\S]*?)\]\]/g, m;
      var s = String(metin || '');
      while ((m = re.exec(s))) {
        if (m.index > son) g.appendChild(document.createTextNode(s.slice(son, m.index)));
        var b = document.createElement('span');
        b.className = 'en-parca'; b.textContent = m[1];
        g.appendChild(b);
        son = re.lastIndex;
      }
      if (son < s.length) g.appendChild(document.createTextNode(s.slice(son)));
      return g;
    }
  };

  global.AI = AI;
})(window);
