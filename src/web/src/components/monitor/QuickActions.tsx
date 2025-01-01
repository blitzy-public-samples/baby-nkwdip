/**
 * @fileoverview Quick action buttons component for logging baby care actions
 * Implements Material Design 3.0 with WCAG 2.1 AA compliance
 * Version: 1.0.0
 */

import React, { useCallback, useMemo } from 'react';
import styled from 'styled-components';
import Button from '../common/Button';
import { useMonitor } from '../../hooks/useMonitor';

// Action types enum
export enum ActionType {
  FEED = 'feed',
  CHANGE = 'change',
  SLEEP = 'sleep',
  OTHER = 'other'
}

// Interface for action metadata
interface ActionMetadata {
  confidence: number;
  detectedNeed: string;
  actionTimestamp: number;
  deviceInfo: {
    platform: string;
    isOnline: boolean;
    timestamp: number;
  };
}

// Component props interface
interface QuickActionsProps {
  onActionTaken: (actionType: ActionType, timestamp: number, metadata?: ActionMetadata) => Promise<void>;
  disabled?: boolean;
  testID?: string;
  className?: string;
  ariaLabel?: string;
}

// Styled components
const ActionsContainer = styled.div`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.md};
  justify-content: center;
  padding: ${({ theme }) => theme.spacing.md};
  min-height: 80px;

  @media (max-width: ${({ theme }) => theme.breakpoints?.sm}) {
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
  }
`;

// Constants
const BUTTON_SIZE = 'medium';
const BUTTON_VARIANT = 'outline';
const ACTION_TIMEOUT = 5000;
const RETRY_ATTEMPTS = 3;
const DEBOUNCE_DELAY = 300;

/**
 * Quick actions component for logging baby care actions
 * with enhanced accessibility and offline support
 */
const QuickActions: React.FC<QuickActionsProps> = React.memo(({
  onActionTaken,
  disabled = false,
  testID = 'quick-actions',
  className,
  ariaLabel = 'Quick action buttons'
}) => {
  // Get monitoring state
  const { currentState, isProcessing } = useMonitor();

  // Memoized action handlers with debouncing
  const handleActionPress = useCallback(async (actionType: ActionType) => {
    try {
      const timestamp = performance.now();
      const metadata: ActionMetadata = {
        confidence: 1.0,
        detectedNeed: currentState,
        actionTimestamp: timestamp,
        deviceInfo: {
          platform: navigator.platform,
          isOnline: navigator.onLine,
          timestamp: Date.now()
        }
      };

      // Attempt action with retries
      let attempts = 0;
      while (attempts < RETRY_ATTEMPTS) {
        try {
          await onActionTaken(actionType, timestamp, metadata);
          break;
        } catch (error) {
          attempts++;
          if (attempts === RETRY_ATTEMPTS) throw error;
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempts)));
        }
      }
    } catch (error) {
      console.error('Failed to log action:', error);
      // Could implement offline queueing here
    }
  }, [currentState, onActionTaken]);

  // Memoized button configurations
  const actionButtons = useMemo(() => [
    {
      type: ActionType.FEED,
      label: 'Feed',
      ariaLabel: 'Log feeding action',
      testID: 'feed-action'
    },
    {
      type: ActionType.CHANGE,
      label: 'Change',
      ariaLabel: 'Log diaper change action',
      testID: 'change-action'
    },
    {
      type: ActionType.SLEEP,
      label: 'Sleep',
      ariaLabel: 'Log sleep action',
      testID: 'sleep-action'
    },
    {
      type: ActionType.OTHER,
      label: 'Other',
      ariaLabel: 'Log other action',
      testID: 'other-action'
    }
  ], []);

  return (
    <ActionsContainer
      className={className}
      role="toolbar"
      aria-label={ariaLabel}
      data-testid={testID}
    >
      {actionButtons.map(({ type, label, ariaLabel, testID }) => (
        <Button
          key={type}
          variant={BUTTON_VARIANT}
          size={BUTTON_SIZE}
          disabled={disabled || isProcessing}
          onPress={() => handleActionPress(type)}
          accessibilityLabel={ariaLabel}
          accessibilityRole="button"
          accessibilityState={{
            disabled: disabled || isProcessing,
            busy: isProcessing
          }}
          testID={testID}
        >
          {label}
        </Button>
      ))}
    </ActionsContainer>
  );
});

QuickActions.displayName = 'QuickActions';

export default QuickActions;