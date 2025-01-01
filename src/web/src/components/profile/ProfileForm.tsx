/**
 * @fileoverview Material Design 3.0 compliant profile form component with enhanced validation,
 * accessibility features, and secure data handling
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';
import { Formik, Form, FormikHelpers } from 'formik';
import * as Yup from 'yup';
import Input from '../common/Input';
import Button from '../common/Button';
import { useAuth } from '../../hooks/useAuth';
import { User, UserPreferences } from '../../types/user.types';

// Styled components following Material Design 3.0
const StyledForm = styled(Form)`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing.lg};
  background-color: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.components.card.borderRadius};
  box-shadow: ${({ theme }) => theme.elevation.low};
  transition: box-shadow ${({ theme }) => theme.animation.duration.fast} ${({ theme }) => theme.animation.easing.standard};

  &:focus-within {
    box-shadow: ${({ theme }) => theme.elevation.medium};
  }
`;

const FormSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const FormActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing.md};
  margin-top: ${({ theme }) => theme.spacing.lg};
`;

// Interface definitions
interface ProfileFormProps {
  onSubmit: (values: ProfileFormValues) => Promise<void>;
  initialValues: ProfileFormValues;
  isLoading: boolean;
  onError: (error: Error) => void;
  onSuccess: () => void;
}

interface ProfileFormValues {
  name: string;
  email: string;
  phone: string;
  timezone: string;
  notifications: boolean;
  preferredLanguage: string;
  contactPreference: 'email' | 'phone';
}

// Validation schema using Yup
const validationSchema = Yup.object().shape({
  name: Yup.string()
    .required('Name is required')
    .min(2, 'Name too short')
    .max(50, 'Name too long')
    .matches(/^[a-zA-Z\s-']+$/, 'Invalid characters in name'),
  email: Yup.string()
    .email('Invalid email format')
    .required('Email is required')
    .max(255, 'Email too long'),
  phone: Yup.string()
    .matches(/^[0-9+()-\s]+$/, 'Invalid phone number')
    .min(10, 'Phone number too short')
    .max(15, 'Phone number too long'),
  timezone: Yup.string()
    .required('Timezone is required')
    .matches(/^[A-Za-z_/+-]+$/, 'Invalid timezone format'),
  notifications: Yup.boolean()
    .required('Notification preference is required'),
  preferredLanguage: Yup.string()
    .required('Preferred language is required')
    .oneOf(['en', 'es', 'cn'], 'Invalid language selection'),
  contactPreference: Yup.string()
    .required('Contact preference is required')
    .oneOf(['email', 'phone'], 'Invalid contact preference')
});

const ProfileForm: React.FC<ProfileFormProps> = React.memo(({
  onSubmit,
  initialValues,
  isLoading,
  onError,
  onSuccess
}) => {
  const { user } = useAuth();
  const formRef = useRef<HTMLFormElement>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // Handle form submission
  const handleSubmit = useCallback(async (
    values: ProfileFormValues,
    { setSubmitting, setErrors }: FormikHelpers<ProfileFormValues>
  ) => {
    try {
      setSubmitAttempted(true);
      await onSubmit(values);
      onSuccess();
    } catch (error) {
      setErrors({ email: error.message });
      onError(error);
    } finally {
      setSubmitting(false);
    }
  }, [onSubmit, onSuccess, onError]);

  // Handle keyboard navigation
  const handleKeyPress = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  }, []);

  return (
    <Formik
      initialValues={initialValues}
      validationSchema={validationSchema}
      onSubmit={handleSubmit}
      enableReinitialize
    >
      {({ isSubmitting, touched, errors, values, handleChange, handleBlur }) => (
        <StyledForm
          ref={formRef}
          onKeyPress={handleKeyPress}
          aria-label="Profile Settings Form"
          noValidate
        >
          <FormSection>
            <Input
              name="name"
              label="Full Name"
              value={values.name}
              onChange={handleChange}
              onBlur={handleBlur}
              error={touched.name && errors.name}
              disabled={isLoading || isSubmitting}
              required
              autoComplete="name"
              accessibilityLabel="Enter your full name"
              testID="profile-name-input"
            />

            <Input
              name="email"
              type="email"
              label="Email Address"
              value={values.email}
              onChange={handleChange}
              onBlur={handleBlur}
              error={touched.email && errors.email}
              disabled={isLoading || isSubmitting}
              required
              autoComplete="email"
              accessibilityLabel="Enter your email address"
              testID="profile-email-input"
            />

            <Input
              name="phone"
              type="tel"
              label="Phone Number"
              value={values.phone}
              onChange={handleChange}
              onBlur={handleBlur}
              error={touched.phone && errors.phone}
              disabled={isLoading || isSubmitting}
              autoComplete="tel"
              accessibilityLabel="Enter your phone number"
              testID="profile-phone-input"
            />

            <Input
              name="timezone"
              label="Timezone"
              value={values.timezone}
              onChange={handleChange}
              onBlur={handleBlur}
              error={touched.timezone && errors.timezone}
              disabled={isLoading || isSubmitting}
              required
              accessibilityLabel="Select your timezone"
              testID="profile-timezone-input"
            />

            <Input
              name="preferredLanguage"
              label="Preferred Language"
              value={values.preferredLanguage}
              onChange={handleChange}
              onBlur={handleBlur}
              error={touched.preferredLanguage && errors.preferredLanguage}
              disabled={isLoading || isSubmitting}
              required
              accessibilityLabel="Select your preferred language"
              testID="profile-language-input"
            />

            <Input
              name="contactPreference"
              label="Contact Preference"
              value={values.contactPreference}
              onChange={handleChange}
              onBlur={handleBlur}
              error={touched.contactPreference && errors.contactPreference}
              disabled={isLoading || isSubmitting}
              required
              accessibilityLabel="Select your contact preference"
              testID="profile-contact-preference-input"
            />
          </FormSection>

          <FormActions>
            <Button
              variant="outline"
              size="medium"
              disabled={isLoading || isSubmitting}
              onPress={() => formRef.current?.reset()}
              accessibilityLabel="Reset form"
              testID="profile-reset-button"
            >
              Reset
            </Button>
            <Button
              variant="primary"
              size="medium"
              disabled={isLoading || isSubmitting}
              loading={isSubmitting}
              onPress={() => formRef.current?.requestSubmit()}
              accessibilityLabel="Save profile changes"
              testID="profile-submit-button"
            >
              Save Changes
            </Button>
          </FormActions>
        </StyledForm>
      )}
    </Formik>
  );
});

ProfileForm.displayName = 'ProfileForm';

export default ProfileForm;