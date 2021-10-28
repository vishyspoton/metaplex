import React from 'react';
import { Routes } from './routes';
import { Storefront } from '@oyster/common';

interface AppProps {
  storefront: Storefront;
}

function App({ storefront }: AppProps) {
  return <Routes storefront={storefront} />;
}

export default App;
