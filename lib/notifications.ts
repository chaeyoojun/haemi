import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Alert, Platform } from 'react-native';

import { api } from '@/lib/api';

const ASKED_KEY = 'haemi.askedNotifications';

function projectId() {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

async function prepareNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  if (Platform.OS === 'android') {
    const channel = {
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F07D22',
    };
    await Notifications.setNotificationChannelAsync('repairs', { ...channel, name: '수리' });
    await Notifications.setNotificationChannelAsync('notices', { ...channel, name: '공지' });
  }
}

async function registerToken() {
  const id = projectId();
  if (!id) {
    return;
  }
  const token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
  if (token) {
    await api.create('/api/push-tokens', { token });
  }
}

async function requestSystemPermission() {
  const result = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });
  return result.status === 'granted';
}

export async function registerPushToken() {
  try {
    await prepareNotifications();
    const existing = await Notifications.getPermissionsAsync();
    if (existing.status !== 'granted') {
      return;
    }
    await registerToken();
  } catch (error) {
    console.warn('push token registration failed', error);
  }
}

export function listenForNotificationOpen(openUrl: (url: string) => void) {
  let lastHandled = '';
  const open = (response: Notifications.NotificationResponse | null) => {
    const id = response?.notification.request.identifier ?? '';
    const url = response?.notification.request.content.data?.url;
    if (!id || id === lastHandled || typeof url !== 'string' || !url.startsWith('/')) {
      return;
    }
    lastHandled = id;
    openUrl(url);
  };

  const sub = Notifications.addNotificationResponseReceivedListener(open);
  Notifications.getLastNotificationResponseAsync().then(open).catch(() => undefined);
  return () => sub.remove();
}

export async function promptAndRegisterNotifications() {
  try {
    await prepareNotifications();
    const existing = await Notifications.getPermissionsAsync();
    if (existing.status === 'granted') {
      await registerToken();
      return;
    }

    const asked = await AsyncStorage.getItem(ASKED_KEY);
    if (asked === '1') {
      return;
    }

    Alert.alert('알림 권한', '공지가 올라오거나 수리가 완료되면 휴대폰 알림으로 알려 드립니다. 알림을 허용할까요?', [
      {
        text: '나중에',
        style: 'cancel',
        onPress: () => {
          AsyncStorage.setItem(ASKED_KEY, '1').catch(() => undefined);
        },
      },
      {
        text: '허용',
        onPress: () => {
          AsyncStorage.setItem(ASKED_KEY, '1').catch(() => undefined);
          requestSystemPermission()
            .then((granted) => {
              if (granted) {
                return registerToken();
              }
            })
            .catch((error) => {
              console.warn('notification permission failed', error);
            });
        },
      },
    ]);
  } catch (error) {
    console.warn('notification prompt failed', error);
  }
}
