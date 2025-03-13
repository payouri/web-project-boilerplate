import { exchangeRateApiClient } from './exchange-rate-api-client';

describe('exchangeRateApiClient', () => {
  it('should work', () => {
    expect(exchangeRateApiClient()).toEqual('exchange-rate-api-client');
  });
});
