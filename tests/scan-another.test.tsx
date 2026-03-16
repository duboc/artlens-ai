import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
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
  onScanAnother: vi.fn(),
};

describe('Scan Another — Always Reachable', () => {
  it('renders "Scan Another" button in the expanded card view', () => {
    render(<AnalysisResultCard {...defaultProps} />);
    const scanButton = screen.getByText(/Scan Another/i);
    expect(scanButton).toBeInTheDocument();
  });

  it('renders scan-again icon in the minimized pill view', () => {
    render(<AnalysisResultCard {...defaultProps} />);

    // Minimize the card by clicking the drag handle
    const dragHandle = document.querySelector('.cursor-pointer.touch-none');
    expect(dragHandle).toBeTruthy();

    act(() => {
      fireEvent.click(dragHandle!);
    });

    // The pill should have a "Scan Another" button with aria-label
    const scanButton = screen.getByLabelText('Scan Another');
    expect(scanButton).toBeInTheDocument();
  });

  it('calls onScanAnother when pill scan button is clicked', () => {
    const onScanAnother = vi.fn();
    render(<AnalysisResultCard {...defaultProps} onScanAnother={onScanAnother} />);

    // Minimize
    const dragHandle = document.querySelector('.cursor-pointer.touch-none');
    act(() => {
      fireEvent.click(dragHandle!);
    });

    const scanButton = screen.getByLabelText('Scan Another');
    act(() => {
      fireEvent.click(scanButton);
    });
    expect(onScanAnother).toHaveBeenCalled();
  });

  it('"Scan Another" button appears before description text in expanded view', () => {
    render(<AnalysisResultCard {...defaultProps} />);

    const scanButton = screen.getByText(/Scan Another/i);
    const description = screen.getByText(/swirling night sky/i);

    // Scan Another should come before Description in DOM order
    const allElements = document.querySelectorAll('button, p');
    let scanIndex = -1;
    let descIndex = -1;
    allElements.forEach((el, i) => {
      if (el.textContent?.includes('Scan Another')) scanIndex = i;
      if (el.textContent?.includes('swirling night sky')) descIndex = i;
    });

    expect(scanIndex).toBeGreaterThan(-1);
    expect(descIndex).toBeGreaterThan(-1);
    expect(scanIndex).toBeLessThan(descIndex);
  });
});
