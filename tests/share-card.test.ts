import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock canvas context
const mockCtx = {
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 0,
  font: '',
  fillRect: vi.fn(),
  fillText: vi.fn(),
  drawImage: vi.fn(),
  beginPath: vi.fn(),
  rect: vi.fn(),
  clip: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  createLinearGradient: vi.fn(() => ({
    addColorStop: vi.fn(),
  })),
  measureText: vi.fn(() => ({ width: 50 })),
};

// Mock canvas element
const mockCanvas = {
  width: 0,
  height: 0,
  getContext: vi.fn(() => mockCtx),
  toBlob: vi.fn((cb: (blob: Blob | null) => void) => {
    cb(new Blob(['test'], { type: 'image/png' }));
  }),
};

// Mock Image
class MockImage {
  width = 800;
  height = 600;
  crossOrigin = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(_: string) {
    setTimeout(() => this.onload?.(), 0);
  }
}

beforeEach(() => {
  vi.stubGlobal('Image', MockImage);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'canvas') return mockCanvas as any;
    return document.createElement(tag);
  });
  vi.clearAllMocks();
});

describe('createArtworkShareCard', () => {
  it('creates a canvas with correct dimensions (1080x1350)', async () => {
    const { createArtworkShareCard } = await import('../utils/shareCard');

    const artData = {
      title: 'The Starry Night',
      artist: 'Vincent van Gogh',
      year: '1889',
      country: 'Netherlands',
      style: 'Post-Impressionism',
      description: 'A painting',
      funFact: 'Painted from memory',
      sources: [],
      annotations: [],
    };

    const blob = await createArtworkShareCard('data:image/png;base64,abc', artData);
    expect(blob).toBeInstanceOf(Blob);
    expect(mockCanvas.width).toBe(1080);
    expect(mockCanvas.height).toBe(1350);
  });

  it('draws artwork title and artist on the card', async () => {
    const { createArtworkShareCard } = await import('../utils/shareCard');

    const artData = {
      title: 'Guernica',
      artist: 'Pablo Picasso',
      year: '1937',
      country: 'Spain',
      style: 'Cubism',
      description: 'A mural',
      funFact: 'Anti-war statement',
      sources: [],
      annotations: [],
    };

    await createArtworkShareCard('data:image/png;base64,abc', artData);

    // Should draw the artist and year text
    const fillTextCalls = mockCtx.fillText.mock.calls.map((c: any[]) => c[0]);
    expect(fillTextCalls).toContain('Pablo Picasso · 1937');
  });

  it('includes branding text "AI Leadership Academy"', async () => {
    const { createArtworkShareCard } = await import('../utils/shareCard');

    const artData = {
      title: 'Test',
      artist: 'Artist',
      year: '2000',
      country: 'US',
      style: 'Modern',
      description: 'Desc',
      funFact: 'Fun',
      sources: [],
      annotations: [],
    };

    await createArtworkShareCard('data:image/png;base64,abc', artData);

    const fillTextCalls = mockCtx.fillText.mock.calls.map((c: any[]) => c[0]);
    expect(fillTextCalls).toContain('AI Leadership Academy');
  });

  it('draws curiosity when deepAnalysis is available', async () => {
    const { createArtworkShareCard } = await import('../utils/shareCard');

    const artData = {
      title: 'Test',
      artist: 'Artist',
      year: '2000',
      country: 'US',
      style: 'Modern',
      description: 'Desc',
      funFact: 'A fun fact',
      sources: [],
      annotations: [],
      deepAnalysis: {
        historicalContext: 'context',
        technicalAnalysis: 'analysis',
        symbolism: 'symbolism',
        curiosities: ['This painting was created in one night'],
      },
    };

    await createArtworkShareCard('data:image/png;base64,abc', artData);

    const fillTextCalls = mockCtx.fillText.mock.calls.map((c: any[]) => c[0]);
    expect(fillTextCalls).toContain('DID YOU KNOW?');
  });

  it('draws Google dots (4 colored circles) for branding', async () => {
    const { createArtworkShareCard } = await import('../utils/shareCard');

    const artData = {
      title: 'Test',
      artist: 'Artist',
      year: '2000',
      country: 'US',
      style: 'Modern',
      description: 'Desc',
      funFact: '',
      sources: [],
      annotations: [],
    };

    await createArtworkShareCard('data:image/png;base64,abc', artData);

    // Should draw 4 dots (arc calls) for Google brand colors
    const arcCalls = mockCtx.arc.mock.calls;
    expect(arcCalls.length).toBeGreaterThanOrEqual(4);
  });
});

describe('addWatermark', () => {
  it('returns a Blob with the watermarked image', async () => {
    const { addWatermark } = await import('../utils/shareCard');
    const blob = await addWatermark('data:image/png;base64,abc');
    expect(blob).toBeInstanceOf(Blob);
  });

  it('draws the original image first', async () => {
    const { addWatermark } = await import('../utils/shareCard');
    await addWatermark('data:image/png;base64,abc');
    expect(mockCtx.drawImage).toHaveBeenCalled();
  });

  it('includes "AI Leadership Academy" watermark text', async () => {
    const { addWatermark } = await import('../utils/shareCard');
    await addWatermark('data:image/png;base64,abc');

    const fillTextCalls = mockCtx.fillText.mock.calls.map((c: any[]) => c[0]);
    expect(fillTextCalls).toContain('AI Leadership Academy');
  });

  it('draws Google dots on the watermark bar', async () => {
    const { addWatermark } = await import('../utils/shareCard');
    await addWatermark('data:image/png;base64,abc');

    // 4 dots for Google brand colors
    const arcCalls = mockCtx.arc.mock.calls;
    expect(arcCalls.length).toBeGreaterThanOrEqual(4);
  });
});

describe('shareOrDownload', () => {
  it('uses Web Share API when available with file support', async () => {
    const mockShare = vi.fn().mockResolvedValue(undefined);
    const mockCanShare = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', {
      share: mockShare,
      canShare: mockCanShare,
    });

    const { shareOrDownload } = await import('../utils/shareCard');
    const blob = new Blob(['test'], { type: 'image/png' });

    await shareOrDownload(blob, 'test.png', 'Title', 'Description');

    expect(mockShare).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Title',
        text: 'Description',
        files: expect.arrayContaining([expect.any(File)]),
      })
    );
  });

  it('falls back to download when share is not available', async () => {
    vi.stubGlobal('navigator', { share: undefined, canShare: undefined });

    const mockClick = vi.fn();
    const mockAnchor = {
      href: '',
      download: '',
      click: mockClick,
    };
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') return mockAnchor as any;
      if (tag === 'canvas') return mockCanvas as any;
      return document.createElement(tag);
    });
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockAnchor as any);
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockAnchor as any);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const { shareOrDownload } = await import('../utils/shareCard');
    const blob = new Blob(['test'], { type: 'image/png' });

    await shareOrDownload(blob, 'test.png', 'Title', 'Description');

    expect(mockAnchor.download).toBe('test.png');
    expect(mockClick).toHaveBeenCalled();
  });
});
