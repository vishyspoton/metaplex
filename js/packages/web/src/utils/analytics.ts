// a test GA4 Id to see if it works in the staging test app
export const GOOGLE_ANALYTICS_ID =
  process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID || 'G-HLNC4C2YKN';
export let analyticsInitialized = false;

export let analyticsUserId: string | undefined = '';
export let network: string = '';

// custom dimensions and metrics
type AnalyticsOptions = {
  // user dimensions
  user_id: string; // google reserved
  pubkey: string; // same as user_id, but for use in custom reports
} & CustomEventDimensions;

interface CustomEventDimensions {
  // event dimensions
  store_domain: string;
  storefront_pubkey: string;
  network: string; // mainnet, devnet, etc.
  // metrics
  sol_value?: number;
}

export function initializeAnalytics(opts: {
  subdomain: string;
  storefront_pubkey: string;
}) {
  if (!analyticsInitialized) {
    configureAnalytics({
      store_domain: opts.subdomain,
      storefront_pubkey: opts.storefront_pubkey,
    });
    analyticsInitialized = true;
  }
}

export function setAnalyticsUserId(userId: string) {
  configureAnalytics({ user_id: userId, pubkey: userId });
  analyticsUserId = userId;
  // analyticsConfig.user_id = userId;
}

export function setNetwork(n: string) {
  configureAnalytics({
    network: n,
  });
  network = n;
}

export function configureAnalytics(options: Partial<AnalyticsOptions>) {
  console.log('analytics configured');
  if (!window['gtag']) return;
  window['gtag']('config', GOOGLE_ANALYTICS_ID, {
    ...options,
    send_page_view: false,
  });
  // analyticsConfig = {
  //   ...analyticsConfig,
  //   ...options
  // }
}

export function track(
  action: string,
  attributes?: {
    category?: string;
    label?: string;
    value?: number;
    [key: string]: string | number | undefined | any[];
  } & Partial<CustomEventDimensions>,
) {
  console.log('event', action, {
    event_category: attributes?.category,
    event_label: attributes?.label,
    value: attributes?.value,
    ...attributes,
  });
  if (!window['gtag']) return;
  // return;
  window['gtag']('event', action, {
    event_category: attributes?.category,
    event_label: attributes?.label,
    value: attributes?.value,
    ...attributes,
  });
}

export function pageview(path: string) {
  if (!window['gtag']) return;
  window['gtag']('event', 'page_view', {
    page_location: window.location.href, // important to overwrite to keep fragments
    page_path: path, // React router provides the # route as a regular path
  });
}

// export let analyticsConfig = {
//   user_id: '',
//   pubkey: '',
//   store_domain: '',
//   storefront_pubkey: '',
//   network: ''
// };

// import _ from "lodash";
// export function objectDiff(object, base) {
// 	function changes(object, base) {
// 		return _.transform(object, function(result: any, value:any, key:string) {
// 			if (!_.isEqual(value, base[key])) {
// 				result[key] = (_.isObject(value) && _.isObject(base[key])) ? changes(value, base[key]) : value;
// 			}
// 		});
// 	}
// 	return changes(object, base);
// }
