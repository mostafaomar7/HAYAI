export const environment = {
  production: true,
  // TEMPORARY — `api.hayai.com` is parked on Sedo nameservers, so it resolves
  // to a parking IP with no certificate and every request dies on connect.
  // Pointing at the backend's Hostinger domain until the registrar moves the
  // nameservers and an SSL cert is issued for api.hayai.com, then switch back:
  //   apiBaseUrl: 'https://api.hayai.com/api/v1'
  apiBaseUrl: 'https://paleturquoise-wolf-589691.hostingersite.com/api/v1'
};
