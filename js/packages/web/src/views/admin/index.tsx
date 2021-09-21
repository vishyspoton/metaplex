import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Layout,
  Row,
  Col,
  Table,
  Switch,
  Spin,
  Modal,
  Button,
  Input,
  Divider,
} from 'antd';
import { useMeta } from '../../contexts';
import {
  Store,
  WhitelistedCreator,
} from '@oyster/common/dist/lib/models/metaplex/index';
import {
  MasterEditionV1,
  notify,
  ParsedAccount,
  shortenAddress,
  StringPublicKey,
  useConnection,
  useStore,
  useUserAccounts,
  useWalletModal,
  WalletSigner,
} from '@oyster/common';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection } from '@solana/web3.js';
import { saveAdmin } from '../../actions/saveAdmin';
import {
  convertMasterEditions,
  filterMetadata,
} from '../../actions/convertMasterEditions';
import { Link } from 'react-router-dom';
import { SetupVariables } from '../../components/SetupVariables';
import { HolderInfo, useHasHolder, useHolderInfo } from '../../utils/holder';

const { Content } = Layout;
export const AdminView = () => {
  const { store, whitelistedCreatorsByCreator, isLoading } = useMeta();
  const connection = useConnection();
  const wallet = useWallet();
  const { setVisible } = useWalletModal();
  const connect = useCallback(
    () => (wallet.wallet ? wallet.connect().catch() : setVisible(true)),
    [wallet.wallet, wallet.connect, setVisible],
  );
  const { storeAddress, setStoreForOwner, isConfigured } = useStore();

  useEffect(() => {
    if (!store && !storeAddress && wallet.publicKey) {
      setStoreForOwner(wallet.publicKey.toBase58());
    }
  }, [store, storeAddress, wallet.publicKey]);
  console.log('@admin', wallet.connected, storeAddress, isLoading, store);

  return (
    <>
      {!wallet.connected ? (
        <p>
          <Button type="primary" className="app-btn" onClick={connect}>
            Connect
          </Button>{' '}
          to admin store.
        </p>
      ) : !storeAddress || isLoading ? (
        <Spin />
      ) : store && wallet ? (
        <>
          <InnerAdminView
            store={store}
            whitelistedCreatorsByCreator={whitelistedCreatorsByCreator}
            connection={connection}
            wallet={wallet}
            connected={wallet.connected}
          />
          {!isConfigured && (
            <>
              <Divider />
              <Divider />
              <p>
                To finish initialization please copy config below into{' '}
                <b>packages/web/.env</b> and restart yarn or redeploy
              </p>
              <SetupVariables
                storeAddress={storeAddress}
                storeOwnerAddress={wallet.publicKey?.toBase58()}
              />
            </>
          )}
        </>
      ) : (
        <>
          <p>Store is not initialized</p>
          <Link to={`/`}>Go to initialize</Link>
        </>
      )}
    </>
  );
};

function ArtistModal({
  setUpdatedCreators,
  uniqueCreatorsWithUpdates,
}: {
  setUpdatedCreators: React.Dispatch<
    React.SetStateAction<Record<string, WhitelistedCreator>>
  >;
  uniqueCreatorsWithUpdates: Record<string, WhitelistedCreator>;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalAddress, setModalAddress] = useState<string>('');
  return (
    <>
      <Modal
        title="Add New Artist Address"
        visible={modalOpen}
        onOk={() => {
          const addressToAdd = modalAddress;
          setModalAddress('');
          setModalOpen(false);

          if (uniqueCreatorsWithUpdates[addressToAdd]) {
            notify({
              message: 'Artist already added!',
              type: 'error',
            });
            return;
          }

          let address: StringPublicKey;
          try {
            address = addressToAdd;
            setUpdatedCreators(u => ({
              ...u,
              [modalAddress]: new WhitelistedCreator({
                address,
                activated: true,
              }),
            }));
          } catch {
            notify({
              message: 'Only valid Solana addresses are supported',
              type: 'error',
            });
          }
        }}
        onCancel={() => {
          setModalAddress('');
          setModalOpen(false);
        }}
      >
        <Input
          value={modalAddress}
          onChange={e => setModalAddress(e.target.value)}
        />
      </Modal>
      <Button
        className="add-creator-button"
        onClick={() => setModalOpen(true)}
      >
        Add Creator
      </Button>
    </>
  );
}

