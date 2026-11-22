-- ============================================================================
-- CRIAÇÃO DO BANCO DE DADOS E TABELAS
-- ============================================================================
DROP DATABASE IF EXISTS vestible;
CREATE DATABASE vestible;
USE vestible;

-- TABELA: USUARIO
CREATE TABLE usuario (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,
    xp INT NOT NULL DEFAULT 0 CHECK (xp >= 0),
    nivel INT NOT NULL DEFAULT 1 CHECK (nivel > 0),
    streak INT NOT NULL DEFAULT 0 CHECK (streak >= 0),
    questoes_feitas_hoje INT NOT NULL DEFAULT 0 CHECK (questoes_feitas_hoje >= 0),
    data_ultimo_reset DATE,
    data_criacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ÍNDICE: Acelera o processo de Login e verificação de e-mail duplicado
CREATE INDEX idx_usuario_email ON usuario(email);


-- TABELA: AMIZADE
CREATE TABLE amizade (
    id_usuario_solicitante INT NOT NULL,
    id_usuario_solicitado INT NOT NULL,
    data_inicio DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status ENUM('Pendente', 'Aceita', 'Bloqueada') NOT NULL DEFAULT 'Pendente',
    PRIMARY KEY (id_usuario_solicitante, id_usuario_solicitado),
    FOREIGN KEY (id_usuario_solicitante) REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    FOREIGN KEY (id_usuario_solicitado) REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    -- Restrição: Evitar que o usuário envie uma solicitação para si mesmo
    CONSTRAINT chk_nao_auto_amigo CHECK (id_usuario_solicitante != id_usuario_solicitado)
);

-- ÍNDICE: Otimizar a busca na aba de "solicitações pendentes" recebidas pelo usuário
CREATE INDEX idx_amizade_solicitado ON amizade(id_usuario_solicitado);


-- TABELA: DESEMPENHO
CREATE TABLE desempenho (
    id_usuario INT PRIMARY KEY,
    total_acertos INT NOT NULL DEFAULT 0 CHECK (total_acertos >= 0),
    total_erros INT NOT NULL DEFAULT 0 CHECK (total_erros >= 0),
    taxa_acerto DECIMAL(5,2) NOT NULL DEFAULT 0.00 CHECK (taxa_acerto BETWEEN 0 AND 100),
    FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON DELETE CASCADE
);


-- TABELA: QUESTAO
CREATE TABLE questao (
    id_questao INT AUTO_INCREMENT PRIMARY KEY,
    enunciado TEXT NOT NULL,
    alternativa_a TEXT NOT NULL,
    alternativa_b TEXT NOT NULL,
    alternativa_c TEXT NOT NULL,
    alternativa_d TEXT NOT NULL,
    alternativa_e TEXT, 
    resposta_correta ENUM('A', 'B', 'C', 'D', 'E') NOT NULL,
    disciplina VARCHAR(50) NOT NULL,
    tema VARCHAR(100) NOT NULL,
    dificuldade ENUM('Facil', 'Medio', 'Dificil') NOT NULL
);


-- TABELA: RESPOSTA
CREATE TABLE resposta (
    id_resposta INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    id_questao INT NOT NULL,
    alternativa_escolhida ENUM('A', 'B', 'C', 'D', 'E') NOT NULL,
    correta BOOLEAN NOT NULL,
    tempo_resposta DECIMAL(5,2) CHECK (tempo_resposta >= 0),
    data_resposta DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    FOREIGN KEY (id_questao) REFERENCES questao(id_questao) ON DELETE CASCADE
);


-- TABELA: DUELO
CREATE TABLE duelo (
    id_duelo INT AUTO_INCREMENT PRIMARY KEY,
    id_host INT NOT NULL,
    id_desafiante INT NOT NULL,
    pontuacao_host INT NOT NULL DEFAULT 0,
    pontuacao_desafiante INT NOT NULL DEFAULT 0,
    tempo_host DECIMAL(5,2) DEFAULT 0, 
    tempo_desafiante DECIMAL(5,2) DEFAULT 0, 
    id_vencedor INT NULL, 
    status ENUM('Aguardando', 'Em andamento', 'Finalizado') NOT NULL DEFAULT 'Aguardando',
    data_inicio DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_host) REFERENCES usuario(id_usuario),
    FOREIGN KEY (id_desafiante) REFERENCES usuario(id_usuario),
    FOREIGN KEY (id_vencedor) REFERENCES usuario(id_usuario),
-- Restrição: Impedir que o criador lute contra si mesmo
    CONSTRAINT chk_nao_auto_duelo CHECK (id_host != id_desafiante)
);


-- TABELA: MATERIAL DE APOIO
CREATE TABLE material_apoio (
    id_material INT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(150) NOT NULL,
    link_video TEXT, 
    texto_explicativo TEXT, 
    disciplina VARCHAR(50) NOT NULL,
    tema VARCHAR(100) NOT NULL
);


