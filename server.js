const fs = require("fs");
const path = require("path");
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const Database = require("better-sqlite3");
const multer = require("multer");
const http = require("http");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "vestible-desenvolvimento-segredo";
const DB_PATH = process.env.DB_PATH || "./data/vestible.db";
const ROOT = __dirname;
const dbFile = path.resolve(ROOT, DB_PATH);
fs.mkdirSync(path.dirname(dbFile), { recursive: true });
const db = new Database(dbFile);
db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");
fs.mkdirSync(path.join(ROOT, "uploads"), { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(ROOT, "uploads"),
    filename: (req, file, cb) => {
      const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname).toLowerCase()}`;
      cb(null, safeName);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype))
});

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
  foto_cor TEXT NOT NULL DEFAULT 'azul',
  foto_avatar TEXT,
  email_verificado INTEGER NOT NULL DEFAULT 0 CHECK (email_verificado IN (0,1)),
  codigo_verificacao TEXT,
  codigo_expira_em TEXT,
  codigo_enviado_em TEXT,
  data_ultima_atividade TEXT,
  modo_daltonismo TEXT NOT NULL DEFAULT 'nenhum' CHECK (modo_daltonismo IN ('nenhum','protanopia','deuteranopia','tritanopia')),
  reducao_movimento INTEGER NOT NULL DEFAULT 0 CHECK (reducao_movimento IN (0,1)),
  animacao_streak INTEGER NOT NULL DEFAULT 1 CHECK (animacao_streak IN (0,1)),
  notificacoes INTEGER NOT NULL DEFAULT 1 CHECK (notificacoes IN (0,1)),
  conta_excluida INTEGER NOT NULL DEFAULT 0 CHECK (conta_excluida IN (0,1)),
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
  imagem_url TEXT,
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

CREATE TABLE IF NOT EXISTS conta_exclusao (
  email TEXT PRIMARY KEY,
  disponivel_em TEXT NOT NULL,
  criada_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

// If an older database has the original schema, add the admin field when needed.
const usuarioColumns = db.prepare("PRAGMA table_info(usuario)").all();
if (!usuarioColumns.some((column) => column.name === "tipo")) {
  db.exec("ALTER TABLE usuario ADD COLUMN tipo TEXT NOT NULL DEFAULT 'aluno' CHECK (tipo IN ('aluno','admin'))");
}
const usuarioColumnsAfter = db.prepare("PRAGMA table_info(usuario)").all();
if (!usuarioColumnsAfter.some((column) => column.name === "foto_cor")) {
  db.exec("ALTER TABLE usuario ADD COLUMN foto_cor TEXT NOT NULL DEFAULT 'azul'");
}
const usuarioColumnsWithAvatar = db.prepare("PRAGMA table_info(usuario)").all();
if (!usuarioColumnsWithAvatar.some((column) => column.name === "foto_avatar")) {
  db.exec("ALTER TABLE usuario ADD COLUMN foto_avatar TEXT");
}
const usuarioColumnsWithVerification = db.prepare("PRAGMA table_info(usuario)").all();
if (!usuarioColumnsWithVerification.some((column) => column.name === "email_verificado")) {
  db.exec("ALTER TABLE usuario ADD COLUMN email_verificado INTEGER NOT NULL DEFAULT 0 CHECK (email_verificado IN (0,1))");
}
db.exec("UPDATE usuario SET email_verificado = 1");
if (!usuarioColumnsWithVerification.some((column) => column.name === "codigo_verificacao")) {
  db.exec("ALTER TABLE usuario ADD COLUMN codigo_verificacao TEXT");
}
if (!usuarioColumnsWithVerification.some((column) => column.name === "codigo_expira_em")) {
  db.exec("ALTER TABLE usuario ADD COLUMN codigo_expira_em TEXT");
}
if (!usuarioColumnsWithVerification.some((column) => column.name === "codigo_enviado_em")) {
  db.exec("ALTER TABLE usuario ADD COLUMN codigo_enviado_em TEXT");
}
const usuarioColumnsWithActivity = db.prepare("PRAGMA table_info(usuario)").all();
if (!usuarioColumnsWithActivity.some((column) => column.name === "data_ultima_atividade")) {
  db.exec("ALTER TABLE usuario ADD COLUMN data_ultima_atividade TEXT");
}
const usuarioColumnsWithPreferences = db.prepare("PRAGMA table_info(usuario)").all();
if (!usuarioColumnsWithPreferences.some((column) => column.name === "modo_daltonismo")) {
  db.exec("ALTER TABLE usuario ADD COLUMN modo_daltonismo TEXT NOT NULL DEFAULT 'nenhum'");
}
if (!usuarioColumnsWithPreferences.some((column) => column.name === "reducao_movimento")) {
  db.exec("ALTER TABLE usuario ADD COLUMN reducao_movimento INTEGER NOT NULL DEFAULT 0");
}
if (!usuarioColumnsWithPreferences.some((column) => column.name === "animacao_streak")) {
  db.exec("ALTER TABLE usuario ADD COLUMN animacao_streak INTEGER NOT NULL DEFAULT 1");
}
if (!usuarioColumnsWithPreferences.some((column) => column.name === "notificacoes")) {
  db.exec("ALTER TABLE usuario ADD COLUMN notificacoes INTEGER NOT NULL DEFAULT 1");
}
if (!usuarioColumnsWithPreferences.some((column) => column.name === "conta_excluida")) {
  db.exec("ALTER TABLE usuario ADD COLUMN conta_excluida INTEGER NOT NULL DEFAULT 0");
}
const questaoColumns = db.prepare("PRAGMA table_info(questao)").all();
if (!questaoColumns.some((column) => column.name === "imagem_url")) {
  db.exec("ALTER TABLE questao ADD COLUMN imagem_url TEXT");
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
      INSERT INTO usuario (nome, email, senha, tipo, email_verificado)
      VALUES (?, ?, ?, ?, 1)
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

if (db.prepare("SELECT COUNT(*) AS count FROM questao").get().count < 60) {
  const addRealQuestions = db.transaction(() => {
    const insertMaterial = db.prepare(`
      INSERT INTO material_apoio (titulo, link_video, texto_explicativo, disciplina, tema)
      VALUES (?, ?, ?, ?, ?)
    `);
    const insertQuestion = db.prepare(`
      INSERT INTO questao
      (enunciado, alternativa_a, alternativa_b, alternativa_c, alternativa_d, alternativa_e, resposta_correta, disciplina, tema, dificuldade)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const link = db.prepare("INSERT OR IGNORE INTO questao_material (id_questao, id_material) VALUES (?, ?)");
    const extras = [
      ["Matemática","Porcentagem","Uma camisa custa R$ 80,00 e recebe desconto de 25%. Qual é o preço final?","R$ 20,00","R$ 55,00","R$ 60,00","R$ 65,00","R$ 75,00","C","Facil","Porcentagem: exercícios resolvidos","Uma porcentagem representa uma fração de 100. Um desconto de 25% sobre R$ 80 equivale a R$ 20; por isso, R$ 80 menos R$ 20 resulta em R$ 60."],
      ["Matemática","Razão e proporção","Se 3 canetas custam R$ 9, quanto custam 7 canetas?","R$ 18","R$ 21","R$ 24","R$ 27","R$ 30","B","Facil","Razão e proporção","A razão entre quantidade e preço é constante. Como cada caneta custa R$ 3, sete canetas custam R$ 21."],
      ["Matemática","Equações","Qual é o valor de x em 2x + 6 = 18?","4","6","8","10","12","B","Medio","Equações do primeiro grau","Subtraindo 6 dos dois lados: 2x = 12. Dividindo por 2: x = 6."],
      ["Matemática","Geometria","Um triângulo possui lados medindo 3 cm, 4 cm e 5 cm. Ele é:","Obtuso","Equilátero","Retângulo","Isósceles","Acutângulo","C","Medio","Teorema de Pitágoras","Como 3² + 4² = 5², o triângulo é retângulo."],
      ["Matemática","Estatística","Em uma amostra com valores 2, 4, 6 e 8, a média aritmética é:","4","5","6","7","8","B","Facil","Média aritmética","A média é a soma dos valores dividida pelo número de valores: (2+4+6+8)/4 = 5."],
      ["Matemática","Probabilidade","Em um dado comum, a probabilidade de sair um número par é:","1/6","1/4","1/3","1/2","2/3","D","Medio","Probabilidade em dados","Há 3 resultados pares entre 6 resultados possíveis: 3/6 = 1/2."],
      ["Física","Leis de Newton","Qual lei explica a resistência de um corpo a mudar seu estado de movimento?","Primeira Lei","Segunda Lei","Terceira Lei","Lei da gravitação","Lei da conservação","A","Medio","Primeira Lei de Newton","A Primeira Lei de Newton afirma que um corpo permanece em repouso ou movimento uniforme enquanto a força resultante sobre ele é nula."],
      ["Física","Energia","Uma lâmpada de 100 W funcionando por 10 segundos consome:","10 J","100 J","1000 J","10000 J","100000 J","C","Medio","Potência e energia elétrica","Energia elétrica é potência multiplicada pelo tempo: E = 100 W × 10 s = 1000 J."],
      ["Física","Pressão","A unidade de pressão no SI é:","Newton","Pascal","Joule","Watt","Coulomb","B","Facil","Pressão hidrostática e Pascal","No Sistema Internacional, pressão é medida em pascal (Pa), equivalente a newton por metro quadrado."],
      ["Física","Óptica","Um espelho plano produz uma imagem:","Real e ampliada","Virtual e igual ao objeto","Real e invertida","Virtual e menor","Infinita","B","Facil","Espelhos planos","Em um espelho plano, a imagem é virtual, direta e do mesmo tamanho que o objeto."],
      ["Física","Termologia","A temperatura de ebulição da água pura ao nível do mar é aproximadamente:","50 °C","75 °C","100 °C","120 °C","150 °C","C","Facil","Mudanças de fase da água","Ao nível do mar, a pressão atmosférica é cerca de 1 atm e a água pura entra em ebulição aproximadamente a 100 °C."],
      ["Física","Ondas","O som se propaga mais rapidamente em:","Vácuo","Gases raros","Ar","Líquidos","Sólidos","E","Medio","Propagação do som","O som não se propaga no vácuo e costuma viajar mais rápido em sólidos, devido à maior proximidade entre suas partículas."],
      ["História","Brasil República","Em que ano a República foi proclamada no Brasil?","1888","1889","1891","1930","1945","B","Facil","A Proclamação da República","A República foi proclamada em 15 de novembro de 1889 pelo Marechal Deodoro da Fonseca."],
      ["História","Independência","A independência do Brasil ocorreu em:","1808","1822","1889","1930","1945","B","Facil","Independência do Brasil","D. Pedro declarou a independência às margens do rio Ipiranga em 7 de setembro de 1822."],
      ["História","Segunda Guerra","Qual país atacou Pearl Harbor em 1941?","Alemanha","Itália","Japão","União Soviética","Canadá","C","Medio","Segunda Guerra Mundial","O ataque japonês a Pearl Harbor ocorreu em dezembro de 1941 e levou os Estados Unidos a entrar diretamente na guerra."],
      ["História","Guerra Fria","A Guerra Fria foi marcada principalmente pela disputa entre:","Brasil e Portugal","EUA e União Soviética","França e Espanha","China e Índia","Alemanha e Itália","B","Medio","Guerra Fria","A Guerra Fria foi um confronto político, militar e ideológico liderado pelos Estados Unidos e pela União Soviética, sem guerra direta em larga escala entre eles."],
      ["História","Abolição","O movimento abolicionista no Brasil terminou legalmente com:","Lei dos Sexagenários","Lei Eusébio de Queirós","Lei Áurea","Lei do Ventre Livre","Lei de Terras","C","Facil","A abolição no Brasil","A Lei Áurea, assinada pela Princesa Isabel em 13 de maio de 1888, extinguiu a escravidão no Brasil."],
      ["História","Constituição","A atual Constituição brasileira foi promulgada em:","1964","1985","1988","1994","2002","C","Medio","Constituição de 1988","A Constituição Federal foi promulgada em 5 de outubro de 1988 e entrou em vigor na mesma data."],
      ["Português","Interpretação","Em \"Ela chegou cedo\", a expressão \"cedo\" indica:","lugar","tempo","modo","causa","intensidade","B","Facil","Advérbio de tempo","A palavra \"cedo\" indica o tempo em que a ação ocorreu e funciona como advérbio de tempo."],
      ["Português","Pontuação","Os dois-pontos são usados, entre outras funções, para:","terminar uma frase","introduzir uma explicação","separar sílabas","indicar som nasal","trocar de linha","B","Facil","Uso dos dois-pontos","Os dois-pontos introduzem explicação, enumeração, fala ou esclarecimento de uma ideia anterior."],
      ["Português","Verbos","Em \"Nós estudaremos amanhã\", o verbo está no:","presente","pretérito perfeito","pretérito imperfeito","futuro do presente","futuro do pretérito","D","Medio","Tempos verbais","A forma \"estudaremos\" indica uma ação futura em relação ao momento da fala."],
      ["Português","Concordância","Assinale a frase com concordância correta:","Fazem dois anos","Haviam pessoas","Houve problemas","Existe muitas causas","Devem haver soluções","C","Medio","Concordância verbal","O verbo haver no sentido de existir é impessoal: \"Houve problemas\"."],
      ["Português","Literatura","\"Morte e Vida Severina\" é uma obra de:","Machado de Assis","Carlos Drummond","João Cabral de Melo Neto","Clarice Lispector","Graciliano Ramos","C","Medio","Literatura brasileira","João Cabral de Melo Neto escreveu o poema dramático \"Morte e Vida Severina\"."],
      ["Português","Semântica","A palavra que substitui \"alegre\" sem alterar o sentido é:","triste","contente","calado","confuso","cego","B","Facil","Sinônimos","Contente é sinônimo de alegre em contextos comuns."],
      ["Geografia","População","O processo de saída da população do campo para as cidades é chamado:","imigração","êxodo rural","emigração","migração pendular","urbanização espontânea","B","Facil","Êxodo rural","Êxodo rural é a migração da população rural em direção às cidades."],
      ["Geografia","Cartografia","Em um mapa, a legenda serve para:","indicar a data","explicar os símbolos","mostrar a altitude apenas","definir o título","medir a distância","B","Facil","Elementos dos mapas","A legenda explica o significado dos símbolos, cores e convenções presentes no mapa."],
      ["Geografia","Clima","Qual fator modifica o clima por causar temperaturas menores em altitudes maiores?","latitude","altitude","longitude","maritimidade","vegetação","B","Facil","Fatores climáticos","A altitude influencia a temperatura: em geral, quanto maior a altitude, menor a temperatura."],
      ["Geografia","Brasil","O maior rio em volume de água do mundo é:","Nilo","Mississipi","Yangtzé","Amazonas","Danúbio","D","Medio","Geografia da América do Sul","O rio Amazonas possui a maior vazão média do mundo."],
      ["Geografia","Globalização","Um exemplo típico de integração econômica internacional é:","Mercosul","Enxurrada","Êxodo rural","Afloramento rochoso","Sedimentação","A","Medio","Globalização e comércio","O Mercosul é um bloco econômico regional criado para facilitar a integração comercial entre países membros."],
      ["Geografia","Meio ambiente","O aquecimento global está associado principalmente ao aumento de:","gases de efeito estufa","oxigênio puro","gelo polar","nutrientes do solo","movimentos tectônicos","A","Medio","Mudanças climáticas","O aumento de gases como CO₂ intensifica o efeito estufa e contribui para o aquecimento global."]
    ];
    for (const item of extras) {
      const [disciplina, tema, enunciado, a, b, c, d, e, correta, dificuldade, videoTitle, resumo] = item;
      const material = insertMaterial.run(
        videoTitle,
        `https://www.youtube.com/results?search_query=${encodeURIComponent(`${disciplina} ${tema} vestibular`)}`,
        resumo,
        disciplina,
        tema
      );
      const question = insertQuestion.run(enunciado, a, b, c, d, e, correta, disciplina, tema, dificuldade);
      link.run(question.lastInsertRowid, material.lastInsertRowid);
    }
  });
  addRealQuestions();
}

