import {
  ParsedAccount,
  Metadata,
  SafetyDepositBox,
  AuctionData,
  AuctionState,
  BidderMetadata,
  BidderPot,
  Vault,
  MasterEditionV1,
  MasterEditionV2,
  StringPublicKey,
  AuctionDataExtended,
  createPipelineExecutor,
  useConnection,
  loadAuction,
  getEmptyMetaState,
  MetaState,
  useStore,
} from '@oyster/common';
import { merge, take, drop } from 'lodash';
import { Connection } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import BN from 'bn.js';
import { useEffect, useMemo, useState } from 'react';
import { useMeta } from '../contexts';
import {
  AuctionManager,
  AuctionManagerStatus,
  AuctionManagerV1,
  AuctionManagerV2,
  BidRedemptionTicket,
  BidRedemptionTicketV2,
  getBidderKeys,
  MetaplexKey,
  SafetyDepositConfig,
  WinningConfigType,
  AuctionViewItem,
} from '@oyster/common/dist/lib/models/metaplex/index';

export enum AuctionViewState {
  Live = '0',
  Upcoming = '1',
  Ended = '2',
  BuyNow = '3',
  Defective = '-1',
}

export interface AuctionViewCompact {
  auction: ParsedAccount<AuctionData>;
  auctionManager: ParsedAccount<AuctionManagerV1 | AuctionManagerV2>;
  vault: ParsedAccount<Vault>;
}

// Flattened surface item for easy display
export interface AuctionView {
  // items 1:1 with winning configs FOR NOW
  // once tiered auctions come along, this becomes an array of arrays.
  items: AuctionViewItem[][];
  safetyDepositBoxes: ParsedAccount<SafetyDepositBox>[];
  auction: ParsedAccount<AuctionData>;
  auctionDataExtended?: ParsedAccount<AuctionDataExtended>;
  auctionManager: AuctionManager;
  participationItem?: AuctionViewItem;
  state: AuctionViewState;
  thumbnail: AuctionViewItem;
  myBidderMetadata?: ParsedAccount<BidderMetadata>;
  myBidderPot?: ParsedAccount<BidderPot>;
  myBidRedemption?: ParsedAccount<BidRedemptionTicket>;
  vault: ParsedAccount<Vault>;
  totallyComplete: boolean;
  isInstantSale: boolean;
}

type CachedRedemptionKeys = Record<
  string,
  ParsedAccount<BidRedemptionTicket> | { pubkey: StringPublicKey; info: null }
>;

export function useCompactAuctions(): AuctionViewCompact[] {
  const { auctionManagersByAuction, auctions, vaults } = useMeta();

  const result = useMemo(() => {
    return Object.values(auctionManagersByAuction).map(
      (am: ParsedAccount<AuctionManagerV1 | AuctionManagerV2>) => ({
        auctionManager: am,
        auction: auctions[am.info.auction],
        vault: vaults[am.info.vault],
      }),
    );
  }, [auctions, auctionManagersByAuction, vaults]);

  return result;
}

export function useStoreAuctionsList() {
  const { auctions, auctionManagersByAuction } = useMeta();
  const { storeAddress } = useStore()
  const result = useMemo(() => {
    return Object
      .values(auctionManagersByAuction)
      .filter(am => am.info.store === storeAddress)
      .map(
      manager => auctions[manager.info.auction],
    );
  }, [auctions, auctionManagersByAuction]);
  return result;
}

