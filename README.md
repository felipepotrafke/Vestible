# Vestible

<div align="center">

**Plataforma gamificada para estudos direcionados ao vestibular e ao ENEM**

*O sucesso no vestibular é construído questão por questão.*

![Node.js](https://img.shields.io/badge/Node.js-24-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4-010101?logo=socket.io&logoColor=white)
![Licença](https://img.shields.io/badge/Licen%C3%A7a-Uso%20acad%C3%AAmico-CB9B3C)

</div>

---

## 1. Apresentação

O **Vestible** é uma plataforma web de apoio aos estudos desenvolvida como projeto acadêmico. A solução une resolução de questões, acompanhamento de desempenho, materiais de apoio e competição em tempo real para tornar a preparação para exames de acesso mais organizada, acessível e engajante.

Ao registrar uma resposta, o sistema atualiza automaticamente os indicadores do estudante, recompensa acertos com experiência e oferece o material relacionado ao tema quando ocorre um erro. Assim, a correção deixa de ser apenas um resultado final e passa a orientar a próxima etapa dos estudos.

## 2. Problema e justificativa

Estudantes que se preparam para vestibulares e para o ENEM frequentemente enfrentam dificuldades como:

- baixa constância na rotina de estudos;
- dificuldade de identificar quais temas apresentam maior quantidade de erros;
- separação entre prática de questões e consulta ao conteúdo teórico;
- ausência de mecanismos de acompanhamento, metas e recompensas;
- baixa motivação em ambientes de estudo isolados.

O Vestible foi concebido para integrar essas necessidades em uma única experiência. A plataforma apresenta a correção no momento da dúvida, registra a evolução individual e utiliza elementos de gamificação e duelos competitivos para estimular a continuidade.

## 3. Objetivos

### Objetivo geral

Desenvolver uma plataforma web responsiva que apoie a prática de questões e o acompanhamento do desempenho de estudantes em preparação para exames vestibulares.

### Objetivos específicos

- permitir cadastro, autenticação e gerenciamento da conta do usuário;
- disponibilizar questões organizadas por disciplina, tema e dificuldade;
- registrar acertos, erros, tempo de resposta e taxa de acerto;
- oferecer materiais de apoio relacionados às questões respondidas incorretamente;
- implementar XP, níveis, sequências de estudo e ranking;
- disponibilizar duelos em tempo real entre dois estudantes;
- fornecer uma área administrativa para o gerenciamento de usuários, questões e materiais;
- aplicar recursos de acessibilidade e adaptação responsiva para diferentes dispositivos.

## 4. Principais funcionalidades

### Estudo e prática

- seleção de questões por disciplina e tema;
- registro imediato da alternativa escolhida;
- feedback com indicação da resposta correta;
- atualização automática de XP e nível;
- controle de acertos, erros e taxa de desempenho;
- acompanhamento da sequência diária de estudos;
- apresentação dos materiais associados ao tema após uma resposta incorreta.

### Gamificação

- experiência acumulada por acerto;
- progressão de níveis a cada 1.000 pontos de XP;
- sequência de dias estudados consecutivamente;
- ranking geral de estudantes;
- painéis com desempenho e histórico recente de erros.

### Modo Batalha

- pareamento aleatório ranqueado em tempo real por meio de WebSocket;
- criação de salas privadas com código de seis caracteres;
- convite direto para amigos conectados ou compartilhamento do código da sala;
- modos **Conhecimento** e **Blitz**;
- períodos configuráveis de 1 a 5 minutos no modo Blitz;
- dez questões comuns para ambos os participantes;
- resultado baseado em acertos e, em caso de empate, tempo total;
- reconexão à sala durante uma partida ativa;
- tela pública para acompanhamento do duelo.

### Conta e acessibilidade

- cadastro e login com validação dos dados;
- atualização de nome, cor e avatar;
- alteração de senha;
- exclusão da conta com proteção por confirmação;
- pedidos de amizade por código único, com opções para aceitar, recusar e remover amizades;
- modos para protanopia, deuteranopia e tritanopia;
- opção de redução de movimento;
- animação opcional da sequência de estudos;
- navegação adaptada para telas móveis.

### Administração

- painel exclusivo para administradores;
- consulta e exclusão de estudantes;
- cadastro, edição e remoção de questões;
- suporte a imagens nas questões;
- cadastro, edição e remoção de materiais de apoio;
- associação de materiais aos temas das questões.

## 5. Arquitetura da solução

O Vestible adota uma arquitetura cliente-servidor monolítica modular.

```text
Cliente web
├── HTML
├── CSS responsivo
├── JavaScript da interface
└── Socket.IO Client
          │
          │ HTTP/REST e WebSocket
          ▼
Servidor Node.js
├── Express
├── Middleware de autenticação JWT
├── API REST
├── Lógica de duelos com Socket.IO
└── Persistência com better-sqlite3
          │
          ▼
Banco SQLite
├── Usuários
├── Amizades e códigos de amizade
├── Desempenho
├── Questões
├── Respostas
├── Materiais
└── Duelos
```

O frontend é composto por páginas HTML e scripts JavaScript responsáveis pela interação, consumo da API e atualização da interface. O backend concentra as regras de negócio, validações, autenticação, controle de acesso e persistência dos dados.

As partidas são coordenadas pelo servidor por meio de salas identificadas por código. Socket.IO permite a comunicação bidirecional necessária para filas, início das partidas, respostas dos jogadores, temporização e publicação dos resultados.

## 6. Tecnologias utilizadas

| Categoria | Tecnologia | Aplicação |
|---|---|---|
| Linguagem | JavaScript | Desenvolvimento do frontend e backend |
| Ambiente | Node.js | Execução do servidor |
| Servidor web | Express 5 | Rotas HTTP, API REST e arquivos estáticos |
| Banco de dados | SQLite | Persistência local por meio de `better-sqlite3` |
| Comunicação em tempo real | Socket.IO | Duelos, fila e reconexão |
| Interface | HTML5 e CSS3 | Estrutura e apresentação responsiva |
| Autenticação | JSON Web Token | Proteção das rotas privadas |
| Senhas | bcryptjs | Criptografia das credenciais |
| Upload de arquivos | Multer | Inclusão de imagens nas questões |
| Testes | Node.js Test Runner | Testes de integração e API |

## 7. Estrutura do banco de dados

A persistência principal utiliza SQLite. O servidor cria o banco e aplica o schema automaticamente na primeira execução.

### Entidades principais

| Entidade | Responsabilidade |
|---|---|
| `usuario` | Dados cadastrais, perfil, XP, nível, streak e preferências |
| `desempenho` | Quantidade de acertos, erros e taxa de acerto |
| `questao` | Enunciado, alternativas, resposta, disciplina e tema |
| `resposta` | Histórico das alternativas selecionadas pelos usuários |
| `material_apoio` | Vídeos e textos explicativos por disciplina e tema |
| `questao_material` | Relação muitos para muitos entre questão e material |
| `duelo` | Participantes, pontuação, tempo e resultado das partidas |
| `amizade` | Estrutura de relacionamento entre usuários |
| `conta_exclusao` | Período de reserva do e-mail após exclusão da conta |

O script de referência compatível com o modelo conceitual está disponível em [`database/BDVestible.sql`](database/BDVestible.sql).

> O banco em execução é criado em `data/vestible.db` e é ignorado pelo Git para evitar o versionamento de dados pessoais.

## 8. Estrutura de diretórios

```text
Vestible/
├── src/
│   └── server.js          # Servidor, API REST e servidor de duelos
├── public/
│   ├── assets/            # Identidade visual e avatares
│   ├── css/               # Folha de estilos e responsividade
│   ├── js/                # Utilidades e lógica de interface
│   ├── *.html             # Páginas da aplicação
│   └── uploads/           # Upload temporário de imagens
├── database/
│   └── BDVestible.sql     # Modelo SQL de referência
├── tests/
│   └── app.test.js        # Testes automatizados
├── .gitignore
├── package.json
└── README.md
```

## 9. Fluxo principal de uso

1. O usuário cria uma conta ou realiza o login.
2. A página inicial apresenta progresso, desempenho e posição no ranking.
3. O estudante escolhe uma disciplina e responde às questões.
4. O servidor valida a alternativa e atualiza o perfil e o desempenho.
5. Acertos concedem XP; erros exibem materiais relacionados ao tema.
6. O usuário pode buscar um oponente aleatório ou criar/entrar em uma sala privada por código.
7. Ao final da partida, o sistema apresenta vencedor, empate ou desistência.
8. Administradores podem gerenciar questões, conteúdos e contas.

## 10. Requisitos

- Node.js 24 ou versão compatível;
- npm;
- navegador moderno com suporte a JavaScript e WebSocket;
- sistema operacional compatível com SQLite.

## 11. Instalação e execução

### 11.1. Clonar o repositório

```bash
git clone <URL_DO_REPOSITORIO>
cd Vestible
```

### 11.2. Instalar as dependências

```bash
npm install
```

### 11.3. Configurar o ambiente

Crie um arquivo `.env` na raiz do projeto para personalizar o ambiente:

```dotenv
PORT=3000
JWT_SECRET=troque-esta-chave-em-um-ambiente-real
DB_PATH=./data/vestible.db
```

Caso as variáveis não sejam informadas, o servidor utiliza a porta `3000`, um segredo de desenvolvimento e o banco em `data/vestible.db`.

> Em produção, nunca utilize o segredo padrão. Gere uma chave aleatória forte e mantenha o arquivo `.env` fora do versionamento.

### 11.4. Iniciar a aplicação

```bash
npm start
```

Acesse: [http://localhost:3000](http://localhost:3000)

Na primeira execução, o servidor cria as tabelas necessárias e pode inserir dados iniciais de demonstração.

## 12. Testes

Os testes automatizados cobrem entrega das páginas públicas, autenticação, operações administrativas, consultas de dados e finalização do duelo sem timers ativos após a partida.

Execute:

```bash
npm test
```

Os testes de integração iniciam um servidor temporário e utilizam um banco SQLite separado, evitando alterações no banco local da aplicação.

## 13. Interface responsiva

A interface adapta-se a computadores, tablets e celulares.

No celular:

- o cabeçalho contém o logotipo da aplicação e o menu da conta;
- o avatar dá acesso às configurações e à saída da conta;
- a barra inferior oferece Praticar, Batalha e Conteúdo;
- a área de administração possui uma barra inferior para alternar entre painel, questões e conteúdos;
- amizades ficam acessíveis pelo menu da conta;
- Início e Perfil são acessados pelo cabeçalho e pelo menu superior;
- o conteúdo utiliza espaçamentos e componentes dimensionados para interação por toque.

## 14. Segurança e qualidade

Medidas implementadas no projeto:

- senhas armazenadas com bcrypt;
- autenticação por JWT;
- validação de dados enviados ao servidor;
- verificação de perfil administrativo nas rotas restritas;
- proteção contra referências inválidas no banco por meio de chaves estrangeiras;
- uso de parâmetros preparados nas consultas SQLite;
- limites de tamanho e validação de tipo para upload de imagens;
- retorno de mensagens padronizadas para erros da API;
- banco de testes isolado durante a execução dos testes.

## 15. Limitações atuais

- o ambiente atual utiliza SQLite, o que atende a demonstrações e implantações de pequeno porte, mas não substitui um servidor de banco de dados distribuído em cenários de alta concorrência;
- os dados e partidas são processados em memória quando necessários pelo servidor de duelos;
- o cadastro não implementa verificação real de e-mail por provedor externo;
- o modelo acadêmico não inclui filas distribuídas ou balanceamento entre múltiplas instâncias;
- a aplicação não possui implantação automatizada configurada por CI/CD.

## 16. Trabalhos futuros

Possíveis evoluções do Vestible incluem:

- migração opcional para PostgreSQL ou outro banco robusto;
- implementação de notificações por e-mail;
- recuperação segura de senha com links temporários;
- análise estatística detalhada por disciplina e tema;
- recomendação automática de conteúdo a partir do histórico de erros;
- metas semanais e desafios personalizados;
- modo cooperativo e convites persistentes para amigos offline;
- publicação em ambiente de nuvem;
- pipeline de integração e entrega contínuas;
- testes automatizados adicionais para interface e casos de acessibilidade.

## 17. Avaliação técnica

O projeto pode ser avaliado pelos seguintes critérios:

- integração entre interface, API e banco de dados;
- aplicação de autenticação e controle de acesso;
- consistência das regras de XP, níveis e desempenho;
- utilização de dados relacionais e integridade referencial;
- comunicação em tempo real;
- adaptação para dispositivos móveis;
- organização do código e da documentação;
- execução reproduzível em ambiente local;
- cobertura de testes para os principais fluxos.

## 18. Licença e uso acadêmico

Este projeto foi desenvolvido para fins acadêmicos e demonstrativos. Os usuários e dados utilizados em testes são fictícios, salvo quando inseridos voluntariamente durante a utilização da aplicação.
