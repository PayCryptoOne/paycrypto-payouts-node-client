import type {
  ApiEnvelope,
  CreatePayoutOptions,
  PayCryptoPayoutClientOptions,
  PayoutCalcDto,
  PayoutCreateDto,
  PayoutListDto,
} from './types.js';

export class PayCryptoPayoutApiError extends Error {
  statusCode: number;
  responseBody: unknown;

  constructor(message: string, statusCode: number, responseBody: unknown) {
    super(message);
    this.name = 'PayCryptoPayoutApiError';
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

export class PayCryptoPayoutClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: PayCryptoPayoutClientOptions) {
    this.apiKey = options.apiKey.trim();
    this.baseUrl = (options.baseUrl ?? 'https://api.paycrypto.one/api/v1').replace(/\/+$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
    if (!this.apiKey) throw new Error('apiKey is required');
  }

  async services(): Promise<ApiEnvelope<unknown>> {
    return this.request('POST', 'payout/services', {});
  }

  async calc(dto: PayoutCalcDto): Promise<ApiEnvelope<unknown>> {
    return this.request('POST', 'payout/calc', dto as unknown as Record<string, unknown>);
  }

  async createPayout(
    dto: PayoutCreateDto,
    opts?: CreatePayoutOptions,
  ): Promise<ApiEnvelope<unknown>> {
    const headers: Record<string, string> = {};
    const mp = opts?.masterPassword?.trim() || dto.masterPassword?.trim() || '';
    if (mp) headers['X-Payout-Master-Password'] = mp;
    const body = { ...dto } as Record<string, unknown>;
    delete body.masterPassword;
    return this.request('POST', 'payout', body, headers);
  }

  async getInfo(id: string): Promise<ApiEnvelope<unknown>> {
    return this.request('POST', 'payout/info', { id });
  }

  async listPayouts(dto?: PayoutListDto): Promise<ApiEnvelope<unknown>> {
    return this.request(
      'POST',
      'payout/list',
      (dto ?? {}) as unknown as Record<string, unknown>,
    );
  }

  async resend(id: string): Promise<ApiEnvelope<unknown>> {
    return this.request('POST', 'payout/resend', { id });
  }

  private async request(
    method: 'POST',
    path: string,
    body: Record<string, unknown>,
    extraHeaders?: Record<string, string>,
  ): Promise<ApiEnvelope<unknown>> {
    const url = `${this.baseUrl}/${path.replace(/^\/+/, '')}`;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
      ...extraHeaders,
    };
    const response = await this.fetchImpl(url, {
      method,
      headers,
      body: JSON.stringify(body ?? {}),
    });
    const text = await response.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      throw new PayCryptoPayoutApiError('Invalid JSON response', response.status, text);
    }
    const envelope = parsed as ApiEnvelope<unknown> | null;
    if (!response.ok || !envelope || envelope.success !== true) {
      const message =
        (envelope &&
          typeof envelope.data === 'object' &&
          envelope.data !== null &&
          'message' in envelope.data &&
          typeof (envelope.data as { message?: unknown }).message === 'string' &&
          (envelope.data as { message: string }).message) ||
        `HTTP ${response.status}`;
      throw new PayCryptoPayoutApiError(message, response.status, parsed);
    }
    return envelope;
  }
}