export function useCachedRedemptionKeysByWallet() {
  const { bidRedemptions } = useMeta();
  const auctions = useStoreAuctionsList();
  const { publicKey } = useWallet();

  const [cachedRedemptionKeys, setCachedRedemptionKeys] =
    useState<CachedRedemptionKeys>({});

  useEffect(() => {
    if (!publicKey) return;
    (async () => {
      const temp: CachedRedemptionKeys = {};
      await createPipelineExecutor(
        auctions.values(),
        async auction => {
          if (!cachedRedemptionKeys[auction.pubkey]) {
            await getBidderKeys(auction.pubkey, publicKey.toBase58()).then(
              key => {
                temp[auction.pubkey] = bidRedemptions[key.bidRedemption]
                  ? bidRedemptions[key.bidRedemption]
                  : { pubkey: key.bidRedemption, info: null };
              },
            );
          } else if (!cachedRedemptionKeys[auction.pubkey].info) {
            temp[auction.pubkey] =
              bidRedemptions[cachedRedemptionKeys[auction.pubkey].pubkey] ||
              cachedRedemptionKeys[auction.pubkey];
          }
        },
        { delay: 1, sequence: 2 },
      );

      setCachedRedemptionKeys(temp);
    })();
  }, [auctions, bidRedemptions, publicKey]);

  return cachedRedemptionKeys;
}

const fetchAuctionsState = async (connection: Connection, auctionManagers: ParsedAccount<AuctionManagerV1 | AuctionManagerV2>[]): Promise<MetaState> => {
  const tempCache = getEmptyMetaState();

  const responses = await Promise.all(
    auctionManagers.map(auctionManager => loadAuction(connection, auctionManager))
  )

  const auctionsState = responses.reduce((memo, state) =>
    merge(memo, state),
    tempCache
  );

  return auctionsState
}

export const useInfiniteScrollAuctions = () => {
  const connection = useConnection();
  const [auctionViews, setAuctionViews] = useState<AuctionView[]>([]);
  const { publicKey } = useWallet();
  const [initLoading, setInitLoading] = useState(true)
  const [loading, setLoading] = useState(false);
  const cachedRedemptionKeys = useCachedRedemptionKeysByWallet();
  const [auctionManagersToQuery, setAuctionManagersToQuery] = useState<
    ParsedAccount<AuctionManagerV1 | AuctionManagerV2>[]
  >([]);
  const { storeAddress } = useStore()

  const {
    isLoading,
    auctionManagersByAuction,
    auctions,
    patchState,
    ...metaState
  } = useMeta();

  const gatherAuctionViews = (
    auctionManagers: ParsedAccount<AuctionManagerV1 | AuctionManagerV2>[],
    {
      auctionDataExtended,
      safetyDepositBoxesByVaultAndIndex,
      metadataByMint,
      bidderMetadataByAuctionAndBidder,
      bidderPotsByAuctionAndBidder,
      bidRedemptionV2sByAuctionManagerAndWinningIndex,
      masterEditions,
      vaults,
      safetyDepositConfigsByAuctionManagerAndIndex,
      masterEditionsByPrintingMint,
      masterEditionsByOneTimeAuthMint,
      metadataByMasterEdition,
    }: MetaState) => {
    return auctionManagers.reduce((memo: AuctionView[], auctionManager) => {
      const auction = auctions[auctionManager.info.auction]
      const nextAuctionView = processAccountsIntoAuctionView(
        publicKey?.toBase58(),
        auction,
        auctionDataExtended,
        auctionManagersByAuction,
        safetyDepositBoxesByVaultAndIndex,
        metadataByMint,
        bidderMetadataByAuctionAndBidder,
        bidderPotsByAuctionAndBidder,
        bidRedemptionV2sByAuctionManagerAndWinningIndex,
        masterEditions,
        vaults,
        safetyDepositConfigsByAuctionManagerAndIndex,
        masterEditionsByPrintingMint,
        masterEditionsByOneTimeAuthMint,
        metadataByMasterEdition,
        cachedRedemptionKeys,
        undefined,
      );

      if (nextAuctionView) {
        return [...memo, nextAuctionView];
      }

      return memo;
    }, []);
  }

  useEffect(() => {
    if (isLoading) {
      return
    }

    (async () => {
      const storeAuctionManagers = Object.values(auctionManagersByAuction).filter(am => am.info.store ===  storeAddress)
      const initializedAuctions = storeAuctionManagers.map(am => auctions[am.info.auction]).filter(a => a.info.state > 0)
      const startedAuctions = initializedAuctions
        .filter(a => a.info.state === 1)
        .sort((a, b) => {
          if (a.info.endAuctionAt && b.info.endAuctionAt) {
            return (
              a.info.endAuctionAt.toNumber() - b.info.endAuctionAt?.toNumber()
            );
          } else {
            return -1;
          }
        });

      const endedAuctions = initializedAuctions
        .filter(a => a.info.state === 2)
        .sort((a, b) => {
          if (a.info.endAuctionAt && b.info.endAuctionAt) {
            return (
              b.info.endAuctionAt.toNumber() - a.info.endAuctionAt?.toNumber()
            );
          } else {
            return -1;
          }
        });
      const auctionDisplayOrder = [...startedAuctions, ...endedAuctions];

      const auctionManagers = auctionDisplayOrder.map(
        auction => auctionManagersByAuction[auction.pubkey],
      );

      const auctionsToLoad = take(auctionManagers, 8);

      const auctionsState = await fetchAuctionsState(connection, auctionsToLoad)

      const views = gatherAuctionViews(
        auctionsToLoad,
        merge(
          {},
          metaState,
          auctionsState,
        )
      )

      patchState(auctionsState)
      setAuctionManagersToQuery(drop(auctionManagers, 8))
      setAuctionViews(views)
      setInitLoading(false)
    })()
  }, [isLoading]);


  const loadMoreAuctions = () => {
    const needLoading = [...auctionManagersToQuery];
    const loaded = [...auctionViews];

    setLoading(true);
    const auctionsToLoad = take(needLoading, 4);

    (async () => {
      const auctionsState = await fetchAuctionsState(connection, auctionsToLoad)
      const nextState = merge(
        {},
        metaState,
        auctionsState,
      )
      
      const views = gatherAuctionViews(
        auctionsToLoad,
        nextState,
      )

      patchState(nextState)
      setAuctionManagersToQuery(drop(needLoading, 4));
      setAuctionViews([...loaded, ...views]);
      setLoading(false);
    })()
  };

  return {
    loading,
    initLoading,
    auctions: auctionViews,
    loadMore: loadMoreAuctions,
    hasNextPage: auctionManagersToQuery.length > 0,
  };
};

