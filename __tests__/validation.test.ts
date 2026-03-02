import {
  detectProvider,
  isValidPhone,
  sanitizeText,
  validateAmount,
  pinToPassword,
  isValidPin,
  formatPhoneDisplay,
} from '../lib/validation';

describe('detectProvider', () => {
  it('detects Airtel from 097x', () => {
    expect(detectProvider('0971234567')).toBe('airtel');
  });
  it('detects Airtel from 077x', () => {
    expect(detectProvider('0771234567')).toBe('airtel');
  });
  it('detects MTN from 096x', () => {
    expect(detectProvider('0961234567')).toBe('mtn');
  });
  it('detects MTN from 076x', () => {
    expect(detectProvider('0761234567')).toBe('mtn');
  });
  it('detects Zamtel from 095x', () => {
    expect(detectProvider('0951234567')).toBe('zamtel');
  });
  it('detects Zamtel from 075x', () => {
    expect(detectProvider('0751234567')).toBe('zamtel');
  });
  it('handles +260 prefix', () => {
    expect(detectProvider('+260971234567')).toBe('airtel');
    expect(detectProvider('260961234567')).toBe('mtn');
  });
  it('returns null for unknown prefix', () => {
    expect(detectProvider('0991234567')).toBeNull();
    expect(detectProvider('')).toBeNull();
  });
});

describe('isValidPhone', () => {
  it('accepts 10-digit local number', () => {
    expect(isValidPhone('0971234567')).toBe(true);
  });
  it('accepts 9-digit number without leading 0', () => {
    expect(isValidPhone('971234567')).toBe(true);
  });
  it('accepts 12-digit with country code', () => {
    expect(isValidPhone('260971234567')).toBe(true);
  });
  it('rejects too short', () => {
    expect(isValidPhone('12345')).toBe(false);
  });
  it('rejects too long', () => {
    expect(isValidPhone('1234567890123')).toBe(false);
  });
  it('strips non-numeric chars', () => {
    expect(isValidPhone('+260 97 123 4567')).toBe(true);
  });
});

describe('sanitizeText', () => {
  it('removes angle brackets', () => {
    expect(sanitizeText('<script>alert("xss")</script>')).toBe('scriptalert("xss")/script');
  });
  it('removes control characters', () => {
    expect(sanitizeText('hello\x00world')).toBe('helloworld');
  });
  it('trims whitespace', () => {
    expect(sanitizeText('  hello  ')).toBe('hello');
  });
  it('preserves normal text', () => {
    expect(sanitizeText('John Doe')).toBe('John Doe');
  });
});

describe('validateAmount', () => {
  it('accepts valid amount within balance', () => {
    expect(validateAmount(100, 500)).toEqual({ valid: true });
  });
  it('rejects zero', () => {
    expect(validateAmount(0, 500).valid).toBe(false);
  });
  it('rejects negative', () => {
    expect(validateAmount(-10, 500).valid).toBe(false);
  });
  it('rejects below minimum', () => {
    expect(validateAmount(0.5, 500).valid).toBe(false);
  });
  it('rejects above maximum', () => {
    expect(validateAmount(60000, 100000).valid).toBe(false);
  });
  it('rejects insufficient balance', () => {
    const result = validateAmount(600, 500);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Insufficient');
  });
  it('rejects NaN', () => {
    expect(validateAmount(NaN, 500).valid).toBe(false);
  });
});

describe('pinToPassword', () => {
  it('wraps PIN in password format', () => {
    const result = pinToPassword('1234');
    expect(result).toBe('Mn!1234#Zk');
    expect(result.length).toBeGreaterThanOrEqual(6);
  });
});

describe('isValidPin', () => {
  it('accepts 4-digit PIN', () => {
    expect(isValidPin('1234')).toBe(true);
    expect(isValidPin('0000')).toBe(true);
  });
  it('rejects non-4-digit', () => {
    expect(isValidPin('123')).toBe(false);
    expect(isValidPin('12345')).toBe(false);
    expect(isValidPin('abcd')).toBe(false);
    expect(isValidPin('')).toBe(false);
  });
});

describe('formatPhoneDisplay', () => {
  it('formats 12-digit number with country code', () => {
    expect(formatPhoneDisplay('260971234567')).toBe('+260 97 123 4567');
  });
  it('returns original if not 12-digit with 260 prefix', () => {
    expect(formatPhoneDisplay('0971234567')).toBe('0971234567');
  });
});
