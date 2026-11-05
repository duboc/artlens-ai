import { Language } from '../types';

const translations: Record<string, Record<Language, string>> = {
  // Language Selector
  'app.tagline': {
    en: 'Point your camera at any artwork',
    pt: 'Aponte sua câmera para qualquer obra de arte',
    es: 'Apunta tu cámara a cualquier obra de arte',
  },

  // Onboarding
  'onboarding.askEmail': {
    en: "What's your email?",
    pt: 'Qual seu email?',
    es: '¿Cuál es tu email?',
  },
  'onboarding.emailPlaceholder': {
    en: 'Your email',
    pt: 'Seu email',
    es: 'Tu email',
  },
  'onboarding.welcomeBack': {
    en: 'Welcome back,',
    pt: 'Bem-vindo de volta,',
    es: 'Bienvenido de nuevo,',
  },
  'onboarding.continueAs': {
    en: 'Continue',
    pt: 'Continuar',
    es: 'Continuar',
  },
  'onboarding.notYou': {
    en: 'Not you? Use a different email',
    pt: 'Não é você? Use outro email',
    es: '¿No eres tú? Usa otro email',
  },
  'onboarding.askName': {
    en: "What's your name?",
    pt: 'Qual seu nome?',
    es: '¿Cómo te llamas?',
  },
  'onboarding.namePlaceholder': {
    en: 'Your name',
    pt: 'Seu nome',
    es: 'Tu nombre',
  },
  'settings.logout': {
    en: 'Log out',
    pt: 'Sair',
    es: 'Cerrar sesión',
  },
  'settings.loggedAs': {
    en: 'Logged in as',
    pt: 'Conectado como',
    es: 'Conectado como',
  },
  'onboarding.next': {
    en: 'Next',
    pt: 'Próximo',
    es: 'Siguiente',
  },
  'onboarding.stepOf': {
    en: 'of',
    pt: 'de',
    es: 'de',
  },
  'onboarding.selfieTitle': {
    en: 'Take a selfie',
    pt: 'Tire uma selfie',
    es: 'Tómate una selfie',
  },
  'onboarding.selfieDesc': {
    en: 'This will be used for your personalized art experience',
    pt: 'Será usada para sua experiência de arte personalizada',
    es: 'Se usará para tu experiencia de arte personalizada',
  },
  'onboarding.capture': {
    en: 'Capture',
    pt: 'Capturar',
    es: 'Capturar',
  },
  'onboarding.retake': {
    en: 'Retake',
    pt: 'Tirar outra',
    es: 'Repetir',
  },
  'onboarding.skipSelfie': {
    en: 'Skip for now',
    pt: 'Pular por agora',
    es: 'Saltar por ahora',
  },
  'onboarding.askPersona': {
    en: 'Choose your experience',
    pt: 'Escolha sua experiência',
    es: 'Elige tu experiencia',
  },
  'onboarding.guide': { en: 'Classic Guide', pt: 'Guia Clássico', es: 'Guía Clásico' },
  'onboarding.guideDesc': {
    en: 'Friendly & accessible',
    pt: 'Amigável e acessível',
    es: 'Amigable y accesible',
  },
  'onboarding.guideQuote': {
    en: '"Let me tell you the fascinating story behind this piece..."',
    pt: '"Deixe-me contar a fascinante história por trás desta obra..."',
    es: '"Déjame contarte la fascinante historia detrás de esta obra..."',
  },
  'onboarding.academic': { en: 'Historian', pt: 'Historiador', es: 'Historiador' },
  'onboarding.academicDesc': {
    en: 'Deep & scholarly',
    pt: 'Profundo e acadêmico',
    es: 'Profundo y académico',
  },
  'onboarding.academicQuote': {
    en: '"This work exemplifies the dialectic tension between form and meaning..."',
    pt: '"Esta obra exemplifica a tensão dialética entre forma e significado..."',
    es: '"Esta obra ejemplifica la tensión dialéctica entre forma y significado..."',
  },
  'onboarding.blogger': { en: 'Influencer', pt: 'Influencer', es: 'Influencer' },
  'onboarding.bloggerDesc': {
    en: 'Fun & trendy',
    pt: 'Divertido e moderno',
    es: 'Divertido y moderno',
  },
  'onboarding.bloggerQuote': {
    en: '"OMG you won\'t believe the drama behind this masterpiece!"',
    pt: '"Você não vai acreditar no drama por trás desta obra-prima!"',
    es: '"¡No vas a creer el drama detrás de esta obra maestra!"',
  },
  'onboarding.continue': {
    en: 'Start Exploring',
    pt: 'Começar',
    es: 'Empezar',
  },
  'onboarding.skip': {
    en: 'Quick Start',
    pt: 'Início Rápido',
    es: 'Inicio Rápido',
  },
  'onboarding.back': { en: 'Back', pt: 'Voltar', es: 'Volver' },

  // HUD
  'hud.tapToIdentify': {
    en: 'Tap to identify',
    pt: 'Toque para identificar',
    es: 'Toca para identificar',
  },
  'hud.analyzing': {
    en: 'Analyzing...',
    pt: 'Analisando...',
    es: 'Analizando...',
  },

  // Camera
  'camera.permissionTitle': {
    en: 'Camera Access Required',
    pt: 'Acesso à Câmera Necessário',
    es: 'Acceso a Cámara Requerido',
  },
  'camera.permissionDesc': {
    en: 'Please allow camera access to identify artworks.',
    pt: 'Permita o acesso à câmera para identificar obras de arte.',
    es: 'Permite el acceso a la cámara para identificar obras de arte.',
  },

  // Result Card
  'result.chatWith': {
    en: 'Chat with',
    pt: 'Conversar com',
    es: 'Chatear con',
  },
  'result.guide': { en: 'Classic Guide', pt: 'Guia Clássico', es: 'Guía Clásico' },
  'result.curator': { en: 'Historian', pt: 'Historiador', es: 'Historiador' },
  'result.blogger': { en: 'Influencer', pt: 'Influencer', es: 'Influencer' },
  'result.didYouKnow': {
    en: 'Did you know?',
    pt: 'Você sabia?',
    es: '¿Sabías que?',
  },
  'result.uniqueInsights': {
    en: 'Unique Insights',
    pt: 'Curiosidades',
    es: 'Curiosidades',
  },
  'result.historicalContext': {
    en: 'Historical Context',
    pt: 'Contexto Histórico',
    es: 'Contexto Histórico',
  },
  'result.symbolism': { en: 'Symbolism', pt: 'Simbolismo', es: 'Simbolismo' },
  'result.technique': { en: 'Technique', pt: 'Técnica', es: 'Técnica' },
  'result.sources': { en: 'Sources', pt: 'Fontes', es: 'Fuentes' },
  'result.uncovering': {
    en: 'Uncovering hidden details...',
    pt: 'Descobrindo detalhes ocultos...',
    es: 'Descubriendo detalles ocultos...',
  },
  'result.scanAnother': {
    en: 'Scan Another',
    pt: 'Escanear Outra',
    es: 'Escanear Otra',
  },
  'result.share': { en: 'Share', pt: 'Compartilhar', es: 'Compartir' },
  'result.narrationCta': {
    en: 'Tap the chat to learn more, or scroll down for curiosities',
    pt: 'Toque no chat para saber mais, ou role para ver as curiosidades',
    es: 'Toca el chat para saber más, o desplázate para ver las curiosidades',
  },

  // Annotation
  'annotation.detailView': {
    en: 'Detail',
    pt: 'Detalhe',
    es: 'Detalle',
  },
  'annotation.showLess': {
    en: 'Show Less',
    pt: 'Ver Menos',
    es: 'Ver Menos',
  },
  'annotation.readDetail': {
    en: 'Read Detail',
    pt: 'Ler Detalhe',
    es: 'Leer Detalle',
  },

  // Chat
  'chat.typeQuestion': {
    en: 'Ask a question',
    pt: 'Faça uma pergunta',
    es: 'Haz una pregunta',
  },
  'chat.startVoice': {
    en: 'Start voice conversation',
    pt: 'Iniciar conversa por voz',
    es: 'Iniciar conversación por voz',
  },
  'chat.selectTopic': {
    en: 'Select a topic or ask a question',
    pt: 'Selecione um tópico ou faça uma pergunta',
    es: 'Selecciona un tema o haz una pregunta',
  },
  'chat.topicsBelow': {
    en: 'Choose from the topics below or type your own',
    pt: 'Escolha entre os tópicos abaixo ou digite o seu',
    es: 'Elige entre los temas de abajo o escribe el tuyo',
  },
  'chat.guidePreparing': {
    en: 'Your guide is preparing...',
    pt: 'Seu guia está se preparando...',
    es: 'Tu guía se está preparando...',
  },
  'chat.guideNarrating': {
    en: 'Your guide is speaking',
    pt: 'Seu guia está falando',
    es: 'Tu guía está hablando',
  },
  'chat.askAnything': {
    en: 'Unmute to ask questions or tap a topic below',
    pt: 'Ative o microfone para perguntar ou toque um tópico',
    es: 'Activa el micrófono para preguntar o toca un tema',
  },
  'chat.voiceActive': {
    en: 'Voice Active',
    pt: 'Voz Ativa',
    es: 'Voz Activa',
  },
  'chat.disconnect': {
    en: 'End',
    pt: 'Encerrar',
    es: 'Finalizar',
  },
  'chat.connectionFailed': {
    en: 'Connection Failed',
    pt: 'Conexão Falhou',
    es: 'Conexión Fallida',
  },
  'chat.retry': { en: 'Retry', pt: 'Tentar Novamente', es: 'Reintentar' },
  'chat.message': { en: 'Message...', pt: 'Mensagem...', es: 'Mensaje...' },
  'chat.listening': {
    en: 'Listening...',
    pt: 'Ouvindo...',
    es: 'Escuchando...',
  },
  'chat.aboutArtist': {
    en: 'About the Artist',
    pt: 'Sobre o Artista',
    es: 'Sobre el Artista',
  },
  'chat.tellStory': {
    en: 'Tell me a story',
    pt: 'Conte uma história',
    es: 'Cuéntame una historia',
  },
  'chat.hiddenDetails': {
    en: 'Hidden Details',
    pt: 'Detalhes Ocultos',
    es: 'Detalles Ocultos',
  },
  'chat.historicalContext': {
    en: 'Historical Context',
    pt: 'Contexto Histórico',
    es: 'Contexto Histórico',
  },
  'chat.symbolism': { en: 'Symbolism', pt: 'Simbolismo', es: 'Simbolismo' },
  'chat.curiosities': {
    en: 'Curiosities',
    pt: 'Curiosidades',
    es: 'Curiosidades',
  },
  'chat.styleTechnique': {
    en: 'Style & Technique',
    pt: 'Estilo e Técnica',
    es: 'Estilo y Técnica',
  },

  // History
  'history.title': { en: 'HISTORY', pt: 'HISTÓRICO', es: 'HISTORIAL' },
  'history.noScans': {
    en: 'No scans yet',
    pt: 'Nenhum escaneamento',
    es: 'Sin escaneos aún',
  },
  'history.noScansDesc': {
    en: 'Identified artworks will appear here.',
    pt: 'Obras identificadas aparecerão aqui.',
    es: 'Las obras identificadas aparecerán aquí.',
  },
  'history.clearAll': {
    en: 'Clear All',
    pt: 'Limpar Tudo',
    es: 'Borrar Todo',
  },

  // Explanation Length
  'chat.brief': { en: 'Brief', pt: 'Breve', es: 'Breve' },
  'chat.detailed': { en: 'Detailed', pt: 'Detalhado', es: 'Detallado' },

  // Errors
  'error.system': { en: 'ERROR', pt: 'ERRO', es: 'ERROR' },

  // Generate Me
  'generate.button': { en: 'Generate Me', pt: 'Gerar Eu', es: 'Genérame' },
  'generate.generating': {
    en: 'Creating your portrait...',
    pt: 'Criando seu retrato...',
    es: 'Creando tu retrato...',
  },
  'generate.title': { en: 'Your Portrait', pt: 'Seu Retrato', es: 'Tu Retrato' },
  'generate.save': { en: 'Save to Gallery', pt: 'Salvar na Galeria', es: 'Guardar en Galería' },
  'generate.download': { en: 'Download', pt: 'Baixar', es: 'Descargar' },
  'generate.noSelfie': {
    en: 'Take a selfie first in Settings',
    pt: 'Tire uma selfie nas Configurações',
    es: 'Tómate una selfie en Ajustes',
  },
  'generate.error': {
    en: 'Generation failed. Try again.',
    pt: 'Falha na geração. Tente novamente.',
    es: 'Error en la generación. Inténtalo de nuevo.',
  },
  'generate.retry': { en: 'Try Again', pt: 'Tentar Novamente', es: 'Reintentar' },

  // Gallery
  'gallery.title': { en: 'My Gallery', pt: 'Minha Galeria', es: 'Mi Galería' },
  'gallery.empty': {
    en: 'No portraits yet',
    pt: 'Nenhum retrato ainda',
    es: 'Sin retratos aún',
  },
  'gallery.emptyDesc': {
    en: 'Generate your first portrait from any artwork.',
    pt: 'Gere seu primeiro retrato a partir de qualquer obra.',
    es: 'Genera tu primer retrato a partir de cualquier obra.',
  },

  // Settings
  'settings.title': { en: 'Settings', pt: 'Configurações', es: 'Ajustes' },
  'settings.language': { en: 'Language', pt: 'Idioma', es: 'Idioma' },
  'settings.persona': { en: 'Persona', pt: 'Persona', es: 'Persona' },
  'settings.reset': {
    en: 'Reset Preferences',
    pt: 'Redefinir Preferências',
    es: 'Restablecer Preferencias',
  },

  // Navigation
  'nav.scan': { en: 'Scan', pt: 'Escanear', es: 'Escanear' },
  'nav.missions': { en: 'Missions', pt: 'Missões', es: 'Misiones' },
  'nav.ranking': { en: 'Ranking', pt: 'Ranking', es: 'Ranking' },
  'nav.me': { en: 'Profile', pt: 'Perfil', es: 'Perfil' },
  'points.unit': { en: 'pts', pt: 'pts', es: 'pts' },
  'points.label': { en: '{points} points', pt: '{points} pontos', es: '{points} puntos' },
  'common.loading': { en: 'Loading…', pt: 'Carregando…', es: 'Cargando…' },
  'common.retry': { en: 'Try again', pt: 'Tentar de novo', es: 'Reintentar' },
  'common.error': { en: 'Could not load. Check your connection.', pt: 'Não foi possível carregar. Verifique sua conexão.', es: 'No se pudo cargar. Revisa tu conexión.' },
  'common.close': { en: 'Close', pt: 'Fechar', es: 'Cerrar' },

  // Missions
  'missions.title': { en: 'Missions', pt: 'Missões', es: 'Misiones' },
  'missions.summary': {
    en: '{done} of {total} completed · {points} points',
    pt: '{done} de {total} concluídas · {points} pontos',
    es: '{done} de {total} completadas · {points} puntos',
  },
  'missions.intro': {
    en: 'Scan artworks to complete missions. One artwork can complete several at once.',
    pt: 'Escaneie obras para cumprir missões. Uma obra pode cumprir várias de uma vez.',
    es: 'Escanea obras para cumplir misiones. Una obra puede cumplir varias a la vez.',
  },
  'missions.completedWith': { en: 'Completed with', pt: 'Concluída com', es: 'Completada con' },
  'missions.statusDone': { en: 'Completed', pt: 'Concluída', es: 'Completada' },
  'missions.statusOpen': { en: 'Not completed yet', pt: 'Ainda não concluída', es: 'Aún sin completar' },
  'missions.scoring': {
    en: 'Every new artwork +{artwork} pts · each quiz answer +{quiz} pts',
    pt: 'Cada obra nova +{artwork} pts · cada resposta certa no quiz +{quiz} pts',
    es: 'Cada obra nueva +{artwork} pts · cada acierto en el quiz +{quiz} pts',
  },

  // Ranking
  'ranking.title': { en: 'Ranking', pt: 'Ranking', es: 'Ranking' },
  'ranking.yourPosition': {
    en: 'You are #{rank} of {total}',
    pt: 'Você está em {rank}º de {total}',
    es: 'Estás en el puesto {rank} de {total}',
  },
  'ranking.notYet': {
    en: 'Scan your first artwork to join the ranking.',
    pt: 'Escaneie sua primeira obra para entrar no ranking.',
    es: 'Escanea tu primera obra para entrar en el ranking.',
  },
  'ranking.empty': {
    en: 'Nobody has scored yet. Be the first.',
    pt: 'Ninguém pontuou ainda. Seja o primeiro.',
    es: 'Nadie ha puntuado todavía. Sé el primero.',
  },
  'ranking.missionsCount': { en: '{n} missions', pt: '{n} missões', es: '{n} misiones' },
  'ranking.missionsCountOne': { en: '1 mission', pt: '1 missão', es: '1 misión' },
  'ranking.you': { en: 'you', pt: 'você', es: 'tú' },
  'ranking.refresh': { en: 'Refresh', pt: 'Atualizar', es: 'Actualizar' },

  // Profile
  'me.title': { en: 'Profile', pt: 'Perfil', es: 'Perfil' },
  'me.history': { en: 'Scanned artworks', pt: 'Obras escaneadas', es: 'Obras escaneadas' },
  'me.gallery': { en: 'My portraits', pt: 'Meus retratos', es: 'Mis retratos' },
  'me.guide': { en: 'Guide', pt: 'Guia', es: 'Guía' },

  // Awards toast
  'awards.newArtwork': { en: 'New artwork', pt: 'Obra nova', es: 'Obra nueva' },
  'awards.mission': { en: 'Mission complete', pt: 'Missão cumprida', es: 'Misión cumplida' },
  'awards.viewMissions': { en: 'View missions', pt: 'Ver missões', es: 'Ver misiones' },

  // Quiz
  'quiz.cta': { en: 'Quiz: 3 questions', pt: 'Quiz: 3 perguntas', es: 'Quiz: 3 preguntas' },
  'quiz.ctaPoints': { en: 'up to {points} pts', pt: 'até {points} pts', es: 'hasta {points} pts' },
  'quiz.ctaDone': { en: 'Quiz done · review answers', pt: 'Quiz feito · rever respostas', es: 'Quiz hecho · ver respuestas' },
  'quiz.progress': { en: 'Question {n} of {total}', pt: 'Pergunta {n} de {total}', es: 'Pregunta {n} de {total}' },
  'quiz.correct': { en: 'Correct', pt: 'Certo', es: 'Correcto' },
  'quiz.wrong': { en: 'Not quite', pt: 'Não foi dessa vez', es: 'Esta vez no' },
  'quiz.next': { en: 'Next question', pt: 'Próxima pergunta', es: 'Siguiente pregunta' },
  'quiz.finish': { en: 'See result', pt: 'Ver resultado', es: 'Ver resultado' },
  'quiz.result': {
    en: '{correct} of {total} correct · +{points} pts',
    pt: '{correct} de {total} certas · +{points} pts',
    es: '{correct} de {total} correctas · +{points} pts',
  },
  'quiz.perfect': { en: 'Includes the perfect-score bonus.', pt: 'Inclui o bônus por gabaritar.', es: 'Incluye el bonus por pleno.' },
  'quiz.back': { en: 'Back to the artwork', pt: 'Voltar à obra', es: 'Volver a la obra' },
  'quiz.loading': { en: 'Writing your questions…', pt: 'Preparando suas perguntas…', es: 'Preparando tus preguntas…' },
  'quiz.saving': { en: 'Saving…', pt: 'Salvando…', es: 'Guardando…' },
  'quiz.unavailable': {
    en: 'The quiz is available once the scan is saved.',
    pt: 'O quiz fica disponível quando o scan for salvo.',
    es: 'El quiz estará disponible cuando se guarde el escaneo.',
  },

  // How the AI thought
  'ai.title': { en: 'How the AI thought', pt: 'Como a IA pensou', es: 'Cómo pensó la IA' },
  'ai.summary': {
    en: 'Gemini looked at your photo, proposed an artwork and checked it with Google Search before answering.',
    pt: 'O Gemini olhou sua foto, propôs uma obra e conferiu com buscas no Google antes de responder.',
    es: 'Gemini miró tu foto, propuso una obra y la comprobó con búsquedas en Google antes de responder.',
  },
  'ai.model': { en: 'Model', pt: 'Modelo', es: 'Modelo' },
  'ai.fallback': { en: 'backup model', pt: 'modelo reserva', es: 'modelo de reserva' },
  'ai.time': { en: 'Response time', pt: 'Tempo de resposta', es: 'Tiempo de respuesta' },
  'ai.thinking': { en: 'Reasoning level', pt: 'Nível de raciocínio', es: 'Nivel de razonamiento' },
  'ai.confidence': { en: 'Confidence', pt: 'Confiança', es: 'Confianza' },
  'ai.conf.high': { en: 'High', pt: 'Alta', es: 'Alta' },
  'ai.conf.medium': { en: 'Medium', pt: 'Média', es: 'Media' },
  'ai.conf.low': { en: 'Low', pt: 'Baixa', es: 'Baja' },
  'ai.searches': { en: 'Google searches', pt: 'Buscas no Google', es: 'Búsquedas en Google' },
  'ai.noSearches': {
    en: 'No search this time: it answered from the image and what it already knew.',
    pt: 'Sem buscas desta vez: respondeu pela imagem e pelo que já sabia.',
    es: 'Sin búsquedas esta vez: respondió con la imagen y lo que ya sabía.',
  },
  'ai.context': { en: 'Context given', pt: 'Contexto fornecido', es: 'Contexto proporcionado' },
  'ai.contextValue': { en: 'Museum profile: {museum}', pt: 'Perfil do museu: {museum}', es: 'Perfil del museo: {museum}' },
  'ai.unavailable': { en: 'Not recorded for this scan.', pt: 'Não registrado neste scan.', es: 'No registrado en este escaneo.' },

  // Result sheet + narration
  'sheet.close': { en: 'Close', pt: 'Fechar', es: 'Cerrar' },
  'sheet.position': { en: 'Scan {n} of {total}', pt: 'Scan {n} de {total}', es: 'Escaneo {n} de {total}' },
  'sheet.swipeHint': { en: 'Swipe sideways for earlier scans', pt: 'Deslize para os lados para ver scans anteriores', es: 'Desliza a los lados para ver escaneos anteriores' },
  'narration.title': { en: 'Narration', pt: 'Narração', es: 'Narración' },
  'narration.preparing': { en: 'Your guide is getting ready…', pt: 'Seu guia está se preparando…', es: 'Tu guía se está preparando…' },
  'narration.pause': { en: 'Pause narration', pt: 'Pausar narração', es: 'Pausar narración' },
  'narration.resume': { en: 'Resume narration', pt: 'Retomar narração', es: 'Reanudar narración' },
  'narration.replay': { en: 'Listen again', pt: 'Ouvir de novo', es: 'Escuchar de nuevo' },
  'narration.play': { en: 'Play narration', pt: 'Tocar narração', es: 'Reproducir narración' },
  'narration.listen': { en: 'Listen', pt: 'Ouvir', es: 'Escuchar' },
  'narration.readOnly': { en: 'Read only', pt: 'Só ler', es: 'Solo leer' },
  'narration.mode': { en: 'How to follow the guide', pt: 'Como acompanhar o guia', es: 'Cómo seguir al guía' },
  'narration.none': { en: 'No narration was saved for this scan.', pt: 'Nenhuma narração foi salva neste scan.', es: 'No se guardó narración en este escaneo.' },
  'install.title': { en: 'Install the app', pt: 'Instalar o app', es: 'Instalar la app' },
  'install.ios': {
    en: 'In Safari, tap Share, then "Add to Home Screen" to open ArtLens full screen.',
    pt: 'No Safari, toque em Compartilhar e depois em "Adicionar à Tela de Início" para abrir o ArtLens em tela cheia.',
    es: 'En Safari, toca Compartir y luego "Añadir a pantalla de inicio" para abrir ArtLens a pantalla completa.',
  },
  'install.other': {
    en: 'Use your browser menu and choose "Install app" or "Add to Home screen".',
    pt: 'No menu do navegador, escolha "Instalar app" ou "Adicionar à tela inicial".',
    es: 'En el menú del navegador, elige "Instalar app" o "Añadir a pantalla de inicio".',
  },
};

export function t(key: string, language: Language): string {
  const entry = translations[key];
  if (!entry) return key;
  return entry[language] || entry['en'] || key;
}

/** t() with {placeholder} substitution. */
export function tf(key: string, language: Language, vars: Record<string, string | number>): string {
  return t(key, language).replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}
