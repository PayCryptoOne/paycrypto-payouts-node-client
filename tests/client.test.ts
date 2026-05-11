import { describe, expect, it, vi } from 'vitest';
import { PayCryptoPayoutApiError, PayCryptoPayoutClient } from '../src/client.js';

function mockFetch(res: { ok: boolean; status: number; text: string }): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: res.ok,
    status: res.status,
    text: async () => res.text,
  }) as unknown as typeof fetch;
}

describe('PayCryptoPayoutClient', () => {
  it('throws if apiKey is empty', () => {
    expect(
      () =>
        new PayCryptoPayoutClient({
          apiKey: '   ',
          fetchImpl: vi.fn() as unknown as typeof fetch,
        }),
    ).toThrow('apiKey is required');
  });

  it('trims apiKey and strips trailing slashes on baseUrl', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true, data: {} }),
    });
    const client = new PayCryptoPayoutClient({
      apiKey: '  sk_x  ',
      baseUrl: 'https://example.com/api/v1///',
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    await client.services();
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://example.com/api/v1/payout/services');
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk_x');
  });

  it('sends Bearer auth and JSON body for services', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true, data: { services: [] } }),
    });
    const client = new PayCryptoPayoutClient({
      apiKey: 'sk_payout_abcd_secretpart',
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    await client.services();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.paycrypto.one/api/v1/payout/services');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer sk_payout_abcd_secretpart');
    expect(headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe('{}');
  });

  it('posts calc with dto body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true, data: { merchant_amount: '1' } }),
    });
    const client = new PayCryptoPayoutClient({
      apiKey: 'k',
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    await client.calc({
      amount: '1',
      address: 'T9',
      currency: 'USDT',
      network: 'TRON',
      priority: 'high',
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url.endsWith('/payout/calc')).toBe(true);
    expect(JSON.parse(String(init.body))).toMatchObject({
      amount: '1',
      address: 'T9',
      currency: 'USDT',
      network: 'TRON',
      priority: 'high',
    });
  });

  it('sets X-Payout-Master-Password on create and strips masterPassword from body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          success: true,
          data: { id: '00000000-0000-4000-8000-000000000001' },
        }),
    });
    const client = new PayCryptoPayoutClient({
      apiKey: 'k',
      baseUrl: 'http://localhost:3002/api/v1',
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    await client.createPayout(
      {
        amount: '1',
        address: 'T9',
        currency: 'USDT',
        network: 'TRON',
        order_id: 'ord_1',
      },
      { masterPassword: 'mp' },
    );
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Payout-Master-Password']).toBe('mp');
    expect(headers['Idempotency-Key']).toBeUndefined();
    const body = JSON.parse(String(init.body));
    expect(body.masterPassword).toBeUndefined();
    expect(body.order_id).toBe('ord_1');
  });

  it('prefers opts.masterPassword over dto.masterPassword', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true, data: { id: 'a' } }),
    });
    const client = new PayCryptoPayoutClient({
      apiKey: 'k',
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    await client.createPayout(
      {
        amount: '1',
        address: 'T9',
        currency: 'USDT',
        network: 'TRON',
        order_id: 'o',
        masterPassword: 'from-body',
      },
      { masterPassword: 'from-opts' },
    );
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['X-Payout-Master-Password']).toBe('from-opts');
    expect(JSON.parse(String(init.body)).masterPassword).toBeUndefined();
  });

  it('sends master password from dto when opts omitted', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true, data: { id: 'b' } }),
    });
    const client = new PayCryptoPayoutClient({
      apiKey: 'k',
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    await client.createPayout({
      amount: '1',
      address: 'T9',
      currency: 'USDT',
      network: 'TRON',
      order_id: 'o2',
      masterPassword: 'only-body',
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['X-Payout-Master-Password']).toBe('only-body');
  });

  it('posts info and resend with id in body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true, data: {} }),
    });
    const client = new PayCryptoPayoutClient({
      apiKey: 'k',
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    await client.getInfo('uuid-1');
    await client.resend('uuid-2');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, init1] = fetchMock.mock.calls[0] as [string, RequestInit];
    const [, init2] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(JSON.parse(String(init1.body))).toEqual({ id: 'uuid-1' });
    expect(JSON.parse(String(init2.body))).toEqual({ id: 'uuid-2' });
  });

  it('posts list with filters and empty object when omitted', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true, data: { items: [] } }),
    });
    const client = new PayCryptoPayoutClient({
      apiKey: 'k',
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    await client.listPayouts();
    await client.listPayouts({
      date_from: '2026-01-01 00:00:00',
      date_to: '2026-01-02 00:00:00',
      cursor: 'abc',
    });
    expect(JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))).toEqual({});
    expect(JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body))).toEqual({
      date_from: '2026-01-01 00:00:00',
      date_to: '2026-01-02 00:00:00',
      cursor: 'abc',
    });
  });

  it('throws PayCryptoPayoutApiError on API error envelope', async () => {
    const client = new PayCryptoPayoutClient({
      apiKey: 'bad',
      fetchImpl: mockFetch({
        ok: false,
        status: 401,
        text: JSON.stringify({
          success: false,
          data: { message: 'Invalid payout API key' },
        }),
      }),
    });
    try {
      await client.services();
      expect.fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(PayCryptoPayoutApiError);
      const err = e as PayCryptoPayoutApiError;
      expect(err.statusCode).toBe(401);
      expect(err.message).toBe('Invalid payout API key');
    }
  });

  it('uses HTTP status message when envelope has no data.message', async () => {
    const client = new PayCryptoPayoutClient({
      apiKey: 'k',
      fetchImpl: mockFetch({
        ok: false,
        status: 503,
        text: JSON.stringify({ success: false, data: {} }),
      }),
    });
    await expect(client.services()).rejects.toMatchObject({
      message: 'HTTP 503',
      statusCode: 503,
    });
  });

  it('throws PayCryptoPayoutApiError on invalid JSON', async () => {
    const client = new PayCryptoPayoutClient({
      apiKey: 'k',
      fetchImpl: mockFetch({ ok: true, status: 200, text: 'not json' }),
    });
    await expect(client.services()).rejects.toMatchObject({
      message: 'Invalid JSON response',
      statusCode: 200,
    });
  });

  it('throws when HTTP ok but success is not true', async () => {
    const client = new PayCryptoPayoutClient({
      apiKey: 'k',
      fetchImpl: mockFetch({
        ok: true,
        status: 200,
        text: JSON.stringify({ success: false, data: { message: 'bad' } }),
      }),
    });
    await expect(client.services()).rejects.toMatchObject({
      message: 'bad',
      statusCode: 200,
    });
  });
});
