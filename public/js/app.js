/* Vestible — utilitários compartilhados da interface */

const STORAGE_KEY = "vestible_state_v1";
const XP_PER_LEVEL = 1000;

const DEFAULT_STATE = {
  name: "",
  initials: "",
  level: 1,
  xp: 0,
  ranking: null,
  streak: 0,
  questionsGoal: 0,
  questionsDone: 0,
  recentErrors: [],
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
  book:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z"/><path d="M4 5.5v16"/><path d="M8 7h8M8 11h6"/></svg>`,
  swords: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m5 4 6 6M4 5l5-1 1 5"/><path d="m19 4-6 6M20 5l-5-1-1 5"/><path d="m8 16 8-8M16 16l-8-8"/><path d="m5 19 3-3M19 19l-3-3"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 19 6v5c0 4.5-2.8 7.8-7 10-4.2-2.2-7-5.5-7-10V6l7-3Z"/><path d="m9 12 2 2 4-4"/></svg>`,
  video: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/></svg>`,
  trophy:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M8 5H5a1 1 0 0 0-1 1c0 2.5 1.8 4 4 4"/><path d="M16 5h3a1 1 0 0 1 1 1c0 2.5-1.8 4-4 4"/><path d="M9 20h6"/><path d="M12 13v4"/></svg>`,
  bell:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 16v-5a6 6 0 1 0-12 0v5l-2 3h16l-2-3Z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>`,
  crown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m3 8 4 3 5-6 5 6 4-3-2 10H5L3 8Z"/></svg>`,
  star:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 2.7 5.9 6.3.7-4.7 4.4 1.2 6.3L12 17.3 6.5 20.3l1.2-6.3-4.7-4.4 6.3-.7L12 3Z"/></svg>`,
  target:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".6" fill="currentColor"/></svg>`,
  bolt:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 3 4 14h6l-1 7 9-11h-6l1-7Z"/></svg>`,
  logout:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M14 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5"/></svg>`,
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
  if(!localStorage.getItem("vestible_token")){
    window.location.href = "index.html";
  }
}

async function api(path, options = {}){
  const token = localStorage.getItem("vestible_token");
  const headers = options.body instanceof FormData
    ? { Accept: "application/json", ...(options.headers || {}) }
    : { "Content-Type": "application/json", Accept: "application/json", ...(options.headers || {}) };
  if(token) headers.Authorization = `Bearer ${token}`;
  let response;
  let rawText = "";
  try{
    response = await fetch(path, { ...options, headers, credentials: "same-origin" });
    rawText = await response.text();
  }catch(error){
    throw new Error("Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.");
  }
  let data = {};
  if(rawText){
    try{ data = JSON.parse(rawText); }
    catch{
      if(response.status >= 500){
        throw new Error("O servidor está indisponível no momento. Tente novamente em alguns instantes.");
      }
      throw new Error("O servidor respondeu com um formato inválido. Atualize a página e tente novamente.");
    }
  }
  if(!response.ok){
    if(response.status === 401 && path !== "/api/auth/login" && path !== "/api/auth/register"){
      localStorage.removeItem("vestible_token");
      localStorage.removeItem("vestible_user");
    }
    let fallback = "Não foi possível concluir a operação.";
    if(response.status === 400) fallback = "Verifique os dados informados e tente novamente.";
    if(response.status === 401) fallback = "E-mail ou senha inválidos.";
    if(response.status === 403) fallback = "Você não tem permissão para realizar esta ação.";
    if(response.status === 404) fallback = "Informação não encontrada.";
    if(response.status === 409) fallback = "Este registro entra em conflito com uma conta ou dados existentes.";
    if(response.status === 429) fallback = "Muitas tentativas. Aguarde um momento e tente novamente.";
    if(response.status >= 500) fallback = "O servidor encontrou um erro. Tente novamente em alguns instantes.";
    const error = new Error(String(data.error || data.message || fallback));
    error.status = response.status;
    error.email = data.email || null;
    error.field = data.field || null;
    throw error;
  }
  return data;
}

function escapeHtml(value){
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  })[ch]);
}

function applyAccessibilityPreferences(user){
  document.body.dataset.daltonismo = user.modo_daltonismo || "nenhum";
  document.body.dataset.reducedMotion = user.reducao_movimento ? "true" : "false";
}

