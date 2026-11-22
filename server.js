const fs = require("fs");
const path = require("path");
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");

const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || "vestible-desenvolvimento-segredo";
const DB_PATH = process.env.DB_PATH || "./data/vestible.db";
const ROOT = __dirname;
const dbFile = path.resolve(ROOT, DB_PATH);
fs.mkdirSync(path.dirname(dbFile), { recursive: true });
const db = new Database(dbFile);
db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS usuario (
  id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha TEXT NOT NULL,
  xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  nivel INTEGER NOT NULL DEFAULT 1 CHECK (nivel > 0),
  streak INTEGER NOT NULL DEFAULT 0 CHECK (streak >= 0),
  questoes_feitas_hoje INTEGER NOT NULL DEFAULT 0 CHECK (questoes_feitas_hoje >= 0),
  data_ultimo_reset TEXT,
  data_criacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  tipo TEXT NOT NULL DEFAULT 'aluno' CHECK (tipo IN ('aluno', 'admin'))
);
CREATE INDEX IF NOT EXISTS idx_usuario_email ON usuario(email);

CREATE TABLE IF NOT EXISTS amizade (
  id_usuario_solicitante INTEGER NOT NULL,
  id_usuario_solicitado INTEGER NOT NULL,
  data_inicio TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente','Aceita','Bloqueada')),
  PRIMARY KEY (id_usuario_solicitante, id_usuario_solicitado),
  FOREIGN KEY (id_usuario_solicitante) REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  FOREIGN KEY (id_usuario_solicitado) REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  CONSTRAINT chk_nao_auto_amigo CHECK (id_usuario_solicitante != id_usuario_solicitado)
);
CREATE INDEX IF NOT EXISTS idx_amizade_solicitado ON amizade(id_usuario_solicitado);

