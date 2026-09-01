import { api } from '@/lib/api';

const pins = new Map<string, string>();

export function rememberModelPin(id: string, pin: string) {
  pins.set(id, pin);
}

export function forgetModelPin(id: string) {
  pins.delete(id);
}

export function modelPin(id: string) {
  return pins.get(id) || '';
}

export function modelPinHeaders(id: string): Record<string, string> {
  const pin = modelPin(id);
  return pin ? { 'X-Model-Pin': pin } : {};
}

export function isModelPin(value: string) {
  return /^\d{4}$/.test(value);
}

export async function unlockOrSetModelPin(id: string, pin: string, isAdmin: boolean, hasPin: boolean) {
  if (!isModelPin(pin)) {
    throw new Error('비밀번호는 숫자 4자리여야 합니다.');
  }
  if (!hasPin) {
    await api.create(`/api/models/${id}/pin`, { pin });
    rememberModelPin(id, pin);
    return;
  }
  if (isAdmin) {
    return;
  }
  await api.create(`/api/models/${id}/unlock`, { pin });
  rememberModelPin(id, pin);
}
