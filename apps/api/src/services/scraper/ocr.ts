import Tesseract from 'tesseract.js';

// Extrai números de uma imagem usando OCR como fallback
export async function ocrFromImageData(imageBuffer: Buffer): Promise<number> {
  try {
    const { data } = await Tesseract.recognize(imageBuffer, 'por+eng', {
      tessedit_char_whitelist: '0123456789adsAnúnciosAtivos'
    } as any);
    
    const txt = (data.text || '').replace(/\n/g, ' ');
    const match = txt.match(/(\d[\d.,]*)/);
    
    if (match) {
      const numStr = match[1].replace(/[.,]/g, match[1].includes('.') && match[1].includes(',') ? '' : '');
      return Number(numStr) || 0;
    }
    
    return 0;
  } catch (error) {
    console.error('OCR Error:', error);
    return 0;
  }
}
