/* Public settings only. A GA4 measurement ID is not a password or API secret. */
(function(root){
  'use strict';
  const config={
    enabled:true,
    measurementId:'G-0G4B7G6K2T',
    propertyId:'553746606',
    reportsURL:'https://analytics.google.com/analytics/web/#/a378649059p553746606/reports/explorer?params=_u..nav%3Dmaui&collectionId=games&r=15760229410&discardConfirmed=true',
    realtimeURL:'https://analytics.google.com/analytics/web/#/a378649059p553746606/realtime/overview?params=_u..nav%3Dmaui',
    dashboardURL:'',
    allowedHost:'wiki.body-all.co.kr',
    basePath:'/contents/bodyall-clinic/',
    version:'huata-stats1'
  };
  root.HuataAnalyticsConfig=config;
  if(typeof module!=='undefined'&&module.exports)module.exports=config;
})(typeof globalThis!=='undefined'?globalThis:window);
