import { Platform, useWindowDimensions } from 'react-native';

export const WIDE_BREAKPOINT = 800;
export const PAGE_MAX_WIDTH = 1080;
export const FORM_MAX_WIDTH = 640;

export function useWideLayout() {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= WIDE_BREAKPOINT;
}

export function useConstrainedStyle(maxWidth = PAGE_MAX_WIDTH) {
  const wide = useWideLayout();
  if (!wide) {
    return null;
  }
  return { maxWidth, width: '100%' as const, alignSelf: 'center' as const };
}