CREATE TABLE IF NOT EXISTS desempenho (
  id_usuario INTEGER PRIMARY KEY,
  total_acertos INTEGER NOT NULL DEFAULT 0 CHECK (total_acertos >= 0),
  total_erros INTEGER NOT NULL DEFAULT 0 CHECK (total_erros >= 0),
  taxa_acerto REAL NOT NULL DEFAULT 0.00 CHECK (taxa_acerto BETWEEN 0 AND 100),
  FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS questao (
  id_questao INTEGER PRIMARY KEY AUTOINCREMENT,
  enunciado TEXT NOT NULL,
  alternativa_a TEXT NOT NULL,
  alternativa_b TEXT NOT NULL,
  alternativa_c TEXT NOT NULL,
  alternativa_d TEXT NOT NULL,
  alternativa_e TEXT,
  resposta_correta TEXT NOT NULL CHECK (resposta_correta IN ('A','B','C','D','E')),
  disciplina TEXT NOT NULL,
  tema TEXT NOT NULL,
  dificuldade TEXT NOT NULL CHECK (dificuldade IN ('Facil','Medio','Dificil'))
);

CREATE TABLE IF NOT EXISTS resposta (
  id_resposta INTEGER PRIMARY KEY AUTOINCREMENT,
  id_usuario INTEGER NOT NULL,
  id_questao INTEGER NOT NULL,
  alternativa_escolhida TEXT NOT NULL CHECK (alternativa_escolhida IN ('A','B','C','D','E')),
  correta INTEGER NOT NULL CHECK (correta IN (0,1)),
  tempo_resposta REAL CHECK (tempo_resposta >= 0),
  data_resposta TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  FOREIGN KEY (id_questao) REFERENCES questao(id_questao) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS duelo (
  id_duelo INTEGER PRIMARY KEY AUTOINCREMENT,
  id_host INTEGER NOT NULL,
  id_desafiante INTEGER NOT NULL,
  pontuacao_host INTEGER NOT NULL DEFAULT 0,
  pontuacao_desafiante INTEGER NOT NULL DEFAULT 0,
  tempo_host REAL DEFAULT 0,
  tempo_desafiante REAL DEFAULT 0,
  id_vencedor INTEGER,
  status TEXT NOT NULL DEFAULT 'Aguardando' CHECK (status IN ('Aguardando','Em andamento','Finalizado')),
  data_inicio TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_host) REFERENCES usuario(id_usuario),
  FOREIGN KEY (id_desafiante) REFERENCES usuario(id_usuario),
  FOREIGN KEY (id_vencedor) REFERENCES usuario(id_usuario),
  CONSTRAINT chk_nao_auto_duelo CHECK (id_host != id_desafiante)
);

CREATE TABLE IF NOT EXISTS material_apoio (
  id_material INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo TEXT NOT NULL,
  link_video TEXT,
  texto_explicativo TEXT,
  disciplina TEXT NOT NULL,
  tema TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS questao_material (
  id_questao INTEGER NOT NULL,
  id_material INTEGER NOT NULL,
  PRIMARY KEY (id_questao, id_material),
  FOREIGN KEY (id_questao) REFERENCES questao(id_questao) ON DELETE CASCADE,
  FOREIGN KEY (id_material) REFERENCES material_apoio(id_material) ON DELETE CASCADE
);
`);

// If an older database has the original schema, add the admin field when needed.
const usuarioColumns = db.prepare("PRAGMA table_info(usuario)").all();
if (!usuarioColumns.some((column) => column.name === "tipo")) {
  db.exec("ALTER TABLE usuario ADD COLUMN tipo TEXT NOT NULL DEFAULT 'aluno' CHECK (tipo IN ('aluno','admin'))");
}

const questionCount = db.prepare("SELECT COUNT(*) AS count FROM questao").get().count;
if (questionCount === 0) {
  const seed = db.transaction(() => {
    const seedUsers = [
      ["Administrador Vestible", "admin@vestible.com", "Admin@123", "admin"],
      ["Professor 1", "prof1@vestible.com", "Vestible@123", "aluno"],
      ["Professor 2", "prof2@vestible.com", "Vestible@123", "aluno"]
    ];
    const insertUser = db.prepare(`
      INSERT INTO usuario (nome, email, senha, tipo)
      VALUES (?, ?, ?, ?)
    `);
    const insertPerformance = db.prepare("INSERT INTO desempenho (id_usuario) VALUES (?)");
    for (const [nome, email, password, tipo] of seedUsers) {
      const result = insertUser.run(nome, email, bcrypt.hashSync(password, 10), tipo);
      insertPerformance.run(result.lastInsertRowid);
    }

    const insertMaterial = db.prepare(`
      INSERT INTO material_apoio (titulo, link_video, texto_explicativo, disciplina, tema)
      VALUES (?, ?, ?, ?, ?)
    `);
    const insertQuestion = db.prepare(`
      INSERT INTO questao
      (enunciado, alternativa_a, alternativa_b, alternativa_c, alternativa_d, alternativa_e, resposta_correta, disciplina, tema, dificuldade)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const link = db.prepare("INSERT INTO questao_material (id_questao, id_material) VALUES (?, ?)");

    const groups = [
      ["Matemática", "Funções", [
        ["Se f(x)=2x+3, o valor de f(5) é:", "10","13","15","18","20","B","Medio"],
        ["O vértice da parábola y=x²-4x+3 é:", "(2,-1)","(-2,1)","(1,-2)","(4,3)","(0,3)","A","Medio"],
        ["Quanto vale 3² + 4²?", "12","25","20","14","49","B","Facil"],
        ["A raiz positiva de x²-9=0 é:", "1","3","-3","9","0","B","Facil"],
        ["Se 20% de um valor é 50, o valor é:", "200","250","300","400","500","B","Medio"],
        ["O próximo termo de 2, 6, 18, 54 é:", "108","162","216","72","60","B","Medio"]
      ]],
      ["Física", "Cinemática", [
        ["Uma velocidade média de 20 m/s por 5 s percorre:", "4 m","100 m","25 m","125 m","50 m","B","Facil"],
        ["Um corpo cai com g=10 m/s² após 3 s atinge:", "30 m/s","13 m/s","3 m/s","300 m/s","10 m/s","A","Medio"],
        ["A unidade da força no SI é:", "Pascal","Newton","Joule","Watt","Volt","B","Facil"],
        ["A densidade é definida por:", "massa × volume","massa/volume","peso × volume","volume/massa","massa + volume","B","Facil"],
        ["A energia cinética depende de:", "massa e velocidade","tempo e peso","força e tempo","altura apenas","densidade","A","Medio"],
        ["Um movimento com velocidade constante é:", "MUV","MU","CA","Free fall","Uniformemente acelerado","B","Facil"]
      ]],
      ["História", "Brasil Colonial", [
        ["O Brasil foi descoberto oficialmente em:", "1492","1500","1822","1888","1530","B","Facil"],
        ["A primeira capital do Brasil foi:", "Rio de Janeiro","Salvador","Brasília","São Paulo","Recife","B","Facil"],
        ["A escravidão foi abolida no Brasil em:", "1822","1888","1889","1930","1808","B","Facil"],
        ["As capitanias hereditárias foram criadas por:", "Portugal","França","Holanda","Inglaterra","Espanha","A","Medio"],
        ["O bandeirismo relacionava-se principalmente:", "expansão interior","literatura","petróleo","aviões","orfebreria","A","Medio"],
        ["O ciclo do ouro concentrou riqueza em:", "Minas Gerais","Amazonas","Rio Grande do Sul","Bahia","Pará","A","Medio"]
      ]],
      ["Português", "Gramática", [
        ["Na frase 'Ele correu', 'correu' é:", "substantivo","verbo","adjetivo","advérbio","preposição","B","Facil"],
        ["A oração subordinada depende de:", "outra oração","sinal apenas","nenhuma estrutura","pontuação","capítulo","A","Medio"],
        ["A palavra 'muito' em 'muito inteligente' é:", "adjetivo","advérbio","substantivo","pronome","verbo","B","Facil"],
        ["Sinônimo de 'efêmero' é:", "duradouro","passageiro","forte","grande","escuro","B","Medio"],
        ["O sujeito em 'Choveu ontem' é:", "simples","composto","indeterminado","desinencial","oração sem sujeito","E","Medio"],
        ["A crase ocorre antes de palavra:", "masculina","feminina","verbal","numérica","preposição repetida","B","Medio"]
      ]],
      ["Geografia", "Climatologia", [
        ["El Niño aquece anormalmente o Oceano:", "Atlântico Norte","Pacífico","Índico","Ártico","Mediterrâneo","B","Medio"],
        ["A Amazônia pertence principalmente ao clima:", "polar","equatorial úmido","mediterrâneo","desértico","temperado","B","Facil"],
        ["O efeito estufa é causado por:", "gases atmosféricos","apenas vulcões","camadas rochosas","marés","vento solar","A","Medio"],
        ["A latitude mede a distância em graus em relação ao:", "Meridiano de Greenwich","Equador","Polo Norte","Trópico de Câncer","Círculo Polar","B","Facil"],
        ["A erosão é um processo de:", "desgaste","congelamento","nascimento","industrialização","magnetismo","A","Medio"],
        ["O bioma predominante no Nordeste seco é:", "Caatinga","Pampa","Pantanal","Mata Atlântica","Tundra","A","Facil"]
      ]]
    ];

    for (const [disciplina, tema, questions] of groups) {
      for (let i = 0; i < questions.length; i++) {
        const [enunciado, a, b, c, d, e, correta, dificuldade] = questions[i];
        const material = insertMaterial.run(
          `${tema}: revisão ${i + 1}`,
          "https://www.youtube.com/results?search_query=" + encodeURIComponent(`${disciplina} ${tema}`),
          `Material de apoio sobre ${tema}. Revise os conceitos principais, exemplos e relações fundamentais antes de tentar novamente.`,
          disciplina,
          tema
        );
        const question = insertQuestion.run(enunciado, a, b, c, d, e, correta, disciplina, tema, dificuldade);
        link.run(question.lastInsertRowid, material.lastInsertRowid);
      }
    }
  });
  seed();
}

