// app/filter/[id].js — Filter Detail.
//
// The FILTER now owns the replacement interval (the manufacturer's recommended
// cadence, user-editable). It shows as the headline spec under the title:
//   - view mode: "Every 90 days" (verbose, singular-aware)
//   - edit mode: the number + Days/Months/Years roller (IntervalField), the
//     same control used in the Device editor. We derive {value, unit} from the
//     stored day count on entering edit and convert back on save.
// Because the interval lives here, every device/stage that links this filter
// inherits this cadence — edit it once, everywhere updates.
//
// View and Edit modes share the same title metrics and spacing so toggling
// edit/save doesn't shift the page. The low-stock slot renders in BOTH modes
// (empty in edit) so the gap below the title is identical.
//
// Delete Filter lives in EDIT mode only (matches Device Edit / iOS conventions).
// Used By stays in view mode (informational).
//
// Keyboard handling: KeyboardAwareScrollView (react-native-keyboard-controller)
// scrolls the focused input clear of the keyboard. Requires <KeyboardProvider>
// in app/_layout.js. Native module — needs a dev rebuild to take effect.

import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Linking, Alert, Image } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../../theme/theme';
import { BackButton, PillButton } from '../../components/HeaderBits';
import PhotoStrip from '../../components/PhotoStrip';
import PhotoCropper from '../../components/PhotoCropper';
import PhotoViewerModal from '../../components/PhotoViewerModal';
import CameraCaptureModal from '../../components/CameraCaptureModal';
import IntervalField from '../../components/IntervalField';
import { loadData, saveData, updateFilter, deleteFilter, devicesUsingFilter, isFilterLow, addFilterPhoto, removeFilterPhoto, FILTER_TYPES, MAX_FILTER_PHOTOS, DEFAULT_INTERVAL_DAYS } from '../../data/store';
import { intervalToDays, daysToInterval, INTERVAL_UNITS } from '../../lib/interval';
import { pickFromLibrary, saveToPhotos, deleteFile, photoUri } from '../../lib/filterPhotos';

// "Every 90 days" / "Every 6 months" / "Every 1 year" (singular-aware).
function verboseInterval(days) {
  const { value, unit } = daysToInterval(days);
  const u = INTERVAL_UNITS.find(x => x.key === unit) || INTERVAL_UNITS[0];
  const word = u.label.toLowerCase();              // days / months / years
  const singular = value === 1 ? word.replace(/s$/, '') : word;
  return `Every ${value} ${singular}`;
}

