import { PayCryptoPayoutApiError, PayCryptoPayoutClient } from '../src/client.js';
import { getEnv, loadEnvFromDotFile } from './env.js';

class LiveRunner {
  private passed = 0;
  private failed = 0;
  private skipped = 0;

  async run(name: string, fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
      this.passed += 1;
      console.log(`PASS ${name}`);
    } catch (error) {
      this.failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`FAIL ${name}: ${message}`);
    }
  }

  async runOptional(name: string, fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
      this.passed += 1;
      console.log(`PASS ${name}`);
    } catch (error) {
      this.skipped += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.log(`SKIP ${name}: ${message}`);
    }
  }

  finish(): void {
    console.log(
      JSON.stringify({
        passed: this.passed,
        failed: this.failed,
        skipped: this.skipped,
      }),
    );
    if (this.failed > 0) process.exit(1);
  }
}

function assertTrue(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function formatApiDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

const FALLBACK_TRON_USDT = 'TNVq3iEcaGWbbsR34MTdg1JMTxvYFU8Qir';

async function run(): Promise<void> {
  loadEnvFromDotFile();
  const apiKey = getEnv('PAYCRYPTO_PAYOUT_API_KEY');
  const baseUrl = getEnv('PAYCRYPTO_PAYOUT_BASE_URL', 'http://localhost:3002/api/v1');
  const masterPassword = (
    process.env.PAYCRYPTO_PAYOUT_MASTER_PASSWORD ?? ''
  ).trim();
  const liveWithdraw = (
    process.env.PAYCRYPTO_PAYOUT_LIVE_WITHDRAW ?? ''
  ).trim() === '1';
  const amount = getEnv('PAYCRYPTO_PAYOUT_TEST_AMOUNT', '0.01');
  const currency = getEnv('PAYCRYPTO_PAYOUT_TEST_CURRENCY', 'USDT');
  const network = getEnv('PAYCRYPTO_PAYOUT_TEST_NETWORK', 'TRON');
  const address =
    (process.env.PAYCRYPTO_PAYOUT_TEST_ADDRESS ?? '').trim() || FALLBACK_TRON_USDT;

  const client = new PayCryptoPayoutClient({ apiKey, baseUrl });
  const runner = new LiveRunner();
  let createdId = '';
  let lastOrderId = '';

  await runner.run('services_envelope', async () => {
    const r = await client.services();
    assertTrue(r.success === true, 'success');
    const data = r.data as { services?: unknown };
    assertTrue(data && Array.isArray(data.services), 'data.services is array');
  });

  await runner.run('calc_basic', async () => {
    const r = await client.calc({ amount, address, currency, network });
    assertTrue(r.success === true, 'success');
    const d = r.data as Record<string, unknown>;
    assertTrue(d && typeof d === 'object', 'data object');
    assertTrue('commission' in d || 'merchant_amount' in d, 'expected calc fields');
  });

  await runner.runOptional('calc_with_priority', async () => {
    const r = await client.calc({
      amount,
      address,
      currency,
      network,
      priority: 'recommended',
    });
    assertTrue(r.success === true, 'success');
  });

  await runner.runOptional('calc_convert_usd_to_usdt', async () => {
    const r = await client.calc({
      amount: '10',
      address,
      currency: 'USD',
      to_currency: 'USDT',
      network,
    });
    assertTrue(r.success === true, 'success');
    const d = r.data as { convert?: unknown };
    assertTrue(d.convert !== undefined && d.convert !== null, 'convert block');
  });

  await runner.run('list_no_filters', async () => {
    const r = await client.listPayouts({});
    assertTrue(r.success === true, 'success');
    const d = r.data as { items?: unknown; paginate?: { nextCursor?: string | null } };
    assertTrue(Array.isArray(d.items), 'items array');
    assertTrue(d.paginate && typeof d.paginate === 'object', 'paginate');
  });

  await runner.run('list_date_range', async () => {
    const from = formatApiDate(new Date(isoDaysAgo(30)));
    const to = formatApiDate(new Date());
    const r = await client.listPayouts({ date_from: from, date_to: to });
    assertTrue(r.success === true, 'success');
    const d = r.data as { items?: unknown };
    assertTrue(Array.isArray(d.items), 'items');
  });

  await runner.runOptional('list_next_cursor_page', async () => {
    const page1 = await client.listPayouts({});
    const paginate = (page1.data as { paginate?: { nextCursor?: string | null } }).paginate;
    const next = paginate?.nextCursor;
    if (!next) throw new Error('no nextCursor on first page');
    const page2 = await client.listPayouts({ cursor: next });
    assertTrue(page2.success === true, 'page2 success');
    const items = (page2.data as { items?: unknown[] }).items;
    assertTrue(Array.isArray(items), 'page2 items');
  });

  await runner.run('info_not_found_returns_error', async () => {
    try {
      await client.getInfo('11111111-1111-4111-8111-111111111111');
      throw new Error('expected PayCryptoPayoutApiError');
    } catch (e) {
      assertTrue(e instanceof PayCryptoPayoutApiError, 'PayCryptoPayoutApiError');
      const code = (e as PayCryptoPayoutApiError).statusCode;
      assertTrue(code === 404 || code === 400, `status ${code} (404 not found or 400 validation)`);
    }
  });

  if (liveWithdraw && !masterPassword) {
    await runner.run('live_withdraw_requires_master_password', async () => {
      throw new Error(
        'Set PAYCRYPTO_PAYOUT_MASTER_PASSWORD when PAYCRYPTO_PAYOUT_LIVE_WITHDRAW=1',
      );
    });
  } else if (liveWithdraw) {
      await runner.run('createPayout', async () => {
        lastOrderId = `live_node_${Date.now()}`;
        const r = await client.createPayout(
          {
            amount,
            address,
            currency,
            network,
            order_id: lastOrderId,
          },
          { masterPassword },
        );
        assertTrue(r.success === true, 'success');
        const data = r.data as { id?: string };
        assertTrue(typeof data.id === 'string' && data.id.length > 0, 'id');
        createdId = data.id as string;
      });

      await runner.run('createPayout_same_order_id_idempotent', async () => {
        const r = await client.createPayout(
          {
            amount,
            address,
            currency,
            network,
            order_id: lastOrderId,
          },
          { masterPassword },
        );
        assertTrue(r.success === true, 'success');
        const data = r.data as { id?: string };
        assertTrue(data.id === createdId, 'same id for same order_id');
      });

      await runner.run('info_created', async () => {
        const r = await client.getInfo(createdId);
        assertTrue(r.success === true, 'success');
        const data = r.data as { id?: string; order_id?: string };
        assertTrue(data.id === createdId, 'id');
        assertTrue(data.order_id === lastOrderId, 'order_id echo');
      });

      await runner.run('resend_created', async () => {
        const r = await client.resend(createdId);
        assertTrue(r.success === true, 'success');
      });
  } else {
    console.log(
      'SKIP withdraw block (create/info_same_order/resend): set PAYCRYPTO_PAYOUT_LIVE_WITHDRAW=1 and PAYCRYPTO_PAYOUT_MASTER_PASSWORD',
    );
  }

  runner.finish();
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
