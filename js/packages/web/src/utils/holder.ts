import { ParsedAccount, WhitelistedCreator } from '@oyster/common';
import { PublicKey } from '@solana/web3.js';
import { useCallback, useMemo, useRef, useState } from 'react';

export interface HolderInfo {
  pubkey: string;
  split: number;
  signMeta: string;
}

export const getHolderInfo = (): HolderInfo | undefined => {
  const HOLDER_PUBKEY = process.env.NEXT_PUBLIC_HOLAPLEX_HOLDER_PUBKEY;
  const HOLDER_SPLIT = process.env.NEXT_PUBLIC_HOLAPLEX_HOLDER_SPLIT;
  const SIGN_META_URL =
    process.env.NEXT_PUBLIC_HOLAPLEX_HOLDER_SIGN_META_URL;

  if (!(HOLDER_PUBKEY && HOLDER_SPLIT && SIGN_META_URL)) {
    if (HOLDER_PUBKEY || HOLDER_SPLIT || SIGN_META_URL)
      console.error(
        'Incorrect Holaplex holder configuration - missing an env var',
      );

    return undefined;
  }

  try {
    return {
      pubkey: HOLDER_PUBKEY,
      split: parseInt(HOLDER_SPLIT),
      signMeta: SIGN_META_URL,
    };
  } catch (e) {
    console.error('Incorrect Holaplex holder configuration', e);

    return undefined;
  }
};

export const useHolderInfo = (): HolderInfo | undefined =>
  useMemo(getHolderInfo, []);

export const hasHolder = (
  whitelistedCreatorsByCreator: Record<
    string,
    ParsedAccount<WhitelistedCreator>
  >,
): boolean => {
  const info = getHolderInfo();
  if (!info) return false;

  const creator = whitelistedCreatorsByCreator[info.pubkey];

  if (!creator) return false;

  return !!creator.info.activated;
};

export const useHasHolder = (
  whitelistedCreatorsByCreator: Record<
    string,
    ParsedAccount<WhitelistedCreator>
  >,
): boolean =>
  useMemo(
    () => hasHolder(whitelistedCreatorsByCreator),
    [whitelistedCreatorsByCreator],
  );

export const holaSignMetadata = async ({
  endpoint,
  solanaEndpoint,
  metadata,
  metaProgramId,
  onProgress,
  onComplete,
  onError,
}: {
  endpoint: string;
  solanaEndpoint: string;
  metadata: PublicKey;
  metaProgramId: PublicKey;
  onProgress?: (status: 'signing' | 'signed' | 'failed') => void;
  onComplete?: () => void;
  onError?: (msg: string) => void;
}) => {
  try {
    if (!onProgress) onProgress = () => {};

    onProgress('signing');

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      mode: 'cors',
      body: JSON.stringify({
        solanaEndpoint,
        metadata: metadata.toBase58(),
        metaProgramId: metaProgramId.toBase58(),
      }),
    });

    if (!resp.ok) {
      let json;

      try {
        json = await resp.json();
      } catch {
        json = { message: 'An error occurred' };
      }

      throw new Error(
        `NFT approval failed: ${json.message ?? JSON.stringify(json)}`,
      );
    }

    onProgress('signed');

    if (onComplete) onComplete();
  } catch (e) {
    if (onProgress) onProgress('failed');
    if (onError && e instanceof Error) onError(e.message);

    throw e;
  }
};

export const useHolaSignMetadata = (): {
  status: undefined | 'signing' | 'signed' | 'failed';
  holaSignMetadata: (params: {
    endpoint: string;
    solanaEndpoint: string;
    metadata: PublicKey;
    metaProgramId: PublicKey;
  }) => void;
} => {
  const promiseRef = useRef<Promise<void> | undefined>(undefined);

  // NOTE: this dual-hook thing is due to a bug where useState kept losing its value
  const status =
    useRef<undefined | 'signing' | 'signed' | 'failed'>(undefined);
  const rerender = useState<{}>({})[1];

  return {
    status: status.current,
    holaSignMetadata: useCallback(params => {
      if (promiseRef.current !== undefined) return;

      promiseRef.current = holaSignMetadata({
        ...params,
        onProgress: s => {
          status.current = s;
          rerender({});
        },
        onError: () => (promiseRef.current = undefined),
      }).catch(console.error);
    }, []),
  };
};
