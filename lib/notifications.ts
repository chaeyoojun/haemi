import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Alert, Platform } from 'react-native';

import { api } from '@/lib/api';

const ASKED_KEY = 'haemi.askedNotifications';

type NotificationsModule = typeof import('expo-notifications');

function loadNotifications(): NotificationsModule | null {
  if (Constants.appOwnership === 'expo') {
    return null;
  }
  try {
    return require('expo-notifications') as NotificationsModule;
  } catch {
    return null;
  }
}

function projectId() {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

async function prepareNotifications() {
  const Notifications = loadNotifications();
  if (!Notifications) {
    return null;
  }
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
    await Notifications.setNotificationChannelAsync('votes', { ...channel, name: '투표' });
  }
  return Notifications;
}

async function registerToken(Notifications: NotificationsModule) {
  const id = projectId();
  if (!id) {
    return;
  }
  const token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
  if (token) {
    await api.create('/api/push-tokens', { token });
  }
}

async function requestSystemPermission(Notifications: NotificationsModule) {
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
    const Notifications = await prepareNotifications();
    if (!Notifications) {
      return;
    }
    const existing = await Notifications.getPermissionsAsync();
    if (existing.status !== 'granted') {
      return;
    }
    await registerToken(Notifications);
  } catch (error) {
    console.warn('push token registration failed', error);
  }
}

export function listenForNotificationOpen(openUrl: (url: string) => void) {
  const Notifications = loadNotifications();
  if (!Notifications) {
    return () => {};
  }
  let lastHandled = '';
  const open = (response: import('expo-notifications').NotificationResponse | null) => {
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
    const Notifications = await prepareNotifications();
    if (!Notifications) {
      return;
    }
    const existing = await Notifications.getPermissionsAsync();
    if (existing.status === 'granted') {
      await registerToken(Notifications);
      await syncVoteEndAlerts();
      return;
    }

    const asked = await AsyncStorage.getItem(ASKED_KEY);
    if (asked === '1') {
      return;
    }

    Alert.alert('알림 권한', '공지, 수리 완료, 투표 마감을 휴대폰 알림으로 알려 드립니다. 알림을 허용할까요?', [
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
          requestSystemPermission(Notifications)
            .then((granted) => {
              if (granted) {
                return registerToken(Notifications).then(() => syncVoteEndAlerts());
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

const VOTE_END_PREFIX = 'haemi.vote.end.';

function voteEndId(id: string) {
  return `${VOTE_END_PREFIX}${id}`;
}

type VoteAlert = {
  id: string;
  title: string;
  endsAt: string;
};

export async function syncVoteEndAlerts(votes?: VoteAlert[]) {
  try {
    const Notifications = await prepareNotifications();
    if (!Notifications) {
      return;
    }
    const permission = await Notifications.getPermissionsAsync();
    if (permission.status !== 'granted') {
      return;
    }

    const list = votes ?? (await api.list<VoteAlert>('/api/votes'));
    const open = list.filter((vote) => {
      const ends = new Date(vote.endsAt).getTime();
      return Number.isFinite(ends) && ends > Date.now() + 1500;
    });

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const item of scheduled) {
      if (item.identifier.startsWith(VOTE_END_PREFIX)) {
        await Notifications.cancelScheduledNotificationAsync(item.identifier);
      }
    }

    for (const vote of open) {
      const title = vote.title.trim() || '투표';
      const ends = new Date(vote.endsAt);
      const content = {
        title: '투표 종료',
        body: `「${title}」 투표가 마감되었습니다.`,
        data: { url: `/vote/${vote.id}` },
        sound: true as const,
      };
      try {
        await Notifications.scheduleNotificationAsync({
          identifier: voteEndId(vote.id),
          content,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: ends,
            channelId: 'votes',
          },
        });
      } catch {
        const seconds = Math.max(1, Math.ceil((ends.getTime() - Date.now()) / 1000));
        await Notifications.scheduleNotificationAsync({
          identifier: voteEndId(vote.id),
          content,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds,
            channelId: 'votes',
          },
        });
      }
    }
  } catch (error) {
    console.warn('vote end alerts failed', error);
  }
}
