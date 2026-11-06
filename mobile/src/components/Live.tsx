import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, Text, ViewStyle } from 'react-native';
import { colors, ui } from '../theme';

// The one element in the app allowed to animate in a loop, because it really is live.
export function LiveDot({ size = 8, style }: { size?: number; style?: ViewStyle }) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.45, duration: 1000, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      style={[ui.liveDot, { width: size, height: size, borderRadius: size / 2, opacity }, style]}
      accessibilityElementsHidden
    />
  );
}

export function LiveTag({ label = 'Live', style }: { label?: string; style?: ViewStyle }) {
  return (
    <View style={[styles.tag, style]}>
      <LiveDot />
      <Text style={ui.liveText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});

export const liveColor = colors.live;