export const useAuctions = (state?: AuctionViewState) => {
  const [auctionViews, setAuctionViews] = useState<AuctionView[]>([]);
  const { publicKey } = useWallet();
  const cachedRedemptionKeys = useCachedRedemptionKeysByWallet();
  const auctions = useStoreAuctionsList();

  const {
    auctionManagersByAuction,
    safetyDepositBoxesByVaultAndIndex,
    metadataByMint,
    bidderMetadataByAuctionAndBidder,
    bidderPotsByAuctionAndBidder,
    vaults,
    masterEditions,
    masterEditionsByPrintingMint,
    masterEditionsByOneTimeAuthMint,
    metadataByMasterEdition,
    safetyDepositConfigsByAuctionManagerAndIndex,
    bidRedemptionV2sByAuctionManagerAndWinningIndex,
    auctionDataExtended,
  } = useMeta();

  useEffect(() => {
    (async () => {
      const auctionViews: AuctionView[] = [];

      await createPipelineExecutor(
        auctions.values(),
        auction => {
          const auctionView = processAccountsIntoAuctionView(
            publicKey?.toBase58(),
            auction,
            auctionDataExtended,
            auctionManagersByAuction,
            safetyDepositBoxesByVaultAndIndex,
            metadataByMint,
            bidderMetadataByAuctionAndBidder,
            bidderPotsByAuctionAndBidder,
            bidRedemptionV2sByAuctionManagerAndWinningIndex,
            masterEditions,
            vaults,
            safetyDepositConfigsByAuctionManagerAndIndex,
            masterEditionsByPrintingMint,
            masterEditionsByOneTimeAuthMint,
            metadataByMasterEdition,
            cachedRedemptionKeys,
            state,
          );
          if (auctionView) {
            auctionViews.push(auctionView);
          }
        },
        { delay: 1, sequence: 2 },
      );
      setAuctionViews(auctionViews.sort(sortByEnded));
    })();
  }, [
    state,
    auctions,
    auctionDataExtended,
    auctionManagersByAuction,
    safetyDepositBoxesByVaultAndIndex,
    metadataByMint,
    bidderMetadataByAuctionAndBidder,
    bidderPotsByAuctionAndBidder,
    bidRedemptionV2sByAuctionManagerAndWinningIndex,
    vaults,
    safetyDepositConfigsByAuctionManagerAndIndex,
    masterEditions,
    masterEditionsByPrintingMint,
    masterEditionsByOneTimeAuthMint,
    metadataByMasterEdition,
    publicKey,
    cachedRedemptionKeys,
    setAuctionViews,
  ]);

  return auctionViews;
};

