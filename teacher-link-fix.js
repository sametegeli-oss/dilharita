
(function(){
"use strict";

function rewriteTeacherUrl(url){
  if(!url) return url;
  return String(url).replace(/teacher-chat\.html/g, "teacher.html");
}

function fixTeacherLinks(){
  document.querySelectorAll('a[href*="teacher-chat.html"], a[href*="teacher.html"]').forEach(function(a){
    const href = a.getAttribute("href") || "";
    if(href.indexOf("teacher-chat.html") !== -1){
      a.setAttribute("href", rewriteTeacherUrl(href));
    }
  });
}

document.addEventListener("click", function(e){
  const a = e.target.closest && e.target.closest('a[href*="teacher-chat.html"]');
  if(!a) return;
  e.preventDefault();
  location.href = rewriteTeacherUrl(a.getAttribute("href") || a.href);
}, true);

document.addEventListener("DOMContentLoaded", function(){
  fixTeacherLinks();
  new MutationObserver(fixTeacherLinks).observe(document.body, {childList:true, subtree:true, attributes:true, attributeFilter:["href"]});
});
})();
