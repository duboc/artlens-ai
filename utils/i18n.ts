import { Language } from '../types';

const translations: Record<string, Record<Language, string>> = {
  // Language Selector
  'app.tagline': {
    en: 'Point your camera at any artwork',
    pt: 'Aponte sua câmera para qualquer obra de arte',
    es: 'Apunta tu cámara a cualquier obra de arte',
  },

  // Onboarding
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
  'onboarding.emailPlaceholder': {
    en: 'Your email',
    pt: 'Seu email',
    es: 'Tu email',
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
  'chat.whatsNearby': {
    en: "What's nearby?",
    pt: 'O que tem por perto?',
    es: '¿Qué hay cerca?',
  },
  'chat.catalanConnection': {
    en: 'Catalan Connection',
    pt: 'Conexão Catalã',
    es: 'Conexión Catalana',
  },
  'chat.compareStyles': {
    en: 'Compare Styles',
    pt: 'Comparar Estilos',
    es: 'Comparar Estilos',
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
};

export function t(key: string, language: Language): string {
  const entry = translations[key];
  if (!entry) return key;
  return entry[language] || entry['en'] || key;
}