const app = express();
app.use(express.json());

function today() {
  return new Date().toISOString().slice(0, 10);
}

function resetUserDay(user) {
  if (user.data_ultimo_reset !== today()) {
    let streak = user.streak;
    if (user.data_ultimo_reset) {
      const previous = new Date(`${user.data_ultimo_reset}T00:00:00Z`);
      const current = new Date(`${today()}T00:00:00Z`);
      const diff = Math.round((current - previous) / 86400000);
      if (diff !== 1) streak = 0;
    } else {
      streak = 0;
    }
    db.prepare("UPDATE usuario SET questoes_feitas_hoje = 0, data_ultimo_reset = ?, streak = ? WHERE id_usuario = ?")
      .run(today(), streak, user.id_usuario);
  }
}

function publicUser(user) {
  return {
    id_usuario: user.id_usuario,
    nome: user.nome,
    email: user.email,
    xp: user.xp,
    nivel: user.nivel,
    streak: user.streak,
    questoes_feitas_hoje: user.questoes_feitas_hoje,
    tipo: user.tipo
  };
}

function signToken(user) {
  return jwt.sign({ id: user.id_usuario, tipo: user.tipo }, JWT_SECRET, { expiresIn: "7d" });
}

function readToken(req) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith("Bearer ")) return auth.slice(7);
  const cookie = (req.headers.cookie || "").split(";").map((v) => v.trim()).find((v) => v.startsWith("token="));
  return cookie ? decodeURIComponent(cookie.slice("token=".length)) : null;
}

