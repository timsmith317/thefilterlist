// File: app/settings/backup.js → ~/Projects/thefilterlist/app/settings/backup.js
//
// app/settings/backup.js
//
// Backup & Restore screen.
//
// Export flow:
//   tap [Backup] → exportBackup() writes .filter file →
//   shareBackup() opens iOS share sheet → user picks Files / AirDrop / etc.
//
// Restore flow:
//   tap [Restore] → DocumentPicker → readAndValidateBackup → preview modal
//   showing what's in the file → user confirms (destructive alert) →
//   applyRestore overwrites everything → success + jump to root.
//
// The preview modal is critical: it gives the user a chance to verify they
// picked the right backup BEFORE they overwrite current data. The "replace
// all data" warning lives in the preview modal + the destructive Alert,
// NOT on the main Restore card — the warning fires at the moment of
// action, where it actually matters.
//
// ERROR SURFACING: every async handler here has a catch, not just a finally.
// Without one, anything thrown inside pickBackupFile / readAndValidateBackup /
// applyRestore became an unhandled rejection: the spinner stopped, no dialog
// appeared, and the user saw the picker close and nothing happen. A silent
// failure in a destructive-data flow is the worst kind, so failures now name
// themselves.
//
// Delete Sample Data:
//   Fresh installs seed demo data (see data/store.js seed()). This screen
//   shows a quiet "Delete Sample Data" action at the bottom while any
//   untouched sample items remain — it removes ONLY pristine seed items, so
//   anything the user edited or added is kept. hasStarterData() drives its
//   visibility, re-checked on focus so deleting the seed items by hand hides
//   it too. Restoring any backup permanently disarms it (the marker is never
//   carried in a backup file).