export default function FilterDetail() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [cropAsset, setCropAsset] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerStart, setViewerStart] = useState(0);
  const s = makeStyles(t);

  useFocusEffect(useCallback(() => {
    let active = true;
    loadData().then(d => {
      if (active) {
        setData(d);
        const p = d.filters.find(x => x.id === id);
        if (p) {
          const { value, unit } = daysToInterval(p.intervalDays != null ? p.intervalDays : DEFAULT_INTERVAL_DAYS);
          setDraft({ ...p, intervalValue: String(value), intervalUnit: unit });
        }
      }
    });
    return () => { active = false; };
  }, [id]));

  if (!data || !draft) return <View style={{ flex: 1, backgroundColor: t.bg }} />;
  const filter = data.filters.find(x => x.id === id);
  if (!filter) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.head}><BackButton onPress={() => router.back()} /><View /></View>
        <Text style={{ color: t.ink, padding: 22 }}>Filter not found.</Text>
      </SafeAreaView>
    );
  }

  const devices = devicesUsingFilter(data, filter.id);
  const low = isFilterLow(filter);
  const filterInterval = filter.intervalDays != null ? filter.intervalDays : DEFAULT_INTERVAL_DAYS;

  const save = async () => {
    // Photos are managed live on `data` (added/removed and persisted immediately),
    // so omit the draft's photo list from the patch — it's a snapshot from when
    // editing began, and including it would overwrite just-added photos.
    const { intervalValue, intervalUnit, photos: _photos, ...rest } = draft;
    const clean = {
      ...rest,
      intervalDays: intervalToDays(intervalValue, intervalUnit),
      onHand: Math.max(0, parseInt(draft.onHand, 10) || 0),
      lowStockThreshold: Math.max(0, parseInt(draft.lowStockThreshold, 10) || 0),
    };
    const next = updateFilter(data, filter.id, clean);
    setData(next);
    const { value, unit } = daysToInterval(clean.intervalDays);
    setDraft({ ...clean, intervalValue: String(value), intervalUnit: unit });
    await saveData(next);
    setEditing(false);
  };

  const bump = async (delta) => {
    const newOn = Math.max(0, (filter.onHand || 0) + delta);
    const next = updateFilter(data, filter.id, { onHand: newOn });
    setData(next);
    setDraft({ ...draft, onHand: newOn });
    await saveData(next);
  };

  const openLink = () => { if (filter.reorderUrl) Linking.openURL(filter.reorderUrl); };

  const askDelete = () => {
    Alert.alert(
      'Delete filter?',
      devices.length
        ? `This filter is used by ${devices.length} device${devices.length > 1 ? 's' : ''}. They will keep their settings but lose the filter link.`
        : 'This will remove the filter. No devices reference it.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          for (const u of (filter.photos || [])) await deleteFile(u);
          const n = deleteFilter(data, filter.id); await saveData(n); router.back();
        } },
      ]
    );
  };

  const onPickPhoto = async (source) => {
    if ((filter.photos || []).length >= MAX_FILTER_PHOTOS) {
      Alert.alert('Limit reached', `You can add up to ${MAX_FILTER_PHOTOS} photos per filter.`);
      return;
    }
    if (source === 'camera') { setCameraOpen(true); return; }
    const asset = await pickFromLibrary();
    if (!asset) return;
    setCropAsset(asset);
  };

  const onCroppedPhoto = async (uri) => {
    setCropAsset(null);
    if (!uri) return;
    const next = addFilterPhoto(data, filter.id, uri);
    setData(next);
    await saveData(next);
  };

  const onSaveToPhotos = async (uri) => {
    const ok = await saveToPhotos(uri);
    if (ok) Alert.alert('Saved', 'Photo saved to your library.');
  };

  const onDeletePhoto = async (index) => {
    const uri = (filter.photos || [])[index];
    const next = removeFilterPhoto(data, filter.id, index);
    setData(next);
    await saveData(next);
    await deleteFile(uri);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.head}>
        <BackButton onPress={() => router.back()} />
        {editing ? (
          <PillButton label="Save" onPress={save} />
        ) : (
          <PillButton label="Edit" onPress={() => setEditing(true)} />
        )}
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 40 }}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
      >
        {editing ? (
          <TextInput value={draft.name} onChangeText={(v) => setDraft({ ...draft, name: v })} placeholder="Name" placeholderTextColor={t.muted} style={s.titleInput} />
        ) : (
          <Text style={s.title}>{filter.name || 'Untitled filter'}</Text>
        )}

        {/* Low-stock slot renders in BOTH modes (empty in edit) so the gap to
            the first section is identical and the page doesn't shift on save. */}
        <View style={s.lowSlot}>
          {!editing && low && (
            <View style={s.lowPill}><Text style={s.lowPillTxt}>Low Stock</Text></View>
          )}
        </View>

        {/* TYPE — what kind of device element this filter is (water / air /
            other). Lives on the filter; the device's icon derives from this. */}
        <Text style={[s.label, s.firstLabel]}>TYPE</Text>
        {editing ? (
          <View style={s.typeRow}>
            {Object.entries(FILTER_TYPES).map(([k, v]) => {
              const on = (draft.type || 'other') === k;
              return (
                <Pressable key={k} onPress={() => setDraft({ ...draft, type: k })} style={[s.typeChip, on && s.typeChipOn]}>
                  <Text style={[s.typeChipTxt, on && s.typeChipTxtOn]}>{v.label}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Text style={s.value}>{FILTER_TYPES[filter.type]?.label || 'Other'}</Text>
        )}

        {/* INTERVAL — the filter's recommended replacement cadence, the headline
            spec. Lives on the filter so every linked device inherits it. */}
        <Text style={s.label}>REPLACE EVERY</Text>
        {editing ? (
          <IntervalField
            value={draft.intervalValue}
            unit={draft.intervalUnit}
            onChangeValue={(v) => setDraft({ ...draft, intervalValue: v })}
            onChangeUnit={(u) => setDraft({ ...draft, intervalUnit: u })}
          />
        ) : (
          <Text style={s.value}>{verboseInterval(filterInterval)}</Text>
        )}
        {editing && (
          <Text style={s.hint}>Used by every device linked to this filter.</Text>
        )}

        <Text style={s.label}>ON HAND</Text>
        <View style={s.stepperRow}>
          <Pressable style={s.stepBtn} onPress={() => bump(-1)} hitSlop={6}><Text style={s.stepTxt}>−</Text></Pressable>
          <Text style={s.stepCount}>{filter.onHand}</Text>
          <Pressable style={s.stepBtn} onPress={() => bump(1)} hitSlop={6}><Text style={s.stepTxt}>+</Text></Pressable>
        </View>

        <Text style={s.label}>LOW-STOCK THRESHOLD</Text>
        {editing ? (
          <TextInput
            value={String(draft.lowStockThreshold)}
            onChangeText={(v) => setDraft({ ...draft, lowStockThreshold: v.replace(/[^0-9]/g, '') })}
            keyboardType="number-pad"
            style={s.input}
          />
        ) : (
          <Text style={s.value}>Alert when {filter.lowStockThreshold} or less</Text>
        )}

        {editing ? (
          <>
            <Text style={s.label}>SKU</Text>
            <TextInput value={draft.sku} onChangeText={(v) => setDraft({ ...draft, sku: v })} placeholder="e.g. EDR1RXD1" placeholderTextColor={t.muted} style={s.input} autoCapitalize="characters" />
          </>
        ) : filter.sku ? (
          <>
            <Text style={s.label}>SKU</Text>
            <Text style={s.value}>{filter.sku}</Text>
          </>
        ) : null}

        {editing ? (
          <>
            <Text style={s.label}>REORDER URL</Text>
            <TextInput value={draft.reorderUrl} onChangeText={(v) => setDraft({ ...draft, reorderUrl: v })} placeholder="https://..." placeholderTextColor={t.muted} style={s.input} autoCapitalize="none" autoCorrect={false} />
          </>
        ) : filter.reorderUrl ? (
          <>
            <Text style={s.label}>REORDER URL</Text>
            <Pressable onPress={openLink} style={s.openLink}>
              <Text style={s.openLinkTxt} numberOfLines={1}>{filter.reorderUrl}</Text>
              <Text style={s.openLinkArrow}>↗</Text>
            </Pressable>
          </>
        ) : null}

        {/* PHOTOS — edit mode: full editing via PhotoStrip (add/crop/save/delete).
            View mode: read-only thumbnails (actual photos only, no empty slots);
            tapping one opens the framed swipe/zoom viewer. Hidden entirely in
            view mode when there are no photos. */}
        {editing ? (
          <>
            <Text style={s.label}>PHOTOS</Text>
            <View>
              <PhotoStrip
                photos={filter.photos || []}
                max={MAX_FILTER_PHOTOS}
                onPick={(source) => onPickPhoto(source)}
                onSaveToPhotos={onSaveToPhotos}
                onDelete={onDeletePhoto}
              />
            </View>
            <Text style={s.hint}>Up to {MAX_FILTER_PHOTOS} reference photos.</Text>
          </>
        ) : (filter.photos || []).length > 0 ? (
          <>
            <Text style={s.label}>PHOTOS</Text>
            <View style={s.thumbRow}>
              {Array.from({ length: MAX_FILTER_PHOTOS }).map((_, i) => {
                const p = (filter.photos || [])[i];
                if (!p) return <View key={i} style={s.thumbSpacer} />;
                return (
                  <Pressable key={i} style={s.thumb} onPress={() => { setViewerStart(i); setViewerOpen(true); }}>
                    <Image source={{ uri: photoUri(p) }} style={s.thumbImg} />
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        {/* Used By: informational, view-mode only — unchanged. */}
        {!editing && devices.length > 0 && (
          <>
            <Text style={s.label}>USED BY ({devices.length})</Text>
            <View style={s.usedBox}>
              {devices.map(f => (
                <Pressable key={f.id} style={s.usedRow} onPress={() => router.push(`/device/${f.id}`)}>
                  <Text style={s.usedTxt}>{f.name}</Text>
                  <Text style={s.chev}>›</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {/* Delete Filter: edit-mode only. */}
        {editing && (
          <Pressable style={s.delBtn} onPress={askDelete}>
            <Text style={s.delTxt}>Delete Filter</Text>
          </Pressable>
        )}
      </KeyboardAwareScrollView>

      <PhotoCropper
        visible={!!cropAsset}
        asset={cropAsset}
        onCancel={() => setCropAsset(null)}
        onDone={onCroppedPhoto}
      />

      <PhotoViewerModal
        visible={viewerOpen}
        photos={filter.photos || []}
        index={viewerStart}
        onClose={() => setViewerOpen(false)}
      />

      <CameraCaptureModal
        visible={cameraOpen}
        onCancel={() => setCameraOpen(false)}
        onCapture={(asset) => { setCameraOpen(false); setCropAsset(asset); }}
      />
    </SafeAreaView>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bg },
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingTop: 8, paddingBottom: 6 },

    title: { fontSize: 26, fontWeight: '800', letterSpacing: 0.5, color: t.ink, marginTop: 0, paddingLeft: 16 },
    titleInput: { fontSize: 26, fontWeight: '800', letterSpacing: 0.5, color: t.ink, marginTop: 0, paddingLeft: 16, paddingVertical: 0 },

    lowSlot: { height: 22, marginTop: 2, paddingLeft: 16, justifyContent: 'center' },

    label: { ...t.type.kicker, color: t.muted, textTransform: 'uppercase', marginTop: 22, marginBottom: 8, paddingLeft: 16 },
    // First section sits closer to the title/badge above it.
    firstLabel: { marginTop: 8 },
    value: { fontSize: 15, fontWeight: '600', color: t.ink, paddingLeft: 16 },
    typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingLeft: 16 },
    typeChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card },
    typeChipOn: { backgroundColor: t.tabIdleBg },
    typeChipTxt: { fontSize: 13, fontWeight: '600', color: t.inkSoft },
    typeChipTxtOn: { color: t.ink },
    input: { padding: 13, borderRadius: 10, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card, color: t.ink, fontSize: 16 },

    stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingLeft: 16 },
    stepBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: t.tabIdleBg, alignItems: 'center', justifyContent: 'center' },
    stepTxt: { fontSize: 24, fontWeight: '700', color: t.ink },
    stepCount: { fontSize: 22, fontWeight: '800', color: t.ink, minWidth: 40, textAlign: 'center' },

    openLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 13, borderRadius: 10, backgroundColor: t.tabIdleBg },
    openLinkTxt: { color: t.ink, fontSize: 14, flex: 1, marginRight: 8 },
    openLinkArrow: { color: t.inkSoft, fontSize: 18, fontWeight: '700' },

    lowPill: { alignSelf: 'flex-start', backgroundColor: t.status.amb.pillBg, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
    lowPillTxt: { color: t.status.amb.pillInk, fontSize: 11.5, fontWeight: '700', textAlign: 'center' },

    hint: { fontSize: 12, color: t.muted, marginTop: 8, paddingLeft: 16 },

    // Read-only photo thumbnails (view mode). Match PhotoStrip's filled slot:
    // square, card fill, thin line border, contain so the whole photo shows.
    // Read-only photo thumbnails (view mode), laid out on the same 3-column grid
    // as the edit strip: photos fill from the left, invisible spacers hold the
    // empty columns, so the outer photos align with the fields above.
    thumbRow: { flexDirection: 'row', justifyContent: 'space-between' },
    thumb: { width: 96, height: 96, borderRadius: 14, overflow: 'hidden', backgroundColor: t.card, borderWidth: 1, borderColor: t.line },
    thumbSpacer: { width: 96, height: 96 },
    thumbImg: { width: '100%', height: '100%', resizeMode: 'contain' },

    usedBox: { backgroundColor: t.card, borderRadius: 14, borderWidth: 1, borderColor: t.line, paddingHorizontal: 14 },
    usedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: t.line },
    usedTxt: { fontSize: 14, color: t.ink, fontWeight: '600' },
    chev: { fontSize: 22, color: t.muted },

    delBtn: { marginTop: 28, padding: 12, alignItems: 'center' },
    delTxt: { color: '#dc2626', fontSize: 14 },
  });
}