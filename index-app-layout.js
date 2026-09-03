/* index-app-layout.js — v31 PROFESYONEL MODÜL ARAÇ ÇEKMECESİ
   - Ekranda veya Araçlar panelinde "Tüm Modülleri PDF İndir" seçeneği içerir.
   - Bütün modüllerdeki cümleleri, TR karşılıklarını ve IndexedDB'deki AI açıklamalarını derler.
   - Markdown işaretlerini Gemini dizaynında şık HTML'e dönüştürür.
*/
(function(){
  "use strict";
  var applying=false, scheduled=false, suppressSentenceToggleUntil=0;

  function addStyle(){
    if(document.getElementById("dh-ia-css")) return;
    var s=document.createElement("style"); s.id="dh-ia-css";
    s.textContent =
    /* genel */
     ".legend,.legend-item,.legend-dot{display:none !important}"
    +"@media (orientation:landscape){.study-header,.study-progress{display:none !important}}"
    /* React'in Öğretmen/Zayıf butonları ana ekranda gizli */
    +".card-actions .teacher-btn,.card-actions .extra-weak,button.teacher-btn,button.extra-weak{display:none !important}"
    +".extra-weak-btn,.sm-teacher-btn{display:none !important}"
    /* grade-bar her modda kompakt yatay */
    +".grade-bar{display:flex !important;gap:6px;align-items:stretch}"
    +".grade-bar .grade-label{display:none !important}"
    +".grade-bar .grade-btn{flex:1;min-height:38px;border-radius:10px;font-weight:800;font-size:13px}"
    /* Ana kartta yalnız tek cümleye ait birincil AI eylemi görünür. */
    +".dh-ai-row{display:flex;margin:0 0 14px}"
    +".dh-ai-row .dh-gtr-btn{width:100%;margin:0;justify-content:center;min-height:42px}"
    +".dh-gtr-btn{display:inline-flex;align-items:center;gap:6px;padding:7px 10px;border:1px solid rgba(255,255,255,.16);border-radius:11px;background:#1a2942;color:#cfe0ff;font:800 12px Nunito,system-ui,sans-serif;cursor:pointer}"
    +".dh-gtr-btn:hover{background:#22344f}"
    +".dh-aiask-btn{background:linear-gradient(135deg,#7c3aed,#4338ca);border-color:#8b5cf6;color:#fff}"
    +".dh-aiask-btn:hover{background:linear-gradient(135deg,#8b4cf7,#4f46e0)}"
    +".dh-aiask-btn.has-explanation{background:linear-gradient(135deg,#059669,#047857)!important;border-color:#34d399!important;color:#fff!important;box-shadow:0 0 0 1px rgba(52,211,153,.2),0 8px 22px rgba(5,150,105,.2)}.dh-aiask-btn.has-explanation:hover{background:linear-gradient(135deg,#10b981,#059669)!important}.dh-aiask-btn[aria-expanded='true']{box-shadow:0 0 0 2px rgba(255,255,255,.2),0 8px 24px rgba(5,150,105,.28)}"
    +".dh-youtube-source-btn{background:linear-gradient(135deg,#dc2626,#b91c1c)!important;border-color:#f87171!important;color:#fff!important}"
    +".dh-youtube-source-btn:hover{background:linear-gradient(135deg,#ef4444,#dc2626)!important}"
    +".dh-source-media-row{display:flex;align-items:stretch;gap:8px;min-width:0}"
    +".dh-source-media-row #dhModeToggle{flex:1;min-width:0;margin:0!important}"
    +".dh-source-media-row .dh-youtube-source-btn{flex:0 0 auto;padding:7px 13px;border-radius:11px;font:900 12px Nunito,system-ui,sans-serif;cursor:pointer}"
    /* bütün cümle açıklamaları hazır modül kartı */
    +".dh-ai-ready-module-card{background:linear-gradient(135deg,rgba(6,78,59,.96),rgba(13,60,78,.96)) !important;border-color:#34d399 !important;box-shadow:0 0 0 1px rgba(52,211,153,.25),0 10px 28px rgba(5,150,105,.18) !important;position:relative}"
    +".dh-ai-ready-badge{display:inline-flex;align-items:center;align-self:flex-start;margin-top:5px;padding:3px 8px;border-radius:999px;background:#10b981;color:#03261c;font:900 10px Nunito,system-ui,sans-serif;line-height:1.35;pointer-events:none}"
    /* nav */
    +".study-nav{display:none !important}"
    +".dh-nav-trio{display:flex;gap:8px;align-items:center;margin:0 0 14px}"
    +".dh-nav-trio .dh-nav-btn{flex:1;min-height:42px;font-weight:800;border-radius:11px;border:1px solid rgba(255,255,255,.14);background:#1a2942;color:#cfe0ff;font:800 14px Nunito,system-ui,sans-serif;cursor:pointer}"
    +".dh-nav-trio .dh-nav-btn:hover{background:#22344f}"
    +".dh-nav-trio .dh-nav-btn:disabled{opacity:.35;cursor:default}"
    +".dh-nav-trio .dh-nav-next{background:#2563eb;color:#fff;border-color:transparent}"
    +".dh-nav-trio .dh-nav-next:hover{background:#2f6fe0}"
    +".dh-nav-trio .dh-tools-toggle{flex:0 0 auto !important;margin:0}"
    /* Sağdan açılan profesyonel modül araçları çekmecesi */
    +".dh-tools-toggle{display:inline-flex;align-items:center;justify-content:center;gap:7px;flex:0 0 auto!important;min-height:42px;padding:0 13px;border:1px solid rgba(111,146,190,.28);border-radius:11px;background:linear-gradient(145deg,#1a2a41,#101d31);color:#d9e5f4;font:900 13px Nunito,system-ui,sans-serif;cursor:pointer;box-shadow:inset 0 1px rgba(255,255,255,.04);transition:border-color .18s,background .18s,color .18s}"
    +".dh-tools-toggle svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.8}"
    +".dh-tools-toggle:hover,.dh-tools-toggle[aria-expanded='true']{border-color:rgba(83,229,210,.55);background:linear-gradient(145deg,rgba(25,66,70,.94),rgba(8,30,41,.98));color:#6cebdd}"
    +".dh-tools-overlay{position:fixed;inset:0;z-index:1000000;background:rgba(1,7,15,.7);backdrop-filter:blur(10px);opacity:1;transition:opacity .2s ease}"
    +".dh-tools-overlay.dh-hidden{display:none!important}"
    +".dh-tools-box{position:absolute;top:0;right:0;display:grid;grid-template-rows:auto auto minmax(0,1fr);width:min(438px,94vw);height:100dvh;overflow:hidden;border-left:1px solid rgba(118,154,198,.25);background:linear-gradient(160deg,#0d1b2e,#07111f 70%);box-shadow:-28px 0 80px rgba(0,0,0,.52);animation:dhToolsSlide .22s cubic-bezier(.2,.75,.2,1)}"
    +".dh-tools-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:max(17px,env(safe-area-inset-top)) 18px 15px;border-bottom:1px solid rgba(123,157,197,.17);background:rgba(16,32,53,.86)}"
    +".dh-tools-title{display:grid;gap:3px}.dh-tools-title strong{color:#f4f8fd;font-size:16px;letter-spacing:-.01em}.dh-tools-title span{color:#8195ad;font-size:11px}"
    +".dh-tools-close{display:grid;place-items:center;flex:0 0 38px;width:38px;height:38px;border:1px solid rgba(132,163,199,.24);border-radius:11px;background:#14243a;color:#dbe6f3;cursor:pointer}.dh-tools-close:hover{border-color:#60e6d7;color:#72ecde}.dh-tools-close svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.9}"
    +".dh-tools-back{display:inline-flex;align-items:center;gap:7px;border:0;background:transparent;color:#7ceadd;font:900 12px Nunito,system-ui,sans-serif;cursor:pointer;padding:7px 0}.dh-tools-back:hover{color:#fff}.dh-tools-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:10px 15px;border-bottom:1px solid rgba(123,157,197,.17);background:rgba(8,20,35,.88)}.dh-tools-tab{min-height:38px;border:1px solid rgba(126,158,197,.22);border-radius:10px;background:#0d1e33;color:#91a5be;font:900 12px Nunito,system-ui,sans-serif;cursor:pointer}.dh-tools-tab[aria-selected='true']{border-color:#55e6d1;background:rgba(48,196,178,.14);color:#79eee0}.dh-tool-panel[hidden]{display:none!important}"
    +".dh-tools-scroll{overflow:auto;overscroll-behavior:contain;padding:15px 15px max(28px,env(safe-area-inset-bottom));scrollbar-gutter:stable}"
    +".dh-tool-section{display:grid;gap:8px;margin-bottom:19px}.dh-tool-section>header{display:flex;align-items:center;justify-content:space-between;padding:0 3px}.dh-tool-section>header strong{color:#89a0ba;font-size:10px;font-weight:950;letter-spacing:.11em;text-transform:uppercase}.dh-tool-section>header span{color:#60758d;font-size:10px}"
    +".dh-tool-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}"
    +".dh-tool-card{display:grid;grid-template-columns:38px minmax(0,1fr);align-items:center;gap:10px;min-height:67px;padding:10px;border:1px solid rgba(120,153,192,.19);border-radius:14px;background:linear-gradient(145deg,rgba(20,38,59,.96),rgba(8,20,34,.98));color:#dce7f4;text-align:left;cursor:pointer;box-shadow:inset 0 1px rgba(255,255,255,.035);transition:border-color .17s,background .17s,transform .17s}"
    +".dh-tool-card:hover,.dh-tool-card:focus-visible{border-color:rgba(86,231,213,.48);background:linear-gradient(145deg,rgba(24,61,67,.95),rgba(8,27,39,.98));outline:none;transform:translateY(-1px)}"
    +".dh-tool-icon{display:grid;place-items:center;width:38px;height:38px;border:1px solid rgba(101,226,211,.17);border-radius:11px;background:rgba(68,202,187,.09);color:#62e5d6}.dh-tool-icon svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}"
    +".dh-tool-copy{min-width:0;display:grid;gap:3px}.dh-tool-copy b{color:#edf4fc;font-size:12px;line-height:1.25}.dh-tool-copy small{color:#8296ae;font-size:9.5px;line-height:1.35}"
    +".dh-tool-card.is-danger .dh-tool-icon{border-color:rgba(255,184,92,.2);background:rgba(255,171,64,.08);color:#ffc36a}.dh-tool-card.is-purple .dh-tool-icon{border-color:rgba(171,139,255,.22);background:rgba(130,91,230,.11);color:#b9a0ff}"
    +".dh-tool-section .wd-tools-row{margin:0!important;display:grid!important;grid-template-columns:1fr 1fr;gap:8px}.dh-tool-section .wd-tools-row button{min-height:42px;border-radius:11px!important}"
    +"html.dh-tools-open{overflow:hidden}"
    +"@keyframes dhToolsSlide{from{transform:translateX(24px);opacity:.45}to{transform:translateX(0);opacity:1}}"
    +".card.dh-split>.dh-sentence-listen-row{grid-column:1;display:flex !important;align-items:center;gap:9px;min-width:0;margin:0 0 8px}"
    +".dh-sentence-listen-row>.card-en{display:block;margin:0 !important;min-width:0}"
    +".dh-sentence-listen-row>.dh-listen-after-sentence{display:inline-flex;flex:0 0 auto;align-items:center;justify-content:center;margin:0;padding:7px 13px !important;border-radius:10px !important;background:#0e7490 !important;color:#fff !important;font-weight:900 !important;white-space:nowrap}"
    +".card.dh-split>.card-actions{display:none!important}"
    
    /* GEMINI MODELİİLE BİREBİR STİLLER */
    +"#dhAiResultBox { font-family: 'Nunito', system-ui, -apple-system, sans-serif !important; color: #f1f5f9 !important; font-size: 14px !important; line-height: 1.65 !important; }"
    +"#dhAiResultBox h3, #dhAiResultBox h4 { font-size: 15px !important; font-weight: 800 !important; color: #f8fafc !important; margin: 16px 0 8px 0 !important; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 4px; }"
    +"#dhAiResultBox p { margin: 6px 0 !important; }"
    +"#dhAiResultBox strong { color: #ffffff !important; font-weight: 700 !important; }"
    +"#dhAiResultBox em { color: #cbd5e1 !important; font-style: italic !important; }"
    +"#dhAiResultBox code { background: rgba(255, 255, 255, 0.1) !important; color: #e2e8f0 !important; padding: 3px 7px !important; border-radius: 6px !important; font-family: monospace, sans-serif !important; font-size: 13px !important; display: inline-block !important; margin: 2px 0 !important; border: 1px solid rgba(255,255,255,0.05); }"
    +"#dhAiResultBox blockquote { margin: 8px 0 !important; padding: 6px 12px !important; background: rgba(255,255,255,0.03) !important; border-left: 3px solid #8b5cf6 !important; border-radius: 0 6px 6px 0 !important; color: #e2e8f0 !important; font-style: italic !important; }"
    +"#dhAiResultBox ul, #dhAiResultBox ol { margin: 6px 0 10px 20px !important; padding: 0 !important; }"
    +"#dhAiResultBox li { margin-bottom: 6px !important; list-style-type: disc !important; }"
    +"#dhAiResultBox hr { border: 0 !important; height: 1px !important; background: rgba(255,255,255,0.1) !important; margin: 16px 0 !important; }"

    /* 2 SÜTUN */
    +"@media (orientation:landscape),(min-width:680px){"
    +".card.dh-split{display:grid !important;grid-template-columns:1.55fr .85fr;gap:10px 16px;align-items:start}"
    +".card.dh-split>*{grid-column:1;min-width:0}"
    +".card.dh-split>.grade-bar,.card.dh-split>.grade-done{grid-column:2;grid-row:1;flex-direction:column !important}"
    +".card.dh-split>.grade-bar .grade-btn{min-height:33px;font-size:12px}"
    +".card.dh-split>.dh-nav-trio{grid-column:2;grid-row:2}"
    +".card.dh-split>.dh-nav-trio .dh-nav-btn{min-height:31px;padding:5px 9px !important;font-size:12px !important;border-radius:9px !important}"
    +".card.dh-split>.dh-nav-trio .dh-tools-toggle{min-height:31px !important;padding:0 9px !important}"
    +".card.dh-split>.dh-ai-row{grid-column:2;grid-row:3}"
    +".card.dh-split>.dh-ai-row .dh-gtr-btn{font-size:11px !important;padding:5px 6px !important;min-height:31px}"
    +".card.dh-split>.card-actions{display:none!important}"
    +"}"
    /* YATAY MOBİL */
    +"@media (orientation:landscape) and (max-height:520px){"
    +"body{padding:0 !important}"
    +".study-main{padding:6px 10px !important;margin:0 !important}"
    +".card.dh-split{padding:10px !important;gap:6px 12px !important;margin:0 !important}"
    +".card.dh-split>.card-meta{display:none !important}"
    +".card.dh-split>.sm-img-wrap{grid-row:1;grid-column:1;margin:0 !important}"
    +".card.dh-split .sm-img{max-height:50vh;width:100%;object-fit:cover;display:block;border-radius:12px}"
    +".card.dh-split>.dh-sentence-listen-row{grid-row:1;grid-column:1;align-self:end;z-index:2;margin:0 !important;padding:7px 11px !important;background:rgba(4,10,24,.62);backdrop-filter:blur(3px);border-radius:0 0 12px 12px}"
    +".card.dh-split>.dh-sentence-listen-row>.card-en{padding:0 !important;background:transparent !important;font-size:17px !important;line-height:1.3 !important}"
    +".card.dh-split>.card-tr{margin:2px 0 !important;font-size:14px !important}"
    +".card.dh-split>.card-pron,.card.dh-split>.card-ipa{font-size:11px !important;margin:0 !important}"
    +".card.dh-split .dh-gtr-btn{margin:2px 0 !important;padding:4px 6px !important;font-size:11px !important}"
    +".dh-nav-trio .dh-nav-btn{min-height:34px;font-size:13px}"
    +".dh-tools-toggle{min-height:34px}"
    +".dh-tools-toggle b{display:none}"
    +"}"
    +".card.dh-split{display:flex!important;flex-direction:column!important;gap:10px!important}.card.dh-split>*{min-width:0}.dh-card-actions-deck{order:900;display:grid!important;grid-template-columns:1fr;gap:9px;width:100%;margin-top:5px;padding-top:13px;border-top:1px solid rgba(126,158,197,.2)}.dh-card-actions-deck .grade-bar,.dh-card-actions-deck .grade-done{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important;width:100%;margin:0!important;flex-direction:row!important}.dh-card-actions-primary{display:grid;grid-template-columns:minmax(120px,.7fr) minmax(180px,1.3fr);gap:8px}.dh-card-actions-primary>.dh-listen-after-sentence,.dh-card-actions-primary>.dh-ai-row{width:100%!important;min-height:42px!important;margin:0!important}.dh-card-actions-primary>.dh-listen-after-sentence{display:inline-flex!important;align-items:center;justify-content:center}.dh-card-actions-primary>.dh-ai-row .dh-gtr-btn{height:100%;min-height:42px}.dh-card-actions-deck>.dh-nav-trio{display:grid!important;grid-template-columns:1fr auto 1fr;gap:8px;width:100%;margin:0!important}.dh-card-actions-deck>.dh-nav-trio .dh-nav-btn,.dh-card-actions-deck>.dh-nav-trio .dh-tools-toggle{min-height:42px!important;font-size:12px!important;padding:0 12px!important;border-radius:11px!important}.dh-card-actions-deck>.dh-source-media-row{width:100%;margin:0!important}.dh-sentence-listen-row{display:block!important;margin:0 0 8px!important}.dh-sentence-listen-row>.card-en{width:100%}"
    +"@media(max-width:700px){.card.dh-split{gap:7px!important}.dh-card-actions-deck{gap:6px!important;padding-top:8px!important;margin-top:2px!important}.dh-card-actions-deck .grade-bar,.dh-card-actions-deck .grade-done{gap:6px!important}.dh-card-actions-deck .grade-btn{min-height:34px!important;padding:4px 7px!important;font-size:11px!important}.dh-card-actions-primary{grid-template-columns:52px minmax(0,1fr)!important;gap:6px!important}.dh-card-actions-primary>.dh-listen-after-sentence,.dh-card-actions-primary>.dh-ai-row,.dh-card-actions-primary>.dh-ai-row .dh-gtr-btn{min-height:36px!important;height:36px!important}.dh-card-actions-primary>.dh-listen-after-sentence{font-size:0!important;padding:0!important}.dh-card-actions-primary>.dh-listen-after-sentence:after{content:'▶';font-size:15px}.dh-card-actions-primary>.dh-ai-row .dh-gtr-btn{font-size:11px!important;padding:0 9px!important}.dh-card-actions-deck>.dh-nav-trio{grid-template-columns:minmax(0,1fr) 48px minmax(0,1fr)!important;gap:6px!important}.dh-card-actions-deck>.dh-nav-trio .dh-nav-btn,.dh-card-actions-deck>.dh-nav-trio .dh-tools-toggle{min-height:36px!important;height:36px!important;padding:0 8px!important}.dh-card-actions-deck>.dh-nav-trio .dh-tools-toggle b{display:none}.dh-source-media-row{gap:6px!important}.dh-source-media-row #dhModeToggle,.dh-source-media-row .dh-youtube-source-btn{min-height:36px!important;height:36px!important}.dh-source-media-row .dh-youtube-source-btn{padding:0 10px!important;font-size:11px!important}}"
    +"@media(max-width:420px){.dh-card-actions-deck>.dh-nav-trio .dh-nav-btn{font-size:0!important}.dh-card-actions-deck>.dh-nav-trio .dh-nav-prev:after{content:'←';font-size:17px}.dh-card-actions-deck>.dh-nav-trio .dh-nav-next:after{content:'→';font-size:17px}.dh-source-media-row .dh-youtube-source-btn{font-size:0!important;width:42px;padding:0!important}.dh-source-media-row .dh-youtube-source-btn:after{content:'▶';font-size:14px}.dh-aiask-btn{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}"
    /* Masaüstü + mobil: cümleye dokununca açılan kompakt eylem paneli. */
    +".card.dh-split:not(.dh-actions-visible)>.dh-card-actions-deck{display:none!important}.card.dh-split>.dh-sentence-listen-row>.card-en{cursor:pointer;border-radius:9px;transition:background .18s ease,box-shadow .18s ease}.card.dh-split>.dh-sentence-listen-row>.card-en:hover,.card.dh-split>.dh-sentence-listen-row>.card-en:focus-visible{background:rgba(59,130,246,.08);box-shadow:0 0 0 2px rgba(59,130,246,.2);outline:0}.card.dh-split.dh-actions-visible>.dh-card-actions-deck{display:grid!important;grid-template-columns:auto auto minmax(180px,1fr)!important;align-items:center;gap:6px!important;padding-top:8px!important}.card.dh-split.dh-actions-visible>.dh-card-actions-deck>.grade-bar,.card.dh-split.dh-actions-visible>.dh-card-actions-deck>.grade-done{grid-column:1/-1;min-height:34px!important}.card.dh-split.dh-actions-visible .dh-card-actions-primary{display:grid!important;grid-template-columns:42px 42px!important;gap:6px!important}.card.dh-split.dh-actions-visible .dh-card-actions-primary>.dh-listen-after-sentence,.card.dh-split.dh-actions-visible .dh-card-actions-primary>.dh-ai-row,.card.dh-split.dh-actions-visible .dh-card-actions-primary>.dh-ai-row .dh-gtr-btn{width:42px!important;height:36px!important;min-height:36px!important;margin:0!important;padding:0!important}.card.dh-split.dh-actions-visible .dh-card-actions-primary>.dh-listen-after-sentence,.card.dh-split.dh-actions-visible .dh-card-actions-primary>.dh-ai-row .dh-gtr-btn{font-size:0!important}.card.dh-split.dh-actions-visible .dh-card-actions-primary>.dh-listen-after-sentence:after{content:'▶';font-size:14px}.card.dh-split.dh-actions-visible .dh-card-actions-primary>.dh-ai-row .dh-gtr-btn:after{content:'✦';font-size:16px}.card.dh-split.dh-actions-visible>.dh-card-actions-deck>.dh-nav-trio{display:grid!important;grid-template-columns:42px 42px 42px!important;gap:6px!important;width:auto!important}.card.dh-split.dh-actions-visible>.dh-card-actions-deck>.dh-nav-trio .dh-nav-btn,.card.dh-split.dh-actions-visible>.dh-card-actions-deck>.dh-nav-trio .dh-tools-toggle{width:42px!important;height:36px!important;min-height:36px!important;padding:0!important;font-size:0!important}.card.dh-split.dh-actions-visible>.dh-card-actions-deck>.dh-nav-trio .dh-nav-prev:after{content:'←';font-size:17px}.card.dh-split.dh-actions-visible>.dh-card-actions-deck>.dh-nav-trio .dh-nav-next:after{content:'→';font-size:17px}.card.dh-split.dh-actions-visible>.dh-card-actions-deck>.dh-nav-trio .dh-tools-toggle b{display:none!important}.card.dh-split.dh-actions-visible>.dh-card-actions-deck>.dh-source-media-row{min-width:0!important}.card.dh-split.dh-actions-visible>.dh-card-actions-deck>.dh-source-media-row #dhModeToggle,.card.dh-split.dh-actions-visible>.dh-card-actions-deck>.dh-source-media-row .dh-youtube-source-btn{height:36px!important;min-height:36px!important}"
    +"@media(max-width:680px){.card.dh-split.dh-actions-visible>.dh-card-actions-deck{grid-template-columns:auto auto!important}.card.dh-split.dh-actions-visible>.dh-card-actions-deck>.dh-source-media-row{grid-column:1/-1}.card.dh-split.dh-actions-visible>.dh-card-actions-deck>.grade-bar,.card.dh-split.dh-actions-visible>.dh-card-actions-deck>.grade-done{grid-column:1/-1}}"
    +"@media(pointer:coarse){.card.dh-split{touch-action:pan-y;transition:transform .16s ease,box-shadow .16s ease}.card.dh-split.dh-swipe-next{transform:translateX(-8px);box-shadow:8px 0 0 rgba(37,99,235,.8)}.card.dh-split.dh-swipe-prev{transform:translateX(8px);box-shadow:-8px 0 0 rgba(52,211,153,.8)}}"
    +".card.dh-split>.dh-sentence-listen-row>.card-en{cursor:default!important}.card.dh-split>.dh-sentence-listen-row>.card-en:hover,.card.dh-split>.dh-sentence-listen-row>.card-en:focus-visible{background:transparent;box-shadow:none}.dh-card-quickbar{display:flex;align-items:center;justify-content:flex-end;gap:7px;width:100%;margin:0 0 2px}.dh-card-quickbar button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:38px;padding:0 14px;border:1px solid #315071;border-radius:11px;background:#142640;color:#e8f2ff;font:900 12px Nunito,system-ui,sans-serif;cursor:pointer}.dh-card-quickbar button svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8}.dh-card-quickbar .dh-quick-listen{background:linear-gradient(135deg,#7c3aed,#2563eb);border-color:#6366f1}.dh-card-quickbar .dh-quick-tools[aria-expanded='true']{background:#0f766e;border-color:#34d399;color:#fff}@media(max-width:520px){.dh-card-quickbar{gap:6px}.dh-card-quickbar button{min-height:36px;padding:0 12px;font-size:11px}}"
    +".dh-work-return{position:fixed!important;z-index:2147483647!important;left:max(12px,env(safe-area-inset-left));bottom:max(14px,env(safe-area-inset-bottom));display:inline-flex!important;visibility:visible!important;opacity:1!important;align-items:center;justify-content:center;gap:8px;min-height:46px;padding:0 17px;border:2px solid rgba(255,255,255,.9);border-radius:14px;background:linear-gradient(135deg,#047857,#0f766e)!important;color:#fff!important;font:900 13px Nunito,system-ui,sans-serif;box-shadow:0 14px 38px rgba(0,0,0,.72),0 0 0 3px rgba(52,211,153,.32);cursor:pointer}.dh-work-return:hover,.dh-work-return:focus-visible{background:linear-gradient(135deg,#059669,#0d9488)!important;outline:3px solid #fff;outline-offset:2px}@media(max-width:680px){.dh-work-return{left:max(8px,env(safe-area-inset-left))!important;right:max(8px,env(safe-area-inset-right))!important;top:max(8px,env(safe-area-inset-top))!important;bottom:auto!important;width:auto!important;min-height:48px!important;padding:0 13px!important;font-size:13px!important;border-radius:12px!important}.dhgb-close,.dh-exp-reader-close,.dh-ai-reader-close{display:flex!important;visibility:visible!important;opacity:1!important;z-index:2147483647!important}}"
    +"@media(max-width:680px){.dh-mobile-tool-close{position:fixed!important;display:inline-flex!important;visibility:visible!important;opacity:1!important;z-index:2147483647!important;top:calc(max(8px,env(safe-area-inset-top)) + 58px)!important;left:max(10px,env(safe-area-inset-left))!important;right:auto!important;bottom:auto!important;min-width:120px!important;min-height:50px!important;padding:0 18px!important;border:2px solid rgba(255,255,255,.95)!important;border-radius:13px!important;background:#1e3a5f!important;color:#fff!important;font:900 15px Nunito,system-ui,sans-serif!important;box-shadow:0 10px 30px rgba(0,0,0,.75)!important;transform:none!important}.dh-mobile-tool-header{position:sticky!important;top:0!important;z-index:2147483646!important;padding-top:122px!important;background:linear-gradient(180deg,#111b32 84%,rgba(17,27,50,.92))!important}}"
    +".card.dh-youtube-source-sentence>.sm-img-wrap,.card.dh-youtube-source-sentence .sm-img-wrap,.card.dh-youtube-source-sentence #dhModeToggle{display:none!important}.card.dh-youtube-source-sentence .dh-source-media-row{justify-content:flex-end}.card.dh-youtube-source-sentence .dh-youtube-source-btn{display:inline-flex!important;align-items:center;justify-content:center;min-width:150px}"
    /* Tek, sürekli açık üst çalışma şeridi. */
    +".card.dh-split>.card-meta{display:none!important}.card.dh-split>.dh-card-quickbar{display:flex!important;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:7px;width:100%;margin:0 0 8px;padding:0}.dh-card-quickbar>.dh-card-actions-primary{display:flex!important;gap:7px;margin:0}.dh-card-quickbar>.dh-card-actions-primary>.dh-listen-after-sentence,.dh-card-quickbar>.dh-card-actions-primary>.dh-ai-row,.dh-card-quickbar>.dh-card-actions-primary>.dh-ai-row .dh-gtr-btn{width:42px!important;height:38px!important;min-height:38px!important;margin:0!important;padding:0!important}.dh-card-quickbar>.dh-card-actions-primary>.dh-listen-after-sentence,.dh-card-quickbar>.dh-card-actions-primary>.dh-ai-row .dh-gtr-btn{font-size:0!important}.dh-card-quickbar>.dh-card-actions-primary>.dh-listen-after-sentence:after{content:'▶';font-size:14px}.dh-card-quickbar>.dh-card-actions-primary>.dh-ai-row .dh-gtr-btn:after{content:'✦';font-size:16px}.dh-card-quickbar>.dh-nav-trio{display:flex!important;gap:7px;width:auto!important;margin:0!important}.dh-card-quickbar>.dh-nav-trio .dh-nav-btn,.dh-card-quickbar>.dh-nav-trio .dh-tools-toggle{flex:0 0 42px!important;width:42px!important;height:38px!important;min-height:38px!important;padding:0!important;font-size:0!important;border-radius:11px!important}.dh-card-quickbar>.dh-nav-trio .dh-nav-prev:after{content:'←';font-size:17px}.dh-card-quickbar>.dh-nav-trio .dh-nav-next:after{content:'→';font-size:17px}.dh-card-quickbar>.dh-nav-trio .dh-tools-toggle b{display:none!important}.dh-card-quickbar>.dh-source-media-row{width:auto!important;margin:0!important}.dh-card-quickbar>.dh-source-media-row #dhModeToggle,.dh-card-quickbar>.dh-source-media-row .dh-youtube-source-btn{height:38px!important;min-height:38px!important;margin:0!important}.card.dh-split>.dh-card-actions-deck{display:grid!important;grid-template-columns:1fr!important;padding-top:10px!important}.card.dh-split>.dh-card-actions-deck>.grade-bar,.card.dh-split>.dh-card-actions-deck>.grade-done{grid-column:1!important}.card.dh-split>.dh-card-actions-deck>.dh-card-actions-primary,.card.dh-split>.dh-card-actions-deck>.dh-nav-trio,.card.dh-split>.dh-card-actions-deck>.dh-source-media-row{display:none!important}@media(max-width:520px){.card.dh-split>.dh-card-quickbar{justify-content:flex-start;gap:6px}.dh-card-quickbar>.dh-card-actions-primary,.dh-card-quickbar>.dh-nav-trio{gap:6px}.dh-card-quickbar>.dh-source-media-row .dh-youtube-source-btn{min-width:42px!important;width:42px!important;font-size:0!important;padding:0!important}.dh-card-quickbar>.dh-source-media-row .dh-youtube-source-btn:after{content:'▶';font-size:14px}}"
    +"@media(max-width:360px){.dh-tools-box{width:100vw}.dh-tool-grid{grid-template-columns:1fr}.dh-tools-head{padding-left:14px;padding-right:14px}.dh-tools-scroll{padding-left:12px;padding-right:12px}.dh-tool-card{min-height:62px}.dh-tools-title span{display:none}}";
    document.head.appendChild(s);
  }

  function card(){
    var cs=document.querySelectorAll(".card");
    for(var i=0;i<cs.length;i++) if(cs[i].querySelector(".card-en")&&cs[i].querySelector(".card-actions")) return cs[i];
    return null;
  }
  function byText(root,t){
    if(!root) return null;
    t=t.toLocaleLowerCase("tr");
    var bs=root.querySelectorAll("button,a");
    for(var i=0;i<bs.length;i++) if((bs[i].textContent||"").toLocaleLowerCase("tr").indexOf(t)>=0) return bs[i];
    return null;
  }

  function youtubeSourceForCard(c){
    if(!c||!window.DHModul)return null;
    var en=c.querySelector(".card-en"),text=(en&&en.textContent||"").trim().toLocaleLowerCase("en");
    if(!text)return null;
    try{
      var list=DHModul.liste();
      for(var i=0;i<list.length;i++){
        var rows=DHModul.getir(list[i].id)||[];
        for(var j=0;j<rows.length;j++){
          var r=rows[j];
          if(r&&r.videoId&&String(r.en||"").trim().toLocaleLowerCase("en")===text)return r;
        }
      }
    }catch(e){}
    return null;
  }

  function ensureYoutubeSourceButton(c){
    var toggle=c&&c.querySelector("#dhModeToggle");
    if(!toggle)return;
    var wrap=c.querySelector(".dh-source-media-row");
    if(!wrap){wrap=document.createElement("div");wrap.className="dh-source-media-row";toggle.parentElement.insertBefore(wrap,toggle);wrap.appendChild(toggle);}
    var button=wrap.querySelector(".dh-youtube-source-btn");
    if(!button){button=document.createElement("button");button.type="button";button.className="dh-youtube-source-btn";button.textContent="▶ YouTube video";button.onclick=function(){var source=youtubeSourceForCard(card());if(!source)return;location.href="./youtube-egitim.html?video="+encodeURIComponent(source.videoId)+"&sentence="+encodeURIComponent(source.videoSentenceIndex||0)+"&sentenceKey="+encodeURIComponent(source.videoSentenceKey||"")+"&text="+encodeURIComponent(source.en||"")+"&t="+encodeURIComponent(source.videoStartSeconds||0)+"&loop=1&fullscreen=1";};wrap.appendChild(button);}
    var source=youtubeSourceForCard(c);c.classList.toggle("dh-youtube-source-sentence",!!source);button.hidden=!source;button.title=source?"Bu cümleyi kaynak YouTube videosunda aç":"";
    if(source){var oldImage=c.querySelector(".sm-img-wrap");if(oldImage)oldImage.remove();toggle.hidden=true;}else toggle.hidden=false;
  }

  function activeSentenceContext(){
    var c=card(),en=c&&c.querySelector(".card-en"),tr=c&&c.querySelector(".card-tr");
    return{card:c,en:(en&&en.textContent||"").trim(),tr:(tr&&tr.textContent||"").trim()};
  }
  function openActiveTranslate(){
    var context=activeSentenceContext();if(!context.en)return;
    try{if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(context.en);}catch(e){}
    window.open("https://translate.google.com/?sl=en&tl=tr&op=translate&text="+encodeURIComponent(context.en),"_blank");
  }
  function openActiveStudio(){
    var context=activeSentenceContext();if(!context.en)return;var back="";
    try{var mod=new URLSearchParams(location.search).get("mod"),target="";if(mod&&window.DHModul){var entries=DHModul.liste()||[];for(var i=0;i<entries.length&&!target;i++)if(normalizeModuleName(entries[i].ad)===normalizeModuleName(mod)){var rows=DHModul.getir(entries[i].id)||[];for(var j=0;j<rows.length;j++)if(String(rows[j].en||"").trim()===context.en){target=rows[j].id||"";break;}}}if(mod)back="index-app.html?mod="+encodeURIComponent(mod)+(target?"&target="+encodeURIComponent(target):"")+"&q="+encodeURIComponent(context.en);}catch(e){}
    location.href="./sesdalga.html?en="+encodeURIComponent(context.en)+"&tr="+encodeURIComponent(context.tr)+(back?("&back="+encodeURIComponent(back)):"");
  }

  function saveToolReturnContext(title){
    var x=activeSentenceContext(),target="";try{var mod=requestedModuleName();if(mod&&window.DHModul){var entries=DHModul.liste()||[];for(var i=0;i<entries.length&&!target;i++)if(normalizeModuleName(entries[i].ad)===normalizeModuleName(mod)){var rows=DHModul.getir(entries[i].id)||[];for(var j=0;j<rows.length;j++)if(String(rows[j].en||"").trim()===x.en){target=rows[j].id||"";break;}}}}catch(e){}
    var data={title:title||"Araç",module:requestedModuleName(),target:target,sentence:x.en,url:location.href,scrollY:window.scrollY||0,at:Date.now()};try{sessionStorage.setItem("dh-module-tool-return-v1",JSON.stringify(data));}catch(e){}return data;
  }
  function exactModuleReturnUrl(saved){
    saved=saved||saveToolReturnContext("Araç");
    var fallback="";try{fallback=new URL("./index-app.html",location.href).href;}catch(e){fallback="./index-app.html";}
    if(!saved.module)return saved.url||fallback;
    try{var u=new URL("./index-app.html",location.href);u.searchParams.set("mod",saved.module);if(saved.target)u.searchParams.set("target",saved.target);else u.searchParams.set("q",saved.sentence||"");return u.href;}catch(e){return "./index-app.html?mod="+encodeURIComponent(saved.module)+(saved.target?"&target="+encodeURIComponent(saved.target):"&q="+encodeURIComponent(saved.sentence||""));}
  }
  function openActiveTeacher(){
    var context=activeSentenceContext();if(!context.en)return;var saved=saveToolReturnContext("Öğretmen görünümü"),back=exactModuleReturnUrl(saved);try{localStorage.setItem("teacherReturnURL",back);sessionStorage.setItem("teacherReturnURL",back);}catch(e){}
    location.href="./teacher.html?s="+encodeURIComponent(context.en)+"&t="+encodeURIComponent(context.tr||"")+"&return="+encodeURIComponent(back);
  }
  function closeToolSurfaces(){
    var clickSelectors=[".dh-exp-reader-close",".dhgb-close","#dhAiCancel",'#dhAiEditModal [data-x="cancel"]'];for(var i=0;i<clickSelectors.length;i++){var b=document.querySelector(clickSelectors[i]);if(b)try{b.click();}catch(e){}}
    ["dhAiBulkModal","dhAiModal","dhAiEditModal"].forEach(function(id){var n=document.getElementById(id);if(n)n.remove();});var result=document.getElementById("dhAiResultBox");if(result)result.remove();
    Array.prototype.forEach.call(document.querySelectorAll("button,a"),function(button){
      if(button.id==="dhWorkReturn"||button.closest("#dhToolsOverlay"))return;var label=((button.textContent||"")+" "+(button.getAttribute("aria-label")||"")).replace(/\s+/g," ").trim();if(!/(kapat|close|çıkış|geri dön|çalışmaya dön)/i.test(label))return;
      var surface=button.closest("[role='dialog'],[class*='overlay'],[class*='modal'],[class*='reader'],[class*='fullscreen']");if(!surface)return;var style=getComputedStyle(surface);if(style.display==="none"||style.visibility==="hidden")return;try{button.click();}catch(e){}
    });
  }
  function placeToolReturnInTopLayer(){
    var b=document.getElementById("dhWorkReturn");if(!b)return;
    /* Araç içeriğine bağlanmaz: içerik yeniden çizilse bile dönüş düğmesi kaybolmaz. */
    var host=document.fullscreenElement||document.webkitFullscreenElement||document.body;
    if(host&&host.appendChild&&(b.parentElement!==host||b!==host.lastElementChild))host.appendChild(b);
  }
  var dhReturningToSentence=false;
  function returnToWorkingSentence(){
    if(dhReturningToSentence)return;dhReturningToSentence=true;
    var saved=null;try{saved=JSON.parse(sessionStorage.getItem("dh-module-tool-return-v1")||"null");}catch(e){}
    /* Ana araç çekmecesi mutlaka kapanmalı; yalnız yardımcı modalleri kapatmak yetmez. */
    closeModuleTools();var overlay=document.getElementById("dhToolsOverlay");if(overlay)overlay.classList.add("dh-hidden");document.documentElement.classList.remove("dh-tools-open");
    closeToolSurfaces();try{if(document.fullscreenElement&&document.exitFullscreen)document.exitFullscreen();else if(document.webkitFullscreenElement&&document.webkitExitFullscreen)document.webkitExitFullscreen();}catch(e){}var c=card(),en=c&&c.querySelector(".card-en"),current=(en&&en.textContent||"").trim();
    /* Araç kendi katmanını kapatmasa bile kesin dönüş: modülü ve benzersiz cümleyi yeniden aç. */
    if(saved&&saved.module){var url="./index-app.html?mod="+encodeURIComponent(saved.module)+(saved.target?"&target="+encodeURIComponent(saved.target):"&q="+encodeURIComponent(saved.sentence||""));try{sessionStorage.removeItem("dh-module-tool-return-v1");}catch(e){}location.replace(url);return;}
    if(c)setActionPanel(c,false);if(en){try{en.scrollIntoView({block:"center",behavior:"smooth"});}catch(e){}setTimeout(function(){try{en.focus({preventScroll:true});}catch(e){}},250);}var button=document.getElementById("dhWorkReturn");if(button)button.remove();try{sessionStorage.removeItem("dh-module-tool-return-v1");}catch(e){}setTimeout(function(){dhReturningToSentence=false;},250);
  }
  function showToolReturn(title){
    var b=document.getElementById("dhWorkReturn");if(!b){b=document.createElement("button");b.id="dhWorkReturn";b.type="button";b.className="dh-work-return";b.onclick=returnToWorkingSentence;document.body.appendChild(b);}b.textContent="← Çalışılan cümleye dön";b.title=(title||"Araç")+" görünümünü kapat";
    placeToolReturnInTopLayer();setTimeout(placeToolReturnInTopLayer,0);setTimeout(placeToolReturnInTopLayer,250);setTimeout(placeToolReturnInTopLayer,800);
  }
  function ensureMobileGeneratedToolExit(){
    var active=null;try{active=JSON.parse(sessionStorage.getItem("dh-module-tool-return-v1")||"null");}catch(e){}if(!active)return;
    Array.prototype.forEach.call(document.querySelectorAll("button,a"),function(button){
      if(button.id==="dhWorkReturn"||button.closest("#dhToolsOverlay"))return;var label=((button.textContent||"")+" "+(button.getAttribute("aria-label")||"")).replace(/\s+/g," ").trim();if(!/(kapat|close|çıkış)$/i.test(label))return;
      var host=button.closest("[role='dialog'],[class*='overlay'],[class*='modal'],[class*='reader'],[class*='fullscreen']")||button.parentElement;if(!host)return;
      button.classList.add("dh-mobile-tool-close");if(button.parentElement)button.parentElement.classList.add("dh-mobile-tool-header");
      if(!button.dataset.dhSentenceReturn){button.dataset.dhSentenceReturn="1";button.addEventListener("click",function(){setTimeout(returnToWorkingSentence,0);});}
    });
  }
  function restoreStoredToolReturn(){
    if(document.getElementById("dhWorkReturn"))return;var saved=null;try{saved=JSON.parse(sessionStorage.getItem("dh-module-tool-return-v1")||"null");}catch(e){}if(!saved||!saved.at||Date.now()-saved.at>21600000)return;
    var surface=document.querySelector(".dhgb-ov,.dh-exp-reader,.dh-ai-reader,[role='dialog']:not(#dhToolsBox),[class*='fullscreen']");if(!surface&&card()){try{sessionStorage.removeItem("dh-module-tool-return-v1");}catch(e){}return;}showToolReturn(saved.title||"Araç");
  }

  /* Ana kartta yalnız aktif cümleyi açıklayan tek bir AI eylemi kalır. */
  function ensureAiRow(c, trio){
    var en=c.querySelector(".card-en");
    if(!en) return;
    var anchor = trio || gradeAnchor(c);
    if(!anchor) return;
    var row=document.getElementById("dhAiRow");
    if(!row){
      row=document.createElement("div");
      row.id="dhAiRow"; row.className="dh-ai-row";

      var ai=document.createElement("button");
      ai.type="button"; ai.className="dh-gtr-btn dh-aiask-btn"; ai.textContent="✦ Gemini ile açıkla";ai.title="Aktif cümleyi ayrıntılı açıkla";
      row.appendChild(ai);
    }
    if(row.previousElementSibling!==anchor || row.parentElement!==anchor.parentElement){
      anchor.insertAdjacentElement("afterend", row);
    }
  }

  function realPrevBtn(){
    var nav=document.querySelector(".study-nav");
    return nav ? nav.querySelector("button.btn:not(.btn-primary)") : null;
  }
  function realNextBtn(){
    var nav=document.querySelector(".study-nav");
    return nav ? nav.querySelector("button.btn-primary") : null;
  }

  function gradeAnchor(c){
    return c.querySelector(".grade-bar") || c.querySelector(".grade-done") || c.querySelector(".card-meta");
  }
  function ensureListenAfterSentence(c){
    var en=c.querySelector(".card-en");if(!en)return;
    var listen=byText(c.querySelector(".card-actions"),"dinle");
    if(!listen)listen=c.querySelector(".dh-listen-after-sentence");
    if(!listen)return;
    listen.classList.add("dh-listen-after-sentence");
    var row=en.closest(".dh-sentence-listen-row");
    if(!row){
      row=document.createElement("div");
      row.className="dh-sentence-listen-row";
      en.parentElement.insertBefore(row,en);
      row.appendChild(en);
    }
    if(listen.parentElement!==row||listen.previousElementSibling!==en)row.appendChild(listen);
  }
  function ensureSentenceActionToggle(c){
    var en=c&&c.querySelector(".card-en");if(!en)return;
    var sentence=(en.textContent||"").trim();
    if(c.dataset.dhActionSentence!==sentence){c.dataset.dhActionSentence=sentence;c.classList.remove("dh-actions-visible");}
    en.setAttribute("role","button");en.setAttribute("tabindex","0");en.setAttribute("aria-expanded",c.classList.contains("dh-actions-visible")?"true":"false");en.title="Çalışma düğmelerini göster / gizle";
    if(en.dataset.dhActionToggle)return;en.dataset.dhActionToggle="1";
    function toggle(){if(Date.now()<suppressSentenceToggleUntil)return;var visible=c.classList.toggle("dh-actions-visible");en.setAttribute("aria-expanded",visible?"true":"false");}
    en.addEventListener("click",toggle);en.addEventListener("keydown",function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();toggle();}});
  }
  function setActionPanel(c,visible){
    if(!c)return;c.classList.toggle("dh-actions-visible",!!visible);var b=c.querySelector(".dh-quick-tools");if(b)b.setAttribute("aria-expanded",visible?"true":"false");
  }
  function ensureTopQuickBar(c){
    var en=c&&c.querySelector(".card-en");if(!en)return;var sentence=(en.textContent||"").trim(),bar=c.querySelector(".dh-card-quickbar");
    if(c.dataset.dhQuickSentence!==sentence)c.dataset.dhQuickSentence=sentence;c.classList.add("dh-actions-visible","dh-actions-persistent");
    if(!bar){
      bar=document.createElement("div");bar.className="dh-card-quickbar";bar.setAttribute("aria-label","Sürekli cümle araçları");
    }
    Array.prototype.forEach.call(bar.querySelectorAll(".dh-quick-listen,.dh-quick-tools"),function(old){old.remove();});
    var sentenceRow=c.querySelector(".dh-sentence-listen-row");if(sentenceRow&&bar.parentElement!==c)c.insertBefore(bar,sentenceRow);else if(!bar.parentElement)c.insertBefore(bar,c.firstChild);
  }
  function ensureSwipeNavigation(c){
    if(!c||c.dataset.dhSwipeNavigation)return;c.dataset.dhSwipeNavigation="1";
    var sx=0,sy=0,started=0,tracking=false;
    c.addEventListener("touchstart",function(e){
      var target=e.target;if(!e.touches||e.touches.length!==1||target&&target.closest&&target.closest("button,a,input,textarea,select,[contenteditable='true'],.dh-tools-overlay")){tracking=false;return;}
      sx=e.touches[0].clientX;sy=e.touches[0].clientY;started=Date.now();tracking=true;
    },{passive:true});
    c.addEventListener("touchend",function(e){
      if(!tracking||!e.changedTouches||e.changedTouches.length!==1)return;tracking=false;
      var dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy,elapsed=Date.now()-started;
      if(elapsed>900||Math.abs(dx)<55||Math.abs(dx)<Math.abs(dy)*1.25)return;
      suppressSentenceToggleUntil=Date.now()+500;setActionPanel(c,false);
      var direction=dx<0?1:-1,button=direction>0?realNextBtn():realPrevBtn();if(!button||button.disabled)return;
      var cls=direction>0?"dh-swipe-next":"dh-swipe-prev";c.classList.add(cls);setTimeout(function(){c.classList.remove(cls);button.click();},120);
    },{passive:true});
    c.addEventListener("touchcancel",function(){tracking=false;},{passive:true});
  }
  function ensureActionDeck(c){
    var deck=c.querySelector(".dh-card-actions-deck");if(!deck){deck=document.createElement("div");deck.className="dh-card-actions-deck";deck.setAttribute("aria-label","Çalışma eylemleri");c.appendChild(deck);}
    var bar=c.querySelector(".dh-card-quickbar");if(!bar)return;var primary=c.querySelector(".dh-card-actions-primary");if(!primary){primary=document.createElement("div");primary.className="dh-card-actions-primary";}
    var grade=c.querySelector(":scope > .grade-bar, :scope > .grade-done");if(grade)deck.appendChild(grade);bar.appendChild(primary);
    var listen=c.querySelector(".dh-listen-after-sentence");if(listen&&listen.parentElement!==primary)primary.appendChild(listen);
    var ai=document.getElementById("dhAiRow");if(ai&&ai.parentElement!==primary)primary.appendChild(ai);
    var trio=document.getElementById("dhNavTrio");if(trio)bar.appendChild(trio);
    var media=c.querySelector(".dh-source-media-row");if(media)bar.appendChild(media);
  }
  function ensureNavTrio(c){
    var anchor=gradeAnchor(c);
    if(!anchor) return null;
    var trio=document.getElementById("dhNavTrio");
    if(!trio){
      trio=document.createElement("div");
      trio.id="dhNavTrio"; trio.className="dh-nav-trio";
      var prev=document.createElement("button");
      prev.type="button"; prev.className="dh-nav-btn dh-nav-prev"; prev.textContent="← Önceki";
      prev.onclick=function(){ var r=realPrevBtn(); if(r) r.click(); };
      var next=document.createElement("button");
      next.type="button"; next.className="dh-nav-btn dh-nav-next"; next.textContent="Sonraki →";
      next.onclick=function(){ var r=realNextBtn(); if(r) r.click(); };
      trio.appendChild(prev);
      trio.appendChild(next);
      anchor.insertAdjacentElement("afterend", trio);
    }
    if(trio.previousElementSibling!==anchor || trio.parentElement!==anchor.parentElement){
      anchor.insertAdjacentElement("afterend", trio);
    }
    var rp=realPrevBtn(), rn=realNextBtn();
    var pBtn=trio.querySelector(".dh-nav-prev"), nBtn=trio.querySelector(".dh-nav-next");
    if(pBtn) pBtn.disabled = !!(rp && rp.disabled);
    if(nBtn) nBtn.disabled = !!(rn && rn.disabled);
    return trio;
  }

  function moduleToolIcon(name){
    var paths={spark:'<path d="m12 3 1.2 4.1L17 9l-3.8 1.9L12 15l-1.2-4.1L7 9l3.8-1.9L12 3Z"/><path d="m18.5 14 .7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3Z"/>',translate:'<circle cx="12" cy="12" r="9"/><path d="M3.5 12h17M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6"/>',slow:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',detail:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',stack:'<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 8a7 7 0 0 1 11.5-2L20 8M4 16l2.4 2A7 7 0 0 0 18 16"/>',file:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',archive:'<path d="M4 7h16v14H4zM3 3h18v4H3zM9 11h6"/>',teacher:'<path d="m3 8 9-5 9 5-9 5-9-5Z"/><path d="M7 11v5c3 2 7 2 10 0v-5M21 8v7"/>',chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'};
    return'<svg viewBox="0 0 24 24" aria-hidden="true">'+(paths[name]||paths.detail)+'</svg>';
  }
  function closeModuleTools(){
    var overlay=document.getElementById("dhToolsOverlay"),toggle=document.getElementById("dhToolsToggle");if(!overlay)return;
    overlay.classList.add("dh-hidden");overlay.hidden=true;overlay.setAttribute("aria-hidden","true");overlay.style.setProperty("display","none","important");document.documentElement.classList.remove("dh-tools-open");if(toggle){toggle.setAttribute("aria-expanded","false");}
  }
  function openModuleTools(){
    var overlay=document.getElementById("dhToolsOverlay"),toggle=document.getElementById("dhToolsToggle");if(!overlay)return;
    overlay.hidden=false;overlay.removeAttribute("aria-hidden");overlay.style.removeProperty("display");overlay.classList.remove("dh-hidden");document.documentElement.classList.add("dh-tools-open");if(toggle)toggle.setAttribute("aria-expanded","true");var close=overlay.querySelector(".dh-tools-close");if(close)close.focus();
  }
  function ensureTools(){
    var overlay=document.getElementById("dhToolsOverlay"),box=document.getElementById("dhToolsBox"),scroll;
    if(!overlay){
      overlay=document.createElement("div");overlay.id="dhToolsOverlay";overlay.className="dh-tools-overlay dh-hidden";overlay.setAttribute("role","presentation");
      box=document.createElement("aside");box.id="dhToolsBox";box.className="dh-tools-box";box.setAttribute("role","dialog");box.setAttribute("aria-modal","true");box.setAttribute("aria-label","Modül araçları");
      box.innerHTML='<header class="dh-tools-head"><div><button class="dh-tools-back" type="button">← Çalışmaya dön</button><div class="dh-tools-title"><strong>Modül araçları</strong><span>İhtiyacınız olduğunda açın</span></div></div><button class="dh-tools-close" type="button" aria-label="Araçları kapat">'+moduleToolIcon("detail")+'</button></header><div class="dh-tools-tabs" role="tablist" aria-label="Araç kategorileri"><button class="dh-tools-tab" type="button" role="tab" data-tool-tab="sentence" aria-selected="true">Cümle</button><button class="dh-tools-tab" type="button" role="tab" data-tool-tab="module" aria-selected="false">Modül</button><button class="dh-tools-tab" type="button" role="tab" data-tool-tab="analysis" aria-selected="false">Analiz</button></div><div class="dh-tools-scroll"></div>';
      /* Bilgi simgesinin yerine sade kapatma çarpısı kullan. */
      box.querySelector(".dh-tools-close").innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
      scroll=box.querySelector(".dh-tools-scroll");
      var section=function(title,note,tab){var el=document.createElement("section");el.className="dh-tool-section dh-tool-panel";el.dataset.toolPanel=tab;el.hidden=tab!=="sentence";el.innerHTML='<header><strong>'+title+'</strong><span>'+note+'</span></header><div class="dh-tool-grid"></div>';scroll.appendChild(el);return el.querySelector(".dh-tool-grid");};
      var tool=function(grid,icon,title,description,action,tone){var button=document.createElement("button");button.type="button";button.className="dh-tool-card"+(tone?(" is-"+tone):"");button.innerHTML='<span class="dh-tool-icon">'+moduleToolIcon(icon)+'</span><span class="dh-tool-copy"><b>'+title+'</b><small>'+description+'</small></span>';button.onclick=function(){
        /* Bağlam kaydı hata verse bile araç ve dönüş yolu çalışmaya devam eder. */
        try{saveToolReturnContext(title);}catch(contextError){try{sessionStorage.setItem("dh-module-tool-return-v1",JSON.stringify({title:title,module:"",sentence:(activeSentenceContext().en||""),at:Date.now()}));}catch(ignore){}}
        try{closeModuleTools();}catch(closeError){var ov=document.getElementById("dhToolsOverlay");if(ov)ov.classList.add("dh-hidden");document.documentElement.classList.remove("dh-tools-open");}
        /* Düğmeyi eylemden ÖNCE kur: eylem hata verse veya beklese bile kaybolmaz. */
        try{showToolReturn(title);}catch(returnError){}
        /* Tarayıcıya çekmeceyi boyaması için bir kare ver; yeni araç daima onun üstünde açılır. */
        setTimeout(function(){try{action();setTimeout(placeToolReturnInTopLayer,0);setTimeout(placeToolReturnInTopLayer,300);setTimeout(placeToolReturnInTopLayer,900);}catch(actionError){console.error("Modül aracı çalıştırılamadı:",title,actionError);alert(title+" şu anda açılamadı. Çalışılan cümleye dön düğmesini kullanabilirsiniz.");}},40);
      };grid.appendChild(button);return button;};
      var sentence=section("Cümle araçları","Aktif cümle","sentence");
      tool(sentence,"spark","Gemini ile açıkla","Ayrıntılı ve ortak açıklama",function(){var b=document.querySelector(".dh-aiask-btn");if(b)b.click();},"purple");
      tool(sentence,"translate","Translate","Cümleyi çeviride aç",openActiveTranslate);
      tool(sentence,"mic","Konuşma stüdyosu","Ses ve telaffuz çalış",openActiveStudio);
      tool(sentence,"slow","Yavaş oynat","Telaffuzu yavaş dinle",function(){var t=byText(card(),"yavaş");if(t)t.click();else alert("Bu cümlede yavaş oynatma seçeneği bulunmuyor.");});
      tool(sentence,"detail","Detay görünümü","Cümlenin tüm alanlarını aç",function(){var t=byText(card(),"detay");if(t)t.click();else alert("Bu cümlede detay görünümü bulunmuyor.");});
      var module=section("Modül işlemleri","Toplu çalışma","module");
      tool(module,"stack","Eksikleri açıkla","Yalnız açıklaması olmayanlar",function(){explainActiveModuleWithAI();},"purple");
      tool(module,"refresh","Modülü yeniden açıkla","Kayıtlı açıklamaları yenile",function(){if(confirm("Kayıtlı olanlar dahil tüm aktif modül tek istekte yeniden hazırlansın mı?"))explainActiveModuleWithAI(true);},"danger");
      tool(module,"file","Aktif modülü indir","Bu modülü PDF olarak kaydet",function(){exportModuleToPDF(false);});
      tool(module,"archive","Tümünü PDF indir","Bütün modülleri arşivle",function(){exportModuleToPDF(true);});
      var analysis=section("Gelişmiş analiz","İsteğe bağlı","analysis");
      tool(analysis,"teacher","Öğretmen görünümü","Öğretici ipuçlarını göster",openActiveTeacher);
      tool(analysis,"chart","Zayıf analiz","Zorlandığınız alanları incele",function(){var c=card(),t=c&&(c.querySelector(".extra-weak")||byText(c,"zayıf"));if(t)t.click();else alert("Bu cümlede zayıf analiz görünümü bulunmuyor.");});
      var nativeSection=document.createElement("section");nativeSection.id="dhNativeToolsSection";nativeSection.className="dh-tool-section dh-tool-panel";nativeSection.dataset.toolPanel="analysis";nativeSection.hidden=true;nativeSection.innerHTML='<header><strong>Ek çalışma</strong><span>Diğer seçenekler</span></header>';scroll.appendChild(nativeSection);
      /* Sonradan içeri taşınan eski araç düğmeleri de çekmeceyi mutlaka kapatsın. */
      nativeSection.addEventListener("click",function(event){var pressed=event.target&&event.target.closest&&event.target.closest("button,a");if(!pressed||!nativeSection.contains(pressed))return;var label=(pressed.textContent||pressed.getAttribute("aria-label")||"Araç").trim();try{saveToolReturnContext(label);}catch(e){}closeModuleTools();showToolReturn(label);setTimeout(placeToolReturnInTopLayer,0);setTimeout(placeToolReturnInTopLayer,300);},false);
      overlay.appendChild(box);document.body.appendChild(overlay);
      overlay.onclick=function(event){if(event.target===overlay)closeModuleTools();};box.onclick=function(event){event.stopPropagation();};box.querySelector(".dh-tools-close").onclick=closeModuleTools;box.querySelector(".dh-tools-back").onclick=closeModuleTools;
      Array.prototype.forEach.call(box.querySelectorAll(".dh-tools-tab"),function(tab){tab.onclick=function(){var key=tab.dataset.toolTab;Array.prototype.forEach.call(box.querySelectorAll(".dh-tools-tab"),function(t){t.setAttribute("aria-selected",t===tab?"true":"false");});Array.prototype.forEach.call(box.querySelectorAll(".dh-tool-panel"),function(panel){panel.hidden=panel.dataset.toolPanel!==key;});scroll.scrollTop=0;};});
      if(!document.documentElement.dataset.dhModuleToolsKey){document.documentElement.dataset.dhModuleToolsKey="1";document.addEventListener("keydown",function(event){
        var current=document.getElementById("dhToolsOverlay");if(!current||current.classList.contains("dh-hidden"))return;
        if(event.key==="Escape"){closeModuleTools();return;}
        if(event.key!=="Tab")return;var focusable=current.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])');if(!focusable.length)return;var first=focusable[0],last=focusable[focusable.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      });}
    }
    scroll=box.querySelector(".dh-tools-scroll");
    var grid=document.querySelector(".wd-tools-row"),nativeSection=box.querySelector("#dhNativeToolsSection");
    if(grid&&nativeSection){if(grid.parentElement!==nativeSection)nativeSection.appendChild(grid);var active=box.querySelector('.dh-tools-tab[aria-selected="true"]');nativeSection.hidden=!(active&&active.dataset.toolTab==="analysis");}

    var tg=document.getElementById("dhToolsToggle");
    if(!tg){
      tg=document.createElement("button");tg.id="dhToolsToggle";tg.type="button";tg.className="dh-tools-toggle";tg.setAttribute("aria-controls","dhToolsBox");tg.setAttribute("aria-expanded","false");tg.setAttribute("aria-label","Modül araçlarını aç");tg.innerHTML=moduleToolIcon("stack")+'<b>Araçlar</b>';
      tg.onclick=function(){if(overlay.classList.contains("dh-hidden"))openModuleTools();else closeModuleTools();};
    }
    var trio=document.getElementById("dhNavTrio");
    if(trio&&tg.parentElement!==trio){
      var nextBtn=trio.querySelector(".dh-nav-next");
      if(nextBtn) trio.insertBefore(tg,nextBtn); else trio.appendChild(tg);
    }else if(!trio){
      var nav=document.querySelector(".study-nav");
      if(nav&&tg.parentElement!==nav){
        var btns=nav.querySelectorAll(".btn");
        if(btns.length>=2) nav.insertBefore(tg,btns[btns.length-1]); else nav.appendChild(tg);
      }
    }
  }

  function apply(){
    if(applying) return;
    applying=true;
    try{
      addStyle();
      var c=card();
      if(c){
        if(!c.classList.contains("dh-split")) c.classList.add("dh-split");
        ensureListenAfterSentence(c);
        ensureTopQuickBar(c);
        ensureSwipeNavigation(c);
        ensureNavTrio(c);
        var trio=document.getElementById("dhNavTrio");
        ensureAiRow(c, trio);
        ensureYoutubeSourceButton(c);
        ensureActionDeck(c);
        checkAndSyncAiBox(c);
      }
      ensureTools();
      restoreStoredToolReturn();
      if(document.getElementById("dhWorkReturn"))placeToolReturnInTopLayer();
      ensureMobileGeneratedToolExit();
      scheduleModuleAIStatusUI();
    }catch(e){}
    applying=false;
  }
  function schedule(){ if(scheduled) return; scheduled=true; setTimeout(function(){ scheduled=false; apply(); },150); }
  function boot(){
    apply();
    document.addEventListener("fullscreenchange",function(){setTimeout(function(){restoreStoredToolReturn();placeToolReturnInTopLayer();},0);});
    document.addEventListener("webkitfullscreenchange",function(){setTimeout(function(){restoreStoredToolReturn();placeToolReturnInTopLayer();},0);});
    try{ new MutationObserver(function(){ if(!applying) schedule(); }).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["class"]}); }catch(e){}
    var n=0,t=setInterval(function(){ apply(); if(++n>10) clearInterval(t); },400);
  }
  if(document.readyState!=="loading") boot(); else document.addEventListener("DOMContentLoaded",boot);
})();

