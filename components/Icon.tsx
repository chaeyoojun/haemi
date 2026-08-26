import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import type { ColorValue } from 'react-native';

type IconProps = {
  ios: SFSymbol;
  android: AndroidSymbol;
  color: ColorValue;
  size?: number;
};

export function Icon({ ios, android, color, size = 24 }: IconProps) {
  return (
    <SymbolView
      name={{ ios, android, web: android }}
      tintColor={color}
      size={size}
    />
  );
}
