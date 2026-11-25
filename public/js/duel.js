requireLogin();
document.body.innerHTML = document.body.innerHTML.replace(/\$\{ICON\.(\w+)\}/g, (_, k) => ICON[k] || "");
document.body.style.opacity = 1;

const stage = document.getElementById("duelStage");
let state = null;
let socket = null;
let match = null;
let questionIndex = 0;
let answered = false;
let friendList = [];

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
      <div class="step-item"><span class="step-num">2</span>No Conhecimento, cada questão vale 3 minutos, com até 30 questões.</div>
      <div class="step-item"><span class="step-num">3</span>No Blitz, acerte para atacar, mantenha combos e administre sua vida.</div>
      <div class="step-item"><span class="step-num">4</span>Vitória vale 50 XP, empate 25 XP e derrota 10 XP.</div>
    </div>
    <div class="duel-intro-card">
      <h3>Escolha o modo</h3>
      <div class="subject-tabs" style="margin:8px 0 14px">
        <button type="button" class="active" data-mode="conhecimento">Conhecimento</button>
        <button type="button" data-mode="blitz">Blitz</button>
      </div>
      <div id="durationWrap" style="display:none">
        <label for="durationSelect" style="display:block;font-size:.78rem;font-weight:700;margin:10px 0 6px">Tempo do Blitz (1 a 10 minutos)</label>
        <select id="durationSelect" style="width:100%;padding:12px;border:1px solid var(--line);border-radius:8px">
          <option value="1">1 minuto</option><option value="2">2 minutos</option>
          <option value="3">3 minutos</option><option value="4">4 minutos</option>
          <option value="5">5 minutos</option><option value="6">6 minutos</option>
          <option value="7">7 minutos</option><option value="8">8 minutos</option>
          <option value="9">9 minutos</option><option value="10">10 minutos</option>
        </select>
        <p class="subtitle" style="margin-top:7px">8 questões por minuto, com mínimo de 10 e máximo de 80 questões.</p>
      </div>
      <div id="questionCountWrap">
        <label for="questionCountSelect" style="display:block;font-size:.78rem;font-weight:700;margin:10px 0 6px">Questões do modo Conhecimento</label>
        <select id="questionCountSelect" style="width:100%;padding:12px;border:1px solid var(--line);border-radius:8px">
          <option value="10">10 questões · 30 minutos</option>
          <option value="15">15 questões · 45 minutos</option>
          <option value="20">20 questões · 60 minutos</option>
          <option value="25">25 questões · 75 minutos</option>
          <option value="30">30 questões · 90 minutos (máximo)</option>
        </select>
      </div>
    </div>
    <button class="btn btn-gold btn-block" id="queueBtn" style="padding:16px;font-size:1rem;">Pareamento aleatório ranqueado</button>
    <div class="duel-intro-card" style="margin-top:16px">
      <h3>Sala privada</h3>
      <p class="subtitle" style="margin:6px 0 14px">Crie uma sala para convidar um amigo online ou compartilhe o código.</p>
      <button class="btn btn-primary btn-block" id="createRoomBtn" type="button">Criar sala privada</button>
      <div style="display:flex;gap:8px;margin-top:12px">
        <input id="roomCodeInput" aria-label="Código da sala" placeholder="Código da sala" maxlength="6" autocomplete="off" style="flex:1;min-width:0;padding:12px;border:1px solid var(--line);border-radius:8px;text-transform:uppercase">
        <button class="btn btn-outline" id="joinRoomBtn" type="button">Entrar</button>
      </div>
    </div>`;

  document.querySelectorAll("[data-mode]").forEach(button => button.addEventListener("click", () => {
    document.querySelectorAll("[data-mode]").forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    const blitz = button.dataset.mode === "blitz";
    document.getElementById("durationWrap").style.display = blitz ? "" : "none";
    document.getElementById("questionCountWrap").style.display = blitz ? "none" : "";
  }));
  document.getElementById("queueBtn").addEventListener("click", () => {
    const mode = document.querySelector("[data-mode].active").dataset.mode;
    const duration = document.getElementById("durationSelect").value;
    const questionCount = document.getElementById("questionCountSelect").value;
    socket.emit("duelo_buscar", { mode, duration, questionCount });
    renderQueue();
  });
  document.getElementById("createRoomBtn").addEventListener("click", () => {
    const mode = document.querySelector("[data-mode].active").dataset.mode;
    const duration = document.getElementById("durationSelect").value;
    const questionCount = document.getElementById("questionCountSelect").value;
    socket.emit("duelo_criar_sala", { mode, duration, questionCount });
    stage.innerHTML = `<div class="matchmaking-card">Criando sua sala privada…</div>`;
  });
  document.getElementById("joinRoomBtn").addEventListener("click", () => {
    const code = document.getElementById("roomCodeInput").value.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      showToast("Informe um código de sala válido com 6 caracteres.");
      return;
    }
    socket.emit("duelo_entrar_sala", { code });
  });
}

function renderPrivateRoom(room) {
  stage.innerHTML = `
    <div class="duel-intro-card">
      <h3>Sala privada criada</h3>
      <p class="subtitle" style="margin:8px 0 16px">Compartilhe o código ou convide um amigo que esteja online.</p>
      <p class="subtitle">${room.mode === "blitz" ? "Blitz" : "Conhecimento"} · ${room.questionCount} questões · ${formatTime(room.duration)}</p>
      <div style="display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap">
        <strong style="font-size:2rem;letter-spacing:.18em">${escapeHtml(room.code)}</strong>
        <button class="btn btn-outline" id="copyRoomCode" type="button">Copiar código</button>
      </div>
      <div style="display:flex;gap:8px;margin-top:20px">
        <select id="inviteFriendSelect" aria-label="Escolha um amigo para convidar" style="flex:1;min-width:0;padding:12px;border:1px solid var(--line);border-radius:8px">
          <option value="">Escolha um amigo</option>
          ${friendList.map(friend => `<option value="${friend.id_usuario}">${escapeHtml(friend.nome)}</option>`).join("")}
        </select>
        <button class="btn btn-primary" id="inviteFriendBtn" type="button" ${friendList.length ? "" : "disabled"}>Convidar</button>
      </div>
      ${friendList.length ? "" : `<p class="subtitle" style="margin-top:10px">Adicione amigos para enviar convites diretos.</p>`}
      <p class="subtitle" style="margin-top:16px">Aguardando outro jogador entrar…</p>
    </div>
    <button class="btn btn-outline btn-block" id="cancelPrivateRoom" type="button">Cancelar sala</button>`;
  document.getElementById("copyRoomCode").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      showToast("Código copiado.");
    } catch (error) {
      showToast("Não foi possível copiar. Selecione e copie o código manualmente.");
    }
  });
  document.getElementById("inviteFriendBtn").addEventListener("click", () => {
    const userId = Number(document.getElementById("inviteFriendSelect").value);
    if (!userId) return showToast("Escolha um amigo para convidar.");
    socket.emit("duelo_convidar", { code: room.code, userId });
  });
  document.getElementById("cancelPrivateRoom").addEventListener("click", () => {
    socket.emit("duelo_cancelar_sala", { code: room.code });
    renderIntro();
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
  questionIndex = Number.isInteger(data.questionIndex) ? data.questionIndex : 0;
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
        <div class="hp-display" data-hp-player="${me?.id_usuario}" data-hp="100" ${data.mode === "blitz" ? "" : "hidden"}>
          <div class="hp-label"><span>Sua vida</span><strong>100 HP</strong></div>
          <div class="hp-track" role="progressbar" aria-label="Sua vida" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><div class="hp-fill" style="width:100%"></div></div>
          <div class="hp-streak" data-streak-player="${me?.id_usuario}"></div>
        </div>
        <div class="avatar">${avatarMarkup(me, state.name)}</div>
        <div class="pname">${escapeHtml(me?.nome || "Você")}</div>
        <div class="plevel">Nível ${me?.nivel || state.level}</div>
        <div class="score" id="myScore">0</div>
        <div class="score-label" id="myAnswers">0 respostas</div>
      </div>
      <div class="vs-mark">VS</div>
      <div class="player-panel" data-opponent-panel>
        <div class="hp-display" data-hp-player="${opponent?.id_usuario}" data-hp="100" ${data.mode === "blitz" ? "" : "hidden"}>
          <div class="hp-label"><span>Vida do oponente</span><strong>100 HP</strong></div>
          <div class="hp-track" role="progressbar" aria-label="Vida do oponente" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><div class="hp-fill" style="width:100%"></div></div>
          <div class="hp-streak" data-streak-player="${opponent?.id_usuario}"></div>
        </div>
        <div class="avatar">${avatarMarkup(opponent, "Oponente")}</div>
        <div class="pname">${escapeHtml(opponent?.nome || "Oponente")}</div>
        <div class="plevel">Nível ${opponent?.nivel || "--"}</div>
        <div class="score" id="opponentScore">0</div>
        <div class="score-label" id="opponentAnswers">0 respostas</div>
      </div>
    </div>
    <div class="duel-mode-status"><span>${data.mode === "blitz" ? "Blitz · vence quem sobreviver" : "Conhecimento"} · ${data.questions.length} questões</span><span id="timerBox" class="duel-timer">${formatTime(data.remaining ?? data.duration)}</span></div>
    <div class="question-card" id="duelQuestionCard"></div>`;
  updateScores({ players: data.players });
  renderQuestion();
}

