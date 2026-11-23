requireLogin();
document.body.innerHTML = document.body.innerHTML.replace(/\$\{ICON\.(\w+)\}/g, (_, k) => ICON[k] || "");
document.body.style.opacity = 1;

const stage = document.getElementById("duelStage");
let state = null;
let socket = null;
let match = null;
let questionIndex = 0;
let answered = false;

function initials(name) {
  return String(name || "").split(" ").filter(Boolean).map(word => word[0]).slice(0, 2).join("").toUpperCase();
}

function avatarMarkup(player, fallbackName) {
  return player?.foto_avatar
    ? `<img src="assets/avatar/${encodeURIComponent(player.foto_avatar)}.png" alt="Avatar de ${escapeHtml(player.nome || fallbackName)}">`
    : initials(player?.nome || fallbackName);
}

function formatTime(seconds) {
  const value = Math.max(0, Number(seconds) || 0);
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function renderIntro() {
  stage.innerHTML = `
    <div class="duel-intro-card">
      <h3>Como funciona o duelo</h3>
      <div class="step-item"><span class="step-num">1</span>Escolha Conhecimento ou Blitz e clique em Buscar oponente.</div>
      <div class="step-item"><span class="step-num">2</span>Os dois jogadores recebem as mesmas 10 questões, na mesma ordem.</div>
      <div class="step-item"><span class="step-num">3</span>No Blitz, o tempo é controlado pelo servidor.</div>
      <div class="step-item"><span class="step-num">4</span>Vitória vale 50 XP, empate 25 XP e derrota 10 XP.</div>
    </div>
    <div class="duel-intro-card">
      <h3>Escolha o modo</h3>
      <div class="subject-tabs" style="margin:8px 0 14px">
        <button type="button" class="active" data-mode="conhecimento">Conhecimento</button>
        <button type="button" data-mode="blitz">Blitz</button>
      </div>
      <div id="durationWrap" style="display:none">
        <label for="durationSelect" style="display:block;font-size:.78rem;font-weight:700;margin:10px 0 6px">Tempo do duelo</label>
        <select id="durationSelect" style="width:100%;padding:12px;border:1px solid var(--line);border-radius:8px">
          <option value="1">1 minuto</option><option value="2">2 minutos</option>
          <option value="3">3 minutos</option><option value="4">4 minutos</option>
          <option value="5">5 minutos</option>
        </select>
      </div>
    </div>
    <button class="btn btn-gold btn-block" id="queueBtn" style="padding:16px;font-size:1rem;">Buscar oponente</button>`;

  document.querySelectorAll("[data-mode]").forEach(button => button.addEventListener("click", () => {
    document.querySelectorAll("[data-mode]").forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    document.getElementById("durationWrap").style.display = button.dataset.mode === "blitz" ? "" : "none";
  }));
  document.getElementById("queueBtn").addEventListener("click", () => {
    const mode = document.querySelector("[data-mode].active").dataset.mode;
    const duration = document.getElementById("durationSelect").value;
    socket.emit("duelo_buscar", { mode, duration });
    renderQueue();
  });
}

function renderQueue() {
  stage.innerHTML = `
    <div class="matchmaking-card">
      <div style="font-weight:700;margin-bottom:6px;">Procurando oponente…</div>
      <div style="color:rgba(244,239,226,.65);font-size:.85rem;">Isso costuma levar poucos segundos</div>
    </div>
    <button class="btn btn-outline btn-block" id="cancelQueue" style="margin-top:14px">Cancelar busca</button>`;
  document.getElementById("cancelQueue").addEventListener("click", () => {
    socket.emit("duelo_cancelar");
    renderIntro();
  });
}

function renderMatch(data) {
  match = data;
  questionIndex = 0;
  answered = false;
  const me = data.players.find(player => player.id_usuario === state.id);
  const opponent = data.players.find(player => player.id_usuario !== state.id);
  stage.innerHTML = `
    <div class="duel-intro-card">
      <h3>Duelo encontrado</h3>
      <div class="step-item"><span class="step-num">1</span>Modo: ${data.mode === "blitz" ? "Blitz" : "Conhecimento"}</div>
      <div class="step-item"><span class="step-num">2</span>Código da sala: <strong>${escapeHtml(data.code)}</strong></div>
    </div>
    <div class="duel-scoreboard">
      <div class="player-panel you">
        <div class="avatar">${avatarMarkup(me, state.name)}</div>
        <div class="pname">${escapeHtml(me?.nome || "Você")}</div>
        <div class="plevel">Nível ${me?.nivel || state.level}</div>
        <div class="score" id="myScore">0</div>
        <div class="score-label" id="myAnswers">0 respostas</div>
      </div>
      <div class="vs-mark">VS</div>
      <div class="player-panel">
        <div class="avatar">${avatarMarkup(opponent, "Oponente")}</div>
        <div class="pname">${escapeHtml(opponent?.nome || "Oponente")}</div>
        <div class="plevel">Nível ${opponent?.nivel || "--"}</div>
        <div class="score" id="opponentScore">0</div>
        <div class="score-label" id="opponentAnswers">0 respostas</div>
      </div>
    </div>
    ${data.mode === "blitz" ? `<div class="duel-timer-wrap"><div class="duel-timer" id="timerBox">${formatTime(data.duration)}</div></div>` : ""}
    <div class="question-card" id="duelQuestionCard"></div>`;
  renderQuestion();
}

function renderQuestion() {
  const card = document.getElementById("duelQuestionCard");
  if (!card || !match) return;
  if (questionIndex >= match.questions.length) {
    card.innerHTML = `<div class="qbody"><p class="statement">Você respondeu todas as 10 questões. Aguarde o outro jogador ou o fim do tempo.</p></div>`;
    return;
  }
  answered = false;
  const q = match.questions[questionIndex];
  card.innerHTML = `
    <div class="qhead"><span><span class="tag">${escapeHtml(q.disciplina)}</span>${escapeHtml(q.tema)}</span><span>Questão ${questionIndex + 1}/10</span></div>
    <div class="qbody">
      <p class="statement">${escapeHtml(q.enunciado)}</p>
      ${q.imagem_url ? `<img src="${escapeHtml(q.imagem_url)}" alt="Imagem da questão" style="max-width:100%;max-height:360px;border-radius:10px;margin:0 0 20px">` : ""}
      <div id="duelOptions"></div>
    </div>`;
  const options = [["A", q.alternativa_a], ["B", q.alternativa_b], ["C", q.alternativa_c], ["D", q.alternativa_d], ...(q.alternativa_e ? [["E", q.alternativa_e]] : [])];
  const wrap = document.getElementById("duelOptions");
  options.forEach(([letter, text]) => {
    const row = document.createElement("div");
    row.className = "option";
    row.dataset.id = letter;
    row.innerHTML = `<span class="letter">${letter}</span><span>${escapeHtml(text)}</span>`;
    row.addEventListener("click", () => {
      if (answered) return;
      answered = true;
      wrap.querySelectorAll(".option").forEach(option => option.style.pointerEvents = "none");
      socket.emit("duelo_responder", { code: match.code, questionIndex, alternativa: letter });
    });
    wrap.appendChild(row);
  });
}

function updateScores(stateData) {
  if (!stateData?.players) return;
  const me = stateData.players.find(player => player.id_usuario === state.id);
  const opponent = stateData.players.find(player => player.id_usuario !== state.id);
  if (me) {
    document.getElementById("myScore")?.replaceChildren(String(me.acertos));
    document.getElementById("myAnswers")?.replaceChildren(`${me.respostas} respostas`);
  }
  if (opponent) {
    document.getElementById("opponentScore")?.replaceChildren(String(opponent.acertos));
    document.getElementById("opponentAnswers")?.replaceChildren(`${opponent.respostas} respostas`);
  }
}

function renderResult(result) {
  const me = result.players.find(player => player.id_usuario === state.id);
  const opponent = result.players.find(player => player.id_usuario !== state.id);
  const won = result.winnerId === state.id;
  const title = result.empate ? "Empate!" : (won ? "Você venceu!" : "Você perdeu");
  stage.innerHTML = `
    <div class="duel-result card on-paper">
      <div class="trophy">${result.empate ? "🤝" : (won ? "🏆" : "🎯")}</div>
      <h2>${title}</h2>
      <p>${result.reason === "desistencia" ? "Vitória por desistência do oponente." : "Resultado final do duelo."} Você ganhou ${me?.xp_ganho || 0} XP.</p>
      <p>Código da sala: <strong>${escapeHtml(result.code)}</strong></p>
      <div class="duel-scoreboard" style="max-width:480px;margin:0 auto 26px">
        <div class="player-panel ${won ? "you" : ""}">
          <div class="avatar">${avatarMarkup(me, state.name)}</div>
          <div class="pname">${escapeHtml(me?.nome || "Você")}</div>
          <div class="score">${me?.acertos || 0}</div>
          <div class="score-label">${me?.respostas || 0} respostas · ${(me?.tempo_total || 0).toFixed(1)}s</div>
        </div>
        <div class="vs-mark">VS</div>
        <div class="player-panel ${!won && !result.empate ? "you" : ""}">
          <div class="avatar">${avatarMarkup(opponent, "Oponente")}</div>
          <div class="pname">${escapeHtml(opponent?.nome || "Oponente")}</div>
          <div class="score">${opponent?.acertos || 0}</div>
          <div class="score-label">${opponent?.respostas || 0} respostas · ${(opponent?.tempo_total || 0).toFixed(1)}s</div>
        </div>
      </div>
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
        <button class="btn btn-gold" id="againBtn">Batalhar novamente</button>
        <a href="dashboard.html" class="btn btn-outline">Voltar ao início</a>
      </div>
    </div>`;
  document.getElementById("againBtn").addEventListener("click", renderIntro);
}

api("/api/me").then(data => {
  state = { ...data.user, id: data.user.id_usuario };
  applyProfileVisuals(data.user);
  document.querySelectorAll("[data-bind='name']").forEach(el => el.textContent = state.nome);
  document.querySelectorAll("[data-bind='level']").forEach(el => el.textContent = state.nivel);
  document.querySelectorAll("[data-bind='streak']").forEach(el => el.textContent = state.streak);

  socket = io({ auth: { token: localStorage.getItem("vestible_token") } });
  socket.on("connect_error", error => showToast(error.message));
  socket.on("duelo_aguardando", renderQueue);
  socket.on("duelo_inicio", renderMatch);
  socket.on("duelo_reconectado", ({ code }) => {
    showToast(`Reconectado à sala ${code}.`);
  });
  socket.on("duelo_estado", updateScores);
  socket.on("duelo_tempo", ({ remaining }) => {
    const box = document.getElementById("timerBox");
    if (box) {
      box.textContent = formatTime(remaining);
      box.classList.toggle("urgent", remaining <= 10);
    }
  });
  socket.on("duelo_resposta", ({ questionIndex: answeredIndex, correta, resposta_correta }) => {
    if (questionIndex !== answeredIndex) return;
    const options = document.querySelectorAll("#duelOptions .option");
    options.forEach(option => {
      if (option.dataset.id === resposta_correta) option.classList.add("correct");
      else if (option.dataset.id !== resposta_correta && !correta && option.style.pointerEvents === "none") option.classList.add("incorrect");
    });
    setTimeout(() => {
      questionIndex += 1;
      renderQuestion();
    }, 650);
  });
  socket.on("duelo_resultado", renderResult);
  renderIntro();
}).catch(() => { window.location.href = "index.html"; });