/* --- MODÜL AI DURUMU: açılış uyarısı + tamamlanan kart zemini --- */
var dhModuleAIStatusTimer=0,dhModuleAIStatusBusy=false,dhModuleSentenceStatusCache=null;
function scheduleModuleAIStatusUI(){clearTimeout(dhModuleAIStatusTimer);dhModuleAIStatusTimer=setTimeout(refreshModuleAIStatusUI,450);}
async function moduleStatusSentences(){if(dhModuleSentenceStatusCache)return dhModuleSentenceStatusCache;var all=[];try{var r=await fetch("./data/sentences.json");if(r.ok)all=await r.json();}catch(e){}if(!all.length&&window._sentencesCache)all=window._sentencesCache;dhModuleSentenceStatusCache=all||[];return dhModuleSentenceStatusCache;}
async function refreshModuleAIStatusUI(){
  if(dhModuleAIStatusBusy)return;dhModuleAIStatusBusy=true;
  try{
    var all=await moduleStatusSentences(),ai=await getAllAIExplanationsFromDB(),groups={};
    all.forEach(function(s){var k=normalizeModuleName(s.module);if(!k)return;(groups[k]||(groups[k]=[])).push(s);});
    var ready={};Object.keys(groups).forEach(function(k){ready[k]=groups[k].length>0&&groups[k].every(function(s){return !!ai[s.en];});});
    document.querySelectorAll(".dh-ai-ready-module-card").forEach(function(el){var marked=el.getAttribute("data-dh-ai-module")||"";if(!ready[marked]){el.classList.remove("dh-ai-ready-module-card");el.removeAttribute("data-dh-ai-module");var oldBadge=el.querySelector(":scope > .dh-ai-ready-badge");if(oldBadge)oldBadge.remove();}});
    /* Kartta cümle sayısı/ilerleme de bulunduğu için tam metin eşitliği kullanma.
       Gerçek React kartı .module-tile'dır; adını .module-name üzerinden eşleştir. */
    document.querySelectorAll("#root .module-tile").forEach(function(card){
      var nameEl=card.querySelector(".module-name"),name=normalizeModuleName(nameEl?nameEl.textContent:card.textContent),k="";
      if(ready[name])k=name;else Object.keys(ready).some(function(candidate){if(ready[candidate]&&(name.indexOf(candidate)>=0||candidate.indexOf(name)>=0)){k=candidate;return true;}return false;});
      if(!k)return;
      card.classList.add("dh-ai-ready-module-card");card.setAttribute("data-dh-ai-module",k);
      if(!card.querySelector(":scope > .dh-ai-ready-badge")){var badge=document.createElement("span");badge.className="dh-ai-ready-badge";badge.textContent="✓ AI açıklamaları hazır";card.appendChild(badge);}
    });
    var title=document.querySelector(".study-title"),sentence=document.querySelector(".card .card-en");
    if(title&&sentence){var name=(title.textContent||"").trim(),key=normalizeModuleName(name),list=groups[key]||[],missing=list.filter(function(s){return !ai[s.en];});if(list.length&&missing.length)showModuleAIWarningOnce(name,list.length,missing.length);}
  }catch(e){}finally{dhModuleAIStatusBusy=false;}
}
function showModuleAIWarningOnce(name,total,missing){
  var key="dh-module-ai-warning-v1:"+normalizeModuleName(name);try{if(sessionStorage.getItem(key))return;sessionStorage.setItem(key,"1");}catch(e){}
  if(document.getElementById("dhModuleAIWarning"))return;var o=document.createElement("div");o.id="dhModuleAIWarning";o.style.cssText="position:fixed;inset:0;z-index:1000003;background:#020617df;display:flex;align-items:center;justify-content:center;padding:16px";
  o.innerHTML='<div style="width:min(520px,100%);background:#0d1b32;color:#e8eef7;border:1px solid #f59e0b;border-radius:17px;padding:18px;box-shadow:0 20px 60px #0009"><h2 style="margin:0 0 10px;font-size:19px">💡 Modül açıklamaları eksik</h2><p style="line-height:1.6;color:#bfd0ea"><b>'+name+'</b> modülündeki '+total+' cümlenin <b>'+missing+' tanesi</b> için AI açıklaması bulunmuyor. Çalışmaya başlamadan önce tamamını tek istekte hazırlayabilirsiniz.</p><div style="display:flex;gap:9px;flex-wrap:wrap"><button data-a="later">Daha sonra</button><button data-a="now">💎 Şimdi açıklamaları al</button></div></div>';
  o.querySelectorAll("button").forEach(function(b){b.style.cssText="flex:1;min-width:150px;padding:11px;border:0;border-radius:9px;background:#334155;color:white;font-weight:900";});o.querySelector('[data-a="now"]').style.background="linear-gradient(135deg,#7c3aed,#2563eb)";o.querySelector('[data-a="later"]').onclick=function(){o.remove();};o.querySelector('[data-a="now"]').onclick=function(){o.remove();explainActiveModuleWithAI();};document.body.appendChild(o);
}

