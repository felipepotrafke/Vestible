/* Vestible — banco de questões de demonstração (dados estáticos, sem backend) */

const QUESTIONS = [
  {
    id: "q1",
    subject: "Matemática",
    topic: "Funções Quadráticas",
    topicSlug: "funcoes-quadraticas",
    examTag: "ENEM 2023 · Médio",
    statement: "Uma empresa produz certo produto e seu lucro mensal, em reais, é dado pela função L(x) = −x² + 120x − 2000, onde x representa a quantidade de unidades produzidas. A quantidade de unidades produzidas para que o lucro seja máximo é:",
    options: [
      { id: "A", text: "40 unidades" },
      { id: "B", text: "60 unidades" },
      { id: "C", text: "80 unidades" },
      { id: "D", text: "100 unidades" },
      { id: "E", text: "120 unidades" }
    ],
    correct: "B",
    video: { title: "Funções Quadráticas — Parábola e vértice", duration: "14 min" },
    resumo: "O gráfico de uma função quadrática L(x) = ax² + bx + c é uma parábola. Quando a < 0, a concavidade é voltada para baixo e o vértice representa o ponto de máximo da função. A coordenada x do vértice é dada por x = −b / (2a). Substituindo os valores de L(x) = −x² + 120x − 2000 (a = −1, b = 120), obtemos x = −120 / (2 × −1) = 60. Portanto, o lucro máximo ocorre quando são produzidas 60 unidades."
  },
  {
    id: "q2",
    subject: "Física",
    topic: "Cinemática — MU e MUV",
    topicSlug: "cinematica",
    examTag: "Vestibular · Médio",
    statement: "Um carro parte do repouso e acelera uniformemente a 2 m/s² durante 10 segundos em uma pista reta. A distância percorrida nesse intervalo é:",
    options: [
      { id: "A", text: "20 m" },
      { id: "B", text: "50 m" },
      { id: "C", text: "100 m" },
      { id: "D", text: "200 m" }
    ],
    correct: "C",
    video: { title: "Cinemática — MU e MUV", duration: "18 min" },
    resumo: "No Movimento Uniformemente Variado (MUV), a posição em função do tempo é dada por S = S₀ + v₀t + at²/2. Como o carro parte do repouso, v₀ = 0. Substituindo a = 2 m/s² e t = 10 s: S = (2 × 10²) / 2 = 100 m. Repare que dobrar o tempo quadruplica a distância percorrida, já que o tempo aparece elevado ao quadrado na equação."
  },
  {
    id: "q3",
    subject: "História",
    topic: "Segunda Guerra Mundial",
    topicSlug: "segunda-guerra",
    examTag: "ENEM · Médio",
    statement: "A conferência que estabeleceu a divisão da Alemanha em zonas de ocupação após o fim da Segunda Guerra Mundial, reunindo as potências vencedoras em 1945, ficou conhecida como:",
    options: [
      { id: "A", text: "Conferência de Yalta" },
      { id: "B", text: "Conferência de Potsdam" },
      { id: "C", text: "Tratado de Versalhes" },
      { id: "D", text: "Conferência de Munique" }
    ],
    correct: "B",
    video: { title: "Segunda Guerra Mundial — Causas e consequências", duration: "22 min" },
    resumo: "Ao final da Segunda Guerra Mundial, em julho e agosto de 1945, líderes dos Estados Unidos, da União Soviética e do Reino Unido se reuniram na Conferência de Potsdam. O encontro definiu a divisão da Alemanha (e de Berlim) em quatro zonas de ocupação, controladas pelos aliados vencedores, e tratou de reparações de guerra — decisões que moldaram o início da Guerra Fria nos anos seguintes."
  },
  {
    id: "q4",
    subject: "Português",
    topic: "Figuras de Linguagem",
    topicSlug: "figuras-linguagem",
    examTag: "ENEM · Fácil",
    statement: "\"O sucesso no vestibular é construído questão por questão.\" A repetição da estrutura sintática nessa frase é um exemplo de qual figura de linguagem?",
    options: [
      { id: "A", text: "Metáfora" },
      { id: "B", text: "Anáfora" },
      { id: "C", text: "Hipérbole" },
      { id: "D", text: "Antítese" }
    ],
    correct: "B",
    video: { title: "Figuras de Linguagem — Repetição e ênfase", duration: "12 min" },
    resumo: "A anáfora é a repetição proposital de uma palavra ou estrutura no início de segmentos consecutivos de um texto, criando ritmo e reforçando uma ideia central. Em \"questão por questão\", a repetição da palavra reforça a ideia de progresso construído em etapas — um recurso comum em textos motivacionais e publicitários."
  },
  {
    id: "q5",
    subject: "Geografia",
    topic: "Climatologia",
    topicSlug: "climatologia",
    examTag: "ENEM · Médio",
    statement: "O fenômeno climático caracterizado pelo aquecimento anormal das águas do Oceano Pacífico, que altera padrões de chuva em diversas regiões do planeta, é conhecido como:",
    options: [
      { id: "A", text: "La Niña" },
      { id: "B", text: "El Niño" },
      { id: "C", text: "Efeito Fohn" },
      { id: "D", text: "Ilha de calor" }
    ],
    correct: "B",
    video: { title: "Climatologia — El Niño e La Niña", duration: "16 min" },
    resumo: "El Niño é um fenômeno natural que ocorre quando as águas superficiais do Oceano Pacífico equatorial ficam mais quentes que o normal. Isso altera a circulação atmosférica global, provocando secas em algumas regiões (como o Norte do Brasil) e chuvas intensas em outras (como o Sul). Seu oposto, La Niña, é marcado pelo resfriamento anormal das mesmas águas."
  },
  {
    id: "q6",
    subject: "Matemática",
    topic: "Geometria Espacial",
    topicSlug: "geometria-espacial",
    examTag: "ENEM · Difícil",
    statement: "Um reservatório tem o formato de um cilindro reto com 4 m de raio e 5 m de altura. Considerando π ≈ 3, o volume aproximado desse reservatório é:",
    options: [
      { id: "A", text: "60 m³" },
      { id: "B", text: "120 m³" },
      { id: "C", text: "180 m³" },
      { id: "D", text: "240 m³" }
    ],
    correct: "D",
    video: { title: "Geometria Espacial — Cilindros e prismas", duration: "15 min" },
    resumo: "O volume de um cilindro reto é dado por V = π × r² × h. Substituindo r = 4 m, h = 5 m e π ≈ 3: V = 3 × 4² × 5 = 3 × 16 × 5 = 240 m³. É comum confundir a fórmula do cilindro com a do cone, que leva o fator 1/3 — vale sempre conferir qual sólido está sendo descrito no enunciado."
  }
];

/* Ranking fixo de demonstração */
const RANKING = [
  { name: "Beatriz Santos", level: 18, xp: 2847, streak: 23 },
  { name: "Carlos Lima", level: 17, xp: 2634, streak: 15 },
  { name: "Fernanda Costa", level: 16, xp: 2410, streak: 31 },
  { name: "Ana Clara", level: 14, xp: 1980, streak: 9 },
  { name: "Gabriel Mendes", level: 12, xp: 847, streak: 7, you: true },
];

function getQuestionsBySubject(subject){
  if(!subject || subject === "Todas") return QUESTIONS;
  return QUESTIONS.filter(q => q.subject === subject);
}
function getQuestionByTopicSlug(slug){
  return QUESTIONS.find(q => q.topicSlug === slug) || QUESTIONS[0];
}