-- TABELA: QUESTAO_MATERIAL (N:M - Muitos para Muitos)
CREATE TABLE questao_material (
    id_questao INT NOT NULL,
    id_material INT NOT NULL,
    PRIMARY KEY (id_questao, id_material),
    FOREIGN KEY (id_questao) REFERENCES questao(id_questao) ON DELETE CASCADE,
    FOREIGN KEY (id_material) REFERENCES material_apoio(id_material) ON DELETE CASCADE
);


-- ============================================================================
-- PROGRAMAÇÃO DO BANCO (TRIGGERS, FUNCTIONS, PROCEDURES)
-- ============================================================================
DELIMITER $$

-- TRIGGER: Automatizar a criação do Desempenho assim que o Usuário se cadastra
CREATE TRIGGER TRG_AposInserirUsuario
AFTER INSERT ON usuario
FOR EACH ROW
BEGIN
    INSERT INTO desempenho (id_usuario) VALUES (NEW.id_usuario);
END$$


-- FUNCTION: Calcular a taxa de acerto
CREATE FUNCTION FN_CalcularTaxaAcerto(p_id_usuario INT) 
RETURNS DECIMAL(5,2)
DETERMINISTIC
BEGIN
    DECLARE v_acertos INT;
    DECLARE v_erros INT;
    DECLARE v_total INT;
    DECLARE v_taxa DECIMAL(5,2);

    SELECT total_acertos, total_erros INTO v_acertos, v_erros
    FROM desempenho WHERE id_usuario = p_id_usuario;

    SET v_total = v_acertos + v_erros;

    IF v_total = 0 THEN
        RETURN 0.00;
    ELSE
        SET v_taxa = (v_acertos / v_total) * 100;
        RETURN v_taxa;
    END IF;
END$$


-- PROCEDURE: Centraliza toda a complexidade de responder uma questão
CREATE PROCEDURE SP_RegistrarResposta(
    IN p_id_usuario INT,
    IN p_id_questao INT,
    IN p_alternativa ENUM('A','B','C','D','E'),
    IN p_tempo DECIMAL(5,2)
)
BEGIN
    DECLARE v_resposta_correta ENUM('A','B','C','D','E');
    DECLARE v_is_correta BOOLEAN;
    
    -- 1. Identifica a alternativa correta
    SELECT resposta_correta INTO v_resposta_correta 
    FROM questao WHERE id_questao = p_id_questao;
    
    -- 2. Valida a resposta do usuário e distribui as recompensas/estatísticas
    IF p_alternativa = v_resposta_correta THEN
        SET v_is_correta = TRUE;
        UPDATE usuario SET xp = xp + 10 WHERE id_usuario = p_id_usuario;
        UPDATE desempenho SET total_acertos = total_acertos + 1 WHERE id_usuario = p_id_usuario;
    ELSE
        SET v_is_correta = FALSE;
        UPDATE desempenho SET total_erros = total_erros + 1 WHERE id_usuario = p_id_usuario;
    END IF;
    
    -- 3. Insere o log na tabela histórica de respostas
    INSERT INTO resposta (id_usuario, id_questao, alternativa_escolhida, correta, tempo_resposta)
    VALUES (p_id_usuario, p_id_questao, p_alternativa, v_is_correta, p_tempo);
    
    -- 4. Atualiza o limite diário do sistema freemium
    UPDATE usuario SET questoes_feitas_hoje = questoes_feitas_hoje + 1 WHERE id_usuario = p_id_usuario;
    
    -- 5. Atualiza a taxa de acerto chamando a Função interna
    UPDATE desempenho 
    SET taxa_acerto = FN_CalcularTaxaAcerto(p_id_usuario) 
    WHERE id_usuario = p_id_usuario;
    
END$$

DELIMITER ;


-- ============================================================================
-- INSERÇÃO DE VALORES DE TESTE
-- ============================================================================

-- Inserindo 3 Usuários fictícios
INSERT INTO usuario (nome, email, senha) VALUES 
('Ana Costa', 'ana@email.com', 'AninhaMilGrau*123'),
('Pedro Silva', 'pedro@email.com', 'Pedro#Raiz'),
('Carlos Souza', 'carlos@email.com', 'PacocaRecheada*092');

-- Inserindo Rede de Amigos
INSERT INTO amizade (id_usuario_solicitante, id_usuario_solicitado, status) VALUES 
(1, 2, 'Aceita'),       -- Ana e Pedro são amigos
(2, 3, 'Pendente');     -- Pedro enviou convite para Carlos, que ainda não aceitou