// Expande o banco em instalações existentes sem duplicar enunciados.
const expandedQuestions = [
  ["Matemática","Geometria plana","Uma praça retangular mede 30 m por 20 m. Qual é seu perímetro?","50 m","60 m","100 m","600 m","1200 m","C","Facil","Geometria básica","Perímetro é a soma dos lados: 30+30+20+20=100 m."],
  ["Matemática","Geometria plana","A área de um triângulo com base 12 cm e altura 5 cm é:","17 cm²","30 cm²","60 cm²","25 cm²","120 cm²","B","Facil","Área de triângulos","A área do triângulo é (base × altura)/2 = 12×5/2 = 30 cm²."],
  ["Matemática","Funções","Se f(x)=3x-7, o valor de f(4) é:","5","7","12","19","−19","A","Facil","Função afim","Substituindo x por 4: f(4)=3×4-7=5."],
  ["Matemática","Funções","Em f(x)=x²-6x+8, a soma das raízes é:","-8","-6","2","6","8","D","Medio","Raízes de funções quadráticas","Para ax²+bx+c, a soma das raízes é -b/a. Aqui, -(-6)/1=6."],
  ["Matemática","Análise combinatória","Uma equipe de 3 pessoas será escolhida entre 5. Quantas equipes são possíveis?","10","15","20","60","125","A","Medio","Combinações","Como a ordem não importa: C(5,3)=5!/(3!2!)=10."],
  ["Matemática","Probabilidade","Ao lançar dois dados, qual a probabilidade de a soma ser 7?","1/12","1/6","1/36","1/3","7/36","B","Medio","Probabilidade com dados","Há 6 pares favoráveis entre 36 possíveis, ou seja, 6/36=1/6."],
  ["Matemática","Progressões","O 10º termo da PA 2, 5, 8, ... é:","29","31","32","35","30","A","Medio","Progressão aritmética","a₁₀=a₁+(10-1)r=2+9×3=29."],
  ["Matemática","Logaritmos","O valor de log₂(32) é:","4","5","16","30","32","B","Facil","Logaritmos","Como 2⁵=32, log₂(32)=5."],
  ["Matemática","Trigonometria","Em um triângulo retângulo, seno é definido como:","cateto adjacente/hipotenusa","cateto oposto/hipotenusa","hipotenusa/cateto oposto","cateto oposto/cateto adjacente","hipotenusa/cateto adjacente","B","Facil","Razões trigonométricas","O seno de um ângulo agudo é o cateto oposto dividido pela hipotenusa."],
  ["Matemática","Estatística","A mediana dos valores 3, 7, 2, 9, 5 é:","3","5","7","9","4","B","Facil","Medidas de tendência central","Ordenando: 2, 3, 5, 7, 9. O valor central é 5."],
  ["Física","Cinemática","Um carro percorre 240 km em 3 h. Sua velocidade média é:","60 km/h","80 km/h","180 km/h","720 km/h","100 km/h","B","Facil","Velocidade média","Velocidade média é distância dividida pelo tempo: 240/3=80 km/h."],
  ["Física","Cinemática","Um móvel acelera uniformemente de 10 m/s para 30 m/s em 4 s. A aceleração é:","2 m/s²","4 m/s²","5 m/s²","10 m/s²","20 m/s²","C","Medio","Movimento uniformemente variado","A aceleração é a variação da velocidade pelo tempo: (30-10)/4=5 m/s²."],
  ["Física","Dinâmica","A força necessária para acelerar uma massa de 5 kg a 3 m/s² é:","8 N","15 N","1,67 N","30 N","25 N","B","Facil","Segunda Lei de Newton","F=m·a=5×3=15 N."],
  ["Física","Dinâmica","Segundo a terceira lei de Newton, ação e reação possuem:","mesma direção e sentido","direções perpendiculares","mesma intensidade e sentidos opostos","a mesma massa","só uma atua","C","Medio","Leis de Newton","Ações e reações têm mesma intensidade, mesma linha de ação e sentidos opostos."],
  ["Física","Energia","Uma mola comprimida armazena principalmente:","energia elétrica","energia potencial elástica","energia química","energia nuclear","energia térmica","B","Facil","Energia potencial elástica","Uma mola deformada pode armazenar energia potencial elástica."],
  ["Física","Termologia","Qual transferência de calor ocorre pelo movimento de fluidos?","Condução","Convecção","Radiação","Dilatação","Indução","B","Facil","Processos de propagação do calor","Convecção é a transferência por movimentos da massa do fluido."],
  ["Física","Óptica","A imagem formada por uma câmera fotográfica é normalmente:","virtual e direita","real e invertida","real e direita","virtual e invertida","inexistente","B","Medio","Formação de imagens","Lentes convergentes produzem imagem real e invertida no plano do filme ou sensor."],
  ["Física","Ondas","O produto frequência por comprimento de onda da onda é:","massa","energia","período","velocidade","amplitude","D","Medio","Equação fundamental da onda","A velocidade de propagação é v=f·λ."],
  ["Física","Eletricidade","Em uma resistência de 10 Ω atravessada por 2 A, a tensão é:","5 V","12 V","20 V","200 V","0,2 V","C","Facil","Lei de Ohm","Pela Lei de Ohm, U=R·i=10×2=20 V."],
  ["Física","Eletricidade","Potência elétrica pode ser calculada por:","P=U/i","P=U·i","P=R·i²","P=U²·R","P=i/U","B","Facil","Potência elétrica","A potência elétrica instantânea é P=U·i."],
  ["História","Brasil Colônia","O sistema de capitanias hereditárias foi instituído em:","1500","1534","1822","1889","1930","B","Facil","Brasil colonial","A Coroa portuguesa criou as capitanias hereditárias em 1534."],
  ["História","Independência","O processo de independência do Brasil ocorreu em:","1808","1822","1888","1889","1930","B","Facil","Independência do Brasil","A independência foi proclamada em 7 de setembro de 1822."],
  ["História","Abolição","A Lei Áurea foi assinada em:","1888","1889","1871","1870","1891","A","Facil","Abolição da escravidão","A Lei Áurea foi assinada pela Princesa Isabel em 13 de maio de 1888."],
  ["História","República Velha","A Política do Café-com-Leite caracterizou:","a aliança entre PA e MG","a união entre RJ e BA","o coronelismo indígena","a ditadura militar","o Plano Real","A","Medio","Primeira República","A expressão designa a alternância política entre oligarquias de São Paulo e Minas Gerais."],
  ["História","Era Vargas","O Estado Novo foi criado no governo de:","Getúlio Vargas","Juscelino Kubitschek","Castelo Branco","Tancredo Neves","Dom Pedro II","A","Medio","Era Vargas","Getúlio Vargas iniciou o Estado Novo em 1937."],
  ["História","Segunda Guerra Mundial","Pearl Harbor foi atacado em:","1939","1941","1945","1950","1936","B","Medio","Segunda Guerra Mundial","O ataque japonês ocorreu em 7 de dezembro de 1941."],
  ["História","Guerra Fria","A corrida armamentista da Guerra Fria ocorreu principalmente entre:","Brasil e Portugal","EUA e URSS","Japão e China","França e Alemanha","Egito e Líbia","B","Medio","Guerra Fria","Estados Unidos e União Soviética lideraram os blocos confrontados."],
  ["História","Ditadura militar","O AI-5 foi editado em:","1964","1968","1979","1985","1990","B","Medio","Ditadura civil-militar","O Ato Institucional nº 5 foi promulgado em 1968."],
  ["História","Constituição","A Constituição cidadã foi promulgada em:","1967","1979","1988","1990","1994","C","Medio","Constituição de 1988","A atual Constituição entrou em vigor após ser promulgada em 1988."],
  ["História","Globalização","A queda do Muro de Berlim ocorreu em:","1989","1985","1991","1979","2001","A","Medio","Fim da Guerra Fria","O Muro de Berlim caiu em 9 de novembro de 1989."],
  ["Português","Interpretação","Na frase \"O aluno estudou bastante, mas não alcançou a meta\", a conjunção introduz:","adição","alternativa","oposição","conclusão","tempo","C","Facil","Conectivos","\"Mas\" é uma conjunção coordenativa adversativa."],
  ["Português","Interpretação","Inferir uma informação significa:","copiá-la do texto","deduzi-la por pistas","opinar sem leitura","corrigir o autor","traduzir o texto","B","Medio","Leitura inferencial","Inferir é concluir uma ideia não explícita a partir de elementos do texto."],
  ["Português","Sintaxe","Em \"Entregaram o relatório\", o sujeito é:","oculto","composto","indeterminado","inexistente","relatório","C","Medio","Tipos de sujeito","O verbo na 3ª pessoa do plural não permite identificar o agente da ação."],
  ["Português","Concordância","Assinale a concordância correta:","A maioria dos alunos viajaram","Fazem cinco dias","Havia muitos candidatos","Haviam muitos candidatos","As crianças chegou","C","Medio","Concordância verbal","O verbo haver impessoal fica no singular: havia muitos candidatos."],
  ["Português","Figuras de linguagem","\"O vento beijava meu rosto\" é um exemplo de:","hipérbole","metáfora","personificação","metonímia","antítese","C","Facil","Figuras de linguagem","Atribuir ao vento uma ação humana caracteriza personificação."],
  ["Português","Semântica","A palavra \"ratificar\" significa:","cancelar","confirmar","reduzir","perder","completar","B","Medio","Vocabulário","Ratificar significa confirmar ou validar."],
  ["Português","Regência","A forma adequada é:","Assistimos o filme","Obedeceram aos idosos","Preferimos a calor","Paguei ao conta","Visitei ao museu","B","Medio","Regência verbal","Obedecer exige a preposição a e o objeto indireto fica no caso: aos idosos."],
  ["Português","Crase","A crase é obrigatória em:","Vou a pé","Entreguei a ela","Chegarei a noite","Referi-me à empresa","Gosto de a praia","D","Medio","Crase","Ocorre crase pela fusão da preposição a com o artigo feminino a."],
  ["Português","Literatura","O Realismo brasileiro marcou:","exaltação romântica da natureza","análise crítica da sociedade","negligência da razão","preferência exclusiva pela mitologia","abandono da prosa","B","Medio","Realismo no Brasil","Machado de Assis usa o Realismo para analisar psicologia e instituições sociais."],
  ["Português","Literatura","A poesia modernista de 1922 buscou:","imitar o parnasianismo","romper modelos europeus","eliminar temas nacionais","usar apenas versos medievais","preservar o Arcadismo","B","Medio","Modernismo brasileiro","A Semana de Arte Moderna valorizou inovação estética e linguagem brasileira."],
  ["Geografia","Cartografia","A escala 1:100.000 indica que 1 cm no mapa representa:","10 m","100 m","1 km","10 km","100 km","C","Medio","Escala cartográfica","Um centímetro representa 100.000 cm, equivalentes a 1 km."],
  ["Geografia","Clima","A latitude influencia o clima principalmente por:","alterar o relevo","variar a insolação","controlar o solo","mudar o fuso horário","diminuir o mar","B","Facil","Fatores climáticos","A latitude modifica o ângulo e a duração da radiação solar."],
  ["Geografia","Urbanização","O processo de crescimento das cidades é chamado:","industrialização","urbanização","transumância","demografia","regionalização","B","Facil","Urbanização","Urbanização é o aumento da participação populacional urbana."],
  ["Geografia","População","A taxa de natalidade relaciona-se ao número de:","idosos por ano","nascidos por mil habitantes","migrações legais","escolas por região","casamentos por país","B","Facil","Indicadores demográficos","Nascimentos anuais por mil habitantes compõem a taxa de natalidade."],
  ["Geografia","Biomas","O Cerrado é marcado por:","vegetação perenemente gelada","árvores latifoliadas e muita umidade","vegetação xerófila mediterrânea","savana com duas estações definidas","florestas de coníferas","D","Medio","Biomas brasileiros","O Cerrado apresenta vegetação arbustiva e estacional entre seca e chuva."],
  ["Geografia","Agronegócio","A monocultura pode intensificar:","diversidade biológica","erosão e desequilíbrio nutricional","perenidade dos solos","policultura familiar","recuperação florestal","B","Medio","Uso agrícola do solo","Cultivo repetido de uma espécie pode empobrecer o solo e ampliar erosão."],
  ["Geografia","Economia","A atividade de transformar matérias-primas em produtos é:","pecuária","comércio","indústria","extrativismo","serviços","C","Facil","Setores econômicos","Indústria transforma insumos em bens por processos produtivos."],
  ["Geografia","Globalização","Os fluxos econômicos de uma empresa em vários países caracterizam:","economia fechada","empresa multinacional","feudalismo","protecionismo absoluto","economia doméstica","B","Medio","Globalização","Empresas com operações em diversos países são multinacionais."],
  ["Geografia","Meio ambiente","O desmatamento da Amazônia contribui para:","aumento da biodiversidade","perda de habitat e mudanças climáticas","queda da erosão","formação de lagos","redução do CO₂","B","Medio","Questões ambientais","A retirada da floresta fragmenta habitats e altera ciclos naturais."],
  ["Geografia","Geopolítica","Mercosul é uma iniciativa voltada à:","integração regional","descolonização do Ártico","guerra comercial global","unificação de moedas do mundo","banimento agrícola","A","Facil","Blocos econômicos","O Mercosul promove integração comercial e política regional."]
];
const insertExpandedMaterial = db.prepare(`
  INSERT INTO material_apoio (titulo, link_video, texto_explicativo, disciplina, tema)
  VALUES (?, ?, ?, ?, ?)
`);
const insertExpandedQuestion = db.prepare(`
  INSERT INTO questao
  (enunciado, alternativa_a, alternativa_b, alternativa_c, alternativa_d, alternativa_e, resposta_correta, disciplina, tema, dificuldade)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const findExpandedQuestion = db.prepare("SELECT id_questao FROM questao WHERE enunciado = ?");
const linkExpandedMaterial = db.prepare("INSERT OR IGNORE INTO questao_material (id_questao, id_material) VALUES (?, ?)");
const expandBank = db.transaction(() => {
  for (const item of expandedQuestions) {
    const [disciplina, tema, enunciado, a, b, c, d, e, correta, dificuldade, titulo, resumo] = item;
    if (findExpandedQuestion.get(enunciado)) continue;
    const material = insertExpandedMaterial.run(
      titulo,
      `https://www.youtube.com/results?search_query=${encodeURIComponent(`${disciplina} ${tema} vestibular aula`)}`,
      resumo,
      disciplina,
      tema
    );
    const question = insertExpandedQuestion.run(enunciado, a, b, c, d, e, correta, disciplina, tema, dificuldade);
    linkExpandedMaterial.run(question.lastInsertRowid, material.lastInsertRowid);
  }
});
expandBank();

