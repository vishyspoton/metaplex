import { HashRouter, Route, Switch } from 'react-router-dom';
import { ENDPOINTS, Storefront, useConnection, useConnectionConfig } from '@oyster/common';
import { Providers } from './providers';
import {
  ArtCreateView,
  ArtistView,
  ArtView,
  ArtworksView,
  AuctionCreateView,
  AuctionView,
  HomeView,
} from './views';
import { AdminView } from './views/admin';
import { BillingView } from './views/auction/billing';

import { useLocation } from 'react-router';
import { useEffect } from 'react';
import { analyticsInitialized, analyticsUserId, initializeAnalytics, network, pageview, setAnalyticsUserId, setNetwork } from './utils/analytics';
import { useWallet } from '@solana/wallet-adapter-react';

interface RoutesProps {
  storefront: Storefront;
}

const Analytics = ({ storefront }: RoutesProps) => {
  const { publicKey, connected } = useWallet();
  const pubkey = publicKey?.toBase58() || '';
  const {endpoint} =useConnectionConfig();
  const endpointName = ENDPOINTS.find(e => e.endpoint === endpoint)?.name

  if(!analyticsInitialized) {
    initializeAnalytics({subdomain: storefront.subdomain, storefront_pubkey: storefront.pubkey,})
  }
  
  
  const location = useLocation();
  useEffect(() => {
    console.log({
      newLocation: location.pathname,
      actual: {
        pubkey,
        endpoint,
        endpointName,
        connected,
        isOwner: storefront.pubkey === pubkey
      },
      analytics: {
        analyticsInitialized,
        analyticsUserId,
        network
      }
    })
    // basic "sign in / out check"
    if(pubkey !== analyticsUserId) {
      setAnalyticsUserId(pubkey, pubkey === storefront.pubkey)
    }
    if(endpointName && endpointName !== network) {
      setNetwork(endpointName)
    }
    pageview(location.pathname)
  }, [location]);

  return <></>;
};

export function Routes({ storefront }: RoutesProps) {
  return (
    <>
      <HashRouter basename={'/'}>
        <Providers storefront={storefront}>
          <Analytics storefront={storefront} />
          <Switch>
            <Route exact path="/admin" component={() => <AdminView />} />
            <Route
              exact
              path="/artworks/new/:step_param?"
              component={() => <ArtCreateView />}
            />
            <Route exact path="/owned" component={() => <ArtworksView />} />
            <Route exact path="/artworks/:id" component={() => <ArtView />} />
            <Route path="/artists/:id" component={() => <ArtistView />} />
            <Route
              exact
              path="/auction/create/:step_param?"
              component={() => <AuctionCreateView />}
            />
            <Route
              exact
              path="/auction/:id"
              component={() => <AuctionView />}
            />
            <Route
              exact
              path="/auction/:id/billing"
              component={() => <BillingView />}
            />
            <Route path="/" component={() => <HomeView />} />
          </Switch>
        </Providers>
      </HashRouter>
    </>
  );
}
