/**
 * @fileoverview Material Design 3.0 compliant settings item component
 * Implements WCAG 2.1 AA accessibility standards with RTL support
 * Version: 1.0.0
 */

import React from 'react';
import styled from 'styled-components';
import { TouchableOpacity, View, Platform, I18nManager } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons'; // v13.0.0
import Text from '../../components/common/Text';

/**
 * Props interface for the SettingsItem component
 */
interface SettingsItemProps {
  icon: string;
  label: string;
  value?: string;
  type: 'navigate' | 'toggle' | 'action';
  onPress: () => void;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  disabled?: boolean;
  isRTL?: boolean;
}

/**
 * Styled container component with RTL support and Material elevation
 */
const Container = styled(TouchableOpacity)<{ isRTL?: boolean; disabled?: boolean }>`
  flex-direction: ${props => props.isRTL ? 'row-reverse' : 'row'};
  align-items: center;
  padding: 16px;
  background-color: ${props => props.theme.colors.surface};
  border-radius: 8px;
  margin-bottom: 8px;
  elevation: ${Platform.select({ ios: 0, android: 2 })};
  shadow-color: ${props => props.theme.colors.shadow};
  shadow-offset: 0px 2px;
  shadow-opacity: 0.25;
  shadow-radius: 3.84px;
  opacity: ${props => props.disabled ? 0.5 : 1};
  min-height: 56px;
`;

/**
 * Styled icon container with themed background
 */
const IconContainer = styled(View)`
  width: 40px;
  height: 40px;
  justify-content: center;
  align-items: center;
  margin-horizontal: 12px;
  background-color: ${props => props.theme.colors.primaryLight};
  border-radius: 20px;
`;

/**
 * Styled content container with flexible layout
 */
const ContentContainer = styled(View)`
  flex: 1;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
`;

/**
 * Settings item component with Material Design and accessibility support
 */
const SettingsItem: React.FC<SettingsItemProps> = React.memo(({
  icon,
  label,
  value,
  type,
  onPress,
  testID,
  accessibilityLabel,
  accessibilityHint,
  disabled = false,
  isRTL = I18nManager.isRTL,
}) => {
  /**
   * Determine the appropriate chevron icon based on type and RTL
   */
  const getChevronIcon = () => {
    if (type === 'navigate') {
      return isRTL ? 'chevron-left' : 'chevron-right';
    }
    return type === 'toggle' ? 'toggle-switch' : undefined;
  };

  /**
   * Generate appropriate accessibility props
   */
  const getAccessibilityProps = () => ({
    accessible: true,
    accessibilityRole: 'button',
    accessibilityState: { disabled },
    accessibilityLabel: accessibilityLabel || `${label}${value ? `, ${value}` : ''}`,
    accessibilityHint: accessibilityHint || `Activates ${label} setting`,
  });

  return (
    <Container
      onPress={onPress}
      disabled={disabled}
      isRTL={isRTL}
      testID={testID}
      {...getAccessibilityProps()}
    >
      <IconContainer>
        <MaterialCommunityIcons
          name={icon}
          size={24}
          color={props => props.theme.colors.primary}
        />
      </IconContainer>

      <ContentContainer>
        <Text
          variant="body"
          weight="medium"
          style={{ flex: 1 }}
        >
          {label}
        </Text>

        {value && (
          <Text
            variant="body"
            color="textSecondary"
            style={{ marginHorizontal: 8 }}
          >
            {value}
          </Text>
        )}

        {getChevronIcon() && (
          <MaterialCommunityIcons
            name={getChevronIcon()}
            size={24}
            color={props => props.theme.colors.textSecondary}
            style={{ marginLeft: 8 }}
          />
        )}
      </ContentContainer>
    </Container>
  );
});

SettingsItem.displayName = 'SettingsItem';

export default SettingsItem;