import { ParsedAccount } from '@oyster/common';
import { useMemo } from 'react';
import { WhitelistedCreator } from '../models/metaplex';

export interface TreasuryInfo {
  pubkey: string;
  split: number;
}

export const getTreasuryInfo = (): TreasuryInfo | undefined => {
  const TREASURY_PUBKEY = process.env.NEXT_PUBLIC_HOLAPLEX_TREASURY_PUBKEY;
  const TREASURY_SPLIT = process.env.NEXT_PUBLIC_HOLAPLEX_TREASURY_SPLIT;

  if (!!TREASURY_PUBKEY !== !!TREASURY_SPLIT) {
    console.error('Incorrect treasury configuration - missing an env var');
  }

  if (!TREASURY_PUBKEY || !TREASURY_SPLIT) return undefined;

  try {
    return { pubkey: TREASURY_PUBKEY, split: parseInt(TREASURY_SPLIT) };
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
