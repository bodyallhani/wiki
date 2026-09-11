/* Public settings only. A GA4 measurement ID is not a password or API secret. */
(function(root){
  'use strict';
  const config={
    enabled:false,
    measurementId:'',
    propertyId:'',
    reportsURL:'',
    realtimeURL:'',
    dashboardURL:'',
    allowedHost:'wiki.body-all.co.kr',
    basePath:'/contents/bodyall-clinic/',
    version:'huata-stats1'
  };
  root.HuataAnalyticsConfig=config;
  if(typeof module!=='undefined'&&module.exports)module.exports=config;
})(typeof globalThis!=='undefined'?globalThis:window);