type ConfirmHolderFn = (change: {
  uniqueCreators: Record<string, WhitelistedCreator>;
  updatedCreators: Record<string, WhitelistedCreator>;
}) => Promise<boolean>;

function AddHolaplexModal({
  holderInfo,
  setUpdatedCreators,
  confirmRef,
}: {
  holderInfo: HolderInfo;
  setUpdatedCreators: React.Dispatch<
    React.SetStateAction<Record<string, WhitelistedCreator>>
  >;
  confirmRef: (val: ConfirmHolderFn) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const promisesRef = useRef<Array<(ok: boolean) => void>>([]);

  confirmRef(
    useCallback<ConfirmHolderFn>(
      async ({ uniqueCreators, updatedCreators }): Promise<boolean> => {
        if (
          !(
            updatedCreators[holderInfo.pubkey]?.activated &&
            !uniqueCreators[holderInfo.pubkey]?.activated
          )
        ) {
          // Don't confirm if the change doesn't involve Holaplex
          return true;
        }

        setIsOpen(true);
        return await new Promise<boolean>(ok => promisesRef.current.push(ok));
      },
      [setIsOpen],
    ),
  );

  return (
    <>
      <Modal
        title="Hold up!"
        visible={isOpen}
        onOk={() => {
          promisesRef.current.splice(0).forEach(p => p(true));
          setIsOpen(false);
        }}
        onCancel={() => {
          promisesRef.current.splice(0).forEach(p => p(false));
          setIsOpen(false);
        }}
      >
        You're about to add Holaplex as a co-creator on your storefront. This
        will enable Holaplex to collect {holderInfo.split}% of all future
        proceeds.
      </Modal>
      <Button
        className="add-creator-button"
        onClick={() => {
          setUpdatedCreators(u => ({
            ...u,
            [holderInfo.pubkey]: new WhitelistedCreator({
              activated: true,
              address: holderInfo.pubkey,
            }),
          }));
        }}
      >
        Add Holaplex
      </Button>
    </>
  );
}

function InnerAdminView({
  store,
  whitelistedCreatorsByCreator,
  connection,
  wallet,
  connected,
}: {
  store: ParsedAccount<Store>;
  whitelistedCreatorsByCreator: Record<
    string,
    ParsedAccount<WhitelistedCreator>
  >;
  connection: Connection;
  wallet: WalletSigner;
  connected: boolean;
}) {
  const [newStore, setNewStore] = useState(
    store && store.info && new Store(store.info),
  );
  const [updatedCreators, setUpdatedCreators] = useState<
    Record<string, WhitelistedCreator>
  >({});
  const [filteredMetadata, setFilteredMetadata] =
    useState<{
      available: ParsedAccount<MasterEditionV1>[];
      unavailable: ParsedAccount<MasterEditionV1>[];
    }>();
  const [loading, setLoading] = useState<boolean>();
  const { metadata, masterEditions } = useMeta();

  const { accountByMint } = useUserAccounts();
  useMemo(() => {
    const fn = async () => {
      setFilteredMetadata(
        await filterMetadata(
          connection,
          metadata,
          masterEditions,
          accountByMint,
        ),
      );
    };
    fn();
  }, [connected]);

  const holderInfo = useHolderInfo();
  const hasHolder = useHasHolder(whitelistedCreatorsByCreator);
  const confirmHolder = useRef<ConfirmHolderFn | undefined>(undefined);

  const uniqueCreators = Object.values(whitelistedCreatorsByCreator).reduce(
    (acc: Record<string, WhitelistedCreator>, e) => {
      acc[e.info.address] = e.info;
      return acc;
    },
    {},
  );

  const uniqueCreatorsWithUpdates = { ...uniqueCreators, ...updatedCreators };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      // TODO: Just name the account normally
      render: (val: string, { key }: { key: string }) => (
        <span>{key === holderInfo?.pubkey ? 'Holaplex' : val}</span>
      ),
      key: 'name',
    },
    {
      title: 'Address',
      dataIndex: 'address',
      render: (val: StringPublicKey) => <span>{val}</span>,
      key: 'address',
    },
    {
      title: 'Activated',
      dataIndex: 'activated',
      key: 'activated',
      render: (
        value: boolean,
        record: {
          address: StringPublicKey;
          activated: boolean;
          name: string;
          key: string;
        },
      ) => {
        const holder = hasHolder && record.key === holderInfo?.pubkey;

        return (
          <Switch
            checkedChildren="Active"
            unCheckedChildren="Inactive"
            title={holder ? "Can't deactivate Holaplex" : undefined}
            disabled={holder}
            checked={value}
            onChange={val => {
              if (!holder)
                setUpdatedCreators(u => ({
                  ...u,
                  [record.key]: new WhitelistedCreator({
                    activated: val,
                    address: record.address,
                  }),
                }));
            }}
          />
        );
      },
    },
  ];

  return (
    <Content>
      <Col style={{ marginTop: 10 }}>
        <Row>
          <Col span={21}>
            <ArtistModal
              setUpdatedCreators={setUpdatedCreators}
              uniqueCreatorsWithUpdates={uniqueCreatorsWithUpdates}
            />
            {holderInfo !== undefined && !hasHolder && (
              <AddHolaplexModal
                holderInfo={holderInfo}
                setUpdatedCreators={setUpdatedCreators}
                confirmRef={f => (confirmHolder.current = f)}
              />
            )}
            <Button
              onClick={async () => {
                if (confirmHolder.current) {
                  if (
                    !(await confirmHolder.current({
                      uniqueCreators,
                      updatedCreators,
                    }))
                  ) {
                    notify({ message: 'Cancelled', type: 'info' });

                    return;
                  }
                }

                notify({
                  message: 'Saving...',
                  type: 'info',
                });
                if (hasHolder && holderInfo) {
                  updatedCreators[holderInfo.pubkey] = new WhitelistedCreator({
                    activated: true,
                    address: holderInfo.pubkey,
                  });
                }
                await saveAdmin(
                  connection,
                  wallet,
                  newStore.public,
                  Object.values(updatedCreators),
                );
                notify({
                  message: 'Saved',
                  type: 'success',
                });
              }}
              type="primary"
            >
              Submit
            </Button>
          </Col>
          <Col span={3}>
            <Switch
              checkedChildren="Public"
              unCheckedChildren="Whitelist Only"
              checked={newStore.public}
              onChange={val => {
                setNewStore(_ => {
                  const newS = new Store(store.info);
                  newS.public = val;
                  return newS;
                });
              }}
            />
          </Col>
        </Row>
        <Row>
          <Table
            className="artist-whitelist-table"
            columns={columns}
            dataSource={Object.keys(uniqueCreatorsWithUpdates).map(key => ({
              key,
              address: uniqueCreatorsWithUpdates[key].address,
              activated: uniqueCreatorsWithUpdates[key].activated,
              name:
                uniqueCreatorsWithUpdates[key].name ||
                shortenAddress(uniqueCreatorsWithUpdates[key].address),
              image: uniqueCreatorsWithUpdates[key].image,
            }))}
          ></Table>
        </Row>
      </Col>

      {!store.info.public && (
        <>
          <h1>
            You have {filteredMetadata?.available.length} MasterEditionV1s that
            can be converted right now and{' '}
            {filteredMetadata?.unavailable.length} still in unfinished auctions
            that cannot be converted yet.
          </h1>
          <Col>
            <Row>
              <Button
                disabled={loading}
                onClick={async () => {
                  setLoading(true);
                  await convertMasterEditions(
                    connection,
                    wallet,
                    filteredMetadata?.available || [],
                    accountByMint,
                  );
                  setLoading(false);
                }}
              >
                {loading ? (
                  <Spin />
                ) : (
                  <span>Convert Eligible Master Editions</span>
                )}
              </Button>
            </Row>
          </Col>{' '}
        </>
      )}
    </Content>
  );
}
