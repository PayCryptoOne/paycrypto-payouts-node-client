import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyPayoutWebhookSignature } from '../src/webhook.js';

function signedPayload(secret: string, core: Record<string, unknown>): Record<string, unknown> {
  const bodyJson = JSON.stringify(core);
  const sign = createHmac('sha256', secret).update(bodyJson).digest('hex');
  return { ...core, sign };
}

describe('verifyPayoutWebhookSignature', () => {
  it('accepts valid sign', () => {
    const secret = 'abc';
    const core = {
      type: 'payout',
      id: '11111111-1111-4111-8111-111111111111',
      amount: '1',
      commission: { fee_amount: '0.1' },
      is_final: false,
      status: 'process',
      txid: null,
      currency: 'USDT',
      network: 'tron',
    };
    const payload = signedPayload(secret, core);
    expect(verifyPayoutWebhookSignature(payload, secret)).toBe(true);
  });

  it('rejects wrong secret', () => {
    const secret = 'abc';
    const core = {
      type: 'payout',
      id: '11111111-1111-4111-8111-111111111111',
      amount: '1',
      commission: { fee_amount: '0.1' },
      is_final: false,
      status: 'process',
      txid: null,
      currency: 'USDT',
      network: 'tron',
    };
    const payload = signedPayload(secret, core);
    expect(verifyPayoutWebhookSignature(payload, 'wrong')).toBe(false);
  });

  it('rejects missing sign', () => {
    const core = {
      type: 'payout',
      id: '11111111-1111-4111-8111-111111111111',
      amount: '1',
    };
    expect(verifyPayoutWebhookSignature(core as Record<string, unknown>, 's')).toBe(false);
  });

  it('rejects non-string sign', () => {
    expect(
      verifyPayoutWebhookSignature({ type: 'payout', sign: 123 } as Record<string, unknown>, 's'),
    ).toBe(false);
  });

  it('rejects tampered field after signing', () => {
    const secret = 'k';
    const core = {
      type: 'payout',
      id: '22222222-2222-4222-8222-222222222222',
      amount: '1',
      commission: { fee_amount: '0' },
      is_final: true,
      status: 'paid',
      txid: 'tx',
      currency: 'USDT',
      network: 'tron',
    };
    const payload = signedPayload(secret, core) as Record<string, unknown>;
    payload.amount = '999';
    expect(verifyPayoutWebhookSignature(payload, secret)).toBe(false);
  });

  it('trims secret whitespace', () => {
    const secret = '  xyz  ';
    const core = { type: 'payout', id: 'a', amount: '1' };
    const trimmed = secret.trim();
    const payload = signedPayload(trimmed, core);
    expect(verifyPayoutWebhookSignature(payload, secret)).toBe(true);
  });
});
