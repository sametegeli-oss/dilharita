
(function(){
"use strict";
function getTeacher(){ return localStorage.getItem("selectedTeacherAvatar") || "teacher1"; }
function dir(){ return "assets/avatars_v3/" + getTeacher() + "/"; }
window.DIL_TEACHER_AVATAR = {
  getDir: dir,
  applyToImage: function(img){
    if(!img) return;
    img.src = dir() + "idle.webp";
    img.srcset = "";
    img.style.objectFit = img.style.objectFit || "contain";
    img.style.background = img.style.background || "#050b16";
  },
  createWidget: function(container){
    if(!container) return;
    container.innerHTML = '<div class="teacher-global-avatar"><img src="'+dir()+'idle.webp" alt="teacher"></div>';
  }
};
document.addEventListener("DOMContentLoaded", function(){
  document.querySelectorAll("[data-teacher-avatar]").forEach(function(el){
    if(el.tagName && el.tagName.toLowerCase()==="img") window.DIL_TEACHER_AVATAR.applyToImage(el);
    else window.DIL_TEACHER_AVATAR.createWidget(el);
  });
});
})();
