import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { AnalysisResultCard } from '../components/AnalysisResultCard';
import { IdentifyResponse, UserContext } from '../types';

const mockArtData: IdentifyResponse = {
  title: 'The Starry Night',
  artist: 'Vincent van Gogh',
  year: '1889',
  country: 'Netherlands',
  style: 'Post-Impressionism',
  description: 'A swirling night sky over a village.',
  funFact: 'Painted from memory during the day.',
  sources: [],
  annotations: [],
};

const mockUserContext: UserContext = {
  name: 'Test User',
  email: 'test@example.com',
  persona: 'guide',
};

const defaultProps = {
  data: mockArtData,
  language: 'en' as const,
  userContext: mockUserContext,
  onClose: vi.fn(),
  isDeepAnalyzing: false,
  narrationIsPlaying: false,
  narrationIsGenerating: false,
  narrationScript: null,
  onStopNarration: vi.fn(),
};

describe('Post-Narration CTA', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not show CTA when narration has not played', () => {
    render(<AnalysisResultCard {...defaultProps} />);
    expect(screen.queryByText(/chat/i)).not.toHaveTextContent('scroll down');
  });

  it('shows CTA when narration transitions from playing to stopped', () => {
    const { rerender } = render(
      <AnalysisResultCard {...defaultProps} narrationIsPlaying={true} />
    );

    // Narration stops
    rerender(
      <AnalysisResultCard {...defaultProps} narrationIsPlaying={false} />
    );

    expect(screen.getByText(/chat.*curiosities|curiosities.*chat/i)).toBeInTheDocument();
  });

  it('auto-dismisses CTA after 8 seconds', () => {
    const { rerender } = render(
      <AnalysisResultCard {...defaultProps} narrationIsPlaying={true} />
    );

    rerender(
      <AnalysisResultCard {...defaultProps} narrationIsPlaying={false} />
    );

    expect(screen.getByText(/chat.*curiosities|curiosities.*chat/i)).toBeInTheDocument();

    // Advance past 8 seconds
    act(() => {
      vi.advanceTimersByTime(8500);
    });

    expect(screen.queryByText(/scroll down for curiosities/i)).not.toBeInTheDocument();
  });

  it('does not show CTA when narration is still generating', () => {
    const { rerender } = render(
      <AnalysisResultCard {...defaultProps} narrationIsPlaying={true} narrationIsGenerating={true} />
    );

    rerender(
      <AnalysisResultCard {...defaultProps} narrationIsPlaying={false} narrationIsGenerating={true} />
    );

    expect(screen.queryByText(/scroll down for curiosities/i)).not.toBeInTheDocument();
  });
});
