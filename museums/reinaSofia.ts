import { MuseumProfile } from './types';

export const reinaSofia: MuseumProfile = {
  id: 'reina-sofia',
  name: 'Museo Nacional Centro de Arte Reina Sofía',
  shortName: 'Museo Reina Sofía',
  city: 'Madrid',
  eventLabel: 'Madrid 2026',
  guideContext:
    "You are guiding visitors at the Museo Nacional Centro de Arte Reina Sofía in Madrid, Spain's national museum of modern and contemporary art. " +
    'It occupies the former General Hospital of Madrid (the 18th-century Sabatini Building), joined to the Nouvel Building extension designed by Jean Nouvel (2005). ' +
    "The collection runs from the late 19th century to the present, centred on Spanish art in its international context: Pablo Picasso's Guernica (1937) and its preparatory studies, " +
    'Salvador Dalí, Joan Miró, Juan Gris, María Blanchard, Maruja Mallo, José Gutiérrez Solana and Julio González, post-war artists such as Antoni Tàpies, Eduardo Chillida and Antonio Saura (El Paso group), ' +
    'as well as photography, film (including Luis Buñuel) and contemporary art. The collection is presented as themed rooms that connect art with history: the avant-garde, the Spanish Civil War, the dictatorship, exile and the return of democracy.',
  guideTips: [
    'Connect the artwork to Spanish 20th-century history and to the avant-garde movements represented in the collection.',
    'Where it genuinely fits, relate the work to Guernica or other landmark pieces of the collection.',
    'Displays change: never invent room numbers or exact locations; suggest the visitor check the floor plan or ask museum staff.',
  ],
  identifyHint:
    'The photo was most likely taken inside the Museo Reina Sofía in Madrid. When the image is ambiguous, prefer works from its collection or current exhibitions, but do not force a match.',
  topics: [
    {
      id: 'next',
      label: { en: 'What to see next', pt: 'O que ver a seguir', es: '¿Qué ver después?' },
      prompt: ({ title }) =>
        `Which other works in the Museo Reina Sofía collection connect to "${title}" and would be worth seeing next? Don't invent room numbers.`,
    },
    {
      id: 'spanish-history',
      label: { en: 'Spanish history', pt: 'História da Espanha', es: 'Historia de España' },
      prompt: ({ title, artist }) =>
        `How does "${title}" by ${artist} relate to Spain's 20th-century history (the avant-garde, the Civil War, the dictatorship, exile or the transition to democracy)? Why does it belong in the Reina Sofía?`,
    },
    {
      id: 'guernica',
      label: { en: 'Link to Guernica', pt: 'Ligação com Guernica', es: 'Relación con el Guernica' },
      prompt: ({ title }) =>
        `Is there a connection between "${title}" and Picasso's Guernica, the centrepiece of the Reina Sofía? If this is Guernica itself, tell me something most visitors miss.`,
    },
    {
      id: 'compare',
      label: { en: 'Compare styles', pt: 'Comparar estilos', es: 'Comparar estilos' },
      prompt: ({ title }) =>
        `How does the style of "${title}" compare to other movements represented in the Reina Sofía collection?`,
    },
  ],
  missions: [
    {
      id: 'guernica',
      title: { en: 'The scream of Guernica', pt: 'O grito de Guernica', es: 'El grito del Guernica' },
      hint: { en: "Find Picasso's 1937 masterpiece.", pt: 'Encontre a obra-prima de Picasso de 1937.', es: 'Encuentra la obra maestra de Picasso de 1937.' },
      criterion: 'The artwork is Guernica (1937) by Pablo Picasso, or one of its preparatory studies or sketches.',
      points: 150,
    },
    {
      id: 'bull',
      title: { en: 'A bull in the room', pt: 'Um touro na sala', es: 'Un toro en la sala' },
      hint: { en: 'Scan a work where a bull appears.', pt: 'Escaneie uma obra em que apareça um touro.', es: 'Escanea una obra en la que aparezca un toro.' },
      criterion: 'A bull is depicted in the artwork (including bullfighting scenes or a bull-headed figure).',
      points: 100,
    },
    {
      id: 'surrealism',
      title: { en: 'Surrealist dreams', pt: 'Sonhos surrealistas', es: 'Sueños surrealistas' },
      hint: { en: 'Find a work from the Surrealist movement.', pt: 'Procure uma obra do surrealismo.', es: 'Busca una obra del surrealismo.' },
      criterion: "The artwork belongs to Surrealism (e.g. Salvador Dalí, Joan Miró's surrealist period, Óscar Domínguez, René Magritte, Maruja Mallo's surrealist works).",
      points: 100,
    },
    {
      id: 'women-avant-garde',
      title: { en: 'Pioneers of the avant-garde', pt: 'Pioneiras da vanguarda', es: 'Pioneras de la vanguardia' },
      hint: { en: 'Scan a work by a woman artist.', pt: 'Escaneie uma obra de uma artista mulher.', es: 'Escanea una obra de una artista mujer.' },
      criterion: 'The artist is a woman (e.g. Maruja Mallo, María Blanchard, Ángeles Santos, Remedios Varo, Delhy Tejero).',
      points: 150,
    },
    {
      id: 'cubism',
      title: { en: 'Cubism in pieces', pt: 'Cubismo em pedaços', es: 'Cubismo en piezas' },
      hint: { en: 'Find a Cubist painting or collage.', pt: 'Procure uma pintura ou colagem cubista.', es: 'Busca una pintura o collage cubista.' },
      criterion: 'The artwork is Cubist (analytic or synthetic Cubism), e.g. by Juan Gris, Pablo Picasso, Georges Braque or María Blanchard.',
      points: 100,
    },
    {
      id: 'miro',
      title: { en: "Miró's universe", pt: 'O universo de Miró', es: 'El universo de Miró' },
      hint: { en: 'Scan a work by Joan Miró.', pt: 'Escaneie uma obra de Joan Miró.', es: 'Escanea una obra de Joan Miró.' },
      criterion: 'The artist is Joan Miró.',
      points: 100,
    },
    {
      id: 'informalism',
      title: { en: 'Matter and gesture', pt: 'Matéria e gesto', es: 'Materia y gesto' },
      hint: { en: 'Find post-war abstraction: Informalism or the El Paso group.', pt: 'Procure a abstração do pós-guerra: informalismo ou o grupo El Paso.', es: 'Busca la abstracción de posguerra: informalismo o el grupo El Paso.' },
      criterion: 'The artwork is post-war Spanish abstraction or Informalism (Art Informel), e.g. Antoni Tàpies, Antonio Saura, Manolo Millares, Rafael Canogar, Luis Feito or the El Paso group.',
      points: 120,
    },
    {
      id: 'sculpture',
      title: { en: 'Iron and space', pt: 'Ferro e espaço', es: 'Hierro y espacio' },
      hint: { en: 'Scan a sculpture.', pt: 'Escaneie uma escultura.', es: 'Escanea una escultura.' },
      criterion: 'The artwork is a sculpture or three-dimensional work (e.g. Julio González, Eduardo Chillida, Pablo Gargallo, Alexander Calder, Jorge Oteiza).',
      points: 120,
    },
  ],
};
