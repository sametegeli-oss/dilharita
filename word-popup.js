/* word-popup.js — Çift Tıklama (Double Click) ile Çalışan Güncel Sürüm */

document.addEventListener('dblclick', function(e) {
    var sel = window.getSelection();
    var word = sel.toString().trim();
    
    // Eğer seçilen kelime 1 harften uzunsa popup'ı tetikle
    if (word.length > 1) {
        showWordPopup(word, e.pageX, e.pageY);
    }
});

// Mobilde basılı tutup seçme işlemi bittiğinde tetiklenmesi için
document.addEventListener('selectionchange', function(e) {
    setTimeout(function() {
        var sel = window.getSelection();
        var word = sel.toString().trim();
        // Sadece boşluğa tıklamaları önlemek için kontrol
        if (word.length > 1 && !word.includes(" ")) {
            // Mobilde popup'ı ekranın ortasına yakın veya seçimin hemen altına hizalayabiliriz
            // Bu basit bir fallback'tir.
        }
    }, 500);
});

function showWordPopup(word, x, y) {
    // Varsa eski popup'ı ekrandan temizle
    var existing = document.getElementById('dh-word-popup');
    if(existing) existing.remove();

    var popup = document.createElement('div');
    popup.id = 'dh-word-popup';
    // Popup Stili
    popup.style.cssText = 'position:absolute; top:'+(y+15)+'px; left:'+(x-50)+'px; background:#10264a; border:1px solid #1e3a5f; color:#e8eef7; padding:12px 18px; border-radius:12px; z-index:99999; box-shadow:0 8px 24px rgba(0,0,0,0.6); font-size:15px; font-weight:bold; min-width:150px; text-align:center; animation: popIn 0.2s ease;';
    
    popup.innerHTML = '🔍 ' + word + ' <br><button style="margin-top:10px; background:#059669; border:none; color:white; padding:6px 12px; border-radius:6px; cursor:pointer; font-weight:bold;" onclick="this.parentNode.remove()">Kapat</button>';
    
    // Popup animasyonu için dinamik stil
    var style = document.createElement('style');
    style.innerHTML = '@keyframes popIn { from { opacity: 0; transform: translateY(-10px) scale(0.9); } to { opacity: 1; transform: translateY(0) scale(1); } }';
    document.head.appendChild(style);

    document.body.appendChild(popup);
}