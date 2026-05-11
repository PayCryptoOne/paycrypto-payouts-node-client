import { PayCryptoPayoutClient } from '../src/client.js';
import { getEnv, loadEnvFromDotFile } from './env.js';

function assertTrue(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function run(): Promise<void> {
  loadEnvFromDotFile();
  const client = new PayCryptoPayoutClient({
    apiKey: getEnv('PAYCRYPTO_PAYOUT_API_KEY'),
    baseUrl: getEnv('PAYCRYPTO_PAYOUT_BASE_URL', 'https://api.paycrypto.one/api/v1'),
  });
  const out = await client.services();
  assertTrue(out.success === true, 'services envelope');
  console.log(JSON.stringify({ ok: true }, null, 2));
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
