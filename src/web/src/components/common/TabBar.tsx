import React, { useCallback, memo } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, Platform } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialIcons'; // ^9.0.0
import { useColorScheme } from 'react';
import { MainStackParamList } from '../../types/navigation.types';
import { DEFAULT_THEME, DARK_THEME } from '../../constants/theme.constants';

/**
 * Mapping of tab routes to their respective Material Icons
 */
const TAB_ICONS = {
  Home: 'home',
  Monitor: 'mic',
  History: 'history',
  Profile: 'person',
} as const;

/**
 * Display labels for each tab
 */
const TAB_LABELS = {
  Home: 'Home',
  Monitor: 'Monitor',
  History: 'History',
  Profile: 'Profile',
} as const;

/**
 * Accessibility labels for screen readers
 */
const ACCESSIBILITY_LABELS = {
  Home: 'Navigate to Home screen',
  Monitor: 'Navigate to Baby Monitor screen',
  History: 'Navigate to History screen',
  Profile: 'Navigate to Profile screen',
} as const;

/**
 * Props interface for the TabBar component
 */
interface TabBarProps extends BottomTabBarProps {
  highContrast?: boolean;
}

/**
 * TabBar component implementing Material Design 3.0 guidelines
 * with full accessibility support and dynamic theming
 */
const TabBar = memo(({ state, descriptors, navigation, highContrast }: TabBarProps) => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? DARK_THEME : DEFAULT_THEME;

  const handleTabPress = useCallback((route: string, isFocused: boolean) => {
    const event = navigation.emit({
      type: 'tabPress',
      target: route,
      canPreventDefault: true,
    });

    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(route);
    }
  }, [navigation]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;
        const routeName = route.name as keyof MainStackParamList;

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: isFocused }}
            accessibilityLabel={ACCESSIBILITY_LABELS[routeName]}
            accessibilityHint={`Double tap to ${isFocused ? 'stay on' : 'navigate to'} ${TAB_LABELS[routeName]} tab`}
            onPress={() => handleTabPress(route.name, isFocused)}
            style={styles.tab}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <Icon
              name={TAB_ICONS[routeName]}
              size={24}
              color={isFocused ? theme.colors.primary : theme.colors.textSecondary}
              style={styles.icon}
            />
            <Text
              style={[
                styles.label,
                {
                  color: isFocused ? theme.colors.primary : theme.colors.textSecondary,
                  fontWeight: isFocused ? '500' : '400',
                },
              ]}
              numberOfLines={1}
            >
              {TAB_LABELS[routeName]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: Platform.select({ ios: 84, android: 64 }),
    paddingBottom: Platform.select({ ios: 20, android: 0 }),
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  tab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
    minHeight: 44, // WCAG touch target size
  },
  icon: {
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    textAlign: 'center',
    letterSpacing: 0.4,
  },
});

TabBar.displayName = 'TabBar';

export default TabBar;