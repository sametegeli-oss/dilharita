
(function(){
"use strict";
function getTeacher(){ return localStorage.getItem("selectedTeacherAvatar") || "teacher1"; }
function teacherDir(){ return "assets/avatars_v3/" + getTeacher() + "/"; }
function isTeacherContext(){
  const url = location.href.toLowerCase();
  const txt = document.body ? document.body.innerText.toLowerCase() : "";
  return /teacher|öğretmen|ogretmen/.test(url + " " + txt);
}
function looksLikeTeacherAvatar(el){
  if(!(el instanceof HTMLImageElement)) return false;
  const s = [el.id, el.className || "", el.alt || "", el.src || ""].join(" ").toLowerCase();
  const r = el.getBoundingClientRect();
  const big = (r.width >= 72 && r.height >= 72);
  return big && (/teacher|öğretmen|ogretmen|avatar/.test(s) || (isTeacherContext() && /webp|png|jpg|jpeg/.test(el.src || "")));
}
function replaceImage(el){
  try{
    el.src = teacherDir() + "idle.webp";
    el.srcset = "";
    el.dataset.teacherAvatarReplaced = "1";
    el.style.objectFit = el.style.objectFit || "contain";
    el.style.background = el.style.background || "#050b16";
  }catch(e){}
}
function attachToPlaceholders(){
  document.querySelectorAll('[data-teacher-avatar]').forEach(function(el){
    if(el.tagName && el.tagName.toLowerCase()==='img'){
      replaceImage(el);
    }else{
      el.innerHTML = '<div class="teacher-global-avatar"><img src="'+teacherDir()+'idle.webp" alt="teacher"></div>';
    }
  });
}
function run(){
  attachToPlaceholders();
  Array.from(document.images).forEach(function(img){ if(looksLikeTeacherAvatar(img)) replaceImage(img); });
}
window.DIL_TEACHER_AVATAR = { getDir: teacherDir, applyNow: run };
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
setTimeout(run, 1200);
setTimeout(run, 2500);
})();
