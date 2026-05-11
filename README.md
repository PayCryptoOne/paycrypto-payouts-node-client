# PayCrypto payouts Node.js client

- **NPM:** [paycrypto-payouts-node-client](https://www.npmjs.com/package/paycrypto-payouts-node-client)
- **GitHub:** [PayCryptoOne/paycrypto-payouts-node-client](https://github.com/PayCryptoOne/paycrypto-payouts-node-client)

Клиент для публичного API выплат PayCrypto: базовый URL по умолчанию `https://api.paycrypto.one/api/v1` (префикс `/api/v1` уже в пути), дальше методы вида `POST …/payout/...`. Авторизация: Bearer `sk_payout_*`; при создании выплаты — мастер-пароль в заголовке `X-Payout-Master-Password` (или в теле `masterPassword`, нежелательно из‑за логов).

## Установка

После публикации пакета в npm под именем **`paycrypto-payouts-node-client`**:

```bash
npm install paycrypto-payouts-node-client
```

Установка **напрямую из репозитория** (при установке выполнится `prepare` → сборка `dist`):

```bash
npm install git+https://github.com/PayCryptoOne/paycrypto-payouts-node-client.git
```

Локально из клона:

```bash
git clone https://github.com/PayCryptoOne/paycrypto-payouts-node-client.git
cd paycrypto-payouts-node-client
npm ci
npm run build
```

После `npm run build` подключайте пакет через `file:` или `npm link` в своём проекте.

## Инициализация

```ts
import { PayCryptoPayoutClient } from 'paycrypto-payouts-node-client';

const client = new PayCryptoPayoutClient({
  apiKey: process.env.PAYCRYPTO_PAYOUT_API_KEY!,
  baseUrl: process.env.PAYCRYPTO_PAYOUT_BASE_URL ?? 'https://api.paycrypto.one/api/v1',
});
```

Переменные окружения (по желанию): `PAYCRYPTO_PAYOUT_BASE_URL`, `PAYCRYPTO_PAYOUT_API_KEY`.

Поддерживаются ESM (`import`) и CommonJS (`require`), в том числе в NestJS и Express. Пакет с `"type": "module"` и полем `exports`: при сборке Nest в CommonJS подставляется `require`-ветка (`dist/cjs/*.cjs`), при ESM-проекте — `import` (`dist/*.js`).

### NestJS

```ts
import { Module } from '@nestjs/common';
import { PayCryptoPayoutClient } from 'paycrypto-payouts-node-client';

@Module({
  providers: [
    {
      provide: PayCryptoPayoutClient,
      useFactory: () =>
        new PayCryptoPayoutClient({
          apiKey: process.env.PAYCRYPTO_PAYOUT_API_KEY!,
          baseUrl: process.env.PAYCRYPTO_PAYOUT_BASE_URL ?? 'https://api.paycrypto.one/api/v1',
        }),
    },
  ],
  exports: [PayCryptoPayoutClient],
})
export class PaycryptoPayoutModule {}
```

Дальше в сервисах: `constructor(private readonly payout: PayCryptoPayoutClient) {}`. Секреты удобнее брать из `ConfigService` внутри `useFactory`, а не из глобального `process.env`.

## Примеры по endpoint-ам

### Семантика `currency` и `to_currency`

Поле **`amount`** всегда задаётся в валюте **`currency`**. Если **`to_currency`** не передан или совпадает с **`currency`**, конвертации нет: на блокчейн уходит ровно эта сумма в **`currency`**.

Если **`to_currency`** указан и он **отличается** от **`currency`**, сумма пересчитывается в **`to_currency`** по курсам из базы (через USD). Пример: `amount: "0.01"`, `currency: "USD"`, `to_currency: "LTC"` — получатель получит эквивалент **0,01 USD** в монете LTC, с округлением до допустимой точности и с учётом комиссий в ответе `calc` / при создании.

Поля **`network`** и **`address`** должны относиться к **итоговой** монете выплаты: при конвертации это **`to_currency`** и её сеть (например, для LTC — сеть Litecoin и LTC-адрес, а не сеть USDT).

С баланса кошелька выплат списывается монета **фактической выплаты** (`to_currency`, если задан и отличается от `currency`, иначе `currency`). 

### `POST /payout/services` — список доступных сервисов выплат

```ts
const { data } = await client.services();
console.log(data);
```

### `POST /payout/calc` — расчет комиссии и суммы

#### Вариант 1: без конвертации валюты

```ts
const calcDirect = await client.calc({
  amount: '10',
  address: 'TNVq3iEcaGWbbsR34MTdg1JMTxvYFU8Qir',
  currency: 'USDT',
  network: 'TRON',
});
console.log(calcDirect.data);
```

#### Вариант 2: с приоритетом сети

```ts
const calcWithPriority = await client.calc({
  amount: '25',
  address: '0x1111111111111111111111111111111111111111',
  currency: 'USDT',
  network: 'ETH',
  priority: 'high',
});
console.log(calcWithPriority.data);
```

#### Вариант 3: сумма в USD, выплата в USDT

`amount` в **`currency`** (USD), ончейн — **`to_currency`** (USDT); `network` и адрес — для USDT в выбранной сети.

```ts
const calcConvert = await client.calc({
  amount: '100',
  address: 'TNVq3iEcaGWbbsR34MTdg1JMTxvYFU8Qir',
  currency: 'USD',
  to_currency: 'USDT',
  network: 'TRON',
});
console.log(calcConvert.data);
```

### `POST /payout` — создание выплаты

#### Вариант 1: стандартная выплата, мастер-пароль в opts

```ts
const created = await client.createPayout(
  {
    amount: '0.01',
    address: 'TNVq3iEcaGWbbsR34MTdg1JMTxvYFU8Qir',
    currency: 'USDT',
    network: 'TRON',
    order_id: `order_${Date.now()}`,
  },
  {
    masterPassword: process.env.PAYCRYPTO_PAYOUT_MASTER_PASSWORD!,
  },
);
console.log(created.data);
```

#### Вариант 2: сумма в USD, выплата в USDT (другая сеть)

```ts
const createdConvert = await client.createPayout(
  {
    amount: '150',
    address: '0x1111111111111111111111111111111111111111',
    currency: 'USD',
    to_currency: 'USDT',
    network: 'ETH',
    order_id: `order_convert_${Date.now()}`,
  },
  {
    masterPassword: process.env.PAYCRYPTO_PAYOUT_MASTER_PASSWORD!,
  },
);
console.log(createdConvert.data);
```

Итоговая монета ончейн — **`to_currency`**; **`currency`** задаёт только валюту, в которой выражен **`amount`**.

#### Вариант 3: передать `masterPassword` в теле

```ts
const createdLegacy = await client.createPayout({
  amount: '5',
  address: 'TNVq3iEcaGWbbsR34MTdg1JMTxvYFU8Qir',
  currency: 'USDT',
  network: 'TRON',
  order_id: `order_body_mp_${Date.now()}`,
  masterPassword: process.env.PAYCRYPTO_PAYOUT_MASTER_PASSWORD!,
});
console.log(createdLegacy.data);
```

### `POST /payout/info` — информация по одной выплате

```ts
const payoutId = '00000000-0000-4000-8000-000000000001';
const info = await client.getInfo(payoutId);
console.log(info.data);
```

### `POST /payout/list` — история выплат

#### Вариант 1: без фильтров

```ts
const historyAll = await client.listPayouts();
console.log(historyAll.data);
```

#### Вариант 2: фильтр по датам

```ts
const historyWithDates = await client.listPayouts({
  date_from: '2026-05-01 00:00:00',
  date_to: '2026-05-08 23:59:59',
});
console.log(historyWithDates.data);
```

#### Вариант 3: пагинация по cursor

```ts
const page1 = await client.listPayouts({});
const nextCursor =
  (page1.data as { paginate?: { nextCursor?: string | null } }).paginate?.nextCursor ?? null;

if (nextCursor) {
  const page2 = await client.listPayouts({ cursor: nextCursor });
  console.log(page2.data);
}
```

### `POST /payout/resend` — повтор webhook

```ts
const payoutId = '00000000-0000-4000-8000-000000000001';
const resent = await client.resend(payoutId);
console.log(resent.data);
```

## Проверка webhook

Сервер подписывает JSON-тело без поля `sign` через HMAC-SHA256 и секрет webhook из ЛК.

```ts
import { verifyPayoutWebhookSignature } from 'paycrypto-payouts-node-client';

const ok = verifyPayoutWebhookSignature(parsedJsonBody, webhookSecretFromSettings);
if (!ok) throw new Error('Invalid payout webhook sign');
```

## Обработка ошибок

```ts
import { PayCryptoPayoutApiError } from 'paycrypto-payouts-node-client';

try {
  await client.services();
} catch (error) {
  if (error instanceof PayCryptoPayoutApiError) {
    console.error(error.statusCode, error.message, error.responseBody);
  }
}
```

## Публикация в npm (maintainers)

Тот же npm-аккаунт, что и для [paycrypto-node-client](https://www.npmjs.com/package/paycrypto-node-client): `npm login`, затем одноразовый код 2FA из приложения:

```bash
cd paycrypto-payouts-node-client
NPM_OTP=123456 npm run publish:otp
```

Перед публикацией срабатывает `prepublishOnly` (сборка и `npm test`). Имя пакета в реестре: **`paycrypto-payouts-node-client`**.

## Тесты

```bash
npm test
npm run test:watch
npm run smoke
npm run e2e
```

Переменные для `e2e` и `test:live` см. `.env.example`. Скрипт `npm run e2e` при заданном мастер-пароле **всегда** создаёт реальную выплату (короткий сценарий).

## Живой API (расширенные сценарии)

Команда `npm run test:live` ходит в реальный HTTP API (нужен `PAYCRYPTO_PAYOUT_API_KEY`, удобно через `.env`).

Безопасный блок (без списания средств): `services`, `calc`, списки с датами и курсором, опционально `calc` с `priority` и конвертацией USD→USDT (если бэк и курсы позволяют — иначе шаг помечается `SKIP`), запрос `info` по несуществующему uuid (ожидается ответ с ошибкой, обычно **404**).

Реальная выплата и повторный `create` с тем же `order_id` (тот же результат на стороне API): выставь `PAYCRYPTO_PAYOUT_LIVE_WITHDRAW=1` и задай `PAYCRYPTO_PAYOUT_MASTER_PASSWORD`. Иначе этот блок пропускается (в консоли будет подсказка). 

```bash
npm run test:live
```
