/**
 * @fileoverview Material Design 3.0 compliant Profile Screen component with enhanced security,
 * accessibility support, and comprehensive error handling
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { AccessibilityInfo, ScrollView, View, Alert } from 'react-native';
import styled from 'styled-components';
import Header from '../../components/common/Header';
import ProfileForm from '../../components/profile/ProfileForm';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { User, UserPreferences } from '../../types/user.types';
import { StorageService } from '../../services/storage.service';

// Styled components with theme support and accessibility considerations
const Container = styled(ScrollView)`
  flex: 1;
  background-color: ${({ theme }) => theme.colors.background};
  padding-horizontal: ${({ theme }) => theme.spacing.md};
`;

const Content = styled(View)`
  padding: ${({ theme }) => theme.spacing.lg};
  flex: 1;
  min-height: ${({ theme }) => theme.dimensions.minHeight};
`;

// Props interface
interface ProfileScreenProps {
  navigation: any;
  route: any;
}

// Component state interface
interface ProfileState {
  isLoading: boolean;
  error: Error | null;
  lastUpdate: Date | null;
}

/**
 * Profile screen component implementing Material Design 3.0 standards
 * with comprehensive security measures and accessibility support
 */
const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation, route }) => {
  // Hooks
  const { user, isAuthenticated } = useAuth();
  const { theme } = useTheme();
  const storageService = StorageService.getInstance();

  // Local state
  const [state, setState] = useState<ProfileState>({
    isLoading: false,
    error: null,
    lastUpdate: null
  });

  /**
   * Handle secure profile data updates
   */
  const handleProfileUpdate = useCallback(async (values: Partial<User>) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Validate user session
      if (!isAuthenticated || !user) {
        throw new Error('Authentication required');
      }

      // Sanitize and validate input data
      const sanitizedData = {
        ...user,
        name: values.name?.trim(),
        email: values.email?.toLowerCase().trim(),
        preferences: {
          ...user.preferences,
          language: values.preferences?.language,
          timezone: values.preferences?.timezone,
          notifications: values.preferences?.notifications
        }
      };

      // Update profile in secure storage
      await storageService.saveUserProfile(sanitizedData);

      setState(prev => ({
        ...prev,
        isLoading: false,
        lastUpdate: new Date()
      }));

      Alert.alert(
        'Success',
        'Profile updated successfully',
        [{ text: 'OK', onPress: () => {} }],
        { cancelable: false }
      );
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error as Error
      }));

      Alert.alert(
        'Error',
        'Failed to update profile. Please try again.',
        [{ text: 'OK', onPress: () => {} }],
        { cancelable: false }
      );
    }
  }, [user, isAuthenticated]);

  /**
   * Handle profile update errors
   */
  const handleError = useCallback((error: Error) => {
    setState(prev => ({ ...prev, error }));
    console.error('Profile update error:', error);
  }, []);

  /**
   * Handle successful profile update
   */
  const handleSuccess = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null,
      lastUpdate: new Date()
    }));
  }, []);

  /**
   * Setup accessibility configurations
   */
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility('Profile screen loaded');

    return () => {
      // Cleanup accessibility announcements
      AccessibilityInfo.announceForAccessibility('Leaving profile screen');
    };
  }, []);

  /**
   * Security check for authenticated access
   */
  useEffect(() => {
    if (!isAuthenticated) {
      navigation.replace('Login');
    }
  }, [isAuthenticated, navigation]);

  // Initial form values from user data
  const initialValues = {
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.preferences?.phone || '',
    timezone: user?.preferences?.timezone || '',
    notifications: user?.preferences?.notifications?.email || false,
    preferredLanguage: user?.preferences?.language || 'en',
    contactPreference: user?.preferences?.notifications?.preferredContact || 'email'
  };

  return (
    <>
      <Header
        title="Profile Settings"
        showBack
        onBackPress={() => navigation.goBack()}
        testID="profile-screen-header"
        accessibilityLabel="Profile Settings Screen"
      />
      <Container
        testID="profile-screen-container"
        accessibilityRole="scrollview"
        accessibilityLabel="Profile settings form container"
      >
        <Content>
          <ProfileForm
            initialValues={initialValues}
            onSubmit={handleProfileUpdate}
            isLoading={state.isLoading}
            onError={handleError}
            onSuccess={handleSuccess}
          />
        </Content>
      </Container>
    </>
  );
};

export default ProfileScreen;