import { MuseumProfile } from './types';

/** Museu Nacional d'Art de Catalunya — the Barcelona 2026 event profile. */
export const mnac: MuseumProfile = {
  id: 'mnac',
  name: "Museu Nacional d'Art de Catalunya (MNAC)",
  shortName: 'MNAC',
  city: 'Barcelona',
  eventLabel: 'Barcelona 2026',
  guideContext:
    "You are guiding visitors at the Museu Nacional d'Art de Catalunya (MNAC), housed in the Palau Nacional on Montjuïc hill in Barcelona. " +
    "MNAC holds the world's most important collection of Romanesque murals (transferred from Pyrenean churches), alongside outstanding Gothic altarpieces, Renaissance and Baroque works, " +
    'and a celebrated Modern Art collection featuring Catalan Modernisme masters (Gaudí, Casas, Rusiñol, Mir). The Thyssen-Bornemisza collection adds European breadth.',
  guideTips: [
    "Connect the artwork to MNAC's broader collection and Catalan cultural identity.",
    'Suggest related works the visitor might find nearby in the museum.',
    'Mention the physical space — "in the next gallery," "upstairs in the Modern Art wing."',
  ],
  topics: [
    {
      id: 'next',
      label: { en: "What's nearby?", pt: 'O que tem por perto?', es: '¿Qué hay cerca?' },
      prompt: ({ title }) =>
        `What other works here at MNAC should I see next that connect to "${title}"? What's nearby in the museum that complements this piece?`,
    },
    {
      id: 'catalan',
      label: { en: 'Catalan Connection', pt: 'Conexão Catalã', es: 'Conexión Catalana' },
      prompt: ({ title }) =>
        `How does "${title}" connect to Catalan culture, history, or identity? What makes it significant here in Barcelona?`,
    },
    {
      id: 'compare',
      label: { en: 'Compare Styles', pt: 'Comparar Estilos', es: 'Comparar Estilos' },
      prompt: ({ title }) =>
        `How does the style of "${title}" compare to other movements represented here at MNAC? How does it fit into the broader art history on display?`,
    },
  ],
};
