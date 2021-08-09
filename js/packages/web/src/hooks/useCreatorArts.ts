import { useMeta } from '../contexts';
import { PublicKey } from '@solana/web3.js';

export const useCreatorArts = (id?: PublicKey | string) => {
  if (id === undefined) {
    return [];
  }

  const { metadata } = useMeta();
  const key = typeof id === 'string' ? new PublicKey(id) : id;
  const filtered = metadata.filter(
    m =>
      m.info.data.creators !== null &&
      m.info.data.creators.findIndex(c => c.address.equals(key)) >= 0,
  );

  return filtered;
};
