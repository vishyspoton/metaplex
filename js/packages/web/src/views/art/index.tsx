import React, { ReactChild, useMemo, useState } from 'react';
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
  useApproveNFT,
  useHasTreasury,
  useTreasuryInfo,
} from '../../utils/treasury';
import { useMeta } from '../../contexts';
import { PublicKey } from '@solana/web3.js';

const { Content } = Layout;

export const ArtView = () => {
  const { whitelistedCreatorsByCreator } = useMeta();
  const { endpoint } = useConnectionConfig();
  const { id } = useParams<{ id: string }>();
  const wallet = useWallet();
  const treasuryInfo = useTreasuryInfo();
  const hasTreasury = useHasTreasury(whitelistedCreatorsByCreator);
  const { status: treasuryApproveStatus, approveNFT } = useApproveNFT();
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
  const shouldVerifyTreasury =
    isCreator &&
    !(art.creators?.find(c => c.address === treasuryInfo?.pubkey)?.verified ??
      true);

  // NOTE: this is debounced by useApproveNFT
  if (hasTreasury && treasuryInfo && shouldVerifyTreasury) {
    approveNFT({
      endpoint: treasuryInfo.approve,
      solanaEndpoint: endpoint,
      metadata: new PublicKey(id),
      metaProgramId: new PublicKey(programIds().metadata),
    });
  }

  const treasuryStatus = useMemo<
    undefined | 'APPROVING' | 'APPROVAL ERROR' | 'TREASURY'
  >(() => {
    if (!hasTreasury) return undefined;
    if (!shouldVerifyTreasury) return 'TREASURY';

    switch (treasuryApproveStatus) {
      case undefined:
      case 'approving':
        return 'APPROVING';
      case 'approved':
        return 'TREASURY';
      case 'failed':
        return 'APPROVAL ERROR';
    }
  }, [hasTreasury, treasuryInfo, shouldVerifyTreasury, treasuryApproveStatus]);

  const treasuryTag = useMemo(() => {
    let color: TagProps['color'];

    switch (treasuryStatus) {
      case undefined:
        color = undefined;
        break;
      case 'APPROVAL ERROR':
        color = 'red';
        break;
      default:
        color = 'blue';
        break;
    }

    return (
      <div className="info-header">
        <Tag color={color}>{treasuryStatus}</Tag>
      </div>
    );
  }, [treasuryStatus]);

  let treasuryUnverified: ReactChild | undefined;

  switch (treasuryStatus) {
    case undefined:
    case 'TREASURY':
      break;
    case 'APPROVING':
      treasuryUnverified = (
        <i>Approval requested from the Holaplex treasury account...</i>
      );
      break;
    case 'APPROVAL ERROR':
      treasuryUnverified = (
        <Typography.Text type="danger">
          Holaplex approval request failed, reload to try again.
        </Typography.Text>
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
      {treasuryUnverified && (
        <>
          <br />
          <div style={{ fontSize: 12 }}>{treasuryUnverified}</div>
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
                  {(art.creators || []).map((creator, idx) => {
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
                              (creator.address === treasuryInfo?.pubkey &&
                                treasuryStatus)) &&
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
                              ) : hasTreasury &&
                                creator.address === treasuryInfo?.pubkey ? (
                                treasuryTag
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
