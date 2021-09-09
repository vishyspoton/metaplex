import { ParsedAccount } from '@oyster/common';
import { PublicKey } from '@solana/web3.js';
import { useCallback, useMemo, useRef, useState } from 'react';
import { WhitelistedCreator } from '../models/metaplex';

export interface TreasuryInfo {
  pubkey: string;
  split: number;
  approve: string;
}

export const getTreasuryInfo = (): TreasuryInfo | undefined => {
  const TREASURY_PUBKEY = process.env.NEXT_PUBLIC_HOLAPLEX_TREASURY_PUBKEY;
  const TREASURY_SPLIT = process.env.NEXT_PUBLIC_HOLAPLEX_TREASURY_SPLIT;
  const APPROVE_ENDPOINT =
    process.env.NEXT_PUBLIC_HOLAPLEX_TREASURY_APPROVE_ENDPOINT;

  if (!(TREASURY_PUBKEY && TREASURY_SPLIT && APPROVE_ENDPOINT)) {
    if (TREASURY_PUBKEY || TREASURY_SPLIT || APPROVE_ENDPOINT)
      console.error('Incorrect treasury configuration - missing an env var');

    return undefined;
  }

  try {
    return {
      pubkey: TREASURY_PUBKEY,
      split: parseInt(TREASURY_SPLIT),
      approve: APPROVE_ENDPOINT,
    };
  } catch (e) {
    console.error('Incorrect treasury configuration', e);

    return undefined;
  }
};

export const useTreasuryInfo = (): TreasuryInfo | undefined =>
  useMemo(getTreasuryInfo, []);

export const hasTreasury = (
  whitelistedCreatorsByCreator: Record<
    string,
    ParsedAccount<WhitelistedCreator>
  >,
): boolean => {
  const info = getTreasuryInfo();
  if (!info) return false;

  const creator = whitelistedCreatorsByCreator[info.pubkey];

  if (!creator) return false;

  return !!creator.info.activated;
};

export const useHasTreasury = (
  whitelistedCreatorsByCreator: Record<
    string,
    ParsedAccount<WhitelistedCreator>
  >,
): boolean =>
  useMemo(
    () => hasTreasury(whitelistedCreatorsByCreator),
    [whitelistedCreatorsByCreator],
  );

export const approveNFT = async ({
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
  onProgress?: (status: 'approving' | 'approved' | 'failed') => void;
  onComplete?: () => void;
  onError?: (msg: string) => void;
}) => {
  try {
    if (!onProgress) onProgress = () => {};

    onProgress('approving');

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
        `Store upload failed: ${json.message ?? JSON.stringify(json)}`,
      );
    }

    onProgress('approved');

    if (onComplete) onComplete();
  } catch (e) {
    if (onProgress) onProgress('failed');
    if (onError && e instanceof Error) onError(e.message);

    throw e;
  }
};

export const useApproveNFT = (): {
  status: undefined | 'approving' | 'approved' | 'failed';
  approveNFT: (params: {
    endpoint: string;
    solanaEndpoint: string;
    metadata: PublicKey;
    metaProgramId: PublicKey;
  }) => void;
} => {
  const promiseRef = useRef<Promise<void> | undefined>(undefined);

  // NOTE: this dual-hook thing is due to a bug where useState kept losing its value
  const status =
    useRef<undefined | 'approving' | 'approved' | 'failed'>(undefined);
  const rerender = useState<{}>({})[1];

  return {
    status: status.current,
    approveNFT: useCallback(params => {
      if (promiseRef.current !== undefined) return;

      promiseRef.current = approveNFT({
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