-- Inserindo Questões de Vestibular
INSERT INTO questao (enunciado, alternativa_a, alternativa_b, alternativa_c, alternativa_d, alternativa_e, resposta_correta, disciplina, tema, dificuldade) VALUES 
('Qual a fórmula da velocidade média na física cinemática?', 'V = d * t', 'V = d / t', 'V = t / d', 'V = m * a', 'V = d + t', 'B', 'Fisica', 'Cinematica', 'Facil'),
('O romance "Dom Casmurro" é uma obra pertencente a qual movimento literário brasileiro?', 'Romantismo', 'Modernismo', 'Barroco', 'Realismo', 'Arcadismo', 'D', 'Literatura', 'Realismo', 'Medio');

-- Inserindo Materiais de Apoio (Vídeos e Textos de Explicação)
INSERT INTO material_apoio (titulo, link_video, texto_explicativo, disciplina, tema) VALUES 
('Descomplicando a Velocidade Média', 'https://youtube.com/watch?v=v_media', 'A velocidade média mede a taxa de variação da posição em função do tempo...', 'Fisica', 'Cinematica'),
('Análise Profunda: Dom Casmurro e Bentinho', 'https://youtube.com/watch?v=casmurro', 'Dom Casmurro, publicado em 1899, expõe a psicologia da dúvida e a crítica à elite carioca...', 'Literatura', 'Realismo');

-- Associando as Questões aos seus respectivos materiais (N:M)
INSERT INTO questao_material (id_questao, id_material) VALUES 
(1, 1),
(2, 2);

-- Simulando um Duelo criado na plataforma
INSERT INTO duelo (id_host, id_desafiante, pontuacao_host, pontuacao_desafiante, tempo_host, tempo_desafiante, id_vencedor, status) VALUES 
(1, 2, 8, 8, 45.20, 52.10, 1, 'Finalizado'); -- Ana e Pedro empataram em pontos, mas Ana ganhou no tempo menor!


-- ============================================================================
-- SIMULAÇÃO DE SISTEMA EM EXECUÇÃO E QUERIES COMPLEXAS (SELECT + INNER JOIN)
-- ============================================================================

-- SIMULAÇÃO: O backend chama a procedure pois a Ana (ID 1) respondeu a Questão de Física (ID 1)
-- Ela escolheu a alternativa 'B' (Correta) e levou 15.4 segundos.
CALL SP_RegistrarResposta(1, 1, 'B', 15.40);

-- SIMULAÇÃO: O Carlos (ID 3) respondeu a Questão de Literatura (ID 2)
-- Ele escolheu a alternativa 'A' (Errada) e levou 32.1 segundos.
CALL SP_RegistrarResposta(3, 2, 'A', 32.10);


-- CONSULTA 1: Trazer o feed histórico de respostas unindo os dados do Aluno e da Questão
SELECT 
    u.nome AS Estudante,
    q.disciplina AS Disciplina,
    q.tema AS Assunto,
    r.alternativa_escolhida AS Marcada,
    CASE WHEN r.correta = 1 THEN 'Acertou' ELSE 'Errou' END AS Resultado,
    r.tempo_resposta AS 'Tempo (s)',
    r.data_resposta AS 'Respondido em'
FROM resposta r
INNER JOIN usuario u ON r.id_usuario = u.id_usuario
INNER JOIN questao q ON r.id_questao = q.id_questao
ORDER BY r.data_resposta DESC;


-- CONSULTA 2: O usuário Carlos acabou de errar uma questão. 
-- O sistema intercepta o erro e faz um INNER JOIN dinâmico para buscar o material de apoio exato
SELECT 
    u.nome AS Aluno,
    q.id_questao AS Codigo_Questao,
    q.disciplina AS Disciplina,
    q.tema AS Conteudo_Para_Estudar,
    ma.titulo AS Titulo_da_Aula,
    ma.link_video AS Link_do_Video,
    ma.texto_explicativo AS Resumo_Texto
FROM resposta r
INNER JOIN usuario u ON r.id_usuario = u.id_usuario
INNER JOIN questao q ON r.id_questao = q.id_questao
INNER JOIN questao_material qm ON q.id_questao = qm.id_questao
INNER JOIN material_apoio ma ON qm.id_material = ma.id_material
WHERE r.correta = FALSE 
  AND u.id_usuario = 3 -- ID do Carlos que errou
ORDER BY r.data_resposta DESC 
LIMIT 1; -- Pega apenas o último erro cometido para redirecionar


-- CONSULTA 3: Visualizar o ranking de desempenho atualizado (junto com a taxa calculada pela Function)
SELECT 
    u.nome AS Usuario,
    u.xp AS XP_Total,
    u.nivel AS Nivel_Atual,
    d.total_acertos AS Acertos,
    d.total_erros AS Erros,
    CONCAT(d.taxa_acerto, '%') AS 'Aproveitamento Geral'
FROM desempenho d
INNER JOIN usuario u ON d.id_usuario = u.id_usuario
ORDER BY u.xp DESC;