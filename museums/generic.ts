import { MuseumProfile } from './types';

/** Fallback profile: works in any museum or gallery without assuming a venue. */
export const generic: MuseumProfile = {
  id: 'generic',
  name: '',
  shortName: 'Museum',
  guideContext:
    'You are guiding a visitor through a museum or gallery. You do not know which institution it is unless the visitor tells you, so do not assume one.',
  guideTips: [
    'Connect the artwork to the movement, period and artists it relates to.',
    'Suggest the kinds of related works the visitor could look for, without claiming they are on display here.',
  ],
  topics: [
    {
      id: 'next',
      label: { en: 'What to see next', pt: 'O que ver a seguir', es: '¿Qué ver después?' },
      prompt: ({ title, artist }) =>
        `If I liked "${title}" by ${artist}, what related artworks, artists or movements should I look for next?`,
    },
    {
      id: 'context',
      label: { en: 'Historical context', pt: 'Contexto histórico', es: 'Contexto histórico' },
      prompt: ({ title }) =>
        `What was happening in the world and in the artist's life when "${title}" was made, and how does that show in the work?`,
    },
    {
      id: 'compare',
      label: { en: 'Compare styles', pt: 'Comparar estilos', es: 'Comparar estilos' },
      prompt: ({ title }) =>
        `How does the style of "${title}" compare to the movements that came before and after it?`,
    },
  ],
  missions: [
    {
      id: 'portrait',
      title: { en: 'Face to face', pt: 'Cara a cara', es: 'Cara a cara' },
      hint: { en: 'Scan a portrait or self-portrait.', pt: 'Escaneie um retrato ou autorretrato.', es: 'Escanea un retrato o autorretrato.' },
      criterion: 'The artwork is a portrait or self-portrait of a person.',
      points: 100,
    },
    {
      id: 'landscape',
      title: { en: 'Out of the window', pt: 'Pela janela', es: 'Por la ventana' },
      hint: { en: 'Find a landscape or cityscape.', pt: 'Procure uma paisagem natural ou urbana.', es: 'Busca un paisaje natural o urbano.' },
      criterion: 'The artwork is a landscape, seascape or cityscape.',
      points: 100,
    },
    {
      id: 'abstract',
      title: { en: 'Beyond the figure', pt: 'Além da figura', es: 'Más allá de la figura' },
      hint: { en: 'Scan an abstract work.', pt: 'Escaneie uma obra abstrata.', es: 'Escanea una obra abstracta.' },
      criterion: 'The artwork is abstract (non-figurative).',
      points: 100,
    },
    {
      id: 'animal',
      title: { en: 'Animal kingdom', pt: 'Reino animal', es: 'Reino animal' },
      hint: { en: 'Find a work where an animal appears.', pt: 'Procure uma obra em que apareça um animal.', es: 'Busca una obra en la que aparezca un animal.' },
      criterion: 'An animal is clearly depicted in the artwork.',
      points: 100,
    },
    {
      id: 'sculpture',
      title: { en: 'In three dimensions', pt: 'Em três dimensões', es: 'En tres dimensiones' },
      hint: { en: 'Scan a sculpture.', pt: 'Escaneie uma escultura.', es: 'Escanea una escultura.' },
      criterion: 'The artwork is a sculpture or three-dimensional work.',
      points: 120,
    },
    {
      id: 'before-1800',
      title: { en: 'Old masters', pt: 'Velhos mestres', es: 'Viejos maestros' },
      hint: { en: 'Find a work made before 1800.', pt: 'Procure uma obra feita antes de 1800.', es: 'Busca una obra hecha antes de 1800.' },
      criterion: 'The artwork was made before the year 1800.',
      points: 120,
    },
  ],
};
