import React, { useContext, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { ENDPOINTS, useConnectionConfig, useStore } from '@oyster/common';
import { useLocation } from 'react-router';
import { useSolPrice } from '../../contexts';
import { Gtag } from './gtag.interface';

export const GOOGLE_ANALYTICS_ID =
  process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID || 'G-HLNC4C2YKN';

interface AnalyticsUserProperties {
  // user dimensions
  user_id: string; // google reserved
  pubkey: string; // same as user_id, but for use in custom reports
}
interface CustomEventDimensions {
  // event dimensions
  store_domain: string;
  store_title: string;
  storefront_pubkey: string;
  is_store_owner: boolean;
  network: string; // mainnet, devnet, etc.
  // metrics
  sol_value?: number;
}

const AnalyticsContext = React.createContext<{
  configureAnalytics: (options: CustomEventDimensions) => void;
  pageview: (path: string) => void;
  track: (action: string, attributes: { [key: string]: any }) => void;
} | null>(null);

// @ts-ignore
const gtag = window.gtag as Gtag;

export function AnalyticsProvider(props: { children: React.ReactNode }) {
  const { publicKey } = useWallet();
  const { storefront } = useStore();
  const { endpoint } = useConnectionConfig();
  const location = useLocation();
  const solPrice = useSolPrice();

  // user pubkey / id
  const pubkey = publicKey?.toBase58() || '';
  const endpointName = ENDPOINTS.find(e => e.endpoint === endpoint)?.name;

  const storefrontGA4Id =
    storefront.integrations?.ga4 ||
    process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID_FOR_STORE;

  // runs everytime pubkey changes (wallet connect / disconnect) or endpoint is changed (devnet / mainnet)
  useEffect(() => {
    setUserProperties({
      user_id: pubkey,
      pubkey: pubkey,
    });

    const storeConfig = {
      is_store_owner: pubkey === storefront.pubkey,
      network: endpointName,
      store_domain: storefront.subdomain,
      store_title: storefront.meta.title,
      storefront_pubkey: storefront.pubkey,
    };
    configureAnalytics(storeConfig);

    // if STORE_SPECIFIC_GA4_ID detected,
    if (storefrontGA4Id) {
      // setup same config for Store Owners automatically
      configureAnalytics(storeConfig, storefrontGA4Id);
    }
  }, [pubkey, endpointName]);

  useEffect(() => {
    pageview(location.pathname);
  }, [location.pathname]);

  function setUserProperties(attributes: AnalyticsUserProperties) {
    gtag('set', 'user_properties', {
      ...attributes,
    });
  }

  function configureAnalytics(
    options: Partial<CustomEventDimensions> & {
      groups?: 'all' | 'holaplex' | 'store_owner';
    },
    googleAnalyticsId: string = GOOGLE_ANALYTICS_ID,
  ) {
    if (!gtag) return;
    gtag('config', googleAnalyticsId, {
      ...options,
      send_page_view: false,
    });
  }

  function pageview(path: string) {
    if (!gtag) return;
    track('page_view', {
      path: path, // React router provides the # route as a regular path
    });
  }

  function track(
    action: string,
    attributes: {
      category?: string;
      label?: string;
      value?: number;
      sol_value?: number;
      [key: string]: string | number | undefined;
    } & Partial<CustomEventDimensions> = {},
  ) {
    if (!gtag) return;
    const { category, label, sol_value, value, ...otherAttributes } =
      attributes;

    console.log(
      'dev track',
      action,
      {
        send_to: [GOOGLE_ANALYTICS_ID].concat(
          storefrontGA4Id ? [storefrontGA4Id] : [],
        ),
      },
      attributes,
    );

    gtag('event', action, {
      send_to: [GOOGLE_ANALYTICS_ID].concat(
        storefrontGA4Id ? [storefrontGA4Id] : [],
      ),
      page_location: window.location.href, // important to overwrite to keep fragments
      // Event specific
      event_category: category,
      event_label: label,
      ...(sol_value && solPrice
        ? {
            value: sol_value * solPrice, //Google Analytics likes this one in USD :)
            sol_value: attributes.sol_value,
            sol_value_dimension: attributes.sol_value,
          }
        : {
            value,
          }),
      ...otherAttributes,
    });
  }

  return (
    <AnalyticsContext.Provider
      value={{
        configureAnalytics,
        track,
        pageview,
      }}
    >
      {props.children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalytics() {
  const context = useContext(AnalyticsContext);
  if (context === null) {
    throw new Error('useAnalytics must be used within an AnalyticsProvider');
  }
  return context;
}
