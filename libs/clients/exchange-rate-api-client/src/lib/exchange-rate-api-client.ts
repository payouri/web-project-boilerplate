import wretch, { Wretch } from "wretch";
import type { EXCHANGE_RATE_API_SUPPORTED_CURRENCIES } from "./constants";

export { EXCHANGE_RATE_API_SUPPORTED_CURRENCIES } from "./constants";

export type ExchangeRateApiCurrencyCode = typeof EXCHANGE_RATE_API_SUPPORTED_CURRENCIES[keyof typeof EXCHANGE_RATE_API_SUPPORTED_CURRENCIES];
export type ExchangeRateApiClient = {
  getAllCurrencyRates: (params: {
    baseCurrencyCode: ExchangeRateApiCurrencyCode;
  }) => Promise<{
    result: "success",
    documentation: string,
    "terms_of_use": string,
    "time_last_update_unix": number
    "time_last_update_utc": string,
    "time_next_update_unix": number,
    "time_next_update_utc": string,
    "base_code": ExchangeRateApiCurrencyCode,
    "conversion_rates": {
      [CurrencyCode in ExchangeRateApiCurrencyCode]: number
    }
  } | {
    result: "error",
    "error-type": string
  }>,
  getCurrencyRate: (params: {
    baseCurrencyCode: ExchangeRateApiCurrencyCode;
    targetCurrencyCode: ExchangeRateApiCurrencyCode;
  }) => Promise<{
    result: "success",
    documentation: string,
    "terms_of_use": string,
    "time_last_update_unix": number
    "time_last_update_utc": string,
    "time_next_update_unix": number,
    "time_next_update_utc": string,
    "base_code": ExchangeRateApiCurrencyCode,
    "target_code": ExchangeRateApiCurrencyCode,
    "conversion_rate": number
  }
    | {
      result: "error",
      "error-type": string
    }>
}

function buildGetAllCurrencyRates(dependencies: {
  wretchInstance: Wretch;
}): ExchangeRateApiClient['getAllCurrencyRates'] {
  const { wretchInstance } = dependencies;

  return async function getAllCurrencyRates(params) {
    const { baseCurrencyCode } = params;

    const response = await wretchInstance.url(`/latest/${baseCurrencyCode}`).get().json<ReturnType<ExchangeRateApiClient['getAllCurrencyRates']>>();

    return response;
  }
}

function buildGetCurrencyRate(dependencies: {
  wretchInstance: Wretch;
}): ExchangeRateApiClient['getCurrencyRate'] {
  const { wretchInstance } = dependencies;

  return async function getCurrencyRate(params) {
    const { baseCurrencyCode, targetCurrencyCode } = params;

    const response = await wretchInstance.url(`/latest/${baseCurrencyCode}/${targetCurrencyCode}`).get().json<ReturnType<ExchangeRateApiClient['getCurrencyRate']>>();

    return response;
  }
}

export function createExchangeRateApiClient(params: {
  baseUrl?: string;
  apiKey?: string;
}): ExchangeRateApiClient {
  const { baseUrl = "https://v6.exchangerate-api.com/v6", apiKey } = params;
  const wretchInstance = wretch(baseUrl, {
    headers: {
      "Authorization": `Bearer ${apiKey}`,
    },
  })

  return {
    getAllCurrencyRates: buildGetAllCurrencyRates({ wretchInstance }),
    getCurrencyRate: buildGetCurrencyRate({ wretchInstance }),
  }
}