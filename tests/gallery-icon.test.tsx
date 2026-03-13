import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HUDOverlay } from '../components/HUDOverlay';

describe('Gallery Icon', () => {
  const defaultProps = {
    isScanning: false,
    onScan: vi.fn(),
    onUpload: vi.fn(),
    hasResult: false,
    language: 'en' as const,
    onHistoryClick: vi.fn(),
    historyCount: 0,
    onSettingsClick: vi.fn(),
    onGalleryClick: vi.fn(),
    children: null,
  };

  it('renders gallery button with photo icon instead of sparkle icon', () => {
    render(<HUDOverlay {...defaultProps} />);
    const galleryButton = screen.getByLabelText('Gallery');
    expect(galleryButton).toBeInTheDocument();

    // The new icon should contain the landscape photo path (mountain/sun)
    const svg = galleryButton.querySelector('svg');
    expect(svg).toBeTruthy();
    const path = svg!.querySelector('path');
    expect(path).toBeTruthy();

    const d = path!.getAttribute('d') || '';
    // Should contain the photo icon path (has "15.75" from the landscape path), not sparkle (has "15.904")
    expect(d).toContain('15.75');
    expect(d).not.toContain('15.904');
  });

  it('does not render gallery button when onGalleryClick is not provided', () => {
    const { onGalleryClick, ...propsWithoutGallery } = defaultProps;
    render(<HUDOverlay {...propsWithoutGallery} children={null} />);
    expect(screen.queryByLabelText('Gallery')).not.toBeInTheDocument();
  });

  it('does not use Gemini sparkle SVG path', () => {
    render(<HUDOverlay {...defaultProps} />);
    const galleryButton = screen.getByLabelText('Gallery');
    const svgContent = galleryButton.innerHTML;
    // Sparkle icon path signature
    expect(svgContent).not.toContain('M9.813 15.904');
    expect(svgContent).not.toContain('M18.259 8.715');
  });
});