function ensureMobileNavigation(){
  if(!localStorage.getItem("vestible_token")) return;
  if(!document.querySelector(".bottom-nav")) return;

  const nav = document.querySelector(".bottom-nav ul");
  if(nav){
    const required = [
      ["dashboard.html", ICON.home, "Início"],
      ["praticar.html", ICON.book, "Praticar"],
      ["duelo.html", ICON.swords, "Batalha"],
      ["conteudo.html", ICON.video, "Conteúdo"],
      ["perfil.html", "⚙", "Perfil"]
    ];
    for(const [href, icon, label] of required){
      if(!nav.querySelector(`a[href="${href}"]`)){
        const li = document.createElement("li");
        li.innerHTML = `<a href="${href}">${icon}<span>${label}</span></a>`;
        nav.appendChild(li);
      }
    }

    nav.querySelectorAll("a").forEach(link => {
      const linkPage = link.getAttribute("href")?.split(/[?#]/)[0];
      const page = location.pathname.split("/").pop();
      link.classList.toggle("active", linkPage === page);
      const battleLink = linkPage === "duelo.html" ? link : null;
      if(battleLink && !battleLink.querySelector("svg")){
        battleLink.insertAdjacentHTML("afterbegin", ICON.swords);
      }
      if(linkPage === "perfil.html" && !link.querySelector("svg")){
        link.insertAdjacentHTML("afterbegin", `<span class="mobile-profile-icon">⚙</span>`);
      }
    });
  }
}

function renderMobileProfile(user){
  if(!localStorage.getItem("vestible_token")) return;
  ensureMobileNavigation();
  let header = document.querySelector(".mobile-header");
  if(!header){
    header = document.createElement("header");
    header.className = "mobile-header";
    header.innerHTML = `
      <a class="mobile-brand" href="dashboard.html" aria-label="Ir para o início">
        <img src="assets/logo.svg" alt="Vestible">
      </a>
      <button class="mobile-user-button" type="button" aria-label="Abrir menu da conta" aria-expanded="false">
        <div class="mobile-avatar" data-bind="initials">--</div>
        <span class="mobile-user-copy">
          <strong data-bind="name">Carregando...</strong>
          <small>Nível <span data-bind="level">--</span></small>
        </span>
        <span class="mobile-menu-chevron">⌄</span>
      </button>
      <div class="mobile-user-menu" role="menu">
        <a href="perfil.html" role="menuitem">⚙ Configurações</a>
        <button type="button" role="menuitem" data-mobile-logout>Sair da conta</button>
      </div>`;
    document.body.prepend(header);
    const button = header.querySelector(".mobile-user-button");
    const menu = header.querySelector(".mobile-user-menu");
    button.addEventListener("click", () => {
      const open = header.classList.toggle("menu-open");
      button.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("click", event => {
      if(!header.contains(event.target)){
        header.classList.remove("menu-open");
        button.setAttribute("aria-expanded", "false");
      }
    });
    header.querySelector("[data-mobile-logout]").addEventListener("click", () => logout());
  }
  header.querySelectorAll("[data-bind='name']").forEach(el => el.textContent = user.nome);
  header.querySelectorAll("[data-bind='level']").forEach(el => el.textContent = user.nivel);
  const avatar = header.querySelector(".mobile-avatar");
  if(avatar){
    avatar.className = "mobile-avatar";
    avatar.dataset.color = user.foto_cor || "azul";
    const initials = user.nome.split(" ").filter(Boolean).map(word => word[0]).slice(0,2).join("").toUpperCase();
    avatar.classList.toggle("has-avatar", Boolean(user.foto_avatar));
    avatar.innerHTML = user.foto_avatar
      ? `<img src="assets/avatar/${encodeURIComponent(user.foto_avatar)}.png" alt="Avatar de ${escapeHtml(user.nome)}">`
      : escapeHtml(initials);
  }
}

function applyProfileVisuals(user){
  if(!user) return;
  applyAccessibilityPreferences(user);
  renderMobileProfile(user);
  document.querySelectorAll("[data-bind='name']").forEach(el => el.textContent = user.nome);
  document.querySelectorAll("[data-bind='initials']").forEach(el => {
    const initials = user.nome.split(" ").filter(Boolean).map(w => w[0]).slice(0,2).join("").toUpperCase();
    el.classList.toggle("has-avatar", Boolean(user.foto_avatar));
    if(user.foto_avatar){
      el.innerHTML = `<img src="assets/avatar/${encodeURIComponent(user.foto_avatar)}.png?v=20261123" alt="Avatar de ${escapeHtml(user.nome)}">`;
    }else{
      el.textContent = initials;
    }
  });
  document.querySelectorAll(".avatar").forEach(el => el.dataset.color = user.foto_cor || "azul");
  document.querySelectorAll(".nav").forEach(nav => {
    if(user.tipo === "admin" && !nav.querySelector("[data-admin-link]")){
      const link = document.createElement("a");
      link.href = "admin.html";
      link.dataset.adminLink = "true";
      link.innerHTML = `${ICON.shield} Administração`;
      nav.appendChild(link);
    }
  });
}

async function logout(){
  try{ await api("/api/auth/logout", { method:"POST" }); }catch(e){}
  localStorage.removeItem("vestible_token");
  localStorage.removeItem("vestible_user");
  window.location.href = "index.html";
}

document.addEventListener("DOMContentLoaded", () => {
  ensureMobileNavigation();
  document.querySelectorAll("[data-action='logout']").forEach(el => {
    el.addEventListener("click", (e) => { e.preventDefault(); logout(); });
  });
});
