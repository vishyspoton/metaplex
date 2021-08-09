import { PublicKey } from '@solana/web3.js';
import { useMeta } from '../contexts';

export const useCreator = (id?: PublicKey | string) => {
  if (id === undefined) {
    return undefined;
  }

  const { whitelistedCreatorsByCreator } = useMeta();
  const key = typeof id === 'string' ? new PublicKey(id) : id;
  const creators = Object.values(whitelistedCreatorsByCreator).filter(creator =>
    creator.info.address.equals(key),
  );

  if (creators.length === 0) {
    return undefined;
  }

  return creators[0];
};
