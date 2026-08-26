import * as ImagePicker from 'expo-image-picker';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Field } from '@/components/Form';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

export type PickedPhoto = {
  uri: string;
  name: string;
  mimeType?: string | null;
};

const MAX_PHOTOS = 3;

export function PhotoAttach({
  photos,
  onChange,
}: {
  photos: PickedPhoto[];
  onChange: (photos: PickedPhoto[]) => void;
}) {
  const palette = Colors[useColorScheme()];
  const remaining = MAX_PHOTOS - photos.length;

  const addAssets = (assets: ImagePicker.ImagePickerAsset[]) => {
    const next = assets.slice(0, remaining).map((asset, index) => ({
      uri: asset.uri,
      name: asset.fileName || `photo-${photos.length + index + 1}.jpg`,
      mimeType: asset.mimeType || 'image/jpeg',
    }));
    if (next.length > 0) {
      onChange([...photos, ...next]);
    }
  };

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.7,
    });
    if (!result.canceled) {
      addAssets(result.assets);
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('카메라 권한이 필요합니다.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled) {
      addAssets(result.assets);
    }
  };

  const onAdd = () => {
    if (remaining <= 0) {
      return;
    }
    Alert.alert('사진 첨부', `최대 ${MAX_PHOTOS}장까지 첨부할 수 있습니다.`, [
      { text: '앨범', onPress: () => void pickFromLibrary() },
      { text: '촬영', onPress: () => void takePhoto() },
      { text: '취소', style: 'cancel' },
    ]);
  };

  return (
    <Field label={`사진 첨부 (${photos.length}/${MAX_PHOTOS})`}>
      <View style={styles.row}>
        {photos.map((photo, index) => (
          <View key={`${photo.uri}-${index}`} style={styles.slot}>
            <Image source={{ uri: photo.uri }} style={styles.image} />
            <Pressable
              onPress={() => onChange(photos.filter((_, item) => item !== index))}
              style={styles.remove}
              hitSlop={8}
              accessibilityLabel="사진 삭제">
              <Text style={styles.removeText}>×</Text>
            </Pressable>
          </View>
        ))}
        {remaining > 0 ? (
          <Pressable
            onPress={onAdd}
            style={[styles.slot, styles.add, { borderColor: palette.border }]}
            accessibilityLabel="사진 추가">
            <Text style={[styles.plus, { color: palette.tint }]}>+</Text>
            <Text style={[styles.addText, { color: palette.muted }]}>추가</Text>
          </Pressable>
        ) : null}
      </View>
    </Field>
  );
}

export function toRepairFormData({
  title,
  place,
  description,
  photos,
}: {
  title: string;
  place: string;
  description: string;
  photos: PickedPhoto[];
}) {
  const form = new FormData();
  form.append('title', title);
  form.append('place', place);
  form.append('description', description);
  for (const photo of photos) {
    form.append('photos', {
      uri: photo.uri,
      name: photo.name,
      type: photo.mimeType || 'image/jpeg',
    } as unknown as Blob);
  }
  return form;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  slot: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F4F4F4',
    maxWidth: 112,
  },
  add: {
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#FAFAFA',
  },
  addText: { fontSize: 12, fontWeight: '700' },
  plus: { fontSize: 28, lineHeight: 30, fontWeight: '300' },
  image: { width: '100%', height: '100%' },
  remove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', lineHeight: 16 },
});
