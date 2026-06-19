
(function(){
"use strict";
function getTeacher(){
  return localStorage.getItem("selectedTeacherAvatar") || "teacher1";
}
function dir(){ return "assets/avatars_v3/" + getTeacher() + "/"; }
window.DIL_TEACHER_AVATAR = {
  getDir: dir,
  applyToImage: function(img){
    if(!img) return;
    img.src = dir() + "idle.webp";
  },
  createWidget: function(container){
    if(!container) return;
    container.innerHTML = '<div style="position:relative;width:92px;height:92px;border-radius:18px;overflow:hidden;background:#050b16;border:2px solid #2dd4bf;box-shadow:0 12px 35px rgba(0,0,0,.35)"><img style="width:100%;height:100%;object-fit:cover" src="'+dir()+'idle.webp" alt="teacher"></div>';
  }
};
document.addEventListener("DOMContentLoaded", function(){
  document.querySelectorAll("[data-teacher-avatar]").forEach(function(el){
    if(el.tagName && el.tagName.toLowerCase()==="img") window.DIL_TEACHER_AVATAR.applyToImage(el);
    else window.DIL_TEACHER_AVATAR.createWidget(el);
  });
});
})();
