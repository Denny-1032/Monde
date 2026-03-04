import {
  formatCurrency,
  formatPhone,
  generateQRData,
  parseQRData,
  generateTransactionId,
  getProviderByPhone,
  maskPhone,
  getInitials,
  calcTopUpFee,
  calcWithdrawFee,
  calcPaymentFee,
} from '../lib/helpers';

describe('formatCurrency', () => {
  it('formats positive amount', () => {
    expect(formatCurrency(1000)).toBe('K1,000.00');
  });
  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('K0.00');
  });
  it('formats decimal amount', () => {
    expect(formatCurrency(49.5)).toBe('K49.50');
  });
});

describe('formatPhone', () => {
  it('formats +260 prefixed number', () => {
    expect(formatPhone('+260971234567')).toBe('0971 234 567');
  });
  it('returns original for non +260 numbers', () => {
    expect(formatPhone('0971234567')).toBe('0971234567');
  });
});

describe('generateQRData / parseQRData', () => {
  it('round-trips QR payload', () => {
    const payload = { app: 'monde' as const, v: 1, phone: '+260971234567', name: 'Test', provider: 'airtel', amount: 100 };
    const encoded = generateQRData(payload);
    const decoded = parseQRData(encoded);
    expect(decoded).toEqual(payload);
  });
  it('returns null for invalid JSON', () => {
    expect(parseQRData('not-json')).toBeNull();
  });
  it('returns null for non-monde payload', () => {
    expect(parseQRData(JSON.stringify({ app: 'other', phone: '123' }))).toBeNull();
  });
  it('returns null for missing phone', () => {
    expect(parseQRData(JSON.stringify({ app: 'monde' }))).toBeNull();
  });
});

describe('generateTransactionId', () => {
  it('starts with txn_ prefix', () => {
    expect(generateTransactionId()).toMatch(/^txn_/);
  });
  it('generates unique IDs', () => {
    const a = generateTransactionId();
    const b = generateTransactionId();
    expect(a).not.toBe(b);
  });
});

describe('getProviderByPhone', () => {
  it('detects airtel', () => {
    expect(getProviderByPhone('0971234567')).toBe('airtel');
    expect(getProviderByPhone('0771234567')).toBe('airtel');
  });
  it('detects mtn', () => {
    expect(getProviderByPhone('0961234567')).toBe('mtn');
  });
  it('detects zamtel', () => {
    expect(getProviderByPhone('0951234567')).toBe('zamtel');
  });
  it('returns unknown for unrecognized', () => {
    expect(getProviderByPhone('0991234567')).toBe('unknown');
  });
});

describe('maskPhone', () => {
  it('masks middle of phone number', () => {
    expect(maskPhone('+260971234567')).toBe('+260****567');
  });
  it('returns short numbers unchanged', () => {
    expect(maskPhone('12345')).toBe('12345');
  });
});

describe('getInitials', () => {
  it('extracts initials from full name', () => {
    expect(getInitials('John Doe')).toBe('JD');
  });
  it('handles single name', () => {
    expect(getInitials('Alice')).toBe('A');
  });
  it('limits to 2 characters', () => {
    expect(getInitials('John Michael Doe')).toBe('JM');
  });
});

// ============================================
// Fee Calculations (must match migration 020)
// ============================================

describe('calcTopUpFee', () => {
  it('returns 0 for zero or negative amounts', () => {
    expect(calcTopUpFee(0)).toBe(0);
    expect(calcTopUpFee(-100)).toBe(0);
  });
  it('calculates 1% + K1 flat', () => {
    expect(calcTopUpFee(1000)).toBe(11.00);   // 10 + 1
    expect(calcTopUpFee(100)).toBe(2.00);      // 1 + 1
    expect(calcTopUpFee(50)).toBe(1.50);       // 0.5 + 1
  });
  it('rounds to 2 decimal places', () => {
    expect(calcTopUpFee(33)).toBe(1.33);       // 0.33 + 1
  });
});

describe('calcWithdrawFee', () => {
  it('returns 0 for zero or negative amounts', () => {
    expect(calcWithdrawFee(0)).toBe(0);
    expect(calcWithdrawFee(-50)).toBe(0);
  });
  it('calculates 1.5% + K2 flat', () => {
    expect(calcWithdrawFee(1000)).toBe(17.00);  // 15 + 2
    expect(calcWithdrawFee(100)).toBe(3.50);     // 1.5 + 2
    expect(calcWithdrawFee(200)).toBe(5.00);     // 3 + 2
  });
  it('rounds to 2 decimal places', () => {
    expect(calcWithdrawFee(33)).toBe(2.50);      // 0.495 → 0.50 + 2
  });
});

describe('calcPaymentFee', () => {
  it('returns 0 for zero or negative amounts', () => {
    expect(calcPaymentFee(0)).toBe(0);
    expect(calcPaymentFee(-100)).toBe(0);
  });
  it('returns 0 for amounts ≤ K500 (free tier)', () => {
    expect(calcPaymentFee(1)).toBe(0);
    expect(calcPaymentFee(499.99)).toBe(0);
    expect(calcPaymentFee(500)).toBe(0);
  });
  it('calculates 0.5% for amounts > K500', () => {
    expect(calcPaymentFee(1000)).toBe(5.00);
    expect(calcPaymentFee(501)).toBe(2.51);      // 2.505 → 2.51
    expect(calcPaymentFee(10000)).toBe(50.00);
  });
});
