import Script from 'next/script';

import type { AnalyticsConfig } from '@/features/analytics/types';

export default function GoogleTagScripts({ config }: { config: AnalyticsConfig }) {
  const google = config.google;
  if (!google.enabled) return null;

  return (
    <>
      {google.gtmEnabled && google.gtmContainerId ? (
        <>
          <Script id="app-hub-gtm" strategy="afterInteractive">
            {`
              (function(w,d,s,l,i){
                w[l]=w[l]||[];
                w[l].push({'gtm.start': new Date().getTime(), event:'gtm.js'});
                var f=d.getElementsByTagName(s)[0], j=d.createElement(s), dl=l!='${google.dataLayerName}'?'&l='+l:'';
                j.async=true;
                j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
                f.parentNode.insertBefore(j,f);
              })(window,document,'script','${google.dataLayerName}','${google.gtmContainerId}');
            `}
          </Script>
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(google.gtmContainerId)}`}
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
              title="Google Tag Manager"
            />
          </noscript>
        </>
      ) : null}

      {google.gaEnabled && google.gaMeasurementId ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(google.gaMeasurementId)}`}
            strategy="afterInteractive"
          />
          <Script id="app-hub-ga4" strategy="afterInteractive">
            {`
              window.${google.dataLayerName} = window.${google.dataLayerName} || [];
              function gtag(){${google.dataLayerName}.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${google.gaMeasurementId}', { send_page_view: ${google.sendPageView ? 'true' : 'false'} });
            `}
          </Script>
        </>
      ) : null}
    </>
  );
}