/* --- MARKDOWN PARSER (Gemini Kod Blokları ve Başlık Düzeltici) --- */
function parseMarkdownToHTML(markdown) {
  if (!markdown) return "";
  let html = markdown
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^#### (.*$)/gim, "<h4>$1</h4>")
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^## (.*$)/gim, "<h3>$1</h3>")
    .replace(/^# (.*$)/gim, "<h3>$1</h3>")
    .replace(/^---$/gim, "<hr/>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/^&gt; (.*$)/gim, "blockquote>$1</blockquote>")
    .replace(/^\s*\* (.*$)/gim, "<li>$1</li>")
    .replace(/^\s*- (.*$)/gim, "<li>$1</li>")
    .replace(/^\d+\.\s+(.*$)/gim, "<li>$1</li>");

  let lines = html.split("\n");
  let inList = false;
  let result = [];

  lines.forEach(line => {
    let trimmed = line.trim();
    if (trimmed.startsWith("<li>")) {
      if (!inList) { result.push("<ul>"); inList = true; }
      result.push(trimmed);
    } else {
      if (inList) { result.push("</ul>"); inList = false; }
      if (trimmed.startsWith("<h3>") || trimmed.startsWith("<h4>") || trimmed.startsWith("<hr/>") || trimmed.startsWith("<blockquote>")) {
        result.push(trimmed);
      } else if (trimmed.length > 0) {
        result.push("<p>" + trimmed + "</p>");
      }
    }
  });

  if (inList) result.push("</ul>");
  return result.join("");
}

/* --- AI'YE SOR & INDEXEDDB KÖPRÜSÜ --- */
var currentLoadedSentence = "";

/* Eski kurulumlarda aynı veritabanı mağaza oluşturulmadan kalmış olabilir.
   Önce mevcut sürümü aç, mağaza yoksa sürümü güvenle yükseltip oluştur. */
function openAIStoreDB() {
  return new Promise(function(resolve) {
    if (!window.indexedDB) return resolve(null);
    var first = indexedDB.open("DilHaritaAI_DB");
    first.onerror = function() { resolve(null); };
    first.onupgradeneeded = function(e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains("ai_explanations")) db.createObjectStore("ai_explanations", { keyPath: "sentence" });
    };
    first.onsuccess = function(e) {
      var db = e.target.result;
      if (db.objectStoreNames.contains("ai_explanations")) return resolve(db);
      var nextVersion = Math.max(1, Number(db.version || 1) + 1);
      db.close();
      var upgrade = indexedDB.open("DilHaritaAI_DB", nextVersion);
      upgrade.onupgradeneeded = function(ev) {
        var upgraded = ev.target.result;
        if (!upgraded.objectStoreNames.contains("ai_explanations")) upgraded.createObjectStore("ai_explanations", { keyPath: "sentence" });
      };
      upgrade.onsuccess = function(ev) { resolve(ev.target.result); };
      upgrade.onerror = function() { resolve(null); };
      upgrade.onblocked = function() { resolve(null); };
    };
  });
}

function getAIFromDB(sentence) {
  return openAIStoreDB().then(function(db) { return new Promise(function(resolve) {
    if (!db) return resolve(null);
    try {
      var tx = db.transaction(["ai_explanations"], "readonly");
      var getReq = tx.objectStore("ai_explanations").get(sentence);
      getReq.onsuccess = function() { db.close(); resolve(getReq.result ? getReq.result.explanation : null); };
      getReq.onerror = function() { db.close(); resolve(null); };
    } catch(e) { try{db.close();}catch(ignore){} resolve(null); }
  });
  });
}

function saveAIToDB(sentence, explanation) {
  return getAIFromDB(sentence).then(function(oldText){
    if(oldText&&oldText!==explanation)pushAIBackup(sentence,oldText);
    return openAIStoreDB().then(function(db){return new Promise(function(resolve) {
      if(!db)return resolve(false);
      try{var tx=db.transaction(["ai_explanations"],"readwrite");tx.objectStore("ai_explanations").put({sentence:sentence,explanation:explanation,deleted:false,timestamp:new Date().toISOString()});tx.oncomplete=function(){db.close();try{window.dispatchEvent(new CustomEvent("dh-ai-explanation-changed"));}catch(e){}resolve(true);};tx.onerror=function(){db.close();resolve(false);};}catch(e){try{db.close();}catch(ignore){}resolve(false);}
    });});
  });
}

var AI_BACKUP_KEY="dh-ai-explanation-backups-v1";
function readAIBackups(){try{return JSON.parse(localStorage.getItem(AI_BACKUP_KEY)||"{}")||{};}catch(e){return {};}}
function pushAIBackup(sentence,text){if(!text)return;var all=readAIBackups(),list=all[sentence]||[];if(list[list.length-1]!==text)list.push(text);all[sentence]=list.slice(-5);try{localStorage.setItem(AI_BACKUP_KEY,JSON.stringify(all));}catch(e){}}
function popAIBackup(sentence){var all=readAIBackups(),list=all[sentence]||[],text=list.pop()||null;if(list.length)all[sentence]=list;else delete all[sentence];try{localStorage.setItem(AI_BACKUP_KEY,JSON.stringify(all));}catch(e){}return text;}
function deleteAIFromDB(sentence){return getAIFromDB(sentence).then(function(oldText){if(oldText)pushAIBackup(sentence,oldText);return openAIStoreDB().then(function(db){return new Promise(function(resolve){if(!db)return resolve(false);try{var tx=db.transaction(["ai_explanations"],"readwrite");tx.objectStore("ai_explanations").put({sentence:sentence,explanation:"",deleted:true,timestamp:new Date().toISOString()});tx.oncomplete=function(){db.close();try{window.dispatchEvent(new CustomEvent("dh-ai-explanation-changed"));}catch(e){}resolve(true);};tx.onerror=function(){db.close();resolve(false);};}catch(e){try{db.close();}catch(ignore){}resolve(false);}});});});}
async function restorePreviousAI(sentence){var old=popAIBackup(sentence);if(!old)return null;await saveAIToDB(sentence,old);return old;}

function getAllAIExplanationsFromDB() {
  return openAIStoreDB().then(function(db) { return new Promise(function(resolve) {
      if (!db) return resolve({});
      let tx = db.transaction(["ai_explanations"], "readonly");
      let store = tx.objectStore("ai_explanations");
      let cursorReq = store.openCursor();
      let map = {};
      cursorReq.onsuccess = function() {
        let cursor = cursorReq.result;
        if (cursor) {
          map[cursor.key] = cursor.value.explanation;
          cursor.continue();
        } else { db.close(); resolve(map); }
      };
      cursorReq.onerror = function() { db.close(); resolve({}); };
  }); });
}

function normalizeModuleName(value){return String(value||"").toLowerCase().replace(/\s+/g," ").trim();}
function requestedModuleName(){
  var fromUrl="";try{fromUrl=new URLSearchParams(location.search).get("mod")||"";}catch(e){}
  if(fromUrl.trim())return fromUrl.trim();
  /* Kullanıcı modülü ana listeden tıklayarak açtığında React adresi değiştirmez.
     Bu durumda öğretmen/araç dönüşü için gerçek modül adı çalışma başlığındadır. */
  var title=document.querySelector(".study-title");
  return title?String(title.textContent||"").replace(/\s+/g," ").trim():"";
}
async function activeModuleSentences(){
  var modName=requestedModuleName()||(document.querySelector(".study-title")&&document.querySelector(".study-title").textContent||"").trim();
  if(!modName)return [];
  var all=[];try{var res=await fetch("./data/sentences.json");if(res.ok)all=await res.json();}catch(e){}
  if(!all.length&&window._sentencesCache)all=window._sentencesCache;
  var key=normalizeModuleName(modName);
  return (all||[]).filter(function(s){return normalizeModuleName(s.module)===key;});
}
function bulkModal(title,body,busy){
  var old=document.getElementById("dhAiBulkModal");if(old)old.remove();var o=document.createElement("div");o.id="dhAiBulkModal";o.style.cssText="position:fixed;inset:0;z-index:1000001;background:#020617df;display:flex;align-items:center;justify-content:center;padding:16px";
  o.innerHTML='<div style="width:min(520px,100%);max-height:88vh;overflow:auto;background:#0d1b32;color:#e8eef7;border:1px solid #8b5cf6;border-radius:17px;padding:18px;box-shadow:0 20px 60px #0009"><h2 style="margin:0 0 10px;font-size:18px;color:#fff">'+title+'</h2><div style="line-height:1.6;color:#bfd0ea">'+body+'</div>'+(busy?'':'<button type="button" style="width:100%;margin-top:16px;padding:12px;border:0;border-radius:10px;background:#334155;color:#fff;font-weight:900">Kapat</button>')+'</div>';
  var b=o.querySelector("button");if(b)b.onclick=function(){o.remove();};document.body.appendChild(o);return o;
}
function isDetailedModuleExplanation(text){var t=String(text||""),low=t.toLocaleLowerCase("tr-TR");return t.length>=450&&low.indexOf("türkçe çeviri")>=0&&low.indexOf("dilbilgisi")>=0&&low.indexOf("önemli kelimeler")>=0&&low.indexOf("anlam nüansı")>=0&&low.indexOf("örnek")>=0;}
async function explainActiveModuleWithAI(forceAll){
  var sentences=await activeModuleSentences();if(!sentences.length){alert("Aktif modülün cümleleri bulunamadı.");return;}
  var cached=await getAllAIExplanationsFromDB(),missing=forceAll?sentences.slice():sentences.filter(function(s){return !cached[s.en];});
  if(!missing.length){bulkModal("♻️ Modül açıklamaları hazır","Bu modüldeki <b>"+sentences.length+" cümlenin tamamı</b> daha önce açıklanmış. Gemini’ye yeniden gönderilmedi.",false);var cur=document.querySelector(".card-en");if(cur)updateGeminiButtonState(cur.textContent.trim(),!!cached[cur.textContent.trim()],false);return;}
  if(!(window.DHProviders&&DHProviders.chat&&DHProviders.hasAnyKey&&DHProviders.hasAnyKey())){alert("Profilde Gemini/AI yöntemini etkinleştirin.");return;}
  var waitingModal=bulkModal("💎 Modül AI’ye hazırlanıyor",forceAll?("Aktif modüldeki <b>"+sentences.length+" cümlenin tamamı</b>, kayıt durumuna bakılmadan tek ayrıntılı istekte yeniden gönderilecek. Kısa yanıtlar eski kayıtların üzerine yazılmayacak."):("Toplam "+sentences.length+" cümlenin "+cachedCount(sentences,cached)+" tanesi kayıtlı. Açıklaması bulunmayan <b>"+missing.length+" cümlenin tamamı tek istekte</b> gönderilecek. Yanıt bazı cümleleri atlarsa kaydedilenler korunur; sonraki çalıştırmada yalnız kalanlar gönderilir."),true);
  var payload=missing.map(function(s,i){return{n:i+1,en:s.en,tr:s.tr||""};});
  var sys="Bu istekte verilen "+missing.length+" İngilizce cümlenin TAMAMINI, hiçbir n değerini atlamadan tek JSON yanıtında açıkla. Öncelik bütün kayıtları tamamlamaktır. Her explanation 90-130 Türkçe kelime arasında, kompakt fakat öğretici olmalı. Her kayıtta şu beş Markdown başlığı zorunludur: **Türkçe çeviri**, **Dilbilgisi**, **Önemli kelimeler ve kalıplar**, **Anlam nüansı**, **Örnek**. Dilbilgisinde zaman/yapı formülünü ve neden kullanıldığını 2-3 cümleyle belirt. En önemli 2-4 kelime veya kalıbı Türkçeleştir. Anlam nüansını 1-2 cümleyle açıkla. Örnekte bir yeni İngilizce cümle ve Türkçe çevirisini aynı satırda ver. Aynı gramer bilgisini gereksiz yere tekrar ederek metni uzatma. İlk kayıttan son kayda kadar aynı biçimi ve yaklaşık aynı uzunluğu koru. Yanıtı erken bitirme; "+missing.length+" nesnenin tamamını üret. Yalnız geçerli JSON dizi döndür: [{\"n\":1,\"explanation\":\"Markdown açıklama\"}]. explanation içindeki bütün çift tırnakları JSON kuralına uygun biçimde \\\" ile kaçır. n değerini aynen koru; markdown kod bloğu kullanma.";
  try{
    /* Kopyala-yapıştır köprüsünün cevap alanını bekleme katmanı kapatmasın. */
    if(waitingModal&&waitingModal.parentNode)waitingModal.remove();
    var raw=await DHProviders.chat([{role:"system",content:sys},{role:"user",content:JSON.stringify(payload)}],{temperature:.2,max_tokens:Math.min(16000,Math.max(5000,missing.length*550)),json:true,title:"💎 "+missing.length+" modül cümlesinin tamamını tek seferde açıkla",cacheType:forceAll?"index-module-explanations-full-refresh-v4":"index-module-explanations-complete-v4",cacheInput:{refresh:!!forceAll,items:payload},forceRefresh:!!forceAll});
    var rows=(window.DHAIBulkJSON&&DHAIBulkJSON.parse)?DHAIBulkJSON.parse(raw):JSON.parse(String(raw||"")),saved=0,rejected=0;
    for(var i=0;i<rows.length;i++){var n=Number(rows[i]&&rows[i].n),text=String(rows[i]&&rows[i].explanation||"").trim();if(n>=1&&n<=missing.length&&text){if(!isDetailedModuleExplanation(text)){rejected++;continue;}await saveAIToDB(missing[n-1].en,text);saved++;}}
    var left=missing.length-saved;bulkModal("✅ Ayrıntılı modül açıklamaları işlendi","<b>"+saved+" ayrıntılı açıklama</b> kaydedildi."+(rejected?" <b>"+rejected+" kısa veya bölümleri eksik açıklama</b> kalite kontrolünden geçmedi ve eski kaydın üzerine yazılmadı.":"")+(left&&!forceAll?" Kalan <b>"+left+" cümle</b> sonraki çalıştırmada yeniden gönderilir.":left&&forceAll?" Baştan yenilemede tamamlanmayan "+left+" cümlenin eski açıklaması korundu.":" Modülün bütün açıklamaları hazır."),false);
    var current=document.querySelector(".card-en");if(current){var now=await getAIFromDB(current.textContent.trim());updateGeminiButtonState(current.textContent.trim(),!!now,false);}
  }catch(e){bulkModal("⚠️ Toplu açıklama tamamlanamadı","Yanıt beklenen JSON biçiminde değildi veya işlem iptal edildi. Hiçbir mevcut kayıt silinmedi; tekrar denediğinizde yalnız eksik cümleler gönderilir.",false);}
}
function cachedCount(sentences,map){return sentences.filter(function(s){return !!map[s.en];}).length;}
window.explainActiveModuleWithAI=explainActiveModuleWithAI;

function renderResultBox(sentence, rawMarkdownText, tag) {
  let old = document.getElementById("dhAiResultBox");
  if (old) old.remove();

  let card = document.querySelector(".card");
  if (!card) return;

  let formattedHTML = window.DHGemini&&DHGemini.formatExplanation
    ? DHGemini.formatExplanation(rawMarkdownText)
    : parseMarkdownToHTML(rawMarkdownText);

  let box = document.createElement("div");
  box.id = "dhAiResultBox";
  box.dataset.sentence = sentence;
  box.style.cssText = "margin-top:16px;padding:16px;background:rgba(15,23,42,0.95);border-radius:14px;border:1px solid #3b82f6;color:#f1f5f9;grid-column:1 / -1;";
  box.innerHTML = `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px;"><span style="background:#10b981;color:#fff;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:800;">${tag}</span><button type="button" data-ai-action="renew">🔄 Yeniden hazırla</button><button type="button" data-ai-action="edit">✏️ Düzenle</button><button type="button" data-ai-action="delete">🗑️ Sil</button><button type="button" data-ai-action="restore">↩ Önceki</button></div><div class="dh-ai-result-content">` + formattedHTML + `</div>`;
  box.querySelectorAll("button[data-ai-action]").forEach(function(b){b.style.cssText="border:1px solid #475569;border-radius:7px;background:#17243a;color:#e5edf8;padding:5px 8px;font-size:11px;font-weight:800;cursor:pointer";});
  var readButton=box.querySelector("[data-dh-exp-reader]");if(readButton)readButton.onclick=function(event){event.preventDefault();event.stopPropagation();if(window.DHGemini&&DHGemini.openExplanationReader)DHGemini.openExplanationReader(readButton.closest(".dh-explanation-shell"));};
  box.querySelector('[data-ai-action="edit"]').onclick=function(){showExplanationEditor(sentence,rawMarkdownText,"Açıklamayı düzenle");};
  box.querySelector('[data-ai-action="renew"]').onclick=function(){renewSingleExplanation(sentence,rawMarkdownText);};
  box.querySelector('[data-ai-action="delete"]').onclick=async function(){if(!confirm("Bu açıklama silinsin mi? Modül toplu işleminde yeniden eksik sayılacaktır."))return;await deleteAIFromDB(sentence);box.innerHTML='<div style="color:#fbbf24">Açıklama silindi. Bir sonraki toplu işlemde yalnız eksiklerle birlikte yeniden hazırlanacak.</div><button type="button" id="dhRestoreDeleted" style="margin-top:10px;padding:8px;border:0;border-radius:8px;background:#334155;color:white;font-weight:800">↩ Silmeyi geri al</button>';box.querySelector("#dhRestoreDeleted").onclick=async function(){var old=await restorePreviousAI(sentence);if(old)renderResultBox(sentence,old,"🤖 Önceki açıklama geri yüklendi");};};
  box.querySelector('[data-ai-action="restore"]').onclick=async function(){var old=popAIBackup(sentence);if(!old){alert("Bu cümle için önceki açıklama bulunmuyor.");return;}var current=await getAIFromDB(sentence);if(current)pushAIBackup(sentence,current);await saveAIToDB(sentence,old);renderResultBox(sentence,old,"🤖 Önceki açıklama geri yüklendi");};
  
  card.appendChild(box);
  updateGeminiButtonState(sentence,true,true);
}

function updateGeminiButtonState(sentence,hasExplanation,isOpen){var button=document.querySelector(".dh-aiask-btn");if(!button)return;var sentenceEl=document.querySelector(".card .card-en"),activeSentence=(sentenceEl&&sentenceEl.textContent||"").trim();if(sentence&&activeSentence&&sentence!==activeSentence)return;button.classList.toggle("has-explanation",!!hasExplanation);button.setAttribute("aria-expanded",isOpen?"true":"false");button.textContent=hasExplanation?"✓ Gemini açıklaması":"✦ Gemini ile açıkla";button.title=hasExplanation?(isOpen?"Açıklamayı kapat":"Kayıtlı açıklamayı aç"):"Bu cümle için Gemini açıklaması hazırla";}

function showExplanationEditor(sentence,text,title){var old=document.getElementById("dhAiEditModal");if(old)old.remove();var m=document.createElement("div");m.id="dhAiEditModal";m.style.cssText="position:fixed;inset:0;z-index:1000002;background:#020617e8;display:flex;align-items:center;justify-content:center;padding:14px";m.innerHTML='<div style="width:min(720px,100%);background:#0f172a;border:1px solid #8b5cf6;border-radius:16px;padding:16px;color:white"><h3 style="margin:0 0 10px">'+title+'</h3><p style="font-size:12px;color:#94a3b8">Yeni metin kaydedilene kadar mevcut açıklama korunur.</p><textarea style="width:100%;height:50vh;box-sizing:border-box;background:#071225;color:white;border:1px solid #475569;border-radius:10px;padding:12px"></textarea><div style="display:flex;gap:8px;margin-top:10px"><button data-x="cancel">İptal</button><button data-x="save">Onayla ve değiştir</button></div></div>';document.body.appendChild(m);var ta=m.querySelector("textarea");ta.value=text||"";m.querySelectorAll("button").forEach(function(b){b.style.cssText="flex:1;padding:10px;border:0;border-radius:8px;background:#334155;color:white;font-weight:800";});m.querySelector('[data-x="save"]').style.background="#10b981";m.querySelector('[data-x="cancel"]').onclick=function(){m.remove();};m.querySelector('[data-x="save"]').onclick=async function(){var v=ta.value.trim();if(!v)return;await saveAIToDB(sentence,v);m.remove();renderResultBox(sentence,v,"🤖 Ortak AI açıklaması düzenlendi");};ta.focus();}

function activeCardTranslation(){var card=document.querySelector(".card"),tr=card&&card.querySelector(".card-tr");return tr?tr.innerText.trim():"";}
function moduleExplanationPrompt(sentence){
  var context={sentence:sentence,translation:activeCardTranslation()};
  if(window.DHGemini&&DHGemini.explanationPrompt)return DHGemini.explanationPrompt(context);
  return "Bu cümleyi detaylı açıkla.\nAKTİF İNGİLİZCE CÜMLE: "+sentence+"\nMevcut Türkçe karşılık: "+(context.translation||"yok");
}
async function requestModuleExplanation(sentence,force){
  sentence=String(sentence||"").trim();if(!sentence)return;
  var cached=await getAIFromDB(sentence);
  if(cached&&!force){renderResultBox(sentence,cached,"🤖 Video ve modülün ortak AI açıklaması");return;}
  var prompt=moduleExplanationPrompt(sentence);
  if(!(window.DHGemini&&DHGemini.ask)){
    try{await navigator.clipboard.writeText(prompt);}catch(e){}
    window.open("https://gemini.google.com/app","_blank");showPasteModal(sentence);return;
  }
  DHGemini.ask({
    title:force?"Cümle açıklamasını Gemini ile yenile · Kopyala ve yapıştır":"Cümleyi Gemini ile açıkla · Kopyala ve yapıştır",
    providerName:"Gemini",openUrl:DHGemini.url,prompt:prompt,
    hint:"Gemini cevabını kopyalayıp buraya yapıştır…",autoApply:true,confirmResult:!!(force&&cached),
    resume:{type:"module-explanation",sentence:sentence,force:!!force,module:requestedModuleName()},
    parse:function(t){return String(t||"").replace(/^\s*DH-ID:[^\n]*\n/i,"").trim();},
    onResult:async function(t){var value=String(t||"").trim();if(!value)return;await saveAIToDB(sentence,value);renderResultBox(sentence,value,"🤖 Video ve modülün ortak AI açıklaması");},
    onCancel:function(){if(cached)renderResultBox(sentence,cached,"🤖 Video ve modülün ortak AI açıklaması");}
  });
}
async function renewSingleExplanation(sentence,current){return requestModuleExplanation(sentence,true);}

async function checkAndSyncAiBox(card) {
  let sentenceEl = card.querySelector(".card-en");
  let sentence = sentenceEl ? sentenceEl.innerText.trim() : "";
  
  var sentenceChanged=sentence!==currentLoadedSentence;
  currentLoadedSentence = sentence;

  let oldBox = document.getElementById("dhAiResultBox");
  if (sentenceChanged&&oldBox) oldBox.remove();

  if (!sentence) return;

  let cached = await getAIFromDB(sentence);
  var visibleBox=document.getElementById("dhAiResultBox");updateGeminiButtonState(sentence,!!cached,!!(visibleBox&&visibleBox.dataset.sentence===sentence));
  var pending=window.DHGemini&&DHGemini.pending&&DHGemini.pending(),resume=pending&&pending.resume;
  if(sentenceChanged&&resume&&resume.type==="module-explanation"&&String(resume.sentence||"").trim()===sentence&&!(DHGemini.hasOverlay&&DHGemini.hasOverlay()))setTimeout(function(){requestModuleExplanation(sentence,!!resume.force);},0);
}

window.addEventListener("dh-ai-explanation-changed",function(){var card=document.querySelector(".card");if(!card)return;currentLoadedSentence="";checkAndSyncAiBox(card);});

function showPasteModal(sentence) {
  let old = document.getElementById("dhAiModal");
  if (old) old.remove();

  let modal = document.createElement("div");
  modal.id = "dhAiModal";
  modal.style.cssText = "position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:16px;";
  modal.innerHTML = `
    <div style="width:100%;max-width:500px;background:#0f172a;border:2px solid #8b5cf6;border-radius:16px;padding:20px;box-shadow:0 10px 40px rgba(0,0,0,0.8);color:#fff;font-family:sans-serif;">
      <div style="font-size:15px;color:#a78bfa;font-weight:800;margin-bottom:8px;">📋 Gemini Cevabını Yapıştırın</div>
      <p style="font-size:12px;color:#94a3b8;margin-bottom:12px;">Gemini'den kopyaladığınız açıklamayı aşağıdaki kutuya yapıştırıp kaydedin.</p>
      <textarea id="dhAiTextarea" placeholder="Cevabı buraya yapıştırın (Ctrl+V)..." style="width:100%;height:120px;background:#1e293b;color:#fff;border:1px solid #475569;border-radius:8px;padding:10px;font-size:13px;resize:none;outline:none;box-sizing:border-box;"></textarea>
      <div style="display:flex;gap:10px;margin-top:14px;justify-content:flex-end;">
        <button id="dhAiCancel" style="padding:8px 16px;font-size:13px;background:#334155;color:#fff;border:none;border-radius:8px;cursor:pointer;">İptal</button>
        <button id="dhAiSave" style="padding:8px 18px;font-size:13px;background:#7c3aed;color:#fff;border:none;border-radius:8px;font-weight:800;cursor:pointer;">Kaydet ve IndexedDB'ye Ekle</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("dhAiCancel").onclick = function() { modal.remove(); };
  document.getElementById("dhAiSave").onclick = async function() {
    let text = document.getElementById("dhAiTextarea").value.trim();
    if (text) {
      await saveAIToDB(sentence, text);
      modal.remove();
      renderResultBox(sentence, text, "🤖 AI Açıklaması (IndexedDB'ye kaydedildi)");
    }
  };
}

/* --- TÜM VEYA TEK MODÜL CÜMLELERİNİ PDF OLARAK DIŞA AKTARMA --- */
async function exportModuleToPDF(exportAllModules) {
  var modName = document.querySelector(".study-title")?.textContent || "Modül Cümleleri";
  if (exportAllModules) modName = "Tüm Modüller";

  var aiMap = await getAllAIExplanationsFromDB();
  var sentences = [];

  // Tüm cümleleri fetch et
  try {
    var res = await fetch("./data/sentences.json");
    if (res.ok) {
      var allData = await res.json();
      
      if (exportAllModules) {
        sentences = allData;
      } else {
        var keyMod = normalizeModuleName(requestedModuleName() || modName);
        sentences = allData.filter(function(s){
          return normalizeModuleName(s.module) === keyMod;
        });
      }
    }
  } catch(e){}

  if (!sentences.length && window._sentencesCache) {
    if (exportAllModules) {
      sentences = window._sentencesCache;
    } else {
      var key = normalizeModuleName(requestedModuleName() || modName);
      sentences = window._sentencesCache.filter(function(s){
        return normalizeModuleName(s.module) === key;
      });
    }
  }

  if (!sentences.length) {
    alert("Dışa aktarılacak cümle bulunamadı.");
    return;
  }

  // Cümleleri Modüllerine Göre Grupla
  var grouped = {};
  sentences.forEach(s => {
    var mName = s.module || "Genel";
    if (!grouped[mName]) grouped[mName] = [];
    grouped[mName].push(s);
  });

  var win = window.open("", "_blank");
  var html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${modName} - Çalışma Notları</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; color: #0f172a; line-height: 1.6; }
        h1 { color: #4338ca; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; font-size: 22px; margin-bottom: 24px; }
        h2.mod-title { color: #1e1b4b; background: #e0e7ff; padding: 8px 14px; border-radius: 6px; font-size: 16px; margin-top: 28px; margin-bottom: 14px; page-break-after: avoid; }
        .item { margin-bottom: 16px; padding: 12px 14px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; page-break-inside: avoid; }
        .en { font-size: 15px; font-weight: 700; color: #1e293b; }
        .tr { font-size: 13.5px; color: #475569; margin-top: 4px; }
        .ai { margin-top: 10px; padding: 10px 12px; background: #f8fafc; border-left: 4px solid #8b5cf6; font-size: 12.5px; color: #334155; border-radius: 0 6px 6px 0; }
        .ai-tag { font-weight: 800; color: #6d28d9; margin-bottom: 4px; font-size: 11px; text-transform: uppercase; }
        .ai h3, .ai h4 { font-size: 13.5px; font-weight: bold; margin: 8px 0 4px 0; color: #1e293b; }
        .ai code { background: #e2e8f0; padding: 2px 5px; border-radius: 4px; font-family: monospace; font-size: 12px; }
        .ai p { margin: 4px 0; }
        .ai ul { margin: 4px 0 8px 20px; padding: 0; }
      </style>
    </head>
    <body>
      <h1>${modName} — Ders ve AI Çalışma Notları (${sentences.length} Cümle)</h1>
      ${Object.keys(grouped).map(m => `
        <h2 class="mod-title">📌 ${m} (${grouped[m].length} Cümle)</h2>
        ${grouped[m].map((s, i) => `
          <div class="item">
            <div class="en">${i + 1}. ${s.en}</div>
            ${s.tr ? `<div class="tr"><b>TR:</b> ${s.tr}</div>` : ''}
            ${aiMap[s.en] ? `<div class="ai"><div class="ai-tag">🤖 AI Açıklaması</div>${parseMarkdownToHTML(aiMap[s.en])}</div>` : ''}
          </div>
        `).join('')}
      `).join('')}
      <script>
        window.onload = function() { window.print(); };
      </script>
    </body>
    </html>
  `;

  win.document.write(html);
  win.document.close();
}

document.addEventListener("click", async function(e) {
  let btn = e.target.closest(".dh-aiask-btn, .ai-sor-btn");
  if (!btn) return;

  e.preventDefault();
  e.stopPropagation();

  let card = document.querySelector(".card");
  let sentenceEl = card ? card.querySelector(".card-en") : null;
  let sentence = sentenceEl ? sentenceEl.innerText.trim() : "";

  if (!sentence) return;

  let cached = await getAIFromDB(sentence);
  if (cached) {
    var openBox=document.getElementById("dhAiResultBox");
    if(openBox&&openBox.dataset.sentence===sentence){openBox.remove();updateGeminiButtonState(sentence,true,false);return;}
    renderResultBox(sentence, cached, "🤖 AI Açıklaması (IndexedDB'den yüklendi)");
    return;
  }

  requestModuleExplanation(sentence, false);
}, true);
