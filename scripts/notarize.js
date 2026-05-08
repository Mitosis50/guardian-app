// TODO: Requires: npm install --save-dev @electron/notarize

'use strict';

exports.default = async function afterSign(context) {
  const { APPLE_ID, APPLE_TEAM_ID, APPLE_APP_SPECIFIC_PASSWORD } = process.env;

  if (!APPLE_ID || !APPLE_TEAM_ID || !APPLE_APP_SPECIFIC_PASSWORD) {
    console.warn('Notarization skipped — APPLE_ID/APPLE_TEAM_ID/APPLE_APP_SPECIFIC_PASSWORD not set');
    return;
  }

  const { notarize } = require('@electron/notarize');
  const appId = context.packager.appInfo.id;
  const appPath = `${context.appOutDir}/${context.packager.appInfo.productFilename}.app`;

  console.log(`Submitting ${appPath} for Apple notarization...`);

  await notarize({
    appBundleId: appId,
    appPath,
    appleId: APPLE_ID,
    appleIdPassword: APPLE_APP_SPECIFIC_PASSWORD,
    teamId: APPLE_TEAM_ID,
  });

  console.log('Apple notarization completed.');
};
