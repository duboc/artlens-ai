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
};