import React, { useState, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, Modal, Alert,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../../theme/theme';
import { BackButton } from '../../components/HeaderBits';
import {
  exportBackup, shareBackup,
  pickBackupFile, readAndValidateBackup, applyRestore,
} from '../../lib/backup';
import { loadData, hasStarterData, clearStarterData } from '../../data/store';
import useFixScrollToTop from '../../lib/useFixScrollToTop';

function formatDate(iso) {
  if (!iso) return 'Unknown';
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function BackupSettings() {
  const t = useTheme();
  const scrollsToTop = useFixScrollToTop();
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [picking, setPicking] = useState(false);
  const [preview, setPreview] = useState(null);   // { parsed, stats } | null
  const [restoring, setRestoring] = useState(false);
  const [data, setData] = useState(null);
  const [clearing, setClearing] = useState(false);

  const s = makeStyles(t);

  const refreshData = useCallback(async () => {
    try { setData(await loadData()); } catch (e) { /* leave data as-is */ }
  }, []);

  // Re-check on every focus so the button reflects manual deletions made
  // elsewhere (deleting the seed items by hand should hide it too).
  useFocusEffect(useCallback(() => { refreshData(); }, [refreshData]));

  const showClear = !!data && hasStarterData(data);

  const onExport = async () => {
    try {
      setExporting(true);
      const fileUri = await exportBackup();
      if (!fileUri) {
        Alert.alert('Export Failed', 'Could not create the backup file.');
        return;
      }
      try {
        await shareBackup(fileUri);
      } catch (e) {
        // Sharing.shareAsync throws when share is not available — surface a
        // friendly message rather than the raw error.
        Alert.alert('Share Failed', String(e?.message || e));
      }
    } catch (e) {
      console.warn('[TFL backup] export threw', e);
      Alert.alert('Export Failed', String(e?.message || e));
    } finally {
      setExporting(false);
    }
  };

  const onPickAndPreview = async () => {
    try {
      setPicking(true);
      const fileUri = await pickBackupFile();
      console.log('[TFL restore] picked:', fileUri);
      if (!fileUri) return; // user cancelled, or the picker returned nothing
      const result = await readAndValidateBackup(fileUri);
      console.log('[TFL restore] validate:', JSON.stringify({
        ok: result && result.ok,
        reason: result && result.reason,
        stats: result && result.stats,
      }));
      if (!result.ok) {
        if (result.reason === 'invalid') {
          Alert.alert(
            'Invalid Backup',
            'This file is not a valid Filter List backup. Pick a backup you exported from this app.'
          );
        } else {
          Alert.alert('Read Failed', 'Could not read the selected file.');
        }
        return;
      }
      setPreview(result);
    } catch (e) {
      console.warn('[TFL restore] pick/validate threw', e);
      Alert.alert('Restore Failed', String(e?.message || e));
    } finally {
      setPicking(false);
    }
  };

  const onConfirmRestore = () => {
    if (!preview) return;
    Alert.alert(
      'Replace all data?',
      'This will replace everything currently in the app with the backup. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: doRestore,
        },
      ]
    );
  };

  const doRestore = async () => {
    if (!preview) return;
    try {
      setRestoring(true);
      const result = await applyRestore(preview.parsed);
      if (result.ok) {
        setPreview(null);
        Alert.alert(
          'Restore Complete',
          'Your data has been restored.',
          [{ text: 'OK', onPress: () => router.replace('/') }]
        );
      } else {
        Alert.alert(
          'Restore Failed',
          'Could not save the restored data. Your current data has not been changed.'
        );
      }
    } catch (e) {
      console.warn('[TFL restore] applyRestore threw', e);
      Alert.alert('Restore Failed', String(e?.message || e));
    } finally {
      setRestoring(false);
    }
  };

  const onDeleteSample = () => {
    Alert.alert(
      'Delete Sample Data?',
      'This removes the built-in sample data. None of your own data will be touched.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDeleteSample },
      ]
    );
  };

  const doDeleteSample = async () => {
    try {
      setClearing(true);
      const next = await clearStarterData();
      setData(next); // marker gone -> showClear flips false, button hides
    } finally {
      setClearing(false);
    }
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
        <Text style={s.title}>Backup & Restore</Text>
        <Text style={s.sub}>
          Export your data, or restore from a previous backup.
        </Text>

        {/* BACKUP + RESTORE — stacked on iPhone, side-by-side on iPad. Each
            label+card is a section; on iPad the two sections sit in a row. */}
        <View style={s.sectionsRow}>
          <View style={s.section}>
            <Text style={s.label}>BACKUP</Text>
            <View style={s.card}>
              <Text style={s.cardBody}>
                Creates a single file with your assets, devices, filters,
                reminders, and reference photos. Save it to Files, AirDrop it,
                or send it to yourself for safekeeping.
              </Text>
              <Pressable
                style={[s.actionBtnPrimary, exporting && s.btnDim]}
                onPress={onExport}
                disabled={exporting}
              >
                {exporting
                  ? <ActivityIndicator color={t.ink} />
                  : <Text style={s.actionBtnPrimaryTxt}>Backup</Text>}
              </Pressable>
            </View>
          </View>

          <View style={s.section}>
            <Text style={s.label}>RESTORE</Text>
            <View style={s.card}>
              <Text style={s.cardBody}>
                Replace all current data with a previous backup. Useful for a
                new device or after reinstalling.
              </Text>
              {/* The "replace everything" warning is intentionally NOT here —
                  it fires at the moment of action via the preview modal and
                  the destructive Alert in onConfirmRestore. */}
              <Pressable
                style={[s.actionBtnSecondary, picking && s.btnDim]}
                onPress={onPickAndPreview}
                disabled={picking}
              >
                {picking
                  ? <ActivityIndicator color={t.ink} />
                  : <Text style={s.actionBtnSecondaryTxt}>Restore</Text>}
              </Pressable>
            </View>
          </View>
        </View>

        {/* DELETE SAMPLE DATA — only while untouched seed items remain.
            Clears ONLY pristine sample items; edited/added data is kept. */}
        {showClear && (
          <View style={s.sampleWrap}>
            <Pressable
              style={[s.sampleBtn, clearing && s.btnDim]}
              onPress={onDeleteSample}
              disabled={clearing}
            >
              {clearing
                ? <ActivityIndicator color={t.muted} />
                : <Text style={s.sampleBtnTxt}>Delete Sample Data</Text>}
            </Pressable>
            <Text style={s.sampleHint}>
              Removes the built-in sample data. None of your own data will be touched.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Preview modal — shows the backup's contents before destructive confirm */}
      <Modal
        visible={!!preview}
        transparent
        animationType="fade"
        onRequestClose={() => setPreview(null)}
      >
        <View style={s.modalRoot}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={s.overlay}
          >
            <Pressable style={s.backdrop} onPress={() => setPreview(null)} />
            <View style={s.dialog}>
              <Text style={s.dialogTitle}>Backup Contents</Text>
              <Text style={s.dialogSub}>
                Exported {formatDate(preview?.stats?.exportedAt)}
              </Text>

              <View style={s.statsList}>
                <StatRow label="Assets"     value={preview?.stats?.assetCount ?? 0} s={s} />
                <StatRow label="Devices"    value={preview?.stats?.deviceCount ?? 0} s={s} />
                <StatRow label="Filters"      value={preview?.stats?.filterCount ?? 0} s={s} />
                <StatRow label="Photos"     value={preview?.stats?.photoCount ?? 0} s={s} />
              </View>

              <Text style={s.cardWarn}>
                Restoring will replace all current data in the app.
              </Text>

              <View style={s.dialogActions}>
                <Pressable
                  onPress={() => setPreview(null)}
                  style={s.btnSecondary}
                  disabled={restoring}
                >
                  <Text style={s.btnSecondaryTxt}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={onConfirmRestore}
                  style={[s.btnPrimary, restoring && s.btnDim]}
                  disabled={restoring}
                >
                  {restoring
                    ? <ActivityIndicator color={t.ink} />
                    : <Text style={s.btnPrimaryTxt}>Restore</Text>}
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function StatRow({ label, value, s }) {
  return (
    <View style={s.statRow}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
    </View>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bg },
    head: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 18, paddingTop: 8, paddingBottom: 6,
    },
    scroll: {
      paddingHorizontal: 18, paddingBottom: 40,
      // iPad: wider inset (matches other settings screens), left-aligned — no
      // centering. The Backup/Restore sections go side-by-side (see sectionsRow).
      paddingHorizontal: t.isTablet ? t.ui(32) : 18,
    },

    // iPhone: sections stack (column). iPad: side-by-side (row), stretched to
    // equal height so both cards match and their buttons align.
    sectionsRow: t.isTablet
      ? { flexDirection: 'row', gap: t.ui(18), alignItems: 'stretch' }
      : { flexDirection: 'column' },
    // On iPad each section takes equal width AND stretches full height; on
    // iPhone full width, natural height.
    section: t.isTablet ? { flex: 1 } : { width: '100%' },

    title: { ...t.type.screenTitle, color: t.ink, marginTop: 4, paddingLeft: 16 },
    sub: { fontSize: t.uit(13), color: t.muted, marginTop: 4, paddingLeft: 16, marginBottom: 22, lineHeight: 18 },

    label: {
      ...t.type.kicker, color: t.muted, textTransform: 'uppercase',
      marginTop: 8, marginBottom: 8, paddingLeft: 13,
    },

    card: {
      padding: 16,
      borderRadius: 12, borderWidth: 1.5, borderColor: t.line,
      backgroundColor: t.card,
      marginBottom: 18,
      // iPad: fill the section's (stretched) height so both cards match and
      // their buttons align at the bottom (paired with marginTop:'auto' on btn).
      ...(t.isTablet ? { flex: 1 } : {}),
    },
    // Left-aligned body text (was centered when the whole screen was centered).
    cardBody: { fontSize: t.uit(13), color: t.ink, lineHeight: 19, textAlign: 'left' },
    cardWarn: { fontSize: t.uit(13), color: t.muted, marginTop: 10, fontStyle: 'italic', lineHeight: 18 },

    // Full-width action buttons within their card (no longer centered pills) —
    // reads as an intentional block, which is what balances the left-aligned
    // layout. Backup = grey-filled bold (app's standard button).
    actionBtnPrimary: {
      marginTop: 16,
      alignSelf: 'stretch',
      paddingVertical: 12, paddingHorizontal: 28,
      borderRadius: 10, backgroundColor: t.tabIdleBg,
      alignItems: 'center', minHeight: 44, justifyContent: 'center',
    },
    actionBtnPrimaryTxt: { fontSize: t.uit(15), fontWeight: '700', color: t.ink },

    // Restore = white-outline secondary, also full-width. On iPad its card is
    // stretched to match the taller Backup card, so we push this button to the
    // bottom (marginTop:'auto') to align it with the Backup button. Backup's
    // button keeps natural position (its text drives the height, so it's already
    // near the bottom). iPhone: normal fixed spacing.
    actionBtnSecondary: {
      marginTop: t.isTablet ? 'auto' : 16,
      alignSelf: 'stretch',
      paddingVertical: 12, paddingHorizontal: 28,
      borderRadius: 10, borderWidth: 1.5, borderColor: t.line,
      backgroundColor: t.bg,
      alignItems: 'center', minHeight: 44, justifyContent: 'center',
    },
    actionBtnSecondaryTxt: { fontSize: t.uit(15), fontWeight: '700', color: t.ink },

    btnDim: { opacity: 0.6 },

    // Delete Sample Data — quiet, centered, no fill. Red text signals the
    // destructive nature without a loud filled button at the foot of a
    // normal settings screen.
    sampleWrap: { marginTop: 4, marginBottom: 8, alignItems: 'center' },
    sampleBtn: {
      paddingVertical: 10, paddingHorizontal: 22,
      minHeight: 44, alignItems: 'center', justifyContent: 'center',
    },
    sampleBtnTxt: { fontSize: t.uit(15), fontWeight: '700', color: t.status.red.pillInk },
    sampleHint: {
      fontSize: t.uit(12), color: t.muted, textAlign: 'center',
      marginTop: 2, paddingHorizontal: 24, lineHeight: 17,
    },

    // Modal styles (matching the pattern from categories.js / assets.js)
    modalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
    overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    backdrop: { ...StyleSheet.absoluteFillObject },
    dialog: {
      width: '85%', maxWidth: 380,
      backgroundColor: t.card, borderRadius: 14, padding: 18,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.22,
      shadowRadius: 16,
      elevation: 10,
    },
    dialogTitle: { fontSize: t.uit(18), fontWeight: '700', color: t.ink, marginBottom: 4 },
    dialogSub: { fontSize: t.uit(12), color: t.muted, marginBottom: 14 },

    statsList: {
      borderTopWidth: 1, borderTopColor: t.line,
      paddingTop: 12, marginTop: 4,
    },
    statRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingVertical: 6,
    },
    statLabel: { fontSize: t.uit(14), color: t.inkSoft },
    statValue: { fontSize: t.uit(14), fontWeight: '700', color: t.ink },

    dialogActions: {
      flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center',
      gap: 12, marginTop: 18,
    },
    btnSecondary: { paddingVertical: 10, paddingHorizontal: 18 },
    btnSecondaryTxt: { fontSize: t.uit(14), fontWeight: '600', color: t.inkSoft },
    // Grey fill + bold black to match the app's standard buttons.
    btnPrimary: {
      paddingVertical: 10, paddingHorizontal: 22,
      borderRadius: 8, backgroundColor: t.tabIdleBg,
      minWidth: 88, alignItems: 'center', justifyContent: 'center',
    },
    btnPrimaryTxt: { fontSize: t.uit(14), fontWeight: '700', color: t.ink },
  });
}