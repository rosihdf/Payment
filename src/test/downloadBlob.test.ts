import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildFinalPdfFilename,
  buildPreviewPdfFilename,
  downloadBlob,
  sanitizePdfFilename,
} from '../utils/downloadBlob';

describe('downloadBlob utilities', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sanitizes unsafe filename characters', () => {
    expect(sanitizePdfFilename('BestPay Angebot/test?.pdf')).toBe('BestPay_Angebot-test-.pdf');
    expect(sanitizePdfFilename('  multiple   spaces  ')).toBe('_multiple_spaces_');
  });

  it('builds preview pdf filename', () => {
    expect(buildPreviewPdfFilename('BP-ANG-2026-0001')).toBe(
      'BestPay-Angebot_VORSCHAU_BP-ANG-2026-0001.pdf',
    );
  });

  it('builds final pdf filename with version', () => {
    expect(buildFinalPdfFilename('BP-ANG-2026-0001', 2)).toBe(
      'BestPay-Angebot_BP-ANG-2026-0001_V2.pdf',
    );
  });

  it('downloads blob via temporary anchor element', () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    const click = vi.fn();
    const remove = vi.fn();
    const anchor = {
      href: '',
      download: '',
      style: { display: '' },
      click,
      remove,
    };
    const createElement = vi.spyOn(document, 'createElement').mockReturnValue(anchor as unknown as HTMLAnchorElement);
    const appendChild = vi.spyOn(document.body, 'appendChild').mockImplementation(() => anchor as unknown as Node);

    const blob = new Blob(['%PDF-test'], { type: 'application/pdf' });
    downloadBlob(blob, 'test.pdf');

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(anchor.download).toBe('test.pdf');
    expect(click).toHaveBeenCalled();
    expect(remove).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    expect(createElement).toHaveBeenCalledWith('a');
    expect(appendChild).toHaveBeenCalled();

    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
    createElement.mockRestore();
    appendChild.mockRestore();
  });
});