function renderQuestion() {
  const card = document.getElementById("duelQuestionCard");
  if (!card || !match) return;
  if (questionIndex >= match.questions.length) {
    card.innerHTML = `<div class="qbody"><p class="statement">Você concluiu suas questões. Aguarde o outro jogador ou o fim do tempo.</p></div>`;
    return;
  }
  answered = false;
  const q = match.questions[questionIndex];
  card.innerHTML = `
    <div class="qhead"><span><span class="tag">${escapeHtml(q.disciplina)}</span>${escapeHtml(q.tema)}</span><span>Questão ${questionIndex + 1}/${match.questions.length}</span></div>
    <div class="qbody">
      <p class="statement">${escapeHtml(q.enunciado)}</p>
      ${q.imagem_url ? `<img src="${escapeHtml(q.imagem_url)}" alt="Imagem da questão" style="max-width:100%;max-height:360px;border-radius:10px;margin:0 0 20px">` : ""}
      <div id="duelOptions"></div>
      <div id="duelFeedback" class="duel-feedback" aria-live="polite"></div>
      ${match.mode === "blitz" ? `<button class="btn btn-outline duel-skip" id="skipQuestion" type="button">Pular questão · -5 HP (3º seguido: -10)</button>` : ""}
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
  document.getElementById("skipQuestion")?.addEventListener("click", () => {
    if (answered) return;
    answered = true;
    wrap.querySelectorAll(".option").forEach(option => option.style.pointerEvents = "none");
    document.getElementById("skipQuestion").disabled = true;
    socket.emit("duelo_pular", { code: match.code, questionIndex });
  });
}

function updateScores(stateData) {
  if (!stateData?.players) return;
  const me = stateData.players.find(player => player.id_usuario === state.id);
  const opponent = stateData.players.find(player => player.id_usuario !== state.id);
  if (me) {
    document.getElementById("myScore")?.replaceChildren(String(me.acertos));
    document.getElementById("myAnswers")?.replaceChildren(`${me.respostas} respostas`);
    updateHealthBar(me);
  }
  if (opponent) {
    document.getElementById("opponentScore")?.replaceChildren(String(opponent.acertos));
    document.getElementById("opponentAnswers")?.replaceChildren(`${opponent.respostas} respostas`);
    updateHealthBar(opponent);
  }
}

function updateHealthBar(player) {
  const display = document.querySelector(`[data-hp-player="${player.id_usuario}"]`);
  if (!display || !Number.isFinite(player.hp)) return;
  const previous = Number(display.dataset.hp);
  const health = Math.max(0, Math.min(100, player.hp));
  display.dataset.hp = String(health);
  display.querySelector(".hp-fill").style.width = `${health}%`;
  display.querySelector(".hp-track").setAttribute("aria-valuenow", String(health));
  display.querySelector(".hp-label strong").textContent = `${health} HP`;
  display.classList.toggle("hp-critical", health <= 30);
  const streak = document.querySelector(`[data-streak-player="${player.id_usuario}"]`);
  if (streak) streak.textContent = player.resposta_streak >= 2 ? `Combo de ${player.resposta_streak} acertos` : "";
  if (health < previous) animatePlayerPanel(player.id_usuario, "hit");
  if (health > previous) animatePlayerPanel(player.id_usuario, "heal");
}

function animatePlayerPanel(playerId, effect) {
  const panel = document.querySelector(`[data-hp-player="${playerId}"]`)?.closest(".player-panel");
  if (!panel) return;
  panel.classList.remove("hp-hit", "hp-heal");
  void panel.offsetWidth;
  panel.classList.add(effect === "heal" ? "hp-heal" : "hp-hit");
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
      <p>${result.reason === "desistencia" ? "Vitória por desistência do oponente." : (result.reason === "knockout" ? "A vida de um jogador chegou a zero." : "Resultado final do duelo.")} Você ganhou ${me?.xp_ganho || 0} XP.</p>
      <p>Código da sala: <strong>${escapeHtml(result.code)}</strong></p>
      <div class="duel-scoreboard" style="max-width:480px;margin:0 auto 26px">
        <div class="player-panel ${won ? "you" : ""}">
          <div class="avatar">${avatarMarkup(me, state.name)}</div>
          <div class="pname">${escapeHtml(me?.nome || "Você")}</div>
          <div class="score">${me?.acertos || 0}</div>
          <div class="score-label">${result.mode === "blitz" ? `${me?.hp ?? 0} HP · ` : ""}${me?.respostas || 0} respostas · ${(me?.tempo_total || 0).toFixed(1)}s</div>
        </div>
        <div class="vs-mark">VS</div>
        <div class="player-panel ${!won && !result.empate ? "you" : ""}">
          <div class="avatar">${avatarMarkup(opponent, "Oponente")}</div>
          <div class="pname">${escapeHtml(opponent?.nome || "Oponente")}</div>
          <div class="score">${opponent?.acertos || 0}</div>
          <div class="score-label">${result.mode === "blitz" ? `${opponent?.hp ?? 0} HP · ` : ""}${opponent?.respostas || 0} respostas · ${(opponent?.tempo_total || 0).toFixed(1)}s</div>
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
  socket.on("duelo_erro", message => showToast(message));
  socket.on("duelo_aguardando", renderQueue);
  socket.on("duelo_sala_criada", renderPrivateRoom);
  socket.on("duelo_convite_enviado", ({ nome }) => showToast(`Convite enviado para ${nome}.`));
  socket.on("duelo_convite", invitation => {
    const mode = invitation.mode === "blitz" ? "Blitz" : "Conhecimento";
    if (window.confirm(`${invitation.host.nome} convidou você para uma batalha (${mode}). Entrar na sala ${invitation.code}?`)) {
      socket.emit("duelo_entrar_sala", { code: invitation.code });
    }
  });
  socket.on("duelo_inicio", renderMatch);
  socket.on("duelo_reconectado", (data) => {
    const code = data.code;
    showToast(`Reconectado à sala ${code}.`);
    renderMatch(data);
  });
  socket.on("duelo_estado", updateScores);
  socket.on("duelo_tempo", ({ remaining }) => {
    const box = document.getElementById("timerBox");
    if (box) {
      box.textContent = formatTime(remaining);
      box.classList.toggle("urgent", remaining <= 10);
    }
  });
  socket.on("duelo_impacto", ({ actorId, targetId, healing, action }) => {
    if (healing > 0) animatePlayerPanel(actorId, "heal");
    if (action === "correct" && targetId !== state.id) animatePlayerPanel(targetId, "hit");
  });
  socket.on("duelo_resposta", ({ questionIndex: answeredIndex, correta, resposta_correta, skipped }) => {
    if (questionIndex !== answeredIndex) return;
    const options = document.querySelectorAll("#duelOptions .option");
    options.forEach(option => {
      if (option.dataset.id === resposta_correta) option.classList.add("correct");
      else if (option.dataset.id !== resposta_correta && !correta && option.style.pointerEvents === "none") option.classList.add("incorrect");
    });
    const feedback = document.getElementById("duelFeedback");
    if (feedback) {
      feedback.textContent = skipped ? "Questão pulada. Você perdeu vida." : (correta ? "Acertou! Dano causado." : "Resposta incorreta. Você perdeu vida.");
      feedback.className = `duel-feedback show ${skipped ? "skip" : (correta ? "correct" : "incorrect")}`;
    }
    setTimeout(() => {
      questionIndex += 1;
      renderQuestion();
    }, 650);
  });
  socket.on("duelo_resultado", renderResult);
  api("/api/amigos").then(data => { friendList = data.friends; }).catch(error => showToast(error.message));
  renderIntro();
}).catch(() => { window.location.href = "index.html"; });
