export const GOOGLE_ANALYTICS_ID = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID;

export let analyticsInitialized = false;
export let analyticsUserId: string | undefined = '';

export const analyticsConfig = {
  userId: undefined,
  subdomain: undefined,
};

export function initializeAnalytics(opts: { subdomain: string }) {
  if (!analyticsInitialized) {
    configureAnalytics({
      store_domain: opts.subdomain,
    });
    analyticsInitialized = true;
  }
}

export function setAnalyticsUserId(userId: string) {
  configureAnalytics({ user_id: userId, pubkey: userId });
  analyticsUserId = userId;
}

export function configureAnalytics(options: {
  user_id?: string;
  pubkey?: string;
  store_domain?: string;
}) {
  console.log('analytics configured');
  window['gtag']('config', GOOGLE_ANALYTICS_ID, {
    ...options,
    send_page_view: false,
  });
}

export function track(
  action: string,
  attributes?: {
    category?: string;
    label?: string;
    value?: number;
    [key: string]: string | number | undefined;
  },
) {
  console.log('event', action, {
    event_category: attributes?.category,
    event_label: attributes?.label,
    value: attributes?.value,
    ...attributes,
  });
  return;
  window['gtag']('event', action, {
    event_category: attributes?.category,
    event_label: attributes?.label,
    value: attributes?.value,
    ...attributes,
  });
}

export function pageview(path: string) {
  window['gtag']('event', 'page_view', {
    page_location: window.location.href, // important to overwrite to keep fragments
    page_path: path, // React router provides the # route as a regular path
  });
}
