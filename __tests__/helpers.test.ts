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
  calcMondeFeeTopUp,
  calcMondeFeeWithdraw,
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
// Fee Calculations (must match migration 027)
// Top-up & Withdraw: flat 3% (no minimum)
// ============================================

describe('calcTopUpFee', () => {
  it('returns 0 for zero or negative amounts', () => {
    expect(calcTopUpFee(0)).toBe(0);
    expect(calcTopUpFee(-100)).toBe(0);
  });
  it('calculates 3% of amount', () => {
    expect(calcTopUpFee(1000)).toBe(30.00);   // 3% of 1000
    expect(calcTopUpFee(500)).toBe(15.00);    // 3% of 500
    expect(calcTopUpFee(5000)).toBe(150.00);  // 3% of 5000
  });
  it('calculates correct fee for small amounts (no minimum)', () => {
    expect(calcTopUpFee(100)).toBe(3.00);    // 3% of 100
    expect(calcTopUpFee(50)).toBe(1.50);     // 3% of 50
    expect(calcTopUpFee(10)).toBe(0.30);     // 3% of 10
    expect(calcTopUpFee(333)).toBe(9.99);    // 3% of 333
    expect(calcTopUpFee(334)).toBe(10.02);   // 3% of 334
  });
});

describe('calcWithdrawFee', () => {
  it('returns 0 for zero or negative amounts', () => {
    expect(calcWithdrawFee(0)).toBe(0);
    expect(calcWithdrawFee(-50)).toBe(0);
  });
  it('calculates 3% of amount', () => {
    expect(calcWithdrawFee(1000)).toBe(30.00);
    expect(calcWithdrawFee(500)).toBe(15.00);
  });
  it('calculates correct fee for small amounts (no minimum)', () => {
    expect(calcWithdrawFee(100)).toBe(3.00);   // 3% of 100
    expect(calcWithdrawFee(200)).toBe(6.00);   // 3% of 200
    expect(calcWithdrawFee(10)).toBe(0.30);    // 3% of 10
  });
});

describe('calcMondeFeeTopUp', () => {
  it('returns Monde share (total fee - Lipila 2.5%)', () => {
    // K1000: total fee K30, Lipila K25, Monde K5
    expect(calcMondeFeeTopUp(1000)).toBe(5.00);
    // K500: total fee K15, Lipila K12.50, Monde K2.50
    expect(calcMondeFeeTopUp(500)).toBe(2.50);
  });
  it('returns 0 for zero amounts', () => {
    expect(calcMondeFeeTopUp(0)).toBe(0);
  });
  it('handles small amounts correctly (no minimum)', () => {
    // K100: total fee K3, Lipila K2.50, Monde K0.50
    expect(calcMondeFeeTopUp(100)).toBe(0.50);
  });
});

describe('calcMondeFeeWithdraw', () => {
  it('returns Monde share (total fee - Lipila 1.5%)', () => {
    // K1000: total fee K30, Lipila K15, Monde K15
    expect(calcMondeFeeWithdraw(1000)).toBe(15.00);
    // K500: total fee K15, Lipila K7.50, Monde K7.50
    expect(calcMondeFeeWithdraw(500)).toBe(7.50);
  });
  it('handles small amounts correctly (no minimum)', () => {
    // K100: total fee K3, Lipila K1.50, Monde K1.50
    expect(calcMondeFeeWithdraw(100)).toBe(1.50);
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
    expect(calcPaymentFee(501)).toBe(2.51);
    expect(calcPaymentFee(10000)).toBe(50.00);
  });
});
