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
};
