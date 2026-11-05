/** Points for the game layer, shared by the server (scoring) and the UI (copy). */
export const POINTS = {
  newArtwork: 10,
  quizCorrect: 20,
  quizPerfectBonus: 20,
} as const;

export const QUIZ_LENGTH = 3;

/** Best possible quiz score for one artwork. */
export const QUIZ_MAX_POINTS = POINTS.quizCorrect * QUIZ_LENGTH + POINTS.quizPerfectBonus;
