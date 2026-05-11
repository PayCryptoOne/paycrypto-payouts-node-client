import { PayCryptoPayoutClient } from '../src/client.js';
import { getEnv, loadEnvFromDotFile } from './env.js';

class TestRunner {
  private passed = 0;
  private failed = 0;

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

  finish(): void {
    console.log(JSON.stringify({ passed: this.passed, failed: this.failed }));
    if (this.failed > 0) process.exit(1);
  }
}

function assertTrue(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const FALLBACK_TRON_USDT = 'TNVq3iEcaGWbbsR34MTdg1JMTxvYFU8Qir';

async function run(): Promise<void> {
  loadEnvFromDotFile();
  const baseUrl = getEnv('PAYCRYPTO_PAYOUT_BASE_URL', 'http://localhost:3002/api/v1');
  const apiKey = getEnv('PAYCRYPTO_PAYOUT_API_KEY');
  const masterPassword = getEnv('PAYCRYPTO_PAYOUT_MASTER_PASSWORD');
  const amount = getEnv('PAYCRYPTO_PAYOUT_TEST_AMOUNT', '0.01');
  const currency = getEnv('PAYCRYPTO_PAYOUT_TEST_CURRENCY', 'USDT');
  const network = getEnv('PAYCRYPTO_PAYOUT_TEST_NETWORK', 'TRON');
  const address =
    getEnv('PAYCRYPTO_PAYOUT_TEST_ADDRESS', '') || FALLBACK_TRON_USDT;

  const client = new PayCryptoPayoutClient({
    apiKey,
    baseUrl,
  });

  const runner = new TestRunner();
  let createdId = '';

  await runner.run('services', async () => {
    const r = await client.services();
    assertTrue(r.success === true && r.data !== undefined, 'services');
  });

  await runner.run('calc', async () => {
    const r = await client.calc({
      amount,
      address,
      currency,
      network,
    });
    assertTrue(r.success === true && r.data !== undefined, 'calc');
  });

  await runner.run('createPayout', async () => {
    const orderId = `e2e_node_${Date.now()}`;
    const r = await client.createPayout(
      {
        amount,
        address,
        currency,
        network,
        order_id: orderId,
      },
      {
        masterPassword,
      },
    );
    const data = r.data as { id?: string };
    assertTrue(typeof data.id === 'string' && data.id.length > 0, 'create id');
    createdId = data.id as string;
  });

  await runner.run('list', async () => {
    const r = await client.listPayouts({});
    assertTrue(r.success === true, 'list');
  });

  await runner.run('info', async () => {
    const r = await client.getInfo(createdId);
    const data = r.data as { id?: string };
    assertTrue(data.id === createdId, 'info id');
  });

  await runner.run('resend', async () => {
    const r = await client.resend(createdId);
    assertTrue(r.success === true, 'resend');
  });

  runner.finish();
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
