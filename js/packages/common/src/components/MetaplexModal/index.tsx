import React from 'react';
import { Modal } from 'antd';

export const MetaplexModal = (props: any) => {
  const { children, bodyStyle, ...rest } = props;

  return (
    <Modal
      bodyStyle={{
        display: 'flex',
        flexDirection: 'column',

        ...bodyStyle,
      }}
      footer={null}
      width={500}
      {...rest}
    >
      {children}
    </Modal>
  );
};
