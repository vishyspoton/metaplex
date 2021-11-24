import React, { createContext, useContext, FC } from 'react';
import { StringPublicKey } from '../utils';


interface HolaplexConfig {
  address?: StringPublicKey;
  share: number;
}

export const HolaplexContext = createContext<HolaplexConfig>({ share: 2 });

export const HolaplexProvider: FC<{
  address?: StringPublicKey;
}> = ({ address, children }) => {


  return (
    <HolaplexContext.Provider
      value={{
        address,
        share: 2,
      }}
    >
      {children}
    </HolaplexContext.Provider>
  );
};

export const useHolaplex = () => {
  return useContext(HolaplexContext);
};