function authRequired(req, res, next) {
  try {
    const token = readToken(req);
    if (!token) return res.status(401).json({ error: "Autenticação obrigatória." });
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare("SELECT * FROM usuario WHERE id_usuario = ?").get(payload.id);
    if (!user) return res.status(401).json({ error: "Usuário não encontrado." });
    resetUserDay(user);
    req.user = db.prepare("SELECT * FROM usuario WHERE id_usuario = ?").get(payload.id);
    next();
  } catch {
    return res.status(401).json({ error: "Sessão inválida ou expirada." });
  }
}

function adminRequired(req, res, next) {
  if (req.user.tipo !== "admin") return res.status(403).json({ error: "Acesso exclusivo para administradores." });
  next();
}

function setAuthCookie(res, token) {
  res.setHeader("Set-Cookie", `token=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax`);
}

app.post("/api/auth/register", (req, res) => {
  const nome = String(req.body.nome || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const senha = String(req.body.senha || "");
  const confirmacao = String(req.body.confirmacao || "");
  if (!nome || !email) return res.status(400).json({ error: "Nome e e-mail são obrigatórios." });
  if (senha.length < 8) return res.status(400).json({ error: "A senha deve ter pelo menos 8 caracteres." });
  if (senha !== confirmacao) return res.status(400).json({ error: "A confirmação da senha não coincide." });
  if (db.prepare("SELECT 1 FROM usuario WHERE email = ?").get(email)) {
    return res.status(409).json({ error: "Este e-mail já está cadastrado." });
  }
  try {
    const register = db.transaction(() => {
      const result = db.prepare("INSERT INTO usuario (nome, email, senha, tipo) VALUES (?, ?, ?, 'aluno')")
        .run(nome, email, bcrypt.hashSync(senha, 10));
      db.prepare("INSERT INTO desempenho (id_usuario) VALUES (?)").run(result.lastInsertRowid);
      return db.prepare("SELECT * FROM usuario WHERE id_usuario = ?").get(result.lastInsertRowid);
    });
    const user = register();
    const token = signToken(user);
    setAuthCookie(res, token);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (error) {
    res.status(500).json({ error: "Não foi possível concluir o cadastro." });
  }
});

app.post("/api/auth/login", (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const senha = String(req.body.senha || "");
  const user = db.prepare("SELECT * FROM usuario WHERE email = ?").get(email);
  if (!user || !bcrypt.compareSync(senha, user.senha)) {
    return res.status(401).json({ error: "E-mail ou senha inválidos." });
  }
  resetUserDay(user);
  const freshUser = db.prepare("SELECT * FROM usuario WHERE id_usuario = ?").get(user.id_usuario);
  const token = signToken(freshUser);
  setAuthCookie(res, token);
  res.json({ token, user: publicUser(freshUser) });
});

app.post("/api/auth/logout", (req, res) => {
  res.setHeader("Set-Cookie", "token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
  res.json({ ok: true });
});

app.get("/api/me", authRequired, (req, res) => {
  const performance = db.prepare("SELECT * FROM desempenho WHERE id_usuario = ?").get(req.user.id_usuario);
  res.json({ user: publicUser(req.user), desempenho: performance });
});

app.get("/api/dashboard", authRequired, (req, res) => {
  const performance = db.prepare("SELECT * FROM desempenho WHERE id_usuario = ?").get(req.user.id_usuario);
  const ranking = db.prepare("SELECT id_usuario, nome, xp, nivel, streak FROM usuario ORDER BY xp DESC").all();
  const position = ranking.findIndex((item) => item.id_usuario === req.user.id_usuario) + 1;
  const recentErrors = db.prepare(`
    SELECT q.id_questao, q.enunciado, q.disciplina, q.tema, r.data_resposta
    FROM resposta r JOIN questao q ON q.id_questao = r.id_questao
    WHERE r.id_usuario = ? AND r.correta = 0
    ORDER BY r.data_resposta DESC LIMIT 5
  `).all(req.user.id_usuario);
  res.json({
    user: publicUser(req.user),
    desempenho: performance,
    rankingPosition: position,
    recentErrors
  });
});

app.get("/api/disciplinas", authRequired, (req, res) => {
  const rows = db.prepare("SELECT DISTINCT disciplina FROM questao ORDER BY disciplina").all();
  res.json(rows.map((row) => row.disciplina));
});

app.get("/api/questoes", authRequired, (req, res) => {
  const disciplina = req.query.disciplina ? String(req.query.disciplina) : null;
  let questions = disciplina
    ? db.prepare("SELECT * FROM questao WHERE disciplina = ? ORDER BY id_questao").all(disciplina)
    : db.prepare("SELECT * FROM questao ORDER BY id_questao").all();
  res.json(questions.map((q) => ({
    id_questao: q.id_questao,
    enunciado: q.enunciado,
    alternativa_a: q.alternativa_a,
    alternativa_b: q.alternativa_b,
    alternativa_c: q.alternativa_c,
    alternativa_d: q.alternativa_d,
    alternativa_e: q.alternativa_e,
    disciplina: q.disciplina,
    tema: q.tema,
    dificuldade: q.dificuldade
  })));
});

app.post("/api/respostas", authRequired, (req, res) => {
  const idQuestao = Number(req.body.id_questao);
  const alternativa = String(req.body.alternativa || "").trim().toUpperCase();
  const tempo = req.body.tempo_resposta === undefined ? null : Number(req.body.tempo_resposta);
  if (!["A", "B", "C", "D", "E"].includes(alternativa)) {
    return res.status(400).json({ error: "Alternativa inválida." });
  }
  const question = db.prepare("SELECT * FROM questao WHERE id_questao = ?").get(idQuestao);
  if (!question) return res.status(404).json({ error: "Questão não encontrada." });

  const registrar = db.transaction(() => {
    const correta = alternativa === question.resposta_correta ? 1 : 0;
    const before = db.prepare("SELECT questoes_feitas_hoje, streak FROM usuario WHERE id_usuario = ?")
      .get(req.user.id_usuario);
    if (before.questoes_feitas_hoje === 0) {
      db.prepare("UPDATE usuario SET streak = ? WHERE id_usuario = ?")
        .run(before.streak + 1, req.user.id_usuario);
    }
    if (correta) {
      db.prepare("UPDATE usuario SET xp = xp + 10 WHERE id_usuario = ?").run(req.user.id_usuario);
      db.prepare("UPDATE desempenho SET total_acertos = total_acertos + 1 WHERE id_usuario = ?").run(req.user.id_usuario);
    } else {
      db.prepare("UPDATE desempenho SET total_erros = total_erros + 1 WHERE id_usuario = ?").run(req.user.id_usuario);
    }
    db.prepare(`
      INSERT INTO resposta (id_usuario, id_questao, alternativa_escolhida, correta, tempo_resposta)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.user.id_usuario, idQuestao, alternativa, correta, tempo);
    db.prepare("UPDATE usuario SET questoes_feitas_hoje = questoes_feitas_hoje + 1 WHERE id_usuario = ?")
      .run(req.user.id_usuario);

    const performance = db.prepare("SELECT total_acertos, total_erros FROM desempenho WHERE id_usuario = ?")
      .get(req.user.id_usuario);
    const total = performance.total_acertos + performance.total_erros;
    const taxa = total === 0 ? 0 : (performance.total_acertos / total) * 100;
    db.prepare("UPDATE desempenho SET taxa_acerto = ? WHERE id_usuario = ?")
      .run(Number(taxa.toFixed(2)), req.user.id_usuario);

    const freshUser = db.prepare("SELECT * FROM usuario WHERE id_usuario = ?").get(req.user.id_usuario);
    const newLevel = Math.floor(freshUser.xp / 1000) + 1;
    if (newLevel !== freshUser.nivel) {
      db.prepare("UPDATE usuario SET nivel = ? WHERE id_usuario = ?").run(newLevel, req.user.id_usuario);
    }
    const todayUser = db.prepare("SELECT * FROM usuario WHERE id_usuario = ?").get(req.user.id_usuario);
    const freshPerformance = db.prepare("SELECT * FROM desempenho WHERE id_usuario = ?").get(req.user.id_usuario);
    let materiais = [];
    if (!correta) {
      materiais = db.prepare(`
        SELECT ma.*
        FROM questao_material qm JOIN material_apoio ma ON ma.id_material = qm.id_material
        WHERE qm.id_questao = ? ORDER BY ma.id_material
      `).all(idQuestao);
    }
    return { user: todayUser, desempenho: freshPerformance, materiais };
  });

  const result = registrar();
  res.json({
    correta: alternativa === question.resposta_correta,
    resposta_correta: question.resposta_correta,
    xp_ganho: alternativa === question.resposta_correta ? 10 : 0,
    user: publicUser(result.user),
    desempenho: result.desempenho,
    materiais: result.materiais
  });
});

app.get("/api/materiais", authRequired, (req, res) => {
  const disciplina = req.query.disciplina ? String(req.query.disciplina) : null;
  const rows = disciplina
    ? db.prepare("SELECT * FROM material_apoio WHERE disciplina = ? ORDER BY id_material").all(disciplina)
    : db.prepare("SELECT * FROM material_apoio ORDER BY id_material").all();
  res.json(rows);
});

app.get("/api/ranking", authRequired, (req, res) => {
  const ranking = db.prepare(`
    SELECT u.id_usuario, u.nome, u.xp, u.nivel, u.streak,
           d.total_acertos, d.total_erros, d.taxa_acerto
    FROM usuario u LEFT JOIN desempenho d ON d.id_usuario = u.id_usuario
    WHERE u.tipo = 'aluno'
    ORDER BY u.xp DESC, u.nome ASC
  `).all();
  res.json(ranking);
});

// Admin routes
app.get("/api/admin/usuarios", authRequired, adminRequired, (req, res) => {
  const users = db.prepare(`
    SELECT u.id_usuario, u.nome, u.email, u.tipo, u.xp, u.nivel, u.streak,
           d.total_acertos, d.total_erros, d.taxa_acerto
    FROM usuario u LEFT JOIN desempenho d ON d.id_usuario = u.id_usuario
    ORDER BY u.tipo DESC, u.nome
  `).all();
  res.json(users);
});

app.get("/api/admin/materiais", authRequired, adminRequired, (req, res) => {
  res.json(db.prepare("SELECT * FROM material_apoio ORDER BY id_material").all());
});

app.post("/api/admin/materiais", authRequired, adminRequired, (req, res) => {
  const { titulo, link_video, texto_explicativo, disciplina, tema } = req.body;
  if (!String(titulo || "").trim() || !String(disciplina || "").trim() || !String(tema || "").trim()) {
    return res.status(400).json({ error: "Título, disciplina e tema são obrigatórios." });
  }
  const result = db.prepare(`
    INSERT INTO material_apoio (titulo, link_video, texto_explicativo, disciplina, tema)
    VALUES (?, ?, ?, ?, ?)
  `).run(titulo.trim(), link_video || null, texto_explicativo || null, disciplina.trim(), tema.trim());
  res.status(201).json(db.prepare("SELECT * FROM material_apoio WHERE id_material = ?").get(result.lastInsertRowid));
});

app.put("/api/admin/materiais/:id", authRequired, adminRequired, (req, res) => {
  const id = Number(req.params.id);
  const { titulo, link_video, texto_explicativo, disciplina, tema } = req.body;
  db.prepare(`
    UPDATE material_apoio
    SET titulo = ?, link_video = ?, texto_explicativo = ?, disciplina = ?, tema = ?
    WHERE id_material = ?
  `).run(titulo, link_video || null, texto_explicativo || null, disciplina, tema, id);
  const material = db.prepare("SELECT * FROM material_apoio WHERE id_material = ?").get(id);
  if (!material) return res.status(404).json({ error: "Material não encontrado." });
  res.json(material);
});

app.delete("/api/admin/materiais/:id", authRequired, adminRequired, (req, res) => {
  db.prepare("DELETE FROM material_apoio WHERE id_material = ?").run(Number(req.params.id));
  res.json({ ok: true });
});

app.post("/api/admin/questoes", authRequired, adminRequired, (req, res) => {
  const q = req.body;
  if (!q.enunciado || !q.alternativa_a || !q.alternativa_b || !q.alternativa_c || !q.alternativa_d ||
      !q.resposta_correta || !q.disciplina || !q.tema) {
    return res.status(400).json({ error: "Preencha todos os campos obrigatórios da questão." });
  }
  const resultado = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO questao
      (enunciado, alternativa_a, alternativa_b, alternativa_c, alternativa_d, alternativa_e,
       resposta_correta, disciplina, tema, dificuldade)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(q.enunciado, q.alternativa_a, q.alternativa_b, q.alternativa_c, q.alternativa_d,
      q.alternativa_e || null, q.resposta_correta, q.disciplina, q.tema, q.dificuldade || "Medio");
    if (q.id_material) {
      db.prepare("INSERT OR IGNORE INTO questao_material (id_questao, id_material) VALUES (?, ?)")
        .run(result.lastInsertRowid, Number(q.id_material));
    }
    return db.prepare("SELECT * FROM questao WHERE id_questao = ?").get(result.lastInsertRowid);
  });
  res.status(201).json(resultado());
});

app.put("/api/admin/questoes/:id", authRequired, adminRequired, (req, res) => {
  const id = Number(req.params.id);
  const q = req.body;
  const atualizar = db.transaction(() => {
    db.prepare(`
      UPDATE questao SET enunciado = ?, alternativa_a = ?, alternativa_b = ?, alternativa_c = ?,
      alternativa_d = ?, alternativa_e = ?, resposta_correta = ?, disciplina = ?, tema = ?, dificuldade = ?
      WHERE id_questao = ?
    `).run(q.enunciado, q.alternativa_a, q.alternativa_b, q.alternativa_c, q.alternativa_d,
      q.alternativa_e || null, q.resposta_correta, q.disciplina, q.tema, q.dificuldade, id);
    if (q.id_material) {
      db.prepare("DELETE FROM questao_material WHERE id_questao = ?").run(id);
      db.prepare("INSERT INTO questao_material (id_questao, id_material) VALUES (?, ?)")
        .run(id, Number(q.id_material));
    }
  });
  atualizar();
  const question = db.prepare("SELECT * FROM questao WHERE id_questao = ?").get(id);
  if (!question) return res.status(404).json({ error: "Questão não encontrada." });
  res.json(question);
});

app.delete("/api/admin/questoes/:id", authRequired, adminRequired, (req, res) => {
  db.prepare("DELETE FROM questao WHERE id_questao = ?").run(Number(req.params.id));
  res.json({ ok: true });
});

app.get("/api/admin/questoes", authRequired, adminRequired, (req, res) => {
  const rows = db.prepare(`
    SELECT q.*, qm.id_material
    FROM questao q LEFT JOIN questao_material qm ON qm.id_questao = q.id_questao
    ORDER BY q.id_questao
  `).all();
  res.json(rows);
});

app.get("/admin.html", authRequired, adminRequired, (req, res) => {
  res.sendFile(path.join(ROOT, "admin.html"));
});

app.use(express.static(ROOT, {
  extensions: ["html"],
  index: "index.html"
}));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Vestible rodando em http://localhost:${PORT}`);
  console.log(`Banco SQLite: ${dbFile}`);
});
