/* index-app React kelime penceresi: yalnız çift tıklamayla açılır.
   React paketi .tok öğelerine click bağladığı için gerçek tek tıklamaları
   yakalama aşamasında durdurur, dblclick olduğunda React'e işaretli tek bir
   sentetik click yollarız. Diğer düğme ve bağlantılara dokunulmaz. */
(function (global) {
  "use strict";
  var PASS = "__dhIndexWordDoubleClick";

  function token(target) {
    return target && target.closest ? target.closest(".tok") : null;
  }

  function onClick(event) {
    if (event[PASS] || !token(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function onDoubleClick(event) {
    var el = token(event.target);
    if (!el) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    var click = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      view: global,
      button: 0
    });
    Object.defineProperty(click, PASS, { value: true });
    el.dispatchEvent(click);
  }

  document.addEventListener("click", onClick, true);
  document.addEventListener("dblclick", onDoubleClick, true);

  global.DHIndexWordDoubleClick = { onClick: onClick, onDoubleClick: onDoubleClick, token: token };
})(window);
