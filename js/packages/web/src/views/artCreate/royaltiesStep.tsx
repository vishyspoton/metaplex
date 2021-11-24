import {
  Creator,
  IMetadataExtension,
  MetaplexModal,
  shortenAddress,
  useStore,
  useHolaplex,
  useMeta,
  StringPublicKey,
  notify,
} from '@oyster/common';
import { partition, without } from 'lodash';
import { useWallet } from '@solana/wallet-adapter-react';
import Image from 'next/image';
import { Button, Col, InputNumber, Row, Slider, Space, Typography, Dropdown, Menu, Divider, Tag } from 'antd';
import Icon from '@ant-design/icons';
import React, { useEffect, useState, useMemo } from 'react';
import { PlusOutlined, CloseOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface Royalty {
  creatorKey: string;
  amount: number;
}

const RoyaltiesSplitter = (props: {
  royalties: Royalty[];
  setRoyalties: (value: number, pubkey: StringPublicKey) => void;
  removeRoyalty: (pubkey: StringPublicKey) => void;
  isShowErrors?: boolean;
}) => {
  return (
    <Col>
      <Row gutter={[0, 24]}>
        {props.royalties.map(({ creatorKey, amount }, idx) => {
          const label = shortenAddress(creatorKey);

          const handleChange = (next: number) => {
            props.setRoyalties(next, creatorKey);
          };

          const handleRemove = () => {
            props.removeRoyalty(creatorKey);
          }

          return (
            <Col span={24} key={creatorKey}>
              <Space direction="horizontal" size="middle">
                {label}
                <InputNumber<number>
                  min={0}
                  max={100}
                  formatter={value => `${value}%`}
                  value={amount}
                  parser={value => parseInt(value?.replace('%', '') ?? '0')}
                  onChange={handleChange}
                />
                <Slider className="metaplex-royalties-slider" value={amount} onChange={handleChange} />
                <Button shape="circle" type="ghost" icon={<CloseOutlined />} onClick={handleRemove} />
                {props.isShowErrors && amount === 0 && (
                  <Text type="danger">
                    The split percentage for this creator cannot be 0%.
                  </Text>
                )}
              </Space>
            </Col>
          );
        })}
      </Row>
    </Col>
  );
};

export const RoyaltiesStep = (props: {
  attributes: IMetadataExtension;
  setAttributes: (attr: IMetadataExtension) => void;
  confirm: () => void;
}) => {
  const { storefront } = useStore()
  const { address: holaplexAddress, share: holaplexShare } = useHolaplex();
  const { publicKey, connected } = useWallet();
  const { whitelistedCreatorsByCreator } = useMeta();
  const [royalties, setRoyalties] = useState<Array<Royalty>>([]);
  const [isShowErrors, setIsShowErrors] = useState<boolean>(false);
  const [sellerFeeBasisPoints, setSellerFeeBasisPoints] = useState<number>(1000);

  const revenueShareEnabled = holaplexAddress && storefront.revenueShare;

  useEffect(() => {
    let royalties: Royalty[] = [];

    if (publicKey) {
      const key = publicKey.toBase58();

      royalties = [
        {
          creatorKey: key,
          amount: 100 - (revenueShareEnabled ? holaplexShare : 0),
        },
        ...royalties,
      ];
    }

    if (revenueShareEnabled) {
      royalties = [
        {
          creatorKey: holaplexAddress,
          amount: holaplexShare,
        },
        ...royalties,
      ];
    }

    setRoyalties(royalties);
  }, [connected, storefront, holaplexAddress]);


  const totalRoyaltyShares = useMemo(() => {
    // When royalties changes, sum up all the amounts.
    const total = royalties.reduce((totalShares, royalty) => {
      return totalShares + royalty.amount;
    }, 0);

    return total;
  }, [royalties]);

  useEffect(() => {
    props.setAttributes({
      ...props.attributes,
      seller_fee_basis_points: sellerFeeBasisPoints
    })
  }, [sellerFeeBasisPoints]);

  const [[holaplexRoyalty], selectedRoyalties] = partition(royalties, ({ creatorKey }) => creatorKey === holaplexAddress);
  const selectable = useMemo(() => {
    const creators = Object.values(whitelistedCreatorsByCreator).map(({ pubkey }) => pubkey);
    const selected = selectedRoyalties.map(({ creatorKey }) => creatorKey);

    return without(creators, ...selected);
  }, [whitelistedCreatorsByCreator, selectedRoyalties]);


  return (
    <Space className="metaplex-fullwidth" direction="vertical">
      <div>
        <h2>Set royalties and creator splits</h2>
        <p>
          Royalties ensure that you continue to get compensated for your work
          after its initial sale.
        </p>
      </div>
      <label>
        <h3>Royalty Percentage</h3>
        <p>
          This is how much of each secondary sale will be paid out to the
          creators.
        </p>
        <InputNumber<number>
          autoFocus
          min={0}
          max={100}
          formatter={v => `${v}%`}
          defaultValue={10}
          parser={v => parseInt(v?.replace('%', '') ?? '0')}
          onChange={(val: number) => setSellerFeeBasisPoints(val * 100)}
        />
      </label>
      <div>
        <label>
          <h3>Creators Split</h3>
          <p>
            This is how much of the proceeds from the initial sale and any
            royalties will be split out amongst the creators.
          </p>
          {holaplexRoyalty && (
            <Tag
              color="default"
              icon={<Icon component={() => <Image src="/holaplex-logo.svg" width={12} height={12} />} />}
            > 
              <Space direction="horizontal" size="small">
                Holaplex
                {`${holaplexRoyalty.amount}%`}
              </Space>
            </Tag>
          )}
          <RoyaltiesSplitter
            royalties={selectedRoyalties}
            setRoyalties={(amount, pubkey) => {
              const nextRoyalties = royalties.map((royalty) => {
                if (royalty.creatorKey === pubkey) {
                  return { ...royalty, amount };
                }

                return royalty;
              });

              setRoyalties(nextRoyalties);
            }}
            isShowErrors={isShowErrors}
          />
        </label>
      </div>
      <Row>
        <Dropdown overlay={(
          <Menu
            onClick={({ key }) => {
              if (totalRoyaltyShares >= 100) {
                notify({ message: 'The royalty split is already at 100%.', type: "warning" })
                return;
              }

              setRoyalties([...royalties, { creatorKey: key, amount: 100 - totalRoyaltyShares }]);
            }}
          >
            {selectable.map((pubkey) => (
              <Menu.Item key={pubkey}>
                {shortenAddress(pubkey)}
              </Menu.Item>
            ))}
          </Menu>
        )} placement="bottomCenter" arrow>
          <Button icon={<PlusOutlined />} type="ghost" disabled={selectable.length === 0}>Co-Creator</Button>
        </Dropdown>
        <Divider />
        <Space direction="horizontal" size="small">
          <Typography.Text strong>Current Split:</Typography.Text> {`${totalRoyaltyShares}%`}
        </Space>
      </Row>
      {isShowErrors && totalRoyaltyShares !== 100 && (
        <Row>
          <Text type="danger">
            The split percentages for each creator must add up to 100%.
          </Text>
        </Row>
      )}
      <Row>
        <Button
          className="metaplex-fullwidth"
          type="primary"
          size="large"
          onClick={() => {
            // Find all royalties that are invalid (0)
            const zeroedRoyalties = royalties.filter(
              royalty => royalty.amount === 0,
            );

            if (zeroedRoyalties.length !== 0 || totalRoyaltyShares !== 100) {
              // Contains a share that is 0 or total shares does not equal 100, show errors.
              setIsShowErrors(true);
              return;
            }

            const creatorStructs: Creator[] = [
              ...royalties,
            ].map(
              c =>
                new Creator({
                  address: c.creatorKey,
                  verified: c.creatorKey === publicKey?.toBase58(),
                  share: c.amount,
                }),
            );

            props.setAttributes({
              ...props.attributes,
              creators: creatorStructs,
            });
            props.confirm();
          }}
        >
          Continue to review
        </Button>
      </Row>
    </Space>
  );
};
