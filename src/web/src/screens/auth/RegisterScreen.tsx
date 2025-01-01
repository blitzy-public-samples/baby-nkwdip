/**
 * @fileoverview Registration screen component implementing secure user registration
 * with Material Design 3.0 compliance and WCAG 2.1 AA accessibility standards
 * @version 1.0.0
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import AuthService from '../../services/auth.service';
import Button from '../../components/common/Button';
import Text from '../../components/common/Text';
import { validateEmail, validatePassword } from '../../utils/validation.util';
import { useTheme } from '../../hooks/useTheme';
import { UserRole } from '../../types/user.types';

// Form data interface
interface RegisterFormData {
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
  acceptTerms: boolean;
}

// Form error interface
interface FormErrors {
  email: string | null;
  password: string | null;
  confirmPassword: string | null;
  name: string | null;
  acceptTerms: string | null;
}

// Initial form state
const initialFormData: RegisterFormData = {
  email: '',
  password: '',
  confirmPassword: '',
  name: '',
  acceptTerms: false,
};

// Initial error state
const initialErrors: FormErrors = {
  email: null,
  password: null,
  confirmPassword: null,
  name: null,
  acceptTerms: null,
};

/**
 * Registration screen component with comprehensive form validation
 * and security measures
 */
const RegisterScreen: React.FC = React.memo(() => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const authService = AuthService.getInstance();

  // State management
  const [formData, setFormData] = useState<RegisterFormData>(initialFormData);
  const [errors, setErrors] = useState<FormErrors>(initialErrors);
  const [loading, setLoading] = useState(false);

  /**
   * Validates form data with comprehensive security checks
   */
  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = { ...initialErrors };
    let isValid = true;

    // Email validation
    if (!validateEmail(formData.email)) {
      newErrors.email = t('auth.errors.invalidEmail');
      isValid = false;
    }

    // Password validation
    if (!validatePassword(formData.password)) {
      newErrors.password = t('auth.errors.invalidPassword');
      isValid = false;
    }

    // Confirm password validation
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = t('auth.errors.passwordMismatch');
      isValid = false;
    }

    // Name validation
    if (!formData.name.trim() || formData.name.length < 2) {
      newErrors.name = t('auth.errors.invalidName');
      isValid = false;
    }

    // Terms acceptance validation
    if (!formData.acceptTerms) {
      newErrors.acceptTerms = t('auth.errors.termsRequired');
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  }, [formData, t]);

  /**
   * Handles form submission with security measures and error handling
   */
  const handleSubmit = useCallback(async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const response = await authService.register({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        name: formData.name.trim(),
        role: UserRole.PARENT,
        preferences: {
          language: 'en',
          notifications: {
            email: true,
            push: true,
            frequency: 'immediate',
            quietHours: {
              enabled: false,
              start: '22:00',
              end: '07:00',
            },
          },
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          theme: 'system',
          dataRetention: 90,
          audioQuality: 'high',
        },
        securityQuestions: [],
      });

      if (response) {
        navigation.navigate('EmailVerification', { email: formData.email });
      }
    } catch (error) {
      Alert.alert(
        t('auth.errors.registrationFailed'),
        error.message || t('auth.errors.generic')
      );
    } finally {
      setLoading(false);
    }
  }, [formData, validateForm, authService, navigation, t]);

  /**
   * Memoized styles with theme integration
   */
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 50 : 0}
    >
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="h1" style={styles.title}>
          {t('auth.register.title')}
        </Text>

        <View style={styles.form}>
          {/* Name Input */}
          <View style={styles.inputContainer}>
            <Text variant="caption" style={styles.label}>
              {t('auth.register.name')}
            </Text>
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              placeholder={t('auth.register.namePlaceholder')}
              autoCapitalize="words"
              autoComplete="name"
              autoCorrect={false}
              testID="register-name-input"
              accessibilityLabel={t('auth.register.name')}
              maxLength={50}
            />
            {errors.name && (
              <Text variant="caption" style={styles.errorText}>
                {errors.name}
              </Text>
            )}
          </View>

          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Text variant="caption" style={styles.label}>
              {t('auth.register.email')}
            </Text>
            <TextInput
              style={[styles.input, errors.email && styles.inputError]}
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              placeholder={t('auth.register.emailPlaceholder')}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              testID="register-email-input"
              accessibilityLabel={t('auth.register.email')}
              maxLength={255}
            />
            {errors.email && (
              <Text variant="caption" style={styles.errorText}>
                {errors.email}
              </Text>
            )}
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Text variant="caption" style={styles.label}>
              {t('auth.register.password')}
            </Text>
            <TextInput
              style={[styles.input, errors.password && styles.inputError]}
              value={formData.password}
              onChangeText={(text) => setFormData({ ...formData, password: text })}
              placeholder={t('auth.register.passwordPlaceholder')}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password-new"
              testID="register-password-input"
              accessibilityLabel={t('auth.register.password')}
            />
            {errors.password && (
              <Text variant="caption" style={styles.errorText}>
                {errors.password}
              </Text>
            )}
          </View>

          {/* Confirm Password Input */}
          <View style={styles.inputContainer}>
            <Text variant="caption" style={styles.label}>
              {t('auth.register.confirmPassword')}
            </Text>
            <TextInput
              style={[styles.input, errors.confirmPassword && styles.inputError]}
              value={formData.confirmPassword}
              onChangeText={(text) =>
                setFormData({ ...formData, confirmPassword: text })
              }
              placeholder={t('auth.register.confirmPasswordPlaceholder')}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password-new"
              testID="register-confirm-password-input"
              accessibilityLabel={t('auth.register.confirmPassword')}
            />
            {errors.confirmPassword && (
              <Text variant="caption" style={styles.errorText}>
                {errors.confirmPassword}
              </Text>
            )}
          </View>

          {/* Terms Acceptance */}
          <View style={styles.termsContainer}>
            <Checkbox
              value={formData.acceptTerms}
              onValueChange={(value) =>
                setFormData({ ...formData, acceptTerms: value })
              }
              testID="register-terms-checkbox"
              accessibilityLabel={t('auth.register.terms')}
            />
            <Text variant="caption" style={styles.termsText}>
              {t('auth.register.termsText')}
            </Text>
          </View>
          {errors.acceptTerms && (
            <Text variant="caption" style={styles.errorText}>
              {errors.acceptTerms}
            </Text>
          )}

          {/* Submit Button */}
          <Button
            variant="primary"
            onPress={handleSubmit}
            loading={loading}
            disabled={loading}
            fullWidth
            testID="register-submit-button"
            accessibilityLabel={t('auth.register.submit')}
            style={styles.submitButton}
          >
            {t('auth.register.submit')}
          </Button>

          {/* Login Link */}
          <View style={styles.loginContainer}>
            <Text variant="body">{t('auth.register.haveAccount')}</Text>
            <Button
              variant="text"
              onPress={() => navigation.navigate('Login')}
              testID="register-login-link"
              accessibilityLabel={t('auth.register.login')}
            >
              {t('auth.register.login')}
            </Button>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
});

/**
 * Styles creator function with theme integration
 */
const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContainer: {
      flex: 1,
    },
    contentContainer: {
      padding: theme.spacing.lg,
      minHeight: '100%',
    },
    title: {
      marginBottom: theme.spacing.xl,
      textAlign: 'center',
    },
    form: {
      width: '100%',
      maxWidth: 400,
      alignSelf: 'center',
    },
    inputContainer: {
      marginBottom: theme.spacing.md,
    },
    label: {
      marginBottom: theme.spacing.xs,
      color: theme.colors.textSecondary,
    },
    input: {
      ...theme.components.input,
      backgroundColor: theme.colors.surface,
      color: theme.colors.text,
    },
    inputError: {
      borderColor: theme.colors.error,
    },
    errorText: {
      color: theme.colors.error,
      marginTop: theme.spacing.xs,
    },
    termsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.spacing.md,
    },
    termsText: {
      marginLeft: theme.spacing.xs,
      flex: 1,
    },
    submitButton: {
      marginTop: theme.spacing.md,
    },
    loginContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: theme.spacing.xl,
    },
  });

RegisterScreen.displayName = 'RegisterScreen';

export default RegisterScreen;