function sortByEnded(a: AuctionView, b: AuctionView) {
  return (
    (b.auction.info.endedAt?.toNumber() || 0) -
    (a.auction.info.endedAt?.toNumber() || 0)
  );
}

function isInstantSale(
  auctionDataExt: ParsedAccount<AuctionDataExtended> | null,
  auction: ParsedAccount<AuctionData>,
) {
  return !!(
    auctionDataExt?.info.instantSalePrice &&
    auction.info.priceFloor.minPrice &&
    auctionDataExt?.info.instantSalePrice.eq(auction.info.priceFloor.minPrice)
  );
}

function buildListWhileNonZero<T>(hash: Record<string, T>, key: string) {
  const list: T[] = [];
  let ticket = hash[key + '-0'];
  if (ticket) {
    list.push(ticket);
    let i = 1;
    while (ticket) {
      ticket = hash[key + '-' + i.toString()];
      if (ticket) list.push(ticket);
      i++;
    }
  }
  return list;
}

export function processAccountsIntoAuctionView(
  walletPubkey: StringPublicKey | null | undefined,
  auction: ParsedAccount<AuctionData>,
  auctionDataExtended: Record<string, ParsedAccount<AuctionDataExtended>>,
  auctionManagersByAuction: Record<
    string,
    ParsedAccount<AuctionManagerV1 | AuctionManagerV2>
  >,
  safetyDepositBoxesByVaultAndIndex: Record<
    string,
    ParsedAccount<SafetyDepositBox>
  >,
  metadataByMint: Record<string, ParsedAccount<Metadata>>,
  bidderMetadataByAuctionAndBidder: Record<
    string,
    ParsedAccount<BidderMetadata>
  >,
  bidderPotsByAuctionAndBidder: Record<string, ParsedAccount<BidderPot>>,
  bidRedemptionV2sByAuctionManagerAndWinningIndex: Record<
    string,
    ParsedAccount<BidRedemptionTicketV2>
  >,
  masterEditions: Record<
    string,
    ParsedAccount<MasterEditionV1 | MasterEditionV2>
  >,
  vaults: Record<string, ParsedAccount<Vault>>,
  safetyDepositConfigsByAuctionManagerAndIndex: Record<
    string,
    ParsedAccount<SafetyDepositConfig>
  >,
  masterEditionsByPrintingMint: Record<string, ParsedAccount<MasterEditionV1>>,
  masterEditionsByOneTimeAuthMint: Record<
    string,
    ParsedAccount<MasterEditionV1>
  >,
  metadataByMasterEdition: Record<string, ParsedAccount<Metadata>>,
  cachedRedemptionKeysByWallet: Record<
    string,
    ParsedAccount<BidRedemptionTicket> | { pubkey: StringPublicKey; info: null }
  >,
  desiredState: AuctionViewState | undefined,
  existingAuctionView?: AuctionView,
): AuctionView | undefined {
  let state: AuctionViewState;
  if (auction.info.ended()) {
    state = AuctionViewState.Ended;
  } else if (auction.info.state === AuctionState.Started) {
    state = AuctionViewState.Live;
  } else if (auction.info.state === AuctionState.Created) {
    state = AuctionViewState.Upcoming;
  } else {
    state = AuctionViewState.BuyNow;
  }

  const auctionManagerInstance = auctionManagersByAuction[auction.pubkey || ''];

  // The defective auction view state really applies to auction managers, not auctions, so we ignore it here
  if (
    desiredState &&
    desiredState !== AuctionViewState.Defective &&
    desiredState !== state
  )
    return undefined;

  if (auctionManagerInstance) {
    // instead we apply defective state to auction managers
    if (
      desiredState === AuctionViewState.Defective &&
      auctionManagerInstance.info.state.status !==
      AuctionManagerStatus.Initialized
    )
      return undefined;
    // Generally the only way an initialized auction manager can get through is if you are asking for defective ones.
    else if (
      desiredState !== AuctionViewState.Defective &&
      auctionManagerInstance.info.state.status ===
      AuctionManagerStatus.Initialized
    )
      return undefined;

    const vault = vaults[auctionManagerInstance.info.vault];
    const auctionManagerKey = auctionManagerInstance.pubkey;

    const safetyDepositConfigs: ParsedAccount<SafetyDepositConfig>[] =
      buildListWhileNonZero(
        safetyDepositConfigsByAuctionManagerAndIndex,
        auctionManagerKey,
      );

    const bidRedemptions: ParsedAccount<BidRedemptionTicketV2>[] =
      buildListWhileNonZero(
        bidRedemptionV2sByAuctionManagerAndWinningIndex,
        auctionManagerKey,
      );
    const auctionManager = new AuctionManager({
      instance: auctionManagerInstance,
      auction,
      vault,
      safetyDepositConfigs,
      bidRedemptions,
    });

    const auctionDataExtendedKey =
      auctionManagerInstance.info.key == MetaplexKey.AuctionManagerV2
        ? (auctionManagerInstance as ParsedAccount<AuctionManagerV2>).info
          .auctionDataExtended
        : null;
    const auctionDataExt = auctionDataExtendedKey
      ? auctionDataExtended[auctionDataExtendedKey]
      : null;

    const boxesExpected = auctionManager.safetyDepositBoxesExpected.toNumber();

    const bidRedemption: ParsedAccount<BidRedemptionTicket> | undefined =
      cachedRedemptionKeysByWallet[auction.pubkey]?.info
        ? (cachedRedemptionKeysByWallet[
          auction.pubkey
        ] as ParsedAccount<BidRedemptionTicket>)
        : undefined;

    const bidderMetadata =
      bidderMetadataByAuctionAndBidder[auction.pubkey + '-' + walletPubkey];
    const bidderPot =
      bidderPotsByAuctionAndBidder[auction.pubkey + '-' + walletPubkey];

    if (existingAuctionView && existingAuctionView.totallyComplete) {
      // If totally complete, we know we arent updating anythign else, let's speed things up
      // and only update the two things that could possibly change
      existingAuctionView.auction = auction;
      existingAuctionView.myBidderPot = bidderPot;
      existingAuctionView.myBidderMetadata = bidderMetadata;
      existingAuctionView.myBidRedemption = bidRedemption;
      existingAuctionView.auctionDataExtended = auctionDataExt || undefined;
      existingAuctionView.vault = vault;
      existingAuctionView.isInstantSale = isInstantSale(
        auctionDataExt,
        auction,
      );
      for (let i = 0; i < existingAuctionView.items.length; i++) {
        const winningSet = existingAuctionView.items[i];
        for (let j = 0; j < winningSet.length; j++) {
          const curr = winningSet[j];
          if (!curr.metadata) {
            let foundMetadata =
              metadataByMint[curr.safetyDeposit.info.tokenMint];
            if (!foundMetadata) {
              // Means is a limited edition, so the tokenMint is the printingMint
              const masterEdition =
                masterEditionsByPrintingMint[curr.safetyDeposit.info.tokenMint];
              if (masterEdition) {
                foundMetadata = metadataByMasterEdition[masterEdition.pubkey];
              }
            }
            curr.metadata = foundMetadata;
          }

          if (
            curr.metadata &&
            !curr.masterEdition &&
            curr.metadata.info.masterEdition
          ) {
            const foundMaster =
              masterEditions[curr.metadata.info.masterEdition];

            curr.masterEdition = foundMaster;
          }
        }
      }

      return existingAuctionView;
    }

    const vaultKey = auctionManager.vault;
    const boxes: ParsedAccount<SafetyDepositBox>[] = buildListWhileNonZero(
      safetyDepositBoxesByVaultAndIndex,
      vaultKey,
    );
    if (boxes.length > 0) {
      let participationMetadata: ParsedAccount<Metadata> | undefined =
        undefined;
      let participationBox: ParsedAccount<SafetyDepositBox> | undefined =
        undefined;
      let participationMaster:
        | ParsedAccount<MasterEditionV1 | MasterEditionV2>
        | undefined = undefined;
      if (
        auctionManager.participationConfig !== null &&
        auctionManager.participationConfig !== undefined
      ) {
        participationBox =
          boxes[auctionManager.participationConfig?.safetyDepositBoxIndex];
        // Cover case of V1 master edition (where we're using one time auth mint in storage)
        // and case of v2 master edition where the edition itself is stored
        participationMetadata =
          metadataByMasterEdition[
          masterEditionsByOneTimeAuthMint[participationBox.info.tokenMint]
            ?.pubkey
          ] || metadataByMint[participationBox.info.tokenMint];
        if (participationMetadata) {
          participationMaster =
            masterEditionsByOneTimeAuthMint[participationBox.info.tokenMint] ||
            (participationMetadata.info.masterEdition &&
              masterEditions[participationMetadata.info.masterEdition]);
        }
      }

      const view: Partial<AuctionView> = {
        auction,
        auctionManager,
        state,
        vault,
        auctionDataExtended: auctionDataExt || undefined,
        safetyDepositBoxes: boxes,
        items: auctionManager.getItemsFromSafetyDepositBoxes(
          metadataByMint,
          masterEditionsByPrintingMint,
          metadataByMasterEdition,
          masterEditions,
          boxes,
        ),
        participationItem:
          participationMetadata && participationBox
            ? {
              metadata: participationMetadata,
              safetyDeposit: participationBox,
              masterEdition: participationMaster,
              amount: new BN(1),
              winningConfigType: WinningConfigType.Participation,
            }
            : undefined,
        myBidderMetadata: bidderMetadata,
        myBidderPot: bidderPot,
        myBidRedemption: bidRedemption,
      };

      view.thumbnail =
        ((view.items || [])[0] || [])[0] || view.participationItem;

      view.isInstantSale = isInstantSale(auctionDataExt, auction);

      view.totallyComplete = !!(
        view.thumbnail &&
        boxesExpected ===
        (view.items || []).length +
        (auctionManager.participationConfig === null ||
          auctionManager.participationConfig === undefined
          ? 0
          : 1) &&
        (auctionManager.participationConfig === null ||
          auctionManager.participationConfig === undefined ||
          (auctionManager.participationConfig !== null &&
            view.participationItem)) &&
        view.vault
      );
      if (
        (!view.thumbnail || !view.thumbnail.metadata) &&
        desiredState != AuctionViewState.Defective
      )
        return undefined;

      return view as AuctionView;
    }
  }

  return undefined;
}
