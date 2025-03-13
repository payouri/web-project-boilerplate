export type StoreEntry<ValueType> = {
  key: string;
  ttl?: {
    expiresAt: Date;
    ttlMs: number;
    timeout: NodeJS.Timeout;
  }
  value: ValueType;
}

export type KeyValueStoreMap<KeyType extends string | number | Record<string, unknown>, ValueType> = Map<KeyType, StoreEntry<ValueType>>;

export type KeyValueStore<KeyType extends string | number | Record<string, unknown>, ValueType> = {
  get: (key: KeyType) => StoreEntry<ValueType> | null;
  set: (key: KeyType, value: ValueType, ttlMs?: number) => StoreEntry<ValueType>;
  delete: (key: KeyType) => void;
  iterator: () => IterableIterator<StoreEntry<ValueType>>;
}

function buildGetKey<KeyType extends string | number | Record<string, unknown>, ValueType>(dependencies: {
  map: KeyValueStoreMap<KeyType, ValueType>;
}): KeyValueStore<KeyType, ValueType>['get'] {
  const { map } = dependencies;

  return function getKey(key) {
    const entry = map.get(key);
    if (!entry) {
      return null;
    }

    return entry;
  }
}

function buildSetKey<KeyType extends string | number | Record<string, unknown>, ValueType>(dependencies: {
  map: KeyValueStoreMap<KeyType, ValueType>;
  defaultTtlMs: number;
}): KeyValueStore<KeyType, ValueType>['set'] {
  const { map } = dependencies;

  return function setKey(key, value, ttlMs) {
    const existing = map.get(key);
    if (existing && existing.ttl) {
      clearTimeout(existing.ttl.timeout);
      map.delete(key);
    }

    const entry: StoreEntry<ValueType> = {
      key: key.toString(),
      value,
    };

    if (typeof ttlMs === "number" && ttlMs > 0 && ttlMs !== Infinity) {
      entry.ttl = {
        expiresAt: new Date(Date.now() + ttlMs),
        ttlMs,
        timeout: setTimeout(() => {
          map.delete(key);
        }, ttlMs),
      }
    }

    map.set(key, entry);

    return entry;
  }
}

function buildDeleteKey<KeyType extends string | number | Record<string, unknown>, ValueType>(dependencies: {
  map: KeyValueStoreMap<KeyType, ValueType>;
}): KeyValueStore<KeyType, ValueType>['delete'] {
  const { map } = dependencies;

  return function deleteKey(key) {
    const entry = map.get(key);
    if (!entry) {
      return;
    }

    if (entry.ttl) {
      clearTimeout(entry.ttl.timeout);
    }
    map.delete(key);
  }
}

type CreateKeyValueStoreParams<KeyType extends string | number | Record<string, unknown>, ValueType> = {
  defaultTtlMs?: number;
}

export function createKeyValueStore<KeyType extends string | number | Record<string, unknown>, ValueType>(params?: CreateKeyValueStoreParams<KeyType, ValueType>): KeyValueStore<KeyType, ValueType> {
  const { defaultTtlMs = Infinity } = params || {};
  const store = new Map<KeyType, StoreEntry<ValueType>>();

  const get = buildGetKey({ map: store })
  const set = buildSetKey({ map: store, defaultTtlMs })
  const deleteKey = buildDeleteKey({ map: store })
  const iterator = () => store.values();

  return {
    get,
    set,
    delete: deleteKey,
    iterator,
  }
}
