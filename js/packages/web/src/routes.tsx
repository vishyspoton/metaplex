import { HashRouter, Route, Switch } from 'react-router-dom';
import { Storefront } from '@oyster/common';
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
import { analyticsInitialized, analyticsUserId, initializeAnalytics, pageview, setAnalyticsUserId } from './utils/analytics';
import { useWallet } from '@solana/wallet-adapter-react';

interface RoutesProps {
  storefront: Storefront;
}

const Analytics = ({ storefront }: RoutesProps) => {
  const { publicKey, connected } = useWallet();
  const pubkey = publicKey?.toBase58() || '';
  const location = useLocation();
  useEffect(() => {
    if(!analyticsInitialized) {
      initializeAnalytics({subdomain: storefront.subdomain})
    }
    // basic "sign in / out check"
    if(pubkey !== analyticsUserId) {
      setAnalyticsUserId(pubkey)
    }
    pageview(location.pathname)
  }, [location]);

  return <></>;
};

export function Routes({ storefront }: RoutesProps) {
  return (
    <>
      <HashRouter basename={'/'}>
        <Analytics storefront={storefront} />
        <Providers storefront={storefront}>
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
