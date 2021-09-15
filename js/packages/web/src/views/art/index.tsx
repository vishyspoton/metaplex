import React, { ReactNode, useMemo, useState } from 'react';
import {
  Row,
  Col,
  Divider,
  Layout,
  Tag,
  Button,
  Skeleton,
  List,
  Card,
  TagProps,
  Typography,
} from 'antd';
import { useParams } from 'react-router-dom';
import { useArt, useExtendedArt } from '../../hooks';

import { ArtContent } from '../../components/ArtContent';
import {
  programIds,
  shortenAddress,
  useConnection,
  useConnectionConfig,
} from '@oyster/common';
import { useWallet } from '@solana/wallet-adapter-react';
import { MetaAvatar } from '../../components/MetaAvatar';
import { sendSignMetadata } from '../../actions/sendSignMetadata';
import { ViewOn } from '../../components/ViewOn';
import { ArtType } from '../../types';
import { ArtMinting } from '../../components/ArtMinting';
import {
  useHolaSignMetadata,
  useHasHolder,
  useHolderInfo,
} from '../../utils/holder';
import { useMeta } from '../../contexts';
import { PublicKey } from '@solana/web3.js';

const { Content } = Layout;

export const ArtView = () => {
  const { whitelistedCreatorsByCreator } = useMeta();
  const { endpoint } = useConnectionConfig();
  const { id } = useParams<{ id: string }>();
  const wallet = useWallet();
  const holderInfo = useHolderInfo();
  const hasHolder = useHasHolder(whitelistedCreatorsByCreator);
  const { status: signMetaStatus, holaSignMetadata } = useHolaSignMetadata();
  const [remountArtMinting, setRemountArtMinting] = useState(0);

  const connection = useConnection();
  const art = useArt(id);
  let badge = '';
  if (art.type === ArtType.NFT) {
    badge = 'Unique';
  } else if (art.type === ArtType.Master) {
    badge = 'NFT 0';
  } else if (art.type === ArtType.Print) {
    badge = `${art.edition} of ${art.supply}`;
  }
  const { ref, data } = useExtendedArt(id);

  // const { userAccounts } = useUserAccounts();

  // const accountByMint = userAccounts.reduce((prev, acc) => {
  //   prev.set(acc.info.mint.toBase58(), acc);
  //   return prev;
  // }, new Map<string, TokenAccount>());

  const description = data?.description;
  const attributes = data?.attributes;

  const pubkey = wallet?.publicKey?.toBase58() || '';

  const tag = (
    <div className="info-header">
      <Tag color="blue">UNVERIFIED</Tag>
    </div>
  );

  const isCreator = art.creators?.some(c => c.address === pubkey) ?? false;
  const holderCreator = art.creators?.find(
    c => c.address === holderInfo?.pubkey,
  );
  const shouldVerifyHolder =
    isCreator &&
    holderCreator !== undefined &&
    !(holderCreator?.verified ?? true);

  // NOTE: this is debounced by useHolaSignMetadata
  if (hasHolder && holderInfo && shouldVerifyHolder) {
    holaSignMetadata({
      endpoint: holderInfo.signMeta,
      solanaEndpoint: endpoint,
      metadata: new PublicKey(id),
      metaProgramId: new PublicKey(programIds().metadata),
    });
  }

  const holderStatus = useMemo<
    undefined | 'FINALIZING' | 'FINALIZED' | 'HOLAPLEX ERROR'
  >(() => {
    if (!(hasHolder && shouldVerifyHolder)) return undefined;

    switch (signMetaStatus) {
      case undefined:
      case 'signing':
        return 'FINALIZING';
      case 'signed':
        return 'FINALIZED';
      case 'failed':
        return 'HOLAPLEX ERROR';
    }
  }, [hasHolder, holderInfo, shouldVerifyHolder, signMetaStatus]);

  const holderTag = useMemo(() => {
    let color: TagProps['color'];

    switch (holderStatus) {
      case undefined:
        color = undefined;
        break;
      case 'FINALIZING':
        color = 'blue';
        break;
      case 'FINALIZED':
        color = 'green';
        break;
      case 'HOLAPLEX ERROR':
        color = 'red';
        break;
    }

    return (
      <div className="info-header">
        <Tag color={color}>{holderStatus}</Tag>
      </div>
    );
  }, [holderStatus]);

  let holderUnverified: ReactNode;

  switch (holderStatus) {
    case undefined:
      break;
    case 'FINALIZING':
      holderUnverified = 'Finalizing with Holaplex...';
      break;
    case 'FINALIZED':
      holderUnverified = 'Finalized! Reload the page to continue.';
      break;
    case 'HOLAPLEX ERROR':
      holderUnverified = (
        <>
          Finalization failed, reload to try again. If that doesn't work please{' '}
          <a href="https://discord.com/invite/TEu7Qx5ux3">reach out for support</a>.
        </>
      );
      break;
  }

  const unverified = (
    <>
      {tag}
      <div style={{ fontSize: 12 }}>
        <i>
          This artwork is still missing verification from{' '}
          {art.creators?.filter(c => !c.verified).length} contributors before it
          can be considered verified and sellable on the platform.
        </i>
      </div>
      {holderUnverified && (
        <>
          <br />
          {holderTag}
          <div style={{ fontSize: 12 }}>
            <i>{holderUnverified}</i>
          </div>
        </>
      )}
      <br />
    </>
  );

  return (
    <Content>
      <Col>
        <Row ref={ref}>
          <Col xs={{ span: 24 }} md={{ span: 12 }} style={{ padding: '30px' }}>
            <ArtContent
              style={{ width: '300px', height: '300px', margin: '0 auto' }}
              height={300}
              width={300}
              className="artwork-image"
              pubkey={id}
              active={true}
              allowMeshRender={true}
            />
          </Col>
          {/* <Divider /> */}
          <Col
            xs={{ span: 24 }}
            md={{ span: 12 }}
            style={{ textAlign: 'left', fontSize: '1.4rem' }}
          >
            <Row>
              <h1>{art.title || <Skeleton paragraph={{ rows: 0 }} />}</h1>
            </Row>
            <Row>
              <Col span={6}>
                <h6>Royalties</h6>
                <div className="royalties">
                  {((art.seller_fee_basis_points || 0) / 100).toFixed(2)}%
                </div>
              </Col>
              <Col span={12}>
                <ViewOn id={id} />
              </Col>
            </Row>
            <Row>
              <Col>
                <h6 style={{ marginTop: 5 }}>Created By</h6>
                <div className="creators">
                  {(art.creators || [])
                    .filter(c => !hasHolder || c.address !== holderInfo?.pubkey)
                    .map((creator, idx) => {
                      return (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            marginBottom: 5,
                          }}
                        >
                          <MetaAvatar creators={[creator]} size={64} />
                          <div>
                            <span className="creator-name">
                              {creator.name ||
                                shortenAddress(creator.address || '')}
                            </span>
                            <div style={{ marginLeft: 10 }}>
                              {(!creator.verified ||
                                (creator.address === holderInfo?.pubkey &&
                                  holderStatus)) &&
                                (creator.address === pubkey ? (
                                  <Button
                                    onClick={async () => {
                                      try {
                                        await sendSignMetadata(
                                          connection,
                                          wallet,
                                          id,
                                        );
                                      } catch (e) {
                                        console.error(e);
                                        return false;
                                      }
                                      return true;
                                    }}
                                  >
                                    Approve
                                  </Button>
                                ) : (
                                  tag
                                ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </Col>
            </Row>
            <Row>
              <Col>
                <h6 style={{ marginTop: 5 }}>Edition</h6>
                <div className="art-edition">{badge}</div>
              </Col>
            </Row>

            {/* <Button
                  onClick={async () => {
                    if(!art.mint) {
                      return;
                    }
                    const mint = new PublicKey(art.mint);

                    const account = accountByMint.get(art.mint);
                    if(!account) {
                      return;
                    }

                    const owner = wallet.publicKey;

                    if(!owner) {
                      return;
                    }
                    const instructions: any[] = [];
                    await updateMetadata(undefined, undefined, true, mint, owner, instructions)

                    sendTransaction(connection, wallet, instructions, [], true);
                  }}
                >
                  Mark as Sold
                </Button> */}

            {/* TODO: Add conversion of MasterEditionV1 to MasterEditionV2 */}
            <ArtMinting
              id={id}
              key={remountArtMinting}
              onMint={async () => await setRemountArtMinting(prev => prev + 1)}
            />
          </Col>
          <Col span="12">
            <Divider />
            {art.creators?.find(c => !c.verified) && unverified}
            <br />
            <div className="info-header">ABOUT THE CREATION</div>
            <div className="info-content">{description}</div>
            <br />
            {/*
              TODO: add info about artist


            <div className="info-header">ABOUT THE CREATOR</div>
            <div className="info-content">{art.about}</div> */}
          </Col>
          <Col span="12">
            {attributes && (
              <>
                <Divider />
                <br />
                <div className="info-header">Attributes</div>
                <List size="large" grid={{ column: 4 }}>
                  {attributes.map(attribute => (
                    <List.Item>
                      <List.Item.Meta
                        title={attribute.trait_type}
                        description={attribute.value}
                      />
                    </List.Item>
                  ))}
                </List>
              </>
            )}
          </Col>
        </Row>
      </Col>
    </Content>
  );
};
