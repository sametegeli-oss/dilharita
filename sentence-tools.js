(function () {
    "use strict";

    function getSentence() {

        // İngilizce cümleyi bulmaya çalış

        const selectors = [
            ".sentence",
            ".english",
            ".question",
            ".study-sentence",
            ".current-sentence",
            "[data-sentence]"
        ];

        for (const s of selectors) {

            const el = document.querySelector(s);

            if (el && el.innerText.trim())
                return el.innerText.trim();

        }

        // En uzun İngilizce cümleyi bul

        const nodes = [...document.querySelectorAll("div,p,span,h1,h2,h3")];

        let best = "";

        nodes.forEach(n => {

            const t = n.innerText.trim();

            if (
                t.length > best.length &&
                /^[A-Za-z0-9 ,.'"?!;:()-]+$/.test(t)
            ) {
                best = t;
            }

        });

        return best;

    }

    function getSelectedWord() {

        const t = window.getSelection().toString().trim();

        if (!t) return "";

        return t.split(/\s+/)[0];

    }

    function openTranslate() {

        const txt = getSentence();

        if (!txt) return;

        window.open(
            "https://translate.google.com/?sl=en&tl=tr&text=" +
            encodeURIComponent(txt) +
            "&op=translate",
            "_blank"
        );

    }

    function openCambridge() {

        const word = getSelectedWord() || prompt("Kelime");

        if (!word) return;

        window.open(
            "https://dictionary.cambridge.org/dictionary/english/" +
            encodeURIComponent(word),
            "_blank"
        );

    }

    function openForvo() {

        const word = getSelectedWord() || prompt("Kelime");

        if (!word) return;

        window.open(
            "https://forvo.com/search/" +
            encodeURIComponent(word),
            "_blank"
        );

    }

    function openYouglish() {

        const word = getSelectedWord() || prompt("Kelime");

        if (!word) return;

        window.open(
            "https://youglish.com/pronounce/" +
            encodeURIComponent(word) +
            "/english",
            "_blank"
        );

    }

    function openYoutube() {

        const word = getSelectedWord() || prompt("Kelime");

        if (!word) return;

        window.open(
            "https://www.youtube.com/results?search_query=" +
            encodeURIComponent(word + " english"),
            "_blank"
        );

    }

    function createToolbar() {

        if (document.getElementById("sentenceTools"))
            return;

        const bar = document.createElement("div");

        bar.id = "sentenceTools";

        bar.style.cssText = `
display:flex;
gap:8px;
flex-wrap:wrap;
margin-top:10px;
margin-bottom:10px;
`;

        function btn(text, fn) {

            const b = document.createElement("button");

            b.textContent = text;

            b.onclick = fn;

            b.style.cssText = `
padding:8px 14px;
border-radius:8px;
border:none;
cursor:pointer;
background:#1976d2;
color:white;
font-size:14px;
`;

            return b;

        }

        bar.appendChild(btn("🌐 Translate", openTranslate));
        bar.appendChild(btn("📖 Cambridge", openCambridge));
        bar.appendChild(btn("🔊 Forvo", openForvo));
        bar.appendChild(btn("▶ YouGlish", openYouglish));
        bar.appendChild(btn("🎬 YouTube", openYoutube));

        const sentence =
            document.querySelector(".sentence") ||
            document.querySelector(".english") ||
            document.querySelector(".question");

        if (sentence)
            sentence.after(bar);
        else
            document.body.prepend(bar);

    }

    setInterval(createToolbar, 1000);

})();