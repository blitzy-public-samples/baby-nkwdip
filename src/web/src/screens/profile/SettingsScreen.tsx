/**
 * @fileoverview Material Design 3.0 compliant settings screen component
 * Implements WCAG 2.1 AA accessibility standards with dynamic theming
 * Version: 1.0.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, AccessibilityInfo } from 'react-native';
import styled from 'styled-components';
import MaterialCommunityIcons from '@expo/vector-icons'; // v13.0.0
import SettingsItem from '../../components/profile/SettingsItem';
import ThemeSwitch from '../../components/profile/ThemeSwitch';
import { useTheme } from '../../hooks/useTheme';
import { setSecureItem, getSecureItem } from '../../utils/storage.util';

/**
 * Settings screen props interface
 */
interface SettingsScreenProps {
  navigation: NavigationProp<SettingsStackParamList>;
  route: RouteProp<SettingsStackParamList, 'Settings'>;
  testID?: string;
  accessibilityLabel?: string;
}

/**
 * Settings state interface
 */
interface SettingsState {
  theme: ThemePreference;
  notifications: {
    enabled: boolean;
    sound: boolean;
    vibration: boolean;
  };
  audioMonitoring: {
    backgroundEnabled: boolean;
    sensitivity: 'low' | 'medium' | 'high';
    noiseReduction: boolean;
  };
  privacy: {
    dataCollection: boolean;
    analytics: boolean;
  };
  systemSync: boolean;
}

/**
 * Styled components with Material Design 3.0 specifications
 */
const Container = styled(ScrollView)`
  flex: 1;
  background-color: ${props => props.theme.colors.background};
  padding: ${props => props.theme.spacing.md};
`;

const Section = styled(View)`
  margin-bottom: ${props => props.theme.spacing.lg};
  border-radius: ${props => props.theme.components.card.borderRadius};
  background-color: ${props => props.theme.colors.surface};
  elevation: 2;
  shadow-color: ${props => props.theme.colors.shadow};
  shadow-offset: 0px 2px;
  shadow-opacity: 0.25;
  shadow-radius: 3.84px;
`;

const SectionTitle = styled(View)`
  padding: ${props => props.theme.spacing.sm} ${props => props.theme.spacing.md};
  border-bottom-width: 1px;
  border-bottom-color: ${props => props.theme.colors.divider};
`;

/**
 * Settings screen component with full accessibility support
 */
const SettingsScreen: React.FC<SettingsScreenProps> = ({
  navigation,
  testID = 'settings-screen',
  accessibilityLabel = 'Settings Screen'
}) => {
  const { theme, isDarkMode, toggleTheme, resetToSystemTheme } = useTheme();
  const [settings, setSettings] = useState<SettingsState>({
    theme: 'system',
    notifications: {
      enabled: true,
      sound: true,
      vibration: true
    },
    audioMonitoring: {
      backgroundEnabled: true,
      sensitivity: 'medium',
      noiseReduction: true
    },
    privacy: {
      dataCollection: true,
      analytics: false
    },
    systemSync: true
  });

  /**
   * Load saved settings on mount
   */
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedSettings = await getSecureItem('user_settings');
        if (savedSettings) {
          setSettings(savedSettings);
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };
    loadSettings();
  }, []);

  /**
   * Save settings when updated
   */
  const updateSettings = useCallback(async (newSettings: Partial<SettingsState>) => {
    try {
      const updatedSettings = { ...settings, ...newSettings };
      await setSecureItem('user_settings', updatedSettings);
      setSettings(updatedSettings);
      
      // Announce changes to screen readers
      AccessibilityInfo.announceForAccessibility('Settings updated successfully');
    } catch (error) {
      console.error('Failed to save settings:', error);
      AccessibilityInfo.announceForAccessibility('Failed to update settings');
    }
  }, [settings]);

  return (
    <Container
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="scrollview"
    >
      <Section>
        <SectionTitle accessibilityRole="header">
          <Text variant="h2" color={theme.colors.primary}>Appearance</Text>
        </SectionTitle>
        <ThemeSwitch
          label="Dark Mode"
          testID="theme-switch"
          onError={(error) => console.error('Theme switch error:', error)}
        />
        <SettingsItem
          icon="theme-light-dark"
          label="System Theme"
          type="toggle"
          onPress={() => resetToSystemTheme()}
          value={settings.systemSync ? 'On' : 'Off'}
        />
      </Section>

      <Section>
        <SectionTitle accessibilityRole="header">
          <Text variant="h2" color={theme.colors.primary}>Notifications</Text>
        </SectionTitle>
        <SettingsItem
          icon="bell-outline"
          label="Enable Notifications"
          type="toggle"
          onPress={() => updateSettings({
            notifications: {
              ...settings.notifications,
              enabled: !settings.notifications.enabled
            }
          })}
          value={settings.notifications.enabled ? 'On' : 'Off'}
        />
        <SettingsItem
          icon="volume-high"
          label="Sound"
          type="toggle"
          onPress={() => updateSettings({
            notifications: {
              ...settings.notifications,
              sound: !settings.notifications.sound
            }
          })}
          value={settings.notifications.sound ? 'On' : 'Off'}
          disabled={!settings.notifications.enabled}
        />
        <SettingsItem
          icon="vibrate"
          label="Vibration"
          type="toggle"
          onPress={() => updateSettings({
            notifications: {
              ...settings.notifications,
              vibration: !settings.notifications.vibration
            }
          })}
          value={settings.notifications.vibration ? 'On' : 'Off'}
          disabled={!settings.notifications.enabled}
        />
      </Section>

      <Section>
        <SectionTitle accessibilityRole="header">
          <Text variant="h2" color={theme.colors.primary}>Audio Monitoring</Text>
        </SectionTitle>
        <SettingsItem
          icon="microphone-outline"
          label="Background Monitoring"
          type="toggle"
          onPress={() => updateSettings({
            audioMonitoring: {
              ...settings.audioMonitoring,
              backgroundEnabled: !settings.audioMonitoring.backgroundEnabled
            }
          })}
          value={settings.audioMonitoring.backgroundEnabled ? 'On' : 'Off'}
        />
        <SettingsItem
          icon="tune"
          label="Sensitivity"
          type="navigate"
          onPress={() => navigation.navigate('AudioSensitivity')}
          value={settings.audioMonitoring.sensitivity}
        />
        <SettingsItem
          icon="noise-control-off"
          label="Noise Reduction"
          type="toggle"
          onPress={() => updateSettings({
            audioMonitoring: {
              ...settings.audioMonitoring,
              noiseReduction: !settings.audioMonitoring.noiseReduction
            }
          })}
          value={settings.audioMonitoring.noiseReduction ? 'On' : 'Off'}
        />
      </Section>

      <Section>
        <SectionTitle accessibilityRole="header">
          <Text variant="h2" color={theme.colors.primary}>Privacy</Text>
        </SectionTitle>
        <SettingsItem
          icon="database"
          label="Data Collection"
          type="toggle"
          onPress={() => updateSettings({
            privacy: {
              ...settings.privacy,
              dataCollection: !settings.privacy.dataCollection
            }
          })}
          value={settings.privacy.dataCollection ? 'On' : 'Off'}
        />
        <SettingsItem
          icon="chart-bar"
          label="Analytics"
          type="toggle"
          onPress={() => updateSettings({
            privacy: {
              ...settings.privacy,
              analytics: !settings.privacy.analytics
            }
          })}
          value={settings.privacy.analytics ? 'On' : 'Off'}
        />
        <SettingsItem
          icon="shield-lock-outline"
          label="Privacy Policy"
          type="navigate"
          onPress={() => navigation.navigate('PrivacyPolicy')}
        />
      </Section>
    </Container>
  );
};

export default SettingsScreen;