import { MuseumProfile } from './types';

export const reinaSofia: MuseumProfile = {
  id: 'reina-sofia',
  name: 'Museo Nacional Centro de Arte Reina Sofía',
  shortName: 'Museo Reina Sofía',
  city: 'Madrid',
  eventLabel: 'Madrid 2026',
  // Checked against the museum's on-display room lists (museoreinasofia.es) in November 2026.
  guideContext:
    "You are guiding visitors at the Museo Nacional Centro de Arte Reina Sofía in Madrid, Spain's national museum of modern and contemporary art. " +
    'It occupies the former General Hospital of Madrid (the 18th-century Sabatini Building), joined to the Nouvel Building extension designed by Jean Nouvel (2005). ' +
    'The collection on display is told as themed rooms that connect art with history. Sabatini Building, floor 2 (about 1900 to 1945): Picasso\'s Guernica (1937) with its preparatory drawings and Dora Maar\'s photographs, ' +
    'the 1937 Spanish Pavilion (Calder\'s Mercury Fountain maquette, Miró), Cubism (Juan Gris, Picasso, Braque, Léger, María Blanchard, Lipchitz), Surrealism (Dalí, Miró, Óscar Domínguez, Magritte, Max Ernst, Tanguy, Masson), ' +
    'women of the avant-garde (Ángeles Santos\'s Un mundo, Maruja Mallo\'s La verbena, Sonia Delaunay, Olga Sacharoff) and Civil War photography (Robert Capa, Agustí Centelles). ' +
    "Sabatini Building, floor 4 (1975 to the present): the Transition to democracy, counterculture and Madrid's Movida (Nazario, Ceesepe, Costus, Ouka Leele, Alberto García-Alix), feminisms (Esther Ferrer, Eulàlia Grau, Martha Rosler) and 1980s photography and video. " +
    'The Nouvel Building terraces show kinetic and geometric sculpture.',
  guideTips: [
    'Connect the artwork to Spanish 20th-century history and to the avant-garde movements represented in the collection.',
    'Where it genuinely fits, relate the work to Guernica or other landmark pieces of the collection.',
    'Displays change: never invent room numbers or exact locations; suggest the visitor check the floor plan or ask museum staff.',
    'The post-war collection (1945–1975: Tàpies, Saura, the El Paso group) is not on display at the moment; do not send visitors to look for it.',
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
      criterion: "The artwork is generally classified as Surrealist, made within the Surrealist movement (e.g. Salvador Dalí, Joan Miró's surrealist period, Óscar Domínguez, René Magritte, Max Ernst, Yves Tanguy, Victor Brauner, André Masson). Works that only show some surrealist influence, such as Picasso's Guernica, do not count.",
      points: 100,
    },
    {
      id: 'women-avant-garde',
      title: { en: 'Pioneers of the avant-garde', pt: 'Pioneiras da vanguarda', es: 'Pioneras de la vanguardia' },
      hint: { en: 'Scan a work by a woman artist.', pt: 'Escaneie uma obra de uma artista mulher.', es: 'Escanea una obra de una artista mujer.' },
      criterion: 'The artist is a woman (e.g. Ángeles Santos, Maruja Mallo, María Blanchard, Sonia Delaunay, Olga Sacharoff, Dora Maar, Esther Ferrer, Eulàlia Grau, Martha Rosler, Ouka Leele).',
      points: 150,
    },
    {
      id: 'cubism',
      title: { en: 'Cubism in pieces', pt: 'Cubismo em pedaços', es: 'Cubismo en piezas' },
      hint: { en: 'Find a Cubist painting or collage.', pt: 'Procure uma pintura ou colagem cubista.', es: 'Busca una pintura o collage cubista.' },
      criterion: 'The artwork is generally classified as Cubist, made during the Cubist movement (roughly 1907–1925, analytic or synthetic), e.g. by Juan Gris, Pablo Picasso, Georges Braque, Fernand Léger, María Blanchard or Jacques Lipchitz. Later works that only use cubist elements, such as Guernica, do not count.',
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
      id: 'movida',
      title: { en: 'Madrid in the 80s', pt: 'A Movida madrilena', es: 'La Movida madrileña' },
      hint: { en: "Find a work from Madrid's Movida and the counterculture of the 70s and 80s.", pt: 'Procure uma obra da Movida e da contracultura dos anos 70 e 80.', es: 'Busca una obra de la Movida y la contracultura de los 70 y 80.' },
      criterion: "The artwork belongs to Spain's late-1970s/1980s counterculture or Madrid's Movida (e.g. Ouka Leele, Ceesepe, Nazario, Costus, Guillermo Pérez Villalta, Alberto García-Alix).",
      points: 120,
    },
    {
      id: 'sculpture',
      title: { en: 'Iron and space', pt: 'Ferro e espaço', es: 'Hierro y espacio' },
      hint: { en: 'Scan a sculpture (the Nouvel terraces count too).', pt: 'Escaneie uma escultura (os terraços do Nouvel também valem).', es: 'Escanea una escultura (las terrazas del Nouvel también cuentan).' },
      criterion: 'The artwork is a sculpture or three-dimensional work (e.g. Pablo Gargallo, Jacques Lipchitz, Manolo Hugué, Alexander Calder, Juan Muñoz, or the kinetic sculptures on the Nouvel terraces).',
      points: 120,
    },
  ],
};
