// File: app/settings/sync.js → ~/Projects/thefilterlist/app/settings/sync.js
//
// Sync settings.
//
// Sync is OFF until turned on here, and the app is fully usable with it off —
// that isn't a limitation to apologise for, it's the design. Everything on this
// screen is optional.
//
// FEEDBACK: every button on this screen either changes state visibly or shows a
// dialog. Save greys out once there's nothing to save; Test reports in a dialog,
// not a line of text somewhere below the fold. An action that appears to do
// nothing is worse than one that fails loudly — the user repeats it, or assumes
// it worked when it didn't.
//
// WHAT THIS SCREEN DELIBERATELY DOESN'T DO:
//   No live status indicator, no "syncing…" spinner elsewhere in the app, no
//   error toast when the network drops. A background sync that fails is not an
//   event the user needs to handle — it retries. Here is the one place a failure
//   is ever surfaced, because here is where someone came looking for it.

import React, { useState, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, TextInput, Switch,
  Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../../theme/theme';
import { BackButton } from '../../components/HeaderBits';
import {
  getConfig, setToken, setUrl, setEnabled, clearConfig, DEFAULT_SYNC_URL,
} from '../../lib/syncConfig';
import { syncNow, testConnection, deleteCloudData } from '../../lib/syncClient';
import { loadData, saveData } from '../../data/store';
import { resetSyncState, getSyncMeta } from '../../lib/sync';
import useFixScrollToTop from '../../lib/useFixScrollToTop';

function describe(result) {
  if (!result) return null;
  if (result.ok) {
    const bits = [];
    if (result.pushed) bits.push(`${result.pushed} sent`);
    if (result.pulled) bits.push(`${result.pulled} received`);
    const p = result.photos || {};
    const photos = (p.uploaded || 0) + (p.downloaded || 0);
    if (photos) bits.push(`${photos} photo${photos === 1 ? '' : 's'}`);
    return bits.length ? `Synced — ${bits.join(', ')}.` : 'Already up to date.';
  }
  switch (result.reason) {
    case 'disabled':       return 'Sync is turned off.';
    case 'not_configured': return 'Add your sync address and token first.';
    case 'network':        return "Couldn't reach the server. It'll try again.";
    case 'timeout':        return "The server took too long. It'll try again.";
    case 'http_401':       return 'The token was rejected. Check it below.';
    case 'load_failed':    return "Couldn't read the data on this device.";
    default:               return `Sync didn't finish (${result.reason}).`;
  }
}

export default function SyncSettings() {
  const t = useTheme();
  const s = makeStyles(t);
  const router = useRouter();
  const scrollsToTop = useFixScrollToTop();

  const [enabled, setEnabledState] = useState(false);
  const [url, setUrlState] = useState(DEFAULT_SYNC_URL);
  const [token, setTokenState] = useState('');
  // What's actually persisted. Comparing against this is what lets Save go grey
  // when there's nothing to save — the clearest possible "yes, that's stored".
  const [savedUrl, setSavedUrl] = useState(DEFAULT_SYNC_URL);
  const [savedToken, setSavedToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [cursor, setCursor] = useState(0);

  const dirty = url.trim() !== savedUrl || token.trim() !== savedToken;
  const hasCreds = !!(savedUrl && savedToken);

  const refresh = useCallback(async () => {
    const c = await getConfig();
    setEnabledState(c.enabled);
    setUrlState(c.url);
    setSavedUrl(c.url);
    setTokenState(c.token || '');
    setSavedToken(c.token || '');
    try {
      const d = await loadData();
      setCursor(getSyncMeta(d).cursor);
    } catch (_) { /* leave as-is */ }
  }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const onToggle = async (on) => {
    setEnabledState(on);
    await setEnabled(on);
    setStatus(on
      ? 'Sync is on. It runs when the app opens and after you make changes.'
      : 'Sync is off. Your data stays on this device.');
  };

  const onSave = async () => {
    await setUrl(url);
    await setToken(token);
    setSavedUrl(url.trim());
    setSavedToken(token.trim());
    setStatus(null);
    Alert.alert('Saved', 'Your sync address and token are stored on this device.');
  };

  const onTest = async () => {
    setBusy(true);
    // Test what's on screen, not what was last saved — otherwise editing the
    // token and hitting Test would silently check the old one.
    await setUrl(url);
    await setToken(token);
    setSavedUrl(url.trim());
    setSavedToken(token.trim());
    const c = await getConfig();
    const r = await testConnection(c);
    setBusy(false);
    if (r.ok) {
      Alert.alert('Connection works', 'The server accepted this address and token.');
    } else if (r.reason === 'bad_token') {
      Alert.alert('Token rejected', 'The server is reachable, but it refused this token. Check for a stray space or a missing character.');
    } else {
      Alert.alert('Server unreachable', "Couldn't reach that address. Check the address and your network connection.");
    }
  };

  const onSyncNow = async () => {
    setBusy(true);
    const r = await syncNow();
    setBusy(false);
    setStatus(describe(r));
    refresh();
  };

  // Disconnect: stop syncing, forget the credentials. Local data untouched, and
  // the server copy left alone. Deliberately distinct from deletion.
  const onDisconnect = () => {
    Alert.alert(
      'Disconnect this device?',
      'Sync will stop and the token will be removed from this device.\n\n'
      + 'Your filters stay here, and the copy on the server is left alone. You '
      + 'can reconnect later with the same token.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            await disconnectDevice();
            Alert.alert('Disconnected', 'Sync is off and the token has been removed. Your filters are still here.');
          },
        },
      ]
    );
  };

  // Shared by Disconnect and by Delete Server Copy, because leaving a device
  // connected to data that no longer exists is never what anyone wants.
  const disconnectDevice = async () => {
    await clearConfig();
    // Clear the cursor too. A stored position describes a conversation this
    // device is no longer part of; trusting it later would silently skip
    // everything that changed while it was away.
    try {
      const d = await loadData();
      await saveData(resetSyncState(d));
    } catch (_) {}
    setEnabledState(false);
    setTokenState('');
    setSavedToken('');
    setCursor(0);
    setStatus(null);
  };

  const onDeleteCloud = () => {
    Alert.alert(
      'Delete the server copy?',
      'This permanently erases your data and photos from the server. '
      + 'IT CANNOT BE UNDONE.\n\n'
      + 'The filters on THIS device are not touched — they stay exactly as they '
      + 'are. Other devices keep whatever they already have, but will stop '
      + 'syncing.\n\n'
      + 'This device will also be disconnected and its token removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            const c = await getConfig();
            const r = await deleteCloudData(c);
            setBusy(false);

            if (!r.ok) {
              // Nothing was removed and we are still connected — leave the
              // device exactly as it was rather than half-exiting.
              Alert.alert(
                'Nothing was deleted',
                "Couldn't reach the server, so nothing was removed. Your data on "
                + 'this device and on the server is unchanged. Try again later.'
              );
              return;
            }

            // Finish the job. Someone who deletes their server copy wants OUT —
            // making them then hunt for Disconnect and clear the token by hand
            // would be busywork, and a device left holding a token for deleted
            // data would just re-upload everything on its next sync.
            await disconnectDevice();
            Alert.alert(
              'Server copy deleted',
              'Your data and photos have been removed from the server, and this '
              + 'device has been disconnected.\n\n'
              + 'Your filters on this device are unchanged.\n\n'
              + 'Note: database backups are kept for up to 30 days and cannot be '
              + 'individually erased.'
            );
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.head}>
        <View style={{ paddingLeft: t.isTablet ? 16 : 0 }}>
          <BackButton onPress={() => router.back()} />
        </View>
        <View />
      </View>

      <ScrollView scrollsToTop={scrollsToTop} contentContainerStyle={s.scroll}>
        <Text style={s.title}>Sync</Text>
        <Text style={s.sub}>
          Keep your filters the same on every device. The app works normally
          whether this is on or off.
        </Text>

        <Text style={s.label}>SYNC</Text>
        <View style={s.card}>
          <View style={s.rowBetween}>
            <Text style={s.cardBody}>Sync this device</Text>
            <Switch value={enabled} onValueChange={onToggle} disabled={!hasCreds} />
          </View>
          {!hasCreds && (
            <Text style={s.meta}>Add your sync address and token below first.</Text>
          )}
          {enabled && hasCreds && (
            <Text style={s.meta}>
              {cursor > 0 ? `Up to date through change ${cursor}.` : 'Not synced yet.'}
            </Text>
          )}
        </View>

        <Text style={s.label}>CONNECTION</Text>
        <View style={s.card}>
          <Text style={s.fieldLabel}>ADDRESS</Text>
          <TextInput
            style={s.input}
            value={url}
            onChangeText={setUrlState}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="https://..."
            placeholderTextColor={t.muted}
          />

          <Text style={[s.fieldLabel, { marginTop: 14 }]}>TOKEN</Text>
          <TextInput
            style={s.input}
            value={token}
            onChangeText={setTokenState}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={!showToken}
            placeholder="Paste your sync token"
            placeholderTextColor={t.muted}
          />
          <Pressable onPress={() => setShowToken(v => !v)} hitSlop={8}>
            <Text style={s.link}>{showToken ? 'Hide token' : 'Show token'}</Text>
          </Pressable>

          {/* Save greys out when there's nothing unsaved — the state of the
              button IS the confirmation, on top of the dialog. */}
          <View style={s.btnRow}>
            <Pressable
              style={[s.btnSecondary, (!dirty || busy) && s.dim]}
              onPress={onSave}
              disabled={!dirty || busy}
            >
              <Text style={s.btnSecondaryTxt}>{dirty ? 'Save' : 'Saved'}</Text>
            </Pressable>
            <Pressable
              style={[s.btnPrimary, (busy || !url || !token) && s.dim]}
              onPress={onTest}
              disabled={busy || !url || !token}
            >
              {busy ? <ActivityIndicator color={t.ink} /> : <Text style={s.btnPrimaryTxt}>Test</Text>}
            </Pressable>
          </View>
        </View>

        <Text style={s.label}>ACTIONS</Text>
        <View style={s.card}>
          <Text style={s.cardBody}>
            Sync runs on its own when the app opens and a few seconds after you
            make changes. You can also run it now.
          </Text>
          <Pressable
            style={[s.btnWide, (busy || !enabled) && s.dim]}
            onPress={onSyncNow}
            disabled={busy || !enabled}
          >
            {busy ? <ActivityIndicator color={t.ink} /> : <Text style={s.btnPrimaryTxt}>Sync Now</Text>}
          </Pressable>
          {!!status && <Text style={s.status}>{status}</Text>}
        </View>

        <Text style={s.label}>THIS DEVICE</Text>
        <View style={s.card}>
          <Text style={s.cardBody}>
            Stop syncing and remove the token from this device. Your filters stay
            here and the server copy is left alone.
          </Text>
          <Pressable style={[s.btnQuiet, !hasCreds && s.dim]} onPress={onDisconnect} disabled={busy || !hasCreds}>
            <Text style={s.btnQuietTxt}>Disconnect</Text>
          </Pressable>
        </View>

        <Text style={s.label}>SERVER COPY</Text>
        <View style={s.card}>
          <Text style={s.cardBody}>
            Permanently erase your data and photos from the server and
            disconnect this device. The filters here are not touched.
          </Text>
          <Pressable style={[s.btnQuiet, !hasCreds && s.dim]} onPress={onDeleteCloud} disabled={busy || !hasCreds}>
            <Text style={s.btnDangerTxt}>Delete Server Copy</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bg },
    head: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 18, paddingTop: 8, paddingBottom: 6,
    },
    scroll: { paddingHorizontal: t.isTablet ? t.ui(32) : 18, paddingBottom: 40 },

    title: { ...t.type.screenTitle, color: t.ink, marginTop: 4, paddingLeft: 16 },
    sub: {
      fontSize: t.uit(13), color: t.muted, marginTop: 4, paddingLeft: 16,
      marginBottom: 22, lineHeight: 18,
    },
    label: {
      ...t.type.kicker, color: t.muted, textTransform: 'uppercase',
      marginTop: 8, marginBottom: 8, paddingLeft: 13,
    },
    card: {
      padding: 16, borderRadius: 12, borderWidth: 1.5, borderColor: t.line,
      backgroundColor: t.card, marginBottom: 18,
    },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardBody: { fontSize: t.uit(13), color: t.ink, lineHeight: 19, flexShrink: 1, paddingRight: 12 },
    meta: { fontSize: t.uit(12), color: t.muted, marginTop: 10 },
    status: { fontSize: t.uit(13), color: t.inkSoft, marginTop: 12, lineHeight: 18 },

    fieldLabel: { ...t.type.kicker, color: t.muted, textTransform: 'uppercase', marginBottom: 6 },
    input: {
      padding: t.ui(12), borderRadius: 10, borderWidth: 1.5, borderColor: t.line,
      backgroundColor: t.bg, color: t.ink, fontSize: t.uit(15),
    },
    link: { fontSize: t.uit(13), color: t.inkSoft, fontWeight: '600', marginTop: 8 },

    btnRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
    btnPrimary: {
      flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: t.tabIdleBg,
      alignItems: 'center', justifyContent: 'center', minHeight: 44,
    },
    btnPrimaryTxt: { fontSize: t.uit(15), fontWeight: '700', color: t.ink },
    btnSecondary: {
      flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5,
      borderColor: t.line, backgroundColor: t.bg,
      alignItems: 'center', justifyContent: 'center', minHeight: 44,
    },
    btnSecondaryTxt: { fontSize: t.uit(15), fontWeight: '700', color: t.ink },
    btnWide: {
      marginTop: 16, alignSelf: 'stretch', paddingVertical: 12, borderRadius: 10,
      backgroundColor: t.tabIdleBg, alignItems: 'center', justifyContent: 'center', minHeight: 44,
    },
    btnQuiet: {
      marginTop: 14, alignSelf: 'flex-start',
      paddingVertical: 10, paddingHorizontal: 4, minHeight: 44, justifyContent: 'center',
    },
    btnQuietTxt: { fontSize: t.uit(15), fontWeight: '700', color: t.ink },
    btnDangerTxt: { fontSize: t.uit(15), fontWeight: '700', color: t.status.red.pillInk },

    dim: { opacity: 0.5 },
  });
}
