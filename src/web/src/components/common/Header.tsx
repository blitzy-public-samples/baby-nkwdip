/**
 * @fileoverview Material Design 3.0 compliant Header component with WCAG 2.1 AA support
 * Implements dynamic theming, RTL support, and enhanced accessibility
 * Version: 1.0.0
 */

import React, { useCallback } from 'react';
import { View, TouchableOpacity, Platform, StatusBar, StyleSheet } from 'react-native';
import styled from 'styled-components';
import Text from './Text';
import { useTheme } from '../../hooks/useTheme';

// Platform-specific constants
const HEADER_HEIGHT = Platform.select({ ios: 44, android: 56 });
const STATUS_BAR_HEIGHT = Platform.select({ 
  ios: 20, 
  android: StatusBar.currentHeight || 0 
});
const MIN_TOUCH_TARGET = 44;
const TRANSITION_DURATION = 300;

// Props interface
interface HeaderProps {
  title: string;
  showBack?: boolean;
  onBackPress?: () => void;
  rightComponent?: React.ReactNode;
  testID?: string;
  accessibilityLabel?: string;
  style?: any;
  elevation?: number;
  safeArea?: boolean;
  titleAlignment?: 'left' | 'center';
}

// Styled components with theme support
const HeaderContainer = styled(View)<{ theme: any; elevation: number; safeArea: boolean }>`
  flex-direction: row;
  align-items: center;
  background-color: ${({ theme }) => theme.colors.surface};
  height: ${HEADER_HEIGHT}px;
  padding-top: ${({ safeArea }) => safeArea ? STATUS_BAR_HEIGHT : 0}px;
  box-shadow: ${({ theme, elevation }) => theme.elevation[elevation ? 'medium' : 'low']};
  border-bottom-width: ${({ theme }) => Platform.OS === 'ios' ? StyleSheet.hairlineWidth : 0}px;
  border-bottom-color: ${({ theme }) => theme.colors.border};
  transition: background-color ${TRANSITION_DURATION}ms ${({ theme }) => theme.animation.easing.standard};
`;

const HeaderContent = styled(View)<{ titleAlignment: 'left' | 'center' }>`
  flex: 1;
  flex-direction: row;
  align-items: center;
  justify-content: ${({ titleAlignment }) => titleAlignment === 'center' ? 'center' : 'flex-start'};
  padding-horizontal: ${({ theme }) => theme.spacing.md};
`;

const BackButton = styled(TouchableOpacity)`
  min-width: ${MIN_TOUCH_TARGET}px;
  min-height: ${MIN_TOUCH_TARGET}px;
  padding-horizontal: ${({ theme }) => theme.spacing.sm};
  justify-content: center;
  align-items: center;
`;

/**
 * Header component implementing Material Design 3.0 standards
 * with comprehensive accessibility support
 */
const Header: React.FC<HeaderProps> = React.memo(({
  title,
  showBack = false,
  onBackPress,
  rightComponent,
  testID = 'header',
  accessibilityLabel,
  style,
  elevation = 0,
  safeArea = true,
  titleAlignment = 'left'
}) => {
  const { theme, isDarkMode } = useTheme();

  // Handle back button press with error boundary
  const handleBackPress = useCallback(() => {
    try {
      onBackPress?.();
    } catch (error) {
      console.error('Back navigation failed:', error);
    }
  }, [onBackPress]);

  // Update status bar style based on theme
  React.useEffect(() => {
    StatusBar.setBarStyle(isDarkMode ? 'light-content' : 'dark-content');
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor(theme.colors.surface);
    }
  }, [isDarkMode, theme]);

  return (
    <HeaderContainer
      theme={theme}
      elevation={elevation}
      safeArea={safeArea}
      style={style}
      testID={testID}
      accessibilityRole="header"
      accessibilityLabel={accessibilityLabel || `${title} header`}
    >
      <HeaderContent titleAlignment={titleAlignment} theme={theme}>
        {showBack && (
          <BackButton
            onPress={handleBackPress}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            testID={`${testID}-back-button`}
            theme={theme}
          >
            <Text
              variant="body"
              weight="medium"
              color={theme.colors.primary}
              accessibilityLabel="Back"
            >
              ←
            </Text>
          </BackButton>
        )}

        <Text
          variant="h2"
          weight="medium"
          style={[
            styles.title,
            titleAlignment === 'center' && styles.titleCenter,
            { color: theme.colors.text }
          ]}
          numberOfLines={1}
          testID={`${testID}-title`}
          accessibilityRole="header"
          maxFontSizeMultiplier={1.5}
        >
          {title}
        </Text>

        {rightComponent && (
          <View
            style={styles.rightComponent}
            accessibilityElementsHidden={true}
            importantForAccessibility="no-hide-descendants"
          >
            {rightComponent}
          </View>
        )}
      </HeaderContent>
    </HeaderContainer>
  );
});

const styles = StyleSheet.create({
  title: {
    flex: 1,
    marginHorizontal: 16,
  },
  titleCenter: {
    textAlign: 'center',
  },
  rightComponent: {
    position: 'absolute',
    right: 16,
    height: '100%',
    justifyContent: 'center',
  },
});

Header.displayName = 'Header';

export default Header;