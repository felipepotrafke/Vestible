const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

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
