import {
  useConnection,
  useStore,
  useWalletModal,
  WhitelistedCreator,
} from '@oyster/common';
import { useWallet } from '@solana/wallet-adapter-react';
import { Button, Modal } from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { saveAdmin } from '../../actions/saveAdmin';
import { useMeta } from '../../contexts';
import { SetupVariables } from '../../components/SetupVariables';
import { HolderInfo, useHolderInfo } from '../../utils/holder';

type ConfirmHolderFn = () => Promise<string | undefined>;

function AddHolaplexModal({
  holderInfo,
  confirmRef,
}: {
  holderInfo: HolderInfo;
  confirmRef: (val: ConfirmHolderFn) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const promisesRef = useRef<Array<(ok: string | undefined) => void>>([]);

  confirmRef(
    useCallback<ConfirmHolderFn>(async (): Promise<string | undefined> => {
      switch (holderInfo.setupMode) {
        case 'enforce':
          return holderInfo.pubkey;
        case 'opt-in':
          setIsOpen(true);
          return await new Promise<string | undefined>(ok =>
            promisesRef.current.push(ok),
          );
      }
    }, [setIsOpen]),
  );

  return (
    <Modal
      title="One quick thing..."
      okText="Yes"
      cancelText="No"
      visible={isOpen}
      onOk={() => {
        promisesRef.current.splice(0).forEach(p => p(holderInfo.pubkey));
        setIsOpen(false);
      }}
      onCancel={() => {
        promisesRef.current.splice(0).forEach(p => p(undefined));
        setIsOpen(false);
      }}
    >
      Would you like to add Holaplex as a co-creator on your storefront? This
      will enable Holaplex to collect {holderInfo.split}% of all future
      proceeds.
    </Modal>
  );
}

export const SetupView = () => {
  const [isInitalizingStore, setIsInitalizingStore] = useState(false);
  const connection = useConnection();
  const { store } = useMeta();
  const { setStoreForOwner } = useStore();
  const history = useHistory();
  const wallet = useWallet();
  const { setVisible } = useWalletModal();
  const connect = useCallback(
    () => (wallet.wallet ? wallet.connect().catch() : setVisible(true)),
    [wallet.wallet, wallet.connect, setVisible],
  );
  const [storeAddress, setStoreAddress] = useState<string | undefined>();

  const holderInfo = useHolderInfo();
  const confirmHolder = useRef<ConfirmHolderFn | undefined>(undefined);

  useEffect(() => {
    const getStore = async () => {
      if (wallet.publicKey) {
        const store = await setStoreForOwner(wallet.publicKey.toBase58());
        setStoreAddress(store);
      } else {
        setStoreAddress(undefined);
      }
    };
    getStore();
  }, [wallet.publicKey]);

  const initializeStore = async () => {
    if (!wallet.publicKey) {
      return;
    }

    setIsInitalizingStore(true);

    const holderKey = confirmHolder.current
      ? await confirmHolder.current()
      : undefined;

    const holderCreators =
      holderKey !== undefined
        ? [
            new WhitelistedCreator({
              address: holderKey,
              activated: true,
            }),
          ]
        : [];

    await saveAdmin(connection, wallet, false, [
      new WhitelistedCreator({
        address: wallet.publicKey.toBase58(),
        activated: true,
      }),
      ...holderCreators,
    ]);

    // TODO: process errors

    await setStoreForOwner(undefined);
    await setStoreForOwner(wallet.publicKey.toBase58());

    history.push('/admin');
  };

  return (
    <>
      {!wallet.connected && (
        <p>
          <Button type="primary" className="app-btn" onClick={connect}>
            Connect
          </Button>{' '}
          to configure store.
        </p>
      )}
      {wallet.connected && !store && (
        <>
          <p>Store is not initialized yet</p>
          <p>There must be some ◎ SOL in the wallet before initialization.</p>
          <p>
            After initialization, you will be able to manage the list of
            creators
          </p>

          <p>
            {holderInfo !== undefined && (
              <AddHolaplexModal
                holderInfo={holderInfo}
                confirmRef={f => (confirmHolder.current = f)}
              />
            )}
            <Button
              className="app-btn"
              type="primary"
              loading={isInitalizingStore}
              onClick={initializeStore}
            >
              Init Store
            </Button>
          </p>
        </>
      )}
      {wallet.connected && store && (
        <>
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
  );
};
