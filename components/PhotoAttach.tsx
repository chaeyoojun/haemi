import * as ImagePicker from 'expo-image-picker';
import { Alert, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Field } from '@/components/Form';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { appendLocalFile } from '@/lib/formData';

export type PickedPhoto = {
  uri: string;
  name: string;
  mimeType?: string | null;
  blob?: Blob;
};

const MAX_PHOTOS = 3;
const JPEG_EXTS = new Set(['jpg', 'jpeg']);
const PNG_EXTS = new Set(['png']);
const CONVERTIBLE_EXTS = new Set(['heic', 'heif', 'webp']);

function fileExt(name: string) {
  const cleaned = (name || '').split(/[?#]/)[0];
  const parts = cleaned.toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() || '' : '';
}

function notify(message: string) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.alert(message);
    }
    return;
  }
  Alert.alert(message);
}

function previewExtForAsset(name?: string | null, mimeType?: string | null, uri?: string | null) {
  const nameExt = fileExt(name || '');
  const uriExt = fileExt(uri || '');
  const mime = (mimeType || '').toLowerCase();
  if (PNG_EXTS.has(nameExt) || PNG_EXTS.has(uriExt) || mime === 'image/png') {
    return 'png' as const;
  }
  if (JPEG_EXTS.has(nameExt) || JPEG_EXTS.has(uriExt) || mime === 'image/jpeg' || mime === 'image/jpg') {
    return nameExt === 'jpeg' || uriExt === 'jpeg' ? ('jpeg' as const) : ('jpg' as const);
  }
  if (Platform.OS !== 'web' && (CONVERTIBLE_EXTS.has(nameExt) || mime === 'image/heic' || mime === 'image/heif' || mime === 'image/webp')) {
    return PNG_EXTS.has(uriExt) ? ('png' as const) : ('jpg' as const);
  }
  return null;
}

export function isAllowedPreviewPhoto(name: string, mimeType?: string | null, uri?: string) {
  return previewExtForAsset(name, mimeType, uri) != null;
}

function photoFromAsset(
  asset: ImagePicker.ImagePickerAsset,
  index: number,
  fallbackPrefix: string,
  previewOnly: boolean
): PickedPhoto | null {
  const originalName = asset.fileName || `${fallbackPrefix}-${index + 1}.jpg`;
  if (previewOnly) {
    const ext = previewExtForAsset(asset.fileName, asset.mimeType, asset.uri);
    if (!ext) {
      return null;
    }
    const stem = originalName.replace(/\.[^.]+$/, '').trim() || `${fallbackPrefix}-${index + 1}`;
    return {
      uri: asset.uri,
      name: `${stem}.${ext}`,
      mimeType: ext === 'png' ? 'image/png' : 'image/jpeg',
      blob: asset.file,
    };
  }
  return {
    uri: asset.uri,
    name: originalName,
    mimeType: asset.mimeType || 'image/jpeg',
    blob: asset.file,
  };
}

const previewPickerOptions: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsMultipleSelection: true,
  quality: 0.7,
  preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
};

export async function pickPreviewPhotos(remaining: number) {
  if (remaining <= 0) {
    return [] as PickedPhoto[];
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    ...previewPickerOptions,
    selectionLimit: remaining,
  });
  if (result.canceled || !result.assets?.length) {
    return [] as PickedPhoto[];
  }
  const allowed: PickedPhoto[] = [];
  let rejected = false;
  for (const [index, asset] of result.assets.entries()) {
    const photo = photoFromAsset(asset, index, 'preview', true);
    if (!photo) {
      rejected = true;
      continue;
    }
    allowed.push(photo);
  }
  if (rejected) {
    notify('미리보기 사진은 JPG, JPEG, PNG만 올릴 수 있습니다.');
  }
  return allowed.slice(0, remaining);
}

export function PhotoAttach({
  photos,
  onChange,
  maxPhotos = MAX_PHOTOS,
  label = '사진 첨부',
  formats,
}: {
  photos: PickedPhoto[];
  onChange: (photos: PickedPhoto[]) => void;
  maxPhotos?: number;
  label?: string;
  formats?: string[];
}) {
  const palette = Colors[useColorScheme()];
  const remaining = maxPhotos - photos.length;
  const previewOnly = Boolean(formats?.length);

  const addAssets = (assets: ImagePicker.ImagePickerAsset[]) => {
    const next: PickedPhoto[] = [];
    let rejected = false;
    for (const [index, asset] of assets.slice(0, remaining).entries()) {
      const photo = photoFromAsset(asset, photos.length + index, 'photo', previewOnly);
      if (!photo) {
        rejected = true;
        continue;
      }
      next.push(photo);
    }
    if (rejected) {
      notify('미리보기 사진은 JPG, JPEG, PNG만 올릴 수 있습니다.');
    }
    if (next.length > 0) {
      onChange([...photos, ...next]);
    }
  };

  const pickFromLibrary = async () => {
    if (previewOnly) {
      const picked = await pickPreviewPhotos(remaining);
      if (picked.length > 0) {
        onChange([...photos, ...picked]);
      }
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      ...previewPickerOptions,
      selectionLimit: remaining,
    });
    if (!result.canceled) {
      addAssets(result.assets);
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      notify('카메라 권한이 필요합니다.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
    if (!result.canceled) {
      addAssets(result.assets);
    }
  };

  const onAdd = () => {
    if (remaining <= 0) {
      return;
    }
    if (Platform.OS === 'web') {
      void pickFromLibrary();
      return;
    }
    Alert.alert(label, `최대 ${maxPhotos}장까지 첨부할 수 있습니다.`, [
      { text: '앨범', onPress: () => void pickFromLibrary() },
      { text: '촬영', onPress: () => void takePhoto() },
      { text: '취소', style: 'cancel' },
    ]);
  };

  return (
    <Field label={`${label} (${photos.length}/${maxPhotos})`}>
      {previewOnly ? (
        <Text style={[styles.hint, { color: palette.muted }]}>JPG, JPEG, PNG만 올릴 수 있습니다.</Text>
      ) : null}
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
    appendLocalFile(form, 'photos', photo);
  }
  return form;
}

const styles = StyleSheet.create({
  hint: { fontSize: 13, lineHeight: 18, marginBottom: 2 },
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