// Reorganiza os materiais iniciais com nomes específicos e explicações completas.
const materialCatalog = {
  "Matemática": [
    ["Função de primeiro grau", "Função afim", "Uma função de primeiro grau tem a forma f(x)=ax+b, com a ≠ 0. O valor a representa a taxa de variação e b indica o ponto em que a reta corta o eixo y. Para resolver questões, substitua os valores dados em f(x), determine a lei da função e interprete o gráfico como uma reta."],
    ["Função de segundo grau", "Função quadrática", "Uma função quadrática é escrita como f(x)=ax²+bx+c. Seus pontos importantes são as raízes, o vértice e o eixo de simetria. Quando a>0, a parábola tem concavidade para cima; quando a<0, para baixo."],
    ["Potências e raízes", "Operações algébricas", "Potência representa multiplicações sucessivas da mesma base. Raiz é a operação inversa da potência. Observe as propriedades de potências, radicais equivalentes e simplificações antes de resolver expressões."],
    ["Equações do segundo grau", "Equações", "A equação ax²+bx+c=0 pode ser resolvida pela fórmula de Bhaskara. O discriminante Δ=b²-4ac indica se existem duas raízes reais, uma raiz real ou nenhuma raiz real."],
    ["Porcentagem e juros", "Porcentagem", "Porcentagem representa uma parte de 100. Para calcular acréscimos ou descontos, multiplique o valor pela taxa decimal e adicione ou subtraia o resultado. Em juros, diferencie juros simples de juros compostos."],
    ["Sequências numéricas", "Progressões", "Sequências podem seguir padrões aritméticos ou geométricos. Na progressão aritmética, soma-se uma razão constante; na geométrica, multiplica-se por uma razão constante."]
  ],
  "Física": [
    ["Cinemática: movimento uniforme", "Movimento uniforme", "No movimento uniforme, a velocidade é constante. A posição pode ser calculada por S=S₀+vt. Para interpretar gráficos, analise a inclinação da reta da posição em função do tempo."],
    ["Cinemática: movimento acelerado", "Movimento uniformemente variado", "No movimento uniformemente variado, a aceleração é constante. Use v=v₀+at e S=S₀+v₀t+at²/2. Identifique os dados do enunciado e escolha a equação adequada."],
    ["Força e leis de Newton", "Dinâmica", "As leis de Newton relacionam força, massa e movimento. A força resultante determina a aceleração pela equação F=m·a. Desenhe as forças atuantes antes de aplicar a segunda lei."],
    ["Densidade e pressão", "Propriedades físicas", "Densidade é massa dividida pelo volume. Pressão é força dividida pela área. Ambas ajudam a explicar o comportamento de materiais e fluidos."],
    ["Energia e trabalho", "Energia", "Trabalho é força aplicada ao longo de uma distância. Energia cinética depende da massa e do quadrado da velocidade. O princípio da conservação da energia permite comparar estados diferentes do sistema."],
    ["Ondas e óptica", "Ondas", "Ondas são perturbações que transportam energia. Frequência, comprimento de onda e velocidade se relacionam pela equação v=λf. Em óptica, diferencie espelhos, lentes e formação de imagens."]
  ],
  "História": [
    ["Brasil colonial", "Período colonial", "O Brasil colonial foi marcado pela colonização portuguesa, economias exportadoras, escravidão e administração indireta. Estude a relação entre engenhos, mineração e formação territorial."],
    ["Primeiro Reinado", "Brasil independente", "Após a independência de 1822, o Primeiro Reinado enfrentou conflitos políticos e disputas regionais. A crise terminou com a abdicação de Dom Pedro I em 1831."],
    ["Segundo Reinado", "Império", "O Segundo Reinado teve estabilidade política durante parte do período, com café, urbanização e escravidão. A Guerra do Paraguai e o movimento abolicionista contribuíram para sua crise."],
    ["República Velha", "Primeira República", "Na República Velha predominaram o coronelismo, o voto controlado e a política do café-com-leite. Estude revoltas sociais e movimentos contestatórios."],
    ["Era Vargas", "Brasil moderno", "Getúlio Vargas governou em contextos autoritários e democráticos. Suas políticas influenciaram indústria, trabalho, centralização administrativa e educação."],
    ["Ditadura militar", "Brasil contemporâneo", "A ditadura civil-militar ocorreu de 1964 a 1985. Analise repressão política, propaganda, crescimento econômico, dívida externa e movimentos de resistência."]
  ],
  "Português": [
    ["Interpretação de texto", "Compreensão textual", "A interpretação depende da leitura atenta do texto e do contexto. Diferencie informação explícita, inferência, tese e argumento. Confirme cada alternativa no texto antes de responder."],
    ["Classes de palavras", "Gramática", "Substantivos, adjetivos, verbos, advérbios e pronomes exercem funções diferentes. Identifique a classe pela relação sintática e pelo sentido na frase."],
    ["Concordância verbal", "Sintaxe", "Na concordância verbal, o verbo se flexiona conforme o sujeito. Casos especiais exigem atenção ao sujeito composto, a expressões partitivas e aos verbos impessoais."],
    ["Figuras de linguagem", "Estilística", "Metáfora, metonímia, antítese, hipérbole e personificação criam sentidos expressivos. Identifique a relação existente entre os elementos comparados ou substituídos."],
    ["Literatura modernista", "Literatura brasileira", "O Modernismo brasileiro rompeu com modelos tradicionais e valorizou a linguagem brasileira, a crítica social e novas formas. Estude Mário de Andrade, Oswald de Andrade e outros autores."],
    ["Crase e pontuação", "Norma culta", "A crase é a fusão da preposição a com o artigo a ou com pronomes demonstrativos. Pontuação organiza as relações sintáticas e ajuda a interpretar o texto."]
  ],
  "Geografia": [
    ["Cartografia", "Representação do espaço", "Mapas utilizam escala, legenda, orientação e projeção. Entenda como medir distâncias e interpretar símbolos. Projeções podem distorcer áreas, formas ou distâncias."],
    ["Climatologia", "Clima", "Clima é o padrão atmosférico de uma região ao longo do tempo. Latitude, altitude, maritimidade e massas de ar influenciam temperaturas e chuvas."],
    ["Geografia urbana", "Urbanização", "Urbanização é o crescimento das cidades e da população urbana. Analise metropolização, segregação socioespacial, transporte e problemas ambientais urbanos."],
    ["Meio ambiente", "Sustentabilidade", "Questões ambientais envolvem uso dos recursos naturais, poluição, mudanças climáticas e conservação. Relacione causas locais a impactos globais."],
    ["Demografia", "População", "Demografia estuda natalidade, mortalidade, migrações e estrutura populacional. Pirâmides etárias ajudam a interpretar crescimento e envelhecimento."],
    ["Globalização", "Economia mundial", "A globalização integra mercados, culturas e tecnologias por fluxos financeiros, comerciais e informacionais. Também aprofunda desigualdades regionais."]
  ]
};
for (const [disciplina, entries] of Object.entries(materialCatalog)) {
  const rows = db.prepare("SELECT id_material FROM material_apoio WHERE disciplina = ? AND id_material <= 30 ORDER BY id_material").all(disciplina);
  rows.forEach((row, index) => {
    const entry = entries[index];
    if (!entry) return;
    const [titulo, tema, resumo] = entry;
    db.prepare(`
      UPDATE material_apoio
      SET titulo = ?, tema = ?, texto_explicativo = ?, link_video = ?
      WHERE id_material = ?
    `).run(
      titulo,
      tema,
      resumo,
      `https://www.youtube.com/results?search_query=${encodeURIComponent(`${titulo} ${disciplina} vestibular aula`)}`,
      row.id_material
    );
  });
}

