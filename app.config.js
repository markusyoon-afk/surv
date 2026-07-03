// Extends app.json; SURV_BASE_URL lets CI build for a subpath
// (GitHub Pages serves at /surv) without affecting local dev builds.
const appJson = require('./app.json');

module.exports = () => {
  const config = { ...appJson.expo };
  if (process.env.SURV_BASE_URL) {
    config.experiments = { ...(config.experiments || {}), baseUrl: process.env.SURV_BASE_URL };
  }
  return config;
};
