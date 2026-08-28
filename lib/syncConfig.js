// File: lib/syncConfig.js → ~/Projects/thefilterlist/lib/syncConfig.js
//
// Where sync points and what it authenticates with.
//
// v1: one shared bearer token, entered by hand on the Sync settings screen.
// v2: the token is minted per-user after Sign in with Apple / Google, and this
// module's shape doesn't change — only where the value comes from.
//
// STORAGE CHOICE, stated plainly: the token lives in AsyncStorage, not
// expo-secure-store. AsyncStorage is unencrypted app-private storage — fine
// against another app on the device, not against someone with a jailbroken
// phone or a filesystem backup. expo-secure-store is the correct home for a
// credential, and the reason it isn't used yet is that it's a native module and
// adding it forces a prebuild and a rebuild of both platforms.
//
// This is a real (small) tradeoff, deliberately deferred, and it must close
// before v2 ships — at that point the token is a per-user credential rather than
// one developer's own, which is a different risk entirely. The swap is confined
// to getToken/setToken/clearToken below.

import AsyncStorage from '@react-native-async-storage/async-storage';

const URL_KEY   = 'thefilterlist.sync.url';
const TOKEN_KEY = 'thefilterlist.sync.token';
const ENABLED_KEY = 'thefilterlist.sync.enabled';

// Default endpoint. Overridable from the settings screen so a dev build can
// point at a local wrangler instance without a rebuild.
//
// A saved address in AsyncStorage OVERRIDES this, which matters when changing
// it: bumping the default does NOT move a device that has already stored one.
// Changing endpoints is a three-step sequence — add the new route and deploy so
// both URLs work, update every device, and only then retire the old route.
// Retiring first strands every device that hasn't been touched yet.
export const DEFAULT_SYNC_URL = 'https://sync.thefilterlist.app';

export async function getConfig() {
  try {
    const [[, url], [, token], [, enabled]] = await AsyncStorage.multiGet(
      [URL_KEY, TOKEN_KEY, ENABLED_KEY]
    );
    return {
      url: (url || DEFAULT_SYNC_URL).replace(/\/+$/, ''),
      token: token || null,
      // Sync is OFF until the user turns it on. A build that quietly started
      // talking to a server the moment it was installed would be the wrong
      // default for something that ships to other people.
      enabled: enabled === '1',
    };
  } catch (e) {
    console.warn('[TFL sync] getConfig failed', e);
    return { url: DEFAULT_SYNC_URL, token: null, enabled: false };
  }
}

export async function setToken(token) {
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token.trim());
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function setUrl(url) {
  if (url) await AsyncStorage.setItem(URL_KEY, url.trim().replace(/\/+$/, ''));
  else await AsyncStorage.removeItem(URL_KEY);
}

export async function setEnabled(on) {
  await AsyncStorage.setItem(ENABLED_KEY, on ? '1' : '0');
}

/** Wipe every trace of sync config from this device. Used by "disconnect". */
export async function clearConfig() {
  await AsyncStorage.multiRemove([URL_KEY, TOKEN_KEY, ENABLED_KEY]);
}

export function isConfigured(config) {
  return !!(config && config.enabled && config.url && config.token);
}
