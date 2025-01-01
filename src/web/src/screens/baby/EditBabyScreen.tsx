/**
 * @fileoverview Material Design 3.0 compliant screen component for editing baby profiles
 * Implements WCAG 2.1 AA accessibility standards and comprehensive validation
 * Version: 1.0.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View } from 'react-native';
import styled from 'styled-components';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { withErrorBoundary } from 'react-error-boundary';
import analytics from '@segment/analytics-react-native';

import Header from '../../components/common/Header';
import BabyForm from '../../components/baby/BabyForm';
import { useBaby } from '../../hooks/useBaby';
import { useTheme } from '../../hooks/useTheme';
import { Baby } from '../../types/baby.types';

// Navigation and route types
type RootStackParamList = {
  EditBaby: {
    babyId: string;
    returnTo: string;
  };
};

type EditBabyScreenProps = {
  route: RouteProp<RootStackParamList, 'EditBaby'>;
  navigation: any;
};

// Styled components with accessibility support
const Container = styled(View)`
  flex: 1;
  background-color: ${({ theme }) => theme.colors.background};
  padding: ${({ theme }) => theme.spacing.md};
`;

const LoadingContainer = styled(View)`
  flex: 1;
  justify-content: center;
  align-items: center;
`;

/**
 * Enhanced error boundary fallback component
 */
const ErrorFallback = ({ error, resetErrorBoundary }) => (
  <Container>
    <Header 
      title="Error" 
      showBack 
      onBackPress={resetErrorBoundary}
    />
    <View style={{ padding: 16 }}>
      <Text>Something went wrong: {error.message}</Text>
    </View>
  </Container>
);

/**
 * EditBabyScreen component with comprehensive profile management
 */
const EditBabyScreen: React.FC<EditBabyScreenProps> = ({ route }) => {
  const { babyId, returnTo } = route.params;
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { updateBaby, loading, error } = useBaby();

  // Local state management
  const [baby, setBaby] = useState<Baby | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Fetch baby data on mount
  useEffect(() => {
    const fetchBabyData = async () => {
      try {
        const response = await useBaby().getBaby(babyId);
        if (response.data) {
          setBaby(response.data);
          // Track screen view
          analytics.screen('Edit Baby Profile', {
            babyId,
            babyName: response.data.name
          });
        }
      } catch (error) {
        console.error('Failed to fetch baby data:', error);
      }
    };

    fetchBabyData();
  }, [babyId]);

  // Handle navigation prevention with unsaved changes
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      if (!hasUnsavedChanges) return;

      e.preventDefault();
      // Show confirmation dialog
      Alert.alert(
        'Discard changes?',
        'You have unsaved changes. Are you sure you want to discard them?',
        [
          { text: "Don't leave", style: 'cancel', onPress: () => {} },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => navigation.dispatch(e.data.action),
          },
        ]
      );
    });

    return unsubscribe;
  }, [hasUnsavedChanges, navigation]);

  // Handle form submission with validation and analytics
  const handleSubmit = useCallback(async (updatedBaby: Baby) => {
    try {
      const result = await updateBaby(babyId, updatedBaby);
      if (result.data) {
        // Track successful update
        analytics.track('Baby Profile Updated', {
          babyId,
          updatedFields: Object.keys(updatedBaby)
        });

        setHasUnsavedChanges(false);
        navigation.navigate(returnTo);
      }
    } catch (error) {
      // Track error
      analytics.track('Baby Profile Update Failed', {
        babyId,
        error: error.message
      });
      throw error;
    }
  }, [babyId, navigation, returnTo, updateBaby]);

  // Handle cancellation with proper cleanup
  const handleCancel = useCallback(() => {
    if (hasUnsavedChanges) {
      Alert.alert(
        'Discard changes?',
        'Are you sure you want to discard your changes?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          { 
            text: 'Discard',
            style: 'destructive',
            onPress: () => navigation.navigate(returnTo)
          }
        ]
      );
    } else {
      navigation.navigate(returnTo);
    }
  }, [hasUnsavedChanges, navigation, returnTo]);

  // Memoized form change handler
  const handleFormChange = useCallback(() => {
    setHasUnsavedChanges(true);
  }, []);

  if (!baby) {
    return (
      <LoadingContainer>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </LoadingContainer>
    );
  }

  return (
    <Container>
      <Header
        title="Edit Baby Profile"
        showBack
        onBackPress={handleCancel}
        testID="edit-baby-header"
        accessibilityLabel="Edit Baby Profile Screen"
      />
      <BabyForm
        baby={baby}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        onChange={handleFormChange}
        loading={loading}
        error={error}
      />
    </Container>
  );
};

// Enhanced error boundary wrapper
const EnhancedEditBabyScreen = withErrorBoundary(EditBabyScreen, {
  FallbackComponent: ErrorFallback,
  onError: (error) => {
    // Track error
    analytics.track('Baby Profile Edit Error', {
      error: error.message
    });
  }
});

export default EnhancedEditBabyScreen;