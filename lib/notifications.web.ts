export async function registerPushToken() {}

export function listenForNotificationOpen(_openUrl: (url: string) => void) {
  return () => {};
}

export async function promptAndRegisterNotifications() {}

export async function syncVoteEndAlerts(_votes?: { id: string; title: string; endsAt: string }[]) {}