const app = express();
app.use(express.json());
app.use("/uploads", express.static(path.join(ROOT, "uploads")));

function today() {
  return new Date().toISOString().slice(0, 10);
}

function resetUserDay(user) {
  if (user.data_ultimo_reset !== today()) {
    db.prepare("UPDATE usuario SET questoes_feitas_hoje = 0, data_ultimo_reset = ? WHERE id_usuario = ?")
      .run(today(), user.id_usuario);
  }
  if (user.data_ultima_atividade) {
    const previous = new Date(`${user.data_ultima_atividade}T00:00:00Z`);
    const current = new Date(`${today()}T00:00:00Z`);
    const diff = Math.round((current - previous) / 86400000);
    if (diff > 1) {
      db.prepare("UPDATE usuario SET streak = 0 WHERE id_usuario = ?").run(user.id_usuario);
    }
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
    foto_cor: user.foto_cor || "azul",
    foto_avatar: user.foto_avatar || null,
    email_verificado: Boolean(user.email_verificado),
    modo_daltonismo: user.modo_daltonismo || "nenhum",
    reducao_movimento: Boolean(user.reducao_movimento),
    animacao_streak: Boolean(user.animacao_streak),
    notificacoes: Boolean(user.notificacoes),
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
    if (user.conta_excluida) return res.status(401).json({ error: "Esta conta foi excluída." });
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

app.post("/api/auth/register", async (req, res) => {
  const nome = String(req.body.nome || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const confirmacaoEmail = String(req.body.confirmacao_email || "").trim().toLowerCase();
  const senha = String(req.body.senha || "");
  const confirmacao = String(req.body.confirmacao || "");
  if (!nome) return res.status(400).json({ error: "Informe seu nome.", field: "nome" });
  if (!email) return res.status(400).json({ error: "Informe seu e-mail.", field: "email" });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Informe um e-mail válido.", field: "email" });
  if (email !== confirmacaoEmail) return res.status(400).json({ error: "A confirmação do e-mail não coincide.", field: "confirmacao_email" });
  if (senha.length < 8) return res.status(400).json({ error: "A senha deve ter pelo menos 8 caracteres.", field: "senha" });
  if (senha !== confirmacao) return res.status(400).json({ error: "A confirmação da senha não coincide.", field: "confirmacao" });
  const reservation = db.prepare("SELECT disponivel_em FROM conta_exclusao WHERE email = ?").get(email);
  if (reservation) {
    const remaining = Date.parse(reservation.disponivel_em) - Date.now();
    if (remaining > 0) {
      const hours = Math.ceil(remaining / 3600000);
      return res.status(409).json({ error: `Este e-mail não pode ser reutilizado por mais ${hours} hora(s) após a exclusão da conta.` });
    }
    db.prepare("DELETE FROM conta_exclusao WHERE email = ?").run(email);
  }
  if (db.prepare("SELECT 1 FROM usuario WHERE email = ?").get(email)) {
    return res.status(409).json({ error: "Este e-mail já está cadastrado." });
  }
  try {
    const register = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO usuario
        (nome, email, senha, tipo, email_verificado)
        VALUES (?, ?, ?, 'aluno', 1)
      `).run(nome, email, bcrypt.hashSync(senha, 10));
      db.prepare("INSERT INTO desempenho (id_usuario) VALUES (?)").run(result.lastInsertRowid);
      return db.prepare("SELECT * FROM usuario WHERE id_usuario = ?").get(result.lastInsertRowid);
    });
    const user = register();
    const token = signToken(user);
    setAuthCookie(res, token);
    res.status(201).json({ token, user: publicUser(user), message: "Conta criada com sucesso!" });
  } catch (error) {
    console.error("[Vestible] Falha no cadastro:", error);
    res.status(500).json({ error: "Não foi possível concluir o cadastro." });
  }
});

app.post("/api/auth/login", (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const senha = String(req.body.senha || "");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Informe um e-mail válido.", field: "email" });
  }
  if (!senha) {
    return res.status(400).json({ error: "Informe sua senha.", field: "senha" });
  }
  const user = db.prepare("SELECT * FROM usuario WHERE email = ?").get(email);
  if (!user) {
    return res.status(401).json({ error: "Este e-mail não está cadastrado.", field: "email" });
  }
  if (!bcrypt.compareSync(senha, user.senha)) {
    return res.status(401).json({ error: "Senha incorreta.", field: "senha" });
  }
  if (user.conta_excluida) {
    return res.status(403).json({ error: "Esta conta foi excluída." });
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

app.put("/api/me", authRequired, (req, res) => {
  const nome = String(req.body.nome || "").trim();
  const foto_cor = String(req.body.foto_cor || "").trim().toLowerCase();
  const foto_avatar = String(req.body.foto_avatar || "").trim().toLowerCase() || null;
  const cores = ["azul", "vermelho", "verde", "roxo", "dourado"];
  const avatares = ["h1", "h2", "h3", "h4", "h5", "m1", "m2", "m3", "m4", "m5"];
  if (!nome) return res.status(400).json({ error: "O nome não pode ficar vazio." });
  if (nome.length > 100) return res.status(400).json({ error: "O nome deve ter no máximo 100 caracteres." });
  if (!cores.includes(foto_cor)) return res.status(400).json({ error: "Cor de perfil inválida." });
  if (foto_avatar && !avatares.includes(foto_avatar)) {
    return res.status(400).json({ error: "Avatar de perfil inválido." });
  }
  db.prepare("UPDATE usuario SET nome = ?, foto_cor = ?, foto_avatar = ? WHERE id_usuario = ?")
    .run(nome, foto_cor, foto_avatar, req.user.id_usuario);
  const user = db.prepare("SELECT * FROM usuario WHERE id_usuario = ?").get(req.user.id_usuario);
  res.json({ user: publicUser(user) });
});

app.post("/api/me/password", authRequired, (req, res) => {
  const senhaAtual = String(req.body.senha_atual || "");
  const novaSenha = String(req.body.nova_senha || "");
  const confirmacao = String(req.body.confirmacao || "");
  if (!bcrypt.compareSync(senhaAtual, req.user.senha)) {
    return res.status(400).json({ error: "A senha atual está incorreta.", field: "senha_atual" });
  }
  if (novaSenha.length < 8) {
    return res.status(400).json({ error: "A nova senha deve ter pelo menos 8 caracteres.", field: "nova_senha" });
  }
  if (novaSenha !== confirmacao) {
    return res.status(400).json({ error: "A confirmação da nova senha não coincide.", field: "confirmacao" });
  }
  db.prepare("UPDATE usuario SET senha = ? WHERE id_usuario = ?")
    .run(bcrypt.hashSync(novaSenha, 10), req.user.id_usuario);
  res.json({ ok: true, message: "Senha alterada com sucesso." });
});

app.put("/api/me/preferences", authRequired, (req, res) => {
  const modoDaltonismo = String(req.body.modo_daltonismo || "nenhum");
  const reducaoMovimento = req.body.reducao_movimento ? 1 : 0;
  const animacaoStreak = req.body.animacao_streak ? 1 : 0;
  const notificacoes = req.body.notificacoes ? 1 : 0;
  if (!["nenhum", "protanopia", "deuteranopia", "tritanopia"].includes(modoDaltonismo)) {
    return res.status(400).json({ error: "Modo de acessibilidade inválido." });
  }
  db.prepare(`
    UPDATE usuario
    SET modo_daltonismo = ?, reducao_movimento = ?, animacao_streak = ?, notificacoes = ?
    WHERE id_usuario = ?
  `).run(modoDaltonismo, reducaoMovimento, animacaoStreak, notificacoes, req.user.id_usuario);
  const user = db.prepare("SELECT * FROM usuario WHERE id_usuario = ?").get(req.user.id_usuario);
  res.json({ ok: true, user: publicUser(user), message: "Preferências atualizadas." });
});

app.post("/api/me/delete", authRequired, (req, res) => {
  const senha = String(req.body.senha || "");
  if (!bcrypt.compareSync(senha, req.user.senha)) {
    return res.status(400).json({ error: "A senha está incorreta.", field: "senha" });
  }
  const email = req.user.email;
  const availableAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const deleteAccount = db.transaction(() => {
    db.prepare(`
      INSERT INTO conta_exclusao (email, disponivel_em)
      VALUES (?, ?)
      ON CONFLICT(email) DO UPDATE SET disponivel_em = excluded.disponivel_em, criada_em = CURRENT_TIMESTAMP
    `).run(email, availableAt);
    db.prepare("DELETE FROM resposta WHERE id_usuario = ?").run(req.user.id_usuario);
    db.prepare("DELETE FROM amizade WHERE id_usuario_solicitante = ? OR id_usuario_solicitado = ?")
      .run(req.user.id_usuario, req.user.id_usuario);
    db.prepare("UPDATE desempenho SET total_acertos = 0, total_erros = 0, taxa_acerto = 0 WHERE id_usuario = ?")
      .run(req.user.id_usuario);
    db.prepare(`
      UPDATE usuario SET
        nome = 'Conta excluída',
        email = ?,
        senha = ?,
        xp = 0,
        nivel = 1,
        streak = 0,
        questoes_feitas_hoje = 0,
        data_ultimo_reset = NULL,
        data_ultima_atividade = NULL,
        foto_cor = 'azul',
        foto_avatar = NULL,
        codigo_verificacao = NULL,
        codigo_expira_em = NULL,
        codigo_enviado_em = NULL,
        conta_excluida = 1
      WHERE id_usuario = ?
    `).run(
      `excluida-${req.user.id_usuario}-${crypto.randomBytes(6).toString("hex")}@vestible.invalid`,
      bcrypt.hashSync(crypto.randomBytes(24).toString("hex"), 10),
      req.user.id_usuario
    );
  });
  deleteAccount();
  res.setHeader("Set-Cookie", "token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
  res.json({ ok: true, message: "Conta excluída. Este e-mail ficará reservado por 24 horas." });
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

app.get("/api/temas", authRequired, (req, res) => {
  const disciplina = req.query.disciplina ? String(req.query.disciplina) : null;
  const rows = disciplina
    ? db.prepare("SELECT DISTINCT tema FROM questao WHERE disciplina = ? ORDER BY tema").all(disciplina)
    : db.prepare("SELECT DISTINCT tema FROM questao ORDER BY tema").all();
  res.json(rows.map((row) => row.tema));
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
    imagem_url: q.imagem_url,
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
    const before = db.prepare("SELECT streak, data_ultima_atividade, questoes_feitas_hoje FROM usuario WHERE id_usuario = ?")
      .get(req.user.id_usuario);
    let nextStreak = before.streak;
    if (before.data_ultima_atividade !== today()) {
      if (!before.data_ultima_atividade) {
        nextStreak = 1;
      } else {
        const previous = new Date(`${before.data_ultima_atividade}T00:00:00Z`);
        const current = new Date(`${today()}T00:00:00Z`);
        const diff = Math.round((current - previous) / 86400000);
        nextStreak = diff === 1 ? before.streak + 1 : 1;
      }
      db.prepare("UPDATE usuario SET streak = ?, data_ultima_atividade = ? WHERE id_usuario = ?")
        .run(nextStreak, today(), req.user.id_usuario);
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

app.post("/api/admin/questoes", authRequired, adminRequired, upload.single("imagem"), (req, res) => {
  const q = req.body;
  if (!q.enunciado || !q.alternativa_a || !q.alternativa_b || !q.alternativa_c || !q.alternativa_d ||
      !q.resposta_correta || !q.disciplina || !q.tema) {
    return res.status(400).json({ error: "Preencha todos os campos obrigatórios da questão." });
  }
  const resultado = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO questao
      (enunciado, alternativa_a, alternativa_b, alternativa_c, alternativa_d, alternativa_e,
       resposta_correta, disciplina, tema, dificuldade, imagem_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(q.enunciado, q.alternativa_a, q.alternativa_b, q.alternativa_c, q.alternativa_d,
      q.alternativa_e || null, q.resposta_correta, q.disciplina, q.tema, q.dificuldade || "Medio",
      req.file ? `/uploads/${req.file.filename}` : (q.imagem_url || null));
    if (q.id_material) {
      db.prepare("INSERT OR IGNORE INTO questao_material (id_questao, id_material) VALUES (?, ?)")
        .run(result.lastInsertRowid, Number(q.id_material));
    }
    return db.prepare("SELECT * FROM questao WHERE id_questao = ?").get(result.lastInsertRowid);
  });
  res.status(201).json(resultado());
});

app.put("/api/admin/questoes/:id", authRequired, adminRequired, upload.single("imagem"), (req, res) => {
  const id = Number(req.params.id);
  const q = req.body;
  const atualizar = db.transaction(() => {
    db.prepare(`
      UPDATE questao SET enunciado = ?, alternativa_a = ?, alternativa_b = ?, alternativa_c = ?,
      alternativa_d = ?, alternativa_e = ?, resposta_correta = ?, disciplina = ?, tema = ?, dificuldade = ?,
      imagem_url = CASE WHEN ? IS NOT NULL THEN ? ELSE imagem_url END
      WHERE id_questao = ?
    `).run(q.enunciado, q.alternativa_a, q.alternativa_b, q.alternativa_c, q.alternativa_d,
      q.alternativa_e || null, q.resposta_correta, q.disciplina, q.tema, q.dificuldade,
      req.file ? `/uploads/${req.file.filename}` : (q.imagem_url || null),
      req.file ? `/uploads/${req.file.filename}` : (q.imagem_url || null), id);
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

app.get("/admin-questoes.html", authRequired, adminRequired, (req, res) => {
  res.sendFile(path.join(ROOT, "admin-questoes.html"));
});

app.get("/admin-conteudos.html", authRequired, adminRequired, (req, res) => {
  res.sendFile(path.join(ROOT, "admin-conteudos.html"));
});

app.get("/perfil.html", authRequired, (req, res) => {
  res.sendFile(path.join(ROOT, "perfil.html"));
});

app.get("/api/duelo/:code", (req, res) => {
  const match = activeDuels.get(String(req.params.code).toUpperCase());
  if (!match) return res.status(404).json({ error: "Sala não encontrada." });
  res.json(getScreenState(match));
});

app.get("/telao.html", (req, res) => {
  res.sendFile(path.join(ROOT, "telao.html"));
});

const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: false } });

const duelQueues = new Map();
const activeDuels = new Map();

function createRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  do {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  } while (activeDuels.has(code));
  return code;
}

function getQuestionsForDuel() {
  return db.prepare(`
    SELECT id_questao, enunciado, alternativa_a, alternativa_b, alternativa_c,
           alternativa_d, alternativa_e, resposta_correta, disciplina, tema, dificuldade, imagem_url
    FROM questao ORDER BY RANDOM() LIMIT 10
  `).all().map((q) => ({
    id_questao: q.id_questao,
    enunciado: q.enunciado,
    alternativa_a: q.alternativa_a,
    alternativa_b: q.alternativa_b,
    alternativa_c: q.alternativa_c,
    alternativa_d: q.alternativa_d,
    alternativa_e: q.alternativa_e,
    resposta_correta: q.resposta_correta,
    disciplina: q.disciplina,
    tema: q.tema,
    dificuldade: q.dificuldade,
    imagem_url: q.imagem_url
  }));
}

function playerPayload(player) {
  return {
    id_usuario: player.user.id_usuario,
    nome: player.user.nome,
    nivel: player.user.nivel,
    foto_cor: player.user.foto_cor || "azul",
    foto_avatar: player.user.foto_avatar || null,
    respostas: player.respostas,
    acertos: player.acertos,
    tempo_total: Number(player.tempo_total.toFixed(2))
  };
}

function getScreenState(match) {
  return {
    code: match.code,
    mode: match.mode,
    duration: match.duration,
    status: match.finished ? "Finalizado" : "Em andamento",
    remaining: match.mode === "blitz"
      ? Math.max(0, match.duration - Math.floor((Date.now() - match.startedAt) / 1000))
      : null,
    players: match.players.map(playerPayload),
    result: match.result || null
  };
}

function emitMatchState(match) {
  io.to(match.code).emit("duelo_estado", getScreenState(match));
  io.to(`screen:${match.code}`).emit("duelo_estado", getScreenState(match));
}

function finishDuel(match, reason = "concluido", disconnectUserId = null) {
  if (match.finished) return;
  match.finished = true;
  if (match.timer) clearInterval(match.timer);
  if (match.disconnectTimers) {
    for (const timer of match.disconnectTimers.values()) clearTimeout(timer);
    match.disconnectTimers.clear();
  }

  let winnerId = null;
  let empate = false;
  const [playerA, playerB] = match.players;

  if (disconnectUserId) {
    const disconnected = match.players.find((player) => player.user.id_usuario === disconnectUserId);
    const remaining = match.players.find((player) => player.user.id_usuario !== disconnectUserId);
    if (remaining) winnerId = remaining.user.id_usuario;
  } else if (reason === "blitz" || reason === "concluido") {
    if (playerA.acertos !== playerB.acertos) {
      winnerId = playerA.acertos > playerB.acertos ? playerA.user.id_usuario : playerB.user.id_usuario;
    } else if (match.mode === "conhecimento") {
      if (playerA.tempo_total !== playerB.tempo_total) {
        winnerId = playerA.tempo_total < playerB.tempo_total ? playerA.user.id_usuario : playerB.user.id_usuario;
      } else {
        empate = true;
      }
    } else {
      empate = true;
    }
  }

  const finalize = db.transaction(() => {
    db.prepare(`
      INSERT INTO duelo
      (id_host, id_desafiante, pontuacao_host, pontuacao_desafiante,
       tempo_host, tempo_desafiante, id_vencedor, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Finalizado')
    `).run(
      playerA.user.id_usuario,
      playerB.user.id_usuario,
      playerA.acertos,
      playerB.acertos,
      playerA.tempo_total,
      playerB.tempo_total,
      winnerId
    );

    for (const player of match.players) {
      let xpGanho;
      if (empate) {
        xpGanho = 25;
      } else if (player.user.id_usuario === winnerId) {
        xpGanho = 50;
      } else {
        xpGanho = 10;
      }
      db.prepare("UPDATE usuario SET xp = xp + ? WHERE id_usuario = ?")
        .run(xpGanho, player.user.id_usuario);
      const user = db.prepare("SELECT xp, nivel FROM usuario WHERE id_usuario = ?")
        .get(player.user.id_usuario);
      const novoNivel = Math.floor(user.xp / 1000) + 1;
      if (novoNivel !== user.nivel) {
        db.prepare("UPDATE usuario SET nivel = ? WHERE id_usuario = ?")
          .run(novoNivel, player.user.id_usuario);
      }
      const desempenho = db.prepare("SELECT total_acertos, total_erros FROM desempenho WHERE id_usuario = ?")
        .get(player.user.id_usuario);
      const total = desempenho.total_acertos + desempenho.total_erros;
      const taxa = total === 0 ? 0 : desempenho.total_acertos / total * 100;
      db.prepare("UPDATE desempenho SET taxa_acerto = ? WHERE id_usuario = ?")
        .run(Number(taxa.toFixed(2)), player.user.id_usuario);
      player.xpGanho = xpGanho;
    }
  });
  finalize();

  const winner = winnerId
    ? match.players.find((player) => player.user.id_usuario === winnerId)
    : null;
  match.result = {
    winnerId,
    empate,
    reason,
    players: match.players.map((player) => ({
      ...playerPayload(player),
      xp_ganho: player.xpGanho
    }))
  };
  io.to(match.code).emit("duelo_resultado", {
    code: match.code,
    mode: match.mode,
    winnerId,
    winnerName: winner ? winner.user.nome : null,
    empate,
    reason,
    players: match.result.players
  });
  io.to(`screen:${match.code}`).emit("duelo_resultado", {
    code: match.code,
    mode: match.mode,
    winnerId,
    winnerName: winner ? winner.user.nome : null,
    empate,
    reason,
    players: match.result.players
  });
  emitMatchState(match);

  setTimeout(() => {
    activeDuels.delete(match.code);
  }, 30000);
}

function startDuel(match) {
  match.startedAt = Date.now();
  match.finished = false;
  match.disconnectTimers = new Map();
  match.questions = getQuestionsForDuel();
  match.players.forEach((player) => {
    player.respostas = 0;
    player.acertos = 0;
    player.tempo_total = 0;
    player.ultimo_resposta = null;
    player.respondidas = new Set();
  });
  activeDuels.set(match.code, match);

  for (const player of match.players) {
    io.sockets.sockets.get(player.socketId)?.join(match.code);
  }

  io.to(match.code).emit("duelo_inicio", {
    code: match.code,
    mode: match.mode,
    duration: match.duration,
    players: match.players.map(playerPayload),
    questions: match.questions.map(({ resposta_correta, ...question }) => question),
    startedAt: match.startedAt
  });
  emitMatchState(match);

  if (match.mode === "blitz") {
    match.timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - match.startedAt) / 1000);
      const remaining = Math.max(0, match.duration - elapsed);
      io.to(match.code).emit("duelo_tempo", { remaining });
      io.to(`screen:${match.code}`).emit("duelo_tempo", { remaining });
      if (remaining <= 0) finishDuel(match, "blitz");
    }, 1000);
  }
}

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) {
      socket.duelUser = null;
      return next();
    }
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare("SELECT * FROM usuario WHERE id_usuario = ?").get(payload.id);
    if (!user) return next(new Error("Usuário inválido"));
    if (user.conta_excluida) {
      return next(new Error("Conta não disponível"));
    }
    socket.duelUser = user;
    next();
  } catch {
    next(new Error("Token inválido"));
  }
});

io.on("connection", (socket) => {
  if (socket.duelUser) {
    for (const match of activeDuels.values()) {
      if (match.finished) continue;
      const player = match.players.find((entry) =>
        entry.user.id_usuario === socket.duelUser.id_usuario
      );
      if (player) {
        if (match.disconnectTimers?.has(player.user.id_usuario)) {
          clearTimeout(match.disconnectTimers.get(player.user.id_usuario));
          match.disconnectTimers.delete(player.user.id_usuario);
        }
        player.socketId = socket.id;
        socket.join(match.code);
        socket.emit("duelo_reconectado", {
          code: match.code,
          mode: match.mode,
          duration: match.duration
        });
        emitMatchState(match);
      }
    }
  }
  socket.on("telao_entrar", (code) => {
    const normalized = String(code || "").trim().toUpperCase();
    const match = activeDuels.get(normalized);
    if (!match) return socket.emit("telao_erro", "Sala não encontrada.");
    socket.join(`screen:${normalized}`);
    socket.emit("duelo_estado", getScreenState(match));
  });

  socket.on("duelo_buscar", ({ mode, duration } = {}) => {
    if (!socket.duelUser) return socket.emit("duelo_erro", "Autenticação obrigatória.");
    for (const queue of duelQueues.values()) {
      for (let i = queue.length - 1; i >= 0; i--) {
        if (queue[i].socketId === socket.id || queue[i].userId === socket.duelUser.id_usuario) {
          queue.splice(i, 1);
        }
      }
    }
    const normalizedMode = mode === "blitz" ? "blitz" : "conhecimento";
    const normalizedDuration = normalizedMode === "blitz"
      ? Math.min(5, Math.max(1, Number(duration) || 1)) * 60
      : null;
    const queueKey = `${normalizedMode}:${normalizedDuration || "knowledge"}`;
    if (!duelQueues.has(queueKey)) duelQueues.set(queueKey, []);
    const queue = duelQueues.get(queueKey);

    if (queue.some((entry) => entry.userId === socket.duelUser.id_usuario)) {
      socket.emit("duelo_aguardando", { mode: normalizedMode });
      return;
    }

    queue.push({
      socketId: socket.id,
      userId: socket.duelUser.id_usuario,
      user: socket.duelUser
    });
    socket.emit("duelo_aguardando", { mode: normalizedMode, duration: normalizedDuration });

    if (queue.length >= 2) {
      const [first, second] = queue.splice(0, 2);
      duelQueues.delete(queueKey);
      const code = createRoomCode();
      const match = {
        code,
        mode: normalizedMode,
        duration: normalizedDuration,
        players: [
          { socketId: first.socketId, user: db.prepare("SELECT * FROM usuario WHERE id_usuario = ?").get(first.userId), respostas: 0, acertos: 0, tempo_total: 0, ultimo_resposta: null, respondidas: new Set() },
          { socketId: second.socketId, user: db.prepare("SELECT * FROM usuario WHERE id_usuario = ?").get(second.userId), respostas: 0, acertos: 0, tempo_total: 0, ultimo_resposta: null, respondidas: new Set() }
        ],
        finished: false,
        timer: null,
        result: null
      };
      startDuel(match);
    }
  });

  socket.on("duelo_cancelar", () => {
    for (const queue of duelQueues.values()) {
      const index = queue.findIndex((entry) => entry.socketId === socket.id);
      if (index >= 0) queue.splice(index, 1);
    }
  });

  socket.on("duelo_responder", ({ code, questionIndex, alternativa }) => {
    const normalizedCode = String(code || "").toUpperCase();
    const match = activeDuels.get(normalizedCode);
    if (!match || match.finished) return;
    if (match.mode === "blitz" &&
        Date.now() - match.startedAt >= match.duration * 1000) {
      finishDuel(match, "blitz");
      return;
    }
    const player = match.players.find((entry) =>
      entry.socketId === socket.id ||
      entry.user.id_usuario === socket.duelUser?.id_usuario
    );
    if (!player) return;
    const index = Number(questionIndex);
    if (!Number.isInteger(index) || index < 0 || index >= match.questions.length) return;
    if (player.respondidas.has(index)) return;
    const question = match.questions[index];
    const normalizedAnswer = String(alternativa || "").trim().toUpperCase();
    if (!["A", "B", "C", "D", "E"].includes(normalizedAnswer)) return;
    const now = Date.now();
    const elapsed = player.ultimo_resposta
      ? (now - player.ultimo_resposta) / 1000
      : (now - match.startedAt) / 1000;
    player.ultimo_resposta = now;
    const correta = normalizedAnswer === question.resposta_correta;
    player.respondidas.add(index);
    player.respostas += 1;
    player.tempo_total += elapsed;
    if (correta) player.acertos += 1;

    socket.emit("duelo_resposta", {
      questionIndex: index,
      correta,
      resposta_correta: question.resposta_correta
    });
    emitMatchState(match);

    if (match.mode === "conhecimento" &&
        match.players.every((entry) => entry.respostas >= 10)) {
      finishDuel(match, "concluido");
    }
  });

  socket.on("disconnect", () => {
    for (const queue of duelQueues.values()) {
      const index = queue.findIndex((entry) => entry.socketId === socket.id);
      if (index >= 0) queue.splice(index, 1);
    }
    for (const match of activeDuels.values()) {
      if (match.finished) continue;
      const player = match.players.find((entry) => entry.socketId === socket.id);
      if (player) {
        if (!match.disconnectTimers) match.disconnectTimers = new Map();
        if (match.disconnectTimers.has(player.user.id_usuario)) {
          clearTimeout(match.disconnectTimers.get(player.user.id_usuario));
        }
        const timer = setTimeout(() => {
          if (!match.finished) {
            finishDuel(match, "desistencia", player.user.id_usuario);
          }
        }, 15000);
        match.disconnectTimers.set(player.user.id_usuario, timer);
      }
    }
  });
});

app.use((error, req, res, next) => {
  if (req.path.startsWith("/api")) {
    if (error?.type === "entity.parse.failed") {
      return res.status(400).json({ error: "Os dados enviados estão inválidos. Atualize a página e tente novamente." });
    }
    console.error("[Vestible] Erro da API:", error);
    return res.status(error.status || 500).json({
      error: error.status >= 400 && error.status < 500
        ? (error.message || "Requisição inválida.")
        : "O servidor encontrou um erro. Tente novamente em alguns instantes."
    });
  }
  next(error);
});

app.use("/api", (req, res) => {
  res.status(404).json({ error: "Recurso da API não encontrado." });
});

app.use(express.static(ROOT, {
  extensions: ["html"],
  index: "index.html"
}));

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Vestible rodando em http://localhost:${PORT}`);
  console.log(`Banco SQLite: ${dbFile}`);
});
