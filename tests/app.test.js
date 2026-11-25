const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { io } = require("socket.io-client");

const port = 32123 + Math.floor(Math.random() * 100);
const baseUrl = `http://127.0.0.1:${port}`;
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vestible-test-"));
const dbPath = path.join(tempDir, "vestible.db");
let server;

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const text = await response.text();
  let body = null;
  if (text) body = JSON.parse(text);
  return { response, body };
}

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const { response } = await request(`${baseUrl}/api/disciplinas`);
      if (response.status === 401) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Servidor de teste não iniciou.");
}

test.before(async () => {
  server = spawn(process.execPath, ["--env-file-if-exists=.env", "src/server.js"], {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, PORT: String(port), DB_PATH: dbPath, NODE_ENV: "test" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  await waitForServer();
});

test.after(async () => {
  if (server && !server.killed) {
    await new Promise((resolve) => {
      server.once("exit", resolve);
      server.kill("SIGTERM");
      setTimeout(resolve, 500);
    });
  }
  fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

test("servidor entrega páginas públicas e rejeita API sem sessão", async () => {
  const page = await fetch(`${baseUrl}/index.html`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Vestible/);

  const api = await request(`${baseUrl}/api/me`);
  assert.equal(api.response.status, 401);
});

test("layout móvel inclui batalha, perfil, avatar e saída da conta", () => {
  const practice = fs.readFileSync(path.resolve(__dirname, "../public/praticar.html"), "utf8");
  const login = fs.readFileSync(path.resolve(__dirname, "../public/index.html"), "utf8");
  const app = fs.readFileSync(path.resolve(__dirname, "../public/js/app.js"), "utf8");
  const css = fs.readFileSync(path.resolve(__dirname, "../public/css/style.css"), "utf8");

  assert.match(practice, /duelo\.html/);
  assert.match(practice, /Batalha/);
  assert.match(app, /mobile-header/);
  assert.match(app, /perfil\.html/);
  assert.match(app, /data-mobile-logout/);
  assert.match(app, /renderMobileProfile/);
  assert.match(css, /@media \(max-width:820px\)/);
  assert.match(css, /\.bottom-nav/);
  assert.match(css, /a\[href="dashboard\.html"\]/);
  assert.match(css, /a\[href="perfil\.html"\]/);
  assert.match(login, /class="toggle-eye"/);
  assert.match(login, /aria-label="Mostrar senha"/);
  for (const pageName of ["admin.html", "admin-questoes.html", "admin-conteudos.html"]) {
    const page = fs.readFileSync(path.resolve(__dirname, `../public/${pageName}`), "utf8");
    assert.match(page, /class="bottom-nav" data-admin-nav/);
  }
});

test("banco possui matérias e assuntos específicos válidos", async () => {
  const adminLogin = await request(`${baseUrl}/api/auth/login`, {
    method: "POST",
    body: JSON.stringify({ email: "admin@vestible.com", senha: "Admin@123" })
  });
  const token = adminLogin.body.token;
  const headers = { Authorization: `Bearer ${token}` };

  const disciplines = await request(`${baseUrl}/api/disciplinas`, { headers });
  assert.equal(disciplines.response.status, 200);
  assert.ok(disciplines.body.includes("Matemática"));
  assert.ok(disciplines.body.includes("Física"));
  assert.ok(disciplines.body.includes("Biologia"));
  assert.ok(disciplines.body.includes("Inglês"));

  const physicsTopics = await request(`${baseUrl}/api/temas?disciplina=${encodeURIComponent("Física")}`, { headers });
  assert.equal(physicsTopics.response.status, 200);
  assert.ok(physicsTopics.body.length > 5);
  assert.ok(!physicsTopics.body.includes("Abolição"));

  const questions = await request(`${baseUrl}/api/questoes?disciplina=Física`, { headers });
  assert.equal(questions.response.status, 200);
  assert.ok(questions.body.length >= 20);
  assert.ok(questions.body.every((question) => question.disciplina === "Física"));
});

test("administrador pode criar lista e excluir estudante com confirmação no servidor", async () => {
  const student = await request(`${baseUrl}/api/auth/register`, {
    method: "POST",
    body: JSON.stringify({
      nome: "Aluno Teste",
      email: "aluno.teste@example.com",
      confirmacao_email: "aluno.teste@example.com",
      senha: "Teste@123",
      confirmacao: "Teste@123"
    })
  });
  assert.equal(student.response.status, 201);

  const studentApi = await request(`${baseUrl}/api/admin/usuarios`, {
    headers: { Authorization: `Bearer ${student.body.token}` }
  });
  assert.equal(studentApi.response.status, 403);

  const adminLogin = await request(`${baseUrl}/api/auth/login`, {
    method: "POST",
    body: JSON.stringify({ email: "admin@vestible.com", senha: "Admin@123" })
  });
  assert.equal(adminLogin.response.status, 200);
  const adminToken = adminLogin.body.token;

  const list = await request(`${baseUrl}/api/admin/usuarios`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.equal(list.response.status, 200);
  const target = list.body.find((user) => user.email === "aluno.teste@example.com");
  assert.ok(target);

  const selfDelete = await request(`${baseUrl}/api/admin/usuarios/${adminLogin.body.user.id_usuario}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.equal(selfDelete.response.status, 400);

  const removed = await request(`${baseUrl}/api/admin/usuarios/${target.id_usuario}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.equal(removed.response.status, 200);
  assert.match(removed.body.message, /excluído/i);

  const loginRemoved = await request(`${baseUrl}/api/auth/login`, {
    method: "POST",
    body: JSON.stringify({ email: "aluno.teste@example.com", senha: "Teste@123" })
  });
  assert.equal(loginRemoved.response.status, 401);
});

test("pedidos de amizade usam código único e podem ser aceitos, recusados ou removidos", async () => {
  const users = [];
  for (const [name, email] of [["Amiga Um", "amiga.um@example.com"], ["Amigo Dois", "amigo.dois@example.com"]]) {
    const registered = await request(`${baseUrl}/api/auth/register`, {
      method: "POST",
      body: JSON.stringify({
        nome: name,
        email,
        confirmacao_email: email,
        senha: "Teste@123",
        confirmacao: "Teste@123"
      })
    });
    assert.equal(registered.response.status, 201);
    assert.match(registered.body.user.friend_code, /^VST-[A-F0-9]{8}$/);
    users.push(registered.body);
  }
  const [first, second] = users;
  const firstHeaders = { Authorization: `Bearer ${first.token}` };
  const secondHeaders = { Authorization: `Bearer ${second.token}` };

  const sent = await request(`${baseUrl}/api/amigos/solicitacoes`, {
    method: "POST",
    headers: firstHeaders,
    body: JSON.stringify({ friend_code: second.user.friend_code })
  });
  assert.equal(sent.response.status, 201);

  const duplicate = await request(`${baseUrl}/api/amigos/solicitacoes`, {
    method: "POST",
    headers: firstHeaders,
    body: JSON.stringify({ friend_code: second.user.friend_code })
  });
  assert.equal(duplicate.response.status, 409);

  const incoming = await request(`${baseUrl}/api/amigos`, { headers: secondHeaders });
  assert.equal(incoming.body.received[0].id_usuario, first.user.id_usuario);
  const accepted = await request(`${baseUrl}/api/amigos/solicitacoes/${first.user.id_usuario}/aceitar`, {
    method: "POST",
    headers: secondHeaders
  });
  assert.equal(accepted.response.status, 200);

  const friendList = await request(`${baseUrl}/api/amigos`, { headers: firstHeaders });
  assert.equal(friendList.body.friends[0].id_usuario, second.user.id_usuario);
  const removed = await request(`${baseUrl}/api/amigos/${second.user.id_usuario}`, {
    method: "DELETE",
    headers: firstHeaders
  });
  assert.equal(removed.response.status, 200);
});

test("sala privada aceita convite de amigo e inicia a batalha pelo código", async () => {
  const players = [];
  for (let i = 1; i <= 2; i++) {
    const email = `salaprivada${i}@example.com`;
    const registered = await request(`${baseUrl}/api/auth/register`, {
      method: "POST",
      body: JSON.stringify({
        nome: `Sala Privada ${i}`,
        email,
        confirmacao_email: email,
        senha: "Teste@123",
        confirmacao: "Teste@123"
      })
    });
    assert.equal(registered.response.status, 201);
    players.push(registered.body);
  }
  const friendship = await request(`${baseUrl}/api/amigos/solicitacoes`, {
    method: "POST",
    headers: { Authorization: `Bearer ${players[0].token}` },
    body: JSON.stringify({ friend_code: players[1].user.friend_code })
  });
  assert.equal(friendship.response.status, 201);
  await request(`${baseUrl}/api/amigos/solicitacoes/${players[0].user.id_usuario}/aceitar`, {
    method: "POST",
    headers: { Authorization: `Bearer ${players[1].token}` }
  });

  const sockets = players.map(player => io(baseUrl, {
    auth: { token: player.token },
    transports: ["websocket"],
    forceNew: true
  }));
  await Promise.all(sockets.map(socket => new Promise((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  })));

  try {
    const created = new Promise(resolve => sockets[0].once("duelo_sala_criada", resolve));
    sockets[0].emit("duelo_criar_sala", { mode: "conhecimento" });
    const room = await created;
    const invitation = new Promise(resolve => sockets[1].once("duelo_convite", resolve));
    sockets[0].emit("duelo_convidar", {
      code: room.code,
      userId: players[1].user.id_usuario
    });
    assert.equal((await invitation).code, room.code);

    const starts = sockets.map(socket => new Promise(resolve => socket.once("duelo_inicio", resolve)));
    sockets[1].emit("duelo_entrar_sala", { code: room.code });
    const matches = await Promise.all(starts);
    assert.equal(matches[0].code, room.code);
    assert.equal(matches[1].code, room.code);
    assert.equal(matches[0].players.length, 2);

    const outcomes = sockets.map(socket => new Promise(resolve => socket.once("duelo_resultado", resolve)));
    sockets.forEach(socket => {
      for (let questionIndex = 0; questionIndex < 10; questionIndex++) {
        socket.emit("duelo_responder", {
          code: room.code,
          questionIndex,
          alternativa: "A"
        });
      }
    });
    await Promise.all(outcomes);
  } finally {
    sockets.forEach(socket => socket.disconnect());
  }
});

test("duelo Blitz encerra ao responder todas as questões e para o timer", async () => {
  const players = [];
  for (let i = 1; i <= 2; i++) {
    const email = `duelista${i}@example.com`;
    const registered = await request(`${baseUrl}/api/auth/register`, {
      method: "POST",
      body: JSON.stringify({
        nome: `Duelista ${i}`,
        email,
        confirmacao_email: email,
        senha: "Teste@123",
        confirmacao: "Teste@123"
      })
    });
    assert.equal(registered.response.status, 201);
    players.push(registered.body);
  }

  const sockets = players.map((player) =>
    io(baseUrl, {
      auth: { token: player.token },
      transports: ["websocket"],
      forceNew: true
    })
  );

  await Promise.all(sockets.map((socket) => new Promise((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  })));

  const starts = sockets.map((socket) => new Promise((resolve) => socket.once("duelo_inicio", resolve)));
  sockets.forEach((socket) => socket.emit("duelo_buscar", { mode: "blitz", duration: "1" }));
  const matches = await Promise.all(starts);
  assert.equal(matches[0].code, matches[1].code);
  assert.equal(matches[0].questions.length, 10);

  const results = sockets.map((socket) => new Promise((resolve) => socket.once("duelo_resultado", resolve)));
  sockets.forEach((socket) => {
    for (let questionIndex = 0; questionIndex < 10; questionIndex++) {
      socket.emit("duelo_responder", {
        code: matches[0].code,
        questionIndex,
        alternativa: "A"
      });
    }
  });

  const outcomes = await Promise.all(results.map((promise) =>
    Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Duelo não terminou após 10 respostas.")), 5000))
    ])
  ));
  assert.equal(outcomes[0].code, matches[0].code);
  assert.equal(outcomes[1].code, matches[1].code);

  let timerEventsAfterFinish = 0;
  sockets.forEach((socket) => socket.on("duelo_tempo", () => { timerEventsAfterFinish += 1; }));
  await new Promise((resolve) => setTimeout(resolve, 1500));
  assert.equal(timerEventsAfterFinish, 0);

  sockets.forEach((socket) => socket.disconnect());
});
