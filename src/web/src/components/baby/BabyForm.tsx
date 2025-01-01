/**
 * @fileoverview Material Design 3.0 compliant form component for baby profile management
 * Implements WCAG 2.1 AA accessibility standards and comprehensive validation
 * Version: 1.0.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import { DatePicker } from '@mui/lab';
import Input from '../common/Input';
import Button from '../common/Button';
import { useTheme } from '../../hooks/useTheme';

// Form container with responsive layout
const StyledForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing.lg};
`;

// Form section with proper spacing
const StyledSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

// Error message with proper contrast
const StyledErrorMessage = styled.span`
  color: ${({ theme }) => theme.colors.error};
  font-size: ${({ theme }) => theme.typography.fontSize.caption};
  margin-top: ${({ theme }) => theme.spacing.xxs};
`;

interface BabyFormProps {
  baby: Baby | null;
  onSubmit: (baby: Baby) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
  error: Error | null;
}

interface Baby {
  id?: string;
  name: string;
  birthDate: string;
  monitoringEnabled: boolean;
  notificationsEnabled: boolean;
  sensitivity: SensitivityLevel;
  nightMode: boolean;
  backgroundMonitoring: boolean;
  dataRetention: RetentionPeriod;
}

type SensitivityLevel = 'low' | 'medium' | 'high';
type RetentionPeriod = '30days' | '90days' | '180days' | '365days';

const BabyForm: React.FC<BabyFormProps> = ({
  baby,
  onSubmit,
  onCancel,
  loading,
  error
}) => {
  const { theme } = useTheme();
  const { t } = useTranslation();

  // Form state initialization
  const [formData, setFormData] = useState<Baby>({
    name: '',
    birthDate: '',
    monitoringEnabled: true,
    notificationsEnabled: true,
    sensitivity: 'medium',
    nightMode: false,
    backgroundMonitoring: false,
    dataRetention: '90days',
    ...baby
  });

  // Form validation state
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Validation rules
  const validationRules = useMemo(() => ({
    name: [
      (value: string) => value.length >= 2 || t('validation.nameMinLength'),
      (value: string) => value.length <= 50 || t('validation.nameMaxLength'),
      (value: string) => /^[a-zA-Z\s-']+$/.test(value) || t('validation.nameFormat')
    ],
    birthDate: [
      (value: string) => !!value || t('validation.birthDateRequired'),
      (value: string) => {
        const date = new Date(value);
        const now = new Date();
        return date <= now || t('validation.birthDateFuture');
      }
    ]
  }), [t]);

  // Validate field
  const validateField = useCallback((name: string, value: any) => {
    const fieldRules = validationRules[name];
    if (!fieldRules) return [];

    return fieldRules
      .map(rule => rule(value))
      .filter(error => typeof error === 'string') as string[];
  }, [validationRules]);

  // Handle field change
  const handleChange = useCallback((name: string, value: any) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    setTouched(prev => ({ ...prev, [name]: true }));
    
    const fieldErrors = validateField(name, value);
    setErrors(prev => ({ ...prev, [name]: fieldErrors }));
  }, [validateField]);

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields
    const newErrors: Record<string, string[]> = {};
    Object.keys(validationRules).forEach(field => {
      newErrors[field] = validateField(field, formData[field]);
    });

    setErrors(newErrors);
    setTouched(Object.keys(validationRules).reduce((acc, field) => ({
      ...acc,
      [field]: true
    }), {}));

    // Check if there are any errors
    const hasErrors = Object.values(newErrors).some(fieldErrors => fieldErrors.length > 0);
    if (hasErrors) return;

    try {
      await onSubmit(formData);
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        general: [error.message]
      }));
    }
  }, [formData, onSubmit, validateField, validationRules]);

  return (
    <StyledForm onSubmit={handleSubmit} noValidate>
      <StyledSection>
        <Input
          name="name"
          label={t('form.nameLabel')}
          value={formData.name}
          onChange={(value) => handleChange('name', value)}
          error={touched.name ? errors.name?.[0] : undefined}
          required
          disabled={loading}
          accessibilityLabel={t('form.nameAccessibilityLabel')}
          testID="baby-name-input"
        />

        <DatePicker
          label={t('form.birthDateLabel')}
          value={formData.birthDate}
          onChange={(date) => handleChange('birthDate', date)}
          renderInput={(params) => (
            <Input
              {...params}
              name="birthDate"
              error={touched.birthDate ? errors.birthDate?.[0] : undefined}
              required
              disabled={loading}
              accessibilityLabel={t('form.birthDateAccessibilityLabel')}
              testID="baby-birthdate-input"
            />
          )}
          disableFuture
          maxDate={new Date()}
        />
      </StyledSection>

      <StyledSection>
        <Input
          name="sensitivity"
          label={t('form.sensitivityLabel')}
          value={formData.sensitivity}
          onChange={(value) => handleChange('sensitivity', value)}
          type="select"
          options={[
            { value: 'low', label: t('form.sensitivityLow') },
            { value: 'medium', label: t('form.sensitivityMedium') },
            { value: 'high', label: t('form.sensitivityHigh') }
          ]}
          disabled={loading}
          accessibilityLabel={t('form.sensitivityAccessibilityLabel')}
          testID="baby-sensitivity-input"
        />

        <Input
          name="dataRetention"
          label={t('form.retentionLabel')}
          value={formData.dataRetention}
          onChange={(value) => handleChange('dataRetention', value)}
          type="select"
          options={[
            { value: '30days', label: t('form.retention30Days') },
            { value: '90days', label: t('form.retention90Days') },
            { value: '180days', label: t('form.retention180Days') },
            { value: '365days', label: t('form.retention365Days') }
          ]}
          disabled={loading}
          accessibilityLabel={t('form.retentionAccessibilityLabel')}
          testID="baby-retention-input"
        />
      </StyledSection>

      <StyledSection>
        <Input
          name="monitoringEnabled"
          label={t('form.monitoringLabel')}
          value={formData.monitoringEnabled}
          onChange={(value) => handleChange('monitoringEnabled', value)}
          type="checkbox"
          disabled={loading}
          accessibilityLabel={t('form.monitoringAccessibilityLabel')}
          testID="baby-monitoring-input"
        />

        <Input
          name="notificationsEnabled"
          label={t('form.notificationsLabel')}
          value={formData.notificationsEnabled}
          onChange={(value) => handleChange('notificationsEnabled', value)}
          type="checkbox"
          disabled={loading}
          accessibilityLabel={t('form.notificationsAccessibilityLabel')}
          testID="baby-notifications-input"
        />

        <Input
          name="nightMode"
          label={t('form.nightModeLabel')}
          value={formData.nightMode}
          onChange={(value) => handleChange('nightMode', value)}
          type="checkbox"
          disabled={loading}
          accessibilityLabel={t('form.nightModeAccessibilityLabel')}
          testID="baby-nightmode-input"
        />

        <Input
          name="backgroundMonitoring"
          label={t('form.backgroundLabel')}
          value={formData.backgroundMonitoring}
          onChange={(value) => handleChange('backgroundMonitoring', value)}
          type="checkbox"
          disabled={loading}
          accessibilityLabel={t('form.backgroundAccessibilityLabel')}
          testID="baby-background-input"
        />
      </StyledSection>

      {error && (
        <StyledErrorMessage role="alert">
          {error.message}
        </StyledErrorMessage>
      )}

      <StyledSection>
        <Button
          type="submit"
          variant="primary"
          loading={loading}
          disabled={loading}
          fullWidth
          accessibilityLabel={t('form.submitAccessibilityLabel')}
          testID="baby-submit-button"
        >
          {t('form.submitButton')}
        </Button>

        <Button
          variant="outline"
          onPress={onCancel}
          disabled={loading}
          fullWidth
          accessibilityLabel={t('form.cancelAccessibilityLabel')}
          testID="baby-cancel-button"
        >
          {t('form.cancelButton')}
        </Button>
      </StyledSection>
    </StyledForm>
  );
};

export default BabyForm;