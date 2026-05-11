export interface PayCryptoPayoutClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export interface PayoutCalcDto {
  amount: string;
  address: string;
  currency: string;
  network: string;
  priority?: string;
  to_currency?: string;
}

export interface PayoutCreateDto {
  amount: string;
  address: string;
  currency: string;
  network: string;
  order_id: string;
  url_callback?: string;
  priority?: string;
  to_currency?: string;
  masterPassword?: string;
}

export interface PayoutListDto {
  date_from?: string;
  date_to?: string;
  cursor?: string;
}

export interface CreatePayoutOptions {
  masterPassword?: string;
}
