// components/PhotoStrip.js — reusable strip of up to N photo thumbnails.
// Empty slots show a dashed-bordered "+" tap target. Tapping an empty slot
// offers Camera / Library. Tapping a filled slot offers Save to Photos /
// Delete. Caller provides photos array and callbacks; this is pure UI.
//
// Thumbnails use resizeMode 'contain' so the WHOLE composed photo shows inside
// the square slot (a tall device isn't re-cropped). The slot's card background
// fills any spare space — and matches what the cropper preview shows, so the
// thumbnail looks like what you framed.
import React from 'react';
import { View, Text, Pressable, Image, StyleSheet, ActionSheetIOS, Alert, Platform } from 'react-native';
import { useTheme } from '../theme/theme';
import { photoUri } from '../lib/filterPhotos';

export default function PhotoStrip({ photos = [], max = 3, onPick, onSaveToPhotos, onDelete }) {
  const t = useTheme();
  const s = makeStyles(t);

  const slots = [];
  for (let i = 0; i < max; i++) slots.push(photos[i] || null);

  const promptForEmpty = (slotIndex) => {
    const options = ['Take Photo', 'Choose from Library', 'Cancel'];
    const cancelIdx = 2;
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: cancelIdx },
        (i) => {
          if (i === 0) onPick && onPick('camera', slotIndex);
          else if (i === 1) onPick && onPick('library', slotIndex);
        }
      );
    } else {
      Alert.alert('Add photo', '', [
        { text: 'Take Photo', onPress: () => onPick && onPick('camera', slotIndex) },
        { text: 'Choose from Library', onPress: () => onPick && onPick('library', slotIndex) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const promptForFilled = (slotIndex, uri) => {
    const options = ['Save to Photos', 'Delete', 'Cancel'];
    const destructiveIdx = 1;
    const cancelIdx = 2;
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: cancelIdx, destructiveButtonIndex: destructiveIdx },
        (i) => {
          if (i === 0) onSaveToPhotos && onSaveToPhotos(uri);
          else if (i === 1) onDelete && onDelete(slotIndex);
        }
      );
    } else {
      Alert.alert('Photo', '', [
        { text: 'Save to Photos', onPress: () => onSaveToPhotos && onSaveToPhotos(uri) },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete && onDelete(slotIndex) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  return (
    <View style={s.row}>
      {slots.map((uri, i) => (
        <Pressable
          key={i}
          style={[s.slot, uri ? s.slotFilled : s.slotEmpty]}
          onPress={() => uri ? promptForFilled(i, uri) : promptForEmpty(i)}
        >
          {uri ? (
            <Image source={{ uri: photoUri(uri) }} style={s.img} />
          ) : (
            <Text style={s.plus}>+</Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    // iPhone: space-between pins the first/last slots to the row edges (so they
    // align with the full-width input above) and spaces the rest evenly.
    // iPad: on a wide screen (esp. landscape) space-between flings the slots to
    // opposite ends with a huge gap. Instead we cluster them — a left-aligned
    // row with a fixed gap — so the trio keeps tidy, iPhone-like spacing
    // regardless of orientation.
    row: t.isTablet
      ? { flexDirection: 'row', justifyContent: 'flex-start', gap: t.ui(48) }
      : { flexDirection: 'row', justifyContent: 'space-between' },
    slot: { width: t.ui(96), height: t.ui(96), borderRadius: t.ui(14), alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    slotEmpty: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.iconBorder, backgroundColor: t.card },
    slotFilled: { backgroundColor: t.card, borderWidth: 1, borderColor: t.line },
    plus: { fontSize: t.uit(30), color: t.muted, fontWeight: '300' },
    img: { width: '100%', height: '100%', resizeMode: 'contain' },
  });
}