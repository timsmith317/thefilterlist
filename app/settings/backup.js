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

import React, { useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, Modal, Alert,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme/theme';
import { BackButton } from '../../components/HeaderBits';
import {
  exportBackup, shareBackup,
  pickBackupFile, readAndValidateBackup, applyRestore,
} from '../../lib/backup';

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
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [picking, setPicking] = useState(false);
  const [preview, setPreview] = useState(null);   // { parsed, stats } | null
  const [restoring, setRestoring] = useState(false);

  const s = makeStyles(t);

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
    } finally {
      setExporting(false);
    }
  };

  const onPickAndPreview = async () => {
    try {
      setPicking(true);
      const fileUri = await pickBackupFile();
      if (!fileUri) return; // user cancelled
      const result = await readAndValidateBackup(fileUri);
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
    } finally {
      setRestoring(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.head}>
        <BackButton onPress={() => router.back()} />
        <View />
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.title}>Backup & Restore</Text>
        <Text style={s.sub}>
          Export your data, or restore from a previous backup.
        </Text>

        {/* BACKUP */}
        <Text style={s.label}>BACKUP</Text>
        <View style={s.card}>
          <Text style={s.cardBody}>
            Creates a single file with your categories, assets, filters,
            parts, reminders, and reference photos. Save it to Files,
            AirDrop it, or send it to yourself for safekeeping.
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

        {/* RESTORE */}
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
                <StatRow label="Categories" value={preview?.stats?.categoryCount ?? 0} s={s} />
                <StatRow label="Assets"     value={preview?.stats?.assetCount ?? 0} s={s} />
                <StatRow label="Filters"    value={preview?.stats?.filterCount ?? 0} s={s} />
                <StatRow label="Parts"      value={preview?.stats?.partCount ?? 0} s={s} />
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
    scroll: { paddingHorizontal: 18, paddingBottom: 40 },

    title: { ...t.type.screenTitle, color: t.ink, marginTop: 4, paddingLeft: 16 },
    sub: { fontSize: 13, color: t.muted, marginTop: 4, paddingLeft: 16, marginBottom: 22, lineHeight: 18 },

    label: {
      ...t.type.kicker, color: t.muted, textTransform: 'uppercase',
      marginTop: 8, marginBottom: 8, paddingLeft: 13,
    },

    card: {
      padding: 16,
      borderRadius: 12, borderWidth: 1.5, borderColor: t.line,
      backgroundColor: t.card,
      marginBottom: 18,
    },
    cardBody: { fontSize: 13, color: t.ink, lineHeight: 19, textAlign: 'center' },
    cardWarn: { fontSize: 13, color: t.muted, marginTop: 10, fontStyle: 'italic', lineHeight: 18 },

    // Narrow, centered action buttons. alignSelf:'center' takes them out
    // of full-width stretch; minWidth: 200 + identical paddings give both
    // buttons the same chunky pill footprint regardless of label length.
    // Backup is now grey-filled + bold black to match the app's standard
    // buttons (Mark Replaced, Add, etc.).
    actionBtnPrimary: {
      marginTop: 28,
      alignSelf: 'center',
      paddingVertical: 12, paddingHorizontal: 28,
      minWidth: 200,
      borderRadius: 10, backgroundColor: t.tabIdleBg,
      alignItems: 'center', minHeight: 44, justifyContent: 'center',
    },
    actionBtnPrimaryTxt: { fontSize: 15, fontWeight: '700', color: t.ink },

    // Restore kept as the white-outline secondary for primary/secondary
    // distinction next to Backup.
    actionBtnSecondary: {
      marginTop: 28,
      alignSelf: 'center',
      paddingVertical: 12, paddingHorizontal: 28,
      minWidth: 200,
      borderRadius: 10, borderWidth: 1.5, borderColor: t.line,
      backgroundColor: t.bg,
      alignItems: 'center', minHeight: 44, justifyContent: 'center',
    },
    actionBtnSecondaryTxt: { fontSize: 15, fontWeight: '700', color: t.ink },

    btnDim: { opacity: 0.6 },

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
    dialogTitle: { fontSize: 18, fontWeight: '700', color: t.ink, marginBottom: 4 },
    dialogSub: { fontSize: 12, color: t.muted, marginBottom: 14 },

    statsList: {
      borderTopWidth: 1, borderTopColor: t.line,
      paddingTop: 12, marginTop: 4,
    },
    statRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingVertical: 6,
    },
    statLabel: { fontSize: 14, color: t.inkSoft },
    statValue: { fontSize: 14, fontWeight: '700', color: t.ink },

    dialogActions: {
      flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center',
      gap: 12, marginTop: 18,
    },
    btnSecondary: { paddingVertical: 10, paddingHorizontal: 18 },
    btnSecondaryTxt: { fontSize: 14, fontWeight: '600', color: t.inkSoft },
    // Grey fill + bold black to match the app's standard buttons.
    btnPrimary: {
      paddingVertical: 10, paddingHorizontal: 22,
      borderRadius: 8, backgroundColor: t.tabIdleBg,
      minWidth: 88, alignItems: 'center', justifyContent: 'center',
    },
    btnPrimaryTxt: { fontSize: 14, fontWeight: '700', color: t.ink },
  });
}