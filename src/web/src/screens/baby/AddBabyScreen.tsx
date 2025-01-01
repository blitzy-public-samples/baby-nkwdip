/**
 * @fileoverview Material Design 3.0 compliant screen for adding new baby profiles
 * Implements WCAG 2.1 AA accessibility standards and comprehensive validation
 * Version: 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import styled from 'styled-components';
import analytics from '@react-native-firebase/analytics';
import BabyForm from '../../components/baby/BabyForm';
import Header from '../../components/common/Header';
import { useBaby } from '../../hooks/useBaby';
import { useTheme } from '../../hooks/useTheme';
import { Baby } from '../../types/baby.types';

// Styled components with RTL support and accessibility
const StyledContainer = styled.View<{ isRTL: boolean }>`
  flex: 1;
  background-color: ${({ theme }) => theme.colors.background};
  padding: ${({ theme }) => theme.spacing.md};
  direction: ${({ isRTL }) => isRTL ? 'rtl' : 'ltr'};
`;

const StyledContent = styled.View`
  flex: 1;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
`;

const StyledErrorMessage = styled.Text`
  color: ${({ theme }) => theme.colors.error};
  font-size: ${({ theme }) => theme.typography.fontSize.caption};
  margin-top: ${({ theme }) => theme.spacing.sm};
  text-align: center;
`;

interface FormState {
  isSubmitting: boolean;
  error: string | null;
  isDirty: boolean;
}

/**
 * Screen component for adding a new baby profile with comprehensive validation
 * and accessibility support
 */
const AddBabyScreen: React.FC = () => {
  const navigation = useNavigation();
  const { createBaby, loading } = useBaby();
  const { theme, isDarkMode } = useTheme();
  
  // Form state management
  const [formState, setFormState] = useState<FormState>({
    isSubmitting: false,
    error: null,
    isDirty: false
  });

  // Track screen view
  useEffect(() => {
    analytics().logScreenView({
      screen_name: 'AddBaby',
      screen_class: 'AddBabyScreen'
    });
  }, []);

  // Handle back navigation with unsaved changes
  const handleBackPress = useCallback(async () => {
    if (formState.isDirty) {
      // Show confirmation dialog
      const shouldDiscard = await new Promise((resolve) => {
        // Implementation would use platform-specific dialog
        resolve(window.confirm('Discard unsaved changes?'));
      });

      if (!shouldDiscard) {
        return;
      }
    }

    navigation.goBack();
  }, [formState.isDirty, navigation]);

  // Handle form submission with validation and error handling
  const handleSubmit = useCallback(async (babyData: Baby) => {
    try {
      setFormState(prev => ({ ...prev, isSubmitting: true, error: null }));

      // Track submission attempt
      await analytics().logEvent('add_baby_attempt', {
        hasName: !!babyData.name,
        hasBirthDate: !!babyData.birthDate
      });

      const result = await createBaby(babyData);

      if (result.error) {
        throw new Error(result.error.message);
      }

      // Track successful submission
      await analytics().logEvent('add_baby_success', {
        babyId: result.data?.id
      });

      navigation.goBack();
    } catch (error) {
      // Track submission error
      await analytics().logEvent('add_baby_error', {
        errorMessage: error.message
      });

      setFormState(prev => ({
        ...prev,
        error: error.message,
        isSubmitting: false
      }));
    }
  }, [createBaby, navigation]);

  // Handle form changes
  const handleFormChange = useCallback(() => {
    setFormState(prev => ({ ...prev, isDirty: true }));
  }, []);

  // Handle form cancellation
  const handleCancel = useCallback(() => {
    handleBackPress();
  }, [handleBackPress]);

  return (
    <StyledContainer isRTL={theme.isRTL}>
      <Header
        title="Add Baby"
        showBack
        onBackPress={handleBackPress}
        testID="add-baby-header"
        accessibilityLabel="Add new baby profile screen"
        elevation={2}
      />

      <StyledContent>
        <BabyForm
          baby={null}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          onChange={handleFormChange}
          loading={loading || formState.isSubmitting}
          error={formState.error ? new Error(formState.error) : null}
          testID="add-baby-form"
        />

        {formState.error && (
          <StyledErrorMessage
            role="alert"
            accessibilityLiveRegion="polite"
            testID="add-baby-error"
          >
            {formState.error}
          </StyledErrorMessage>
        )}
      </StyledContent>
    </StyledContainer>
  );
};

// Add display name for debugging
AddBabyScreen.displayName = 'AddBabyScreen';

export default AddBabyScreen;