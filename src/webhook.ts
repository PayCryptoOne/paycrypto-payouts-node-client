import { createHmac } from 'node:crypto';

export function verifyPayoutWebhookSignature(
  payloadWithSign: Record<string, unknown>,
  secret: string,
): boolean {
  const signRaw = payloadWithSign.sign;
  if (typeof signRaw !== 'string') return false;
  const { sign: _removed, ...rest } = payloadWithSign;
  void _removed;
  const bodyJson = JSON.stringify(rest);
  const expected = createHmac('sha256', secret.trim()).update(bodyJson).digest('hex');
  return signRaw === expected;
}
