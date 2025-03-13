import { keyValueStore } from './key-value-store';

describe('keyValueStore', () => {
  it('should work', () => {
    expect(keyValueStore()).toEqual('key-value-store');
  });
});
