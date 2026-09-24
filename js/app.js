/* Vestible — estado compartilhado (demo estática, guardado em localStorage) */

const STORAGE_KEY = "vestible_state_v1";
const XP_PER_LEVEL = 1000;

const DEFAULT_STATE = {
  name: "Gabriel Mendes",
  initials: "GM",
  level: 12,
  xp: 847,
  ranking: 234,
  streak: 7,
  questionsGoal: 15,
  questionsDone: 8,
  recentErrors: [
    { topic: "Cinemática", subject: "Física", when: "hoje", topicSlug: "cinematica" },
    { topic: "Segunda Guerra Mundial", subject: "História", when: "ontem", topicSlug: "segunda-guerra" },
    { topic: "Geometria Espacial", subject: "Matemática", when: "ontem", topicSlug: "geometria-espacial" }
  ],
  loggedIn: false
};

function getState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return { ...DEFAULT_STATE };
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  }catch(e){ return { ...DEFAULT_STATE }; }
}
function saveState(state){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){}
}
function resetState(){
  localStorage.removeItem(STORAGE_KEY);
}
function addXP(state, amount){
  state.xp += amount;
  while(state.xp >= XP_PER_LEVEL){
    state.xp -= XP_PER_LEVEL;
    state.level += 1;
  }
  return state;
}

const ICON = {
  home:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4h4v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9"/></svg>`,
  video: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/></svg>`,
  trophy:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M8 5H5a1 1 0 0 0-1 1c0 2.5 1.8 4 4 4"/><path d="M16 5h3a1 1 0 0 1 1 1c0 2.5-1.8 4-4 4"/><path d="M9 20h6"/><path d="M12 13v4"/></svg>`,
  bell:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 16v-5a6 6 0 1 0-12 0v5l-2 3h16l-2-3Z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>`,
  crown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m3 8 4 3 5-6 5 6 4-3-2 10H5L3 8Z"/></svg>`,
  star:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 2.7 5.9 6.3.7-4.7 4.4 1.2 6.3L12 17.3 6.5 20.3l1.2-6.3-4.7-4.4 6.3-.7L12 3Z"/></svg>`,
  target:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".6" fill="currentColor"/></svg>`,
  bolt:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 3 4 14h6l-1 7 9-11h-6l1-7Z"/></svg>`,
  logout:`<svg viewBox="0 0 50 50" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>`,
  mail:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>`,
  lock:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>`,
  eye:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`,
  play:  `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5Z"/></svg>`,
  back:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5 8 12l7 7"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m4 12 6 6L20 6"/></svg>`,
  help:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.9.4-1.5 1-1.5 2.2"/><path d="M12 17h.01"/></svg>`
};

/* Preenche o painel do usuário na sidebar / nav mobile em todas as páginas internas */
function renderUserWidget(){
  const s = getState();
  document.querySelectorAll("[data-bind='name']").forEach(el => el.textContent = s.name);
  document.querySelectorAll("[data-bind='initials']").forEach(el => el.textContent = s.initials);
  document.querySelectorAll("[data-bind='level']").forEach(el => el.textContent = s.level);
  document.querySelectorAll("[data-bind='streak']").forEach(el => el.textContent = s.streak);
  document.querySelectorAll("[data-bind='ranking']").forEach(el => el.textContent = "#" + s.ranking);
  document.querySelectorAll("[data-bind='xp']").forEach(el => el.textContent = s.xp);
  document.querySelectorAll("[data-bind='xp-fraction']").forEach(el => el.textContent = `${s.xp}/${XP_PER_LEVEL}`);
  document.querySelectorAll("[data-bind='xp-fill']").forEach(el => el.style.width = Math.min(100,(s.xp/XP_PER_LEVEL)*100) + "%");
  document.querySelectorAll("[data-bind='questions-done']").forEach(el => el.textContent = s.questionsDone);
  document.querySelectorAll("[data-bind='questions-goal']").forEach(el => el.textContent = s.questionsGoal);
  return s;
}

function showToast(message){
  let toast = document.querySelector(".toast");
  if(!toast){
    toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `<span class="dotc"></span><span class="msg"></span>`;
    document.body.appendChild(toast);
  }
  toast.querySelector(".msg").textContent = message;
  toast.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove("show"), 2600);
}

function requireLogin(){
  const s = getState();
  if(!s.loggedIn){ window.location.href = "index.html"; }
}

function logout(){
  const s = getState();
  s.loggedIn = false;
  saveState(s);
  window.location.href = "index.html";
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-action='logout']").forEach(el => {
    el.addEventListener("click", (e) => { e.preventDefault(); logout(); });
  });
});
