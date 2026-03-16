import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

describe('useWakeLock', () => {
  let mockRelease: ReturnType<typeof vi.fn>;
  let mockRequest: ReturnType<typeof vi.fn>;
  let releaseCallback: (() => void) | null;

  beforeEach(() => {
    releaseCallback = null;
    mockRelease = vi.fn();
    const mockSentinel = {
      release: mockRelease,
      addEventListener: vi.fn((event: string, cb: () => void) => {
        if (event === 'release') releaseCallback = cb;
      }),
      removeEventListener: vi.fn(),
    };
    mockRequest = vi.fn().mockResolvedValue(mockSentinel);

    vi.stubGlobal('navigator', {
      ...navigator,
      wakeLock: { request: mockRequest },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requests screen wake lock on mount', async () => {
    const { useWakeLock } = await import('../hooks/useWakeLock');
    const { result } = renderHook(() => useWakeLock());

    // Wait for the async request
    await act(async () => {});

    expect(mockRequest).toHaveBeenCalledWith('screen');
    expect(result.current.isSupported).toBe(true);
    expect(result.current.isActive).toBe(true);
  });

  it('releases wake lock on unmount', async () => {
    const { useWakeLock } = await import('../hooks/useWakeLock');
    const { unmount } = renderHook(() => useWakeLock());

    await act(async () => {});

    unmount();
    expect(mockRelease).toHaveBeenCalled();
  });

  it('re-acquires lock when page becomes visible', async () => {
    const { useWakeLock } = await import('../hooks/useWakeLock');
    renderHook(() => useWakeLock());

    await act(async () => {});
    expect(mockRequest).toHaveBeenCalledTimes(1);

    // Simulate release (page went hidden)
    act(() => {
      if (releaseCallback) releaseCallback();
    });

    // Simulate page becoming visible again
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(mockRequest).toHaveBeenCalledTimes(2);
  });

  it('reports isSupported as false when API is unavailable', async () => {
    vi.stubGlobal('navigator', {});

    // Need fresh import to re-evaluate isSupported
    vi.resetModules();
    const { useWakeLock } = await import('../hooks/useWakeLock');
    const { result } = renderHook(() => useWakeLock());

    expect(result.current.isSupported).toBe(false);
    expect(result.current.isActive).toBe(false);
  });
});
