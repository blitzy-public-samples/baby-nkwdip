/**
 * @fileoverview Enhanced record button component with Material Design 3.0 compliance
 * and WCAG 2.1 AA accessibility support
 * Version: 1.0.0
 * 
 * Library versions:
 * - react@18.2.0
 * - styled-components@5.3.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { Button } from '../common/Button';
import { useAudio } from '../../hooks/useAudio';
import { AudioState } from '../../types/audio.types';

// Constants for styling and animation
const ICON_SIZE = 24;
const ANIMATION_DURATION = 300;
const ERROR_TIMEOUT = 5000;

// Media query for reduced motion preference
const REDUCED_MOTION_QUERY = '@media (prefers-reduced-motion: reduce)';

interface RecordButtonProps {
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  onStateChange?: (recording: boolean, error?: Error) => void;
  testID?: string;
  ariaLabel?: string;
  className?: string;
}

// Pulse animation for recording state
const pulseAnimation = keyframes`
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.8; }
  100% { transform: scale(1); opacity: 1; }
`;

// Error shake animation
const shakeAnimation = keyframes`
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
`;

const StyledIcon = styled.div<{
  isRecording: boolean;
  isError: boolean;
  prefersReducedMotion: boolean;
}>`
  width: ${ICON_SIZE}px;
  height: ${ICON_SIZE}px;
  border-radius: 50%;
  margin-right: 8px;
  transition: background-color ${ANIMATION_DURATION}ms ${({ theme }) => theme.animation.easing.standard};
  background-color: ${({ isRecording, isError, theme }) => {
    if (isError) return theme.colors.error;
    return isRecording ? theme.colors.primary : theme.colors.textSecondary;
  }};

  ${({ isRecording, isError, prefersReducedMotion }) => {
    if (isError) {
      return !prefersReducedMotion && css`
        animation: ${shakeAnimation} ${ANIMATION_DURATION}ms ease-in-out;
      `;
    }
    if (isRecording) {
      return !prefersReducedMotion && css`
        animation: ${pulseAnimation} 2s ease-in-out infinite;
      `;
    }
    return '';
  }}
`;

const RecordButton: React.FC<RecordButtonProps> = React.memo(({
  size = 'medium',
  disabled = false,
  onStateChange,
  testID = 'record-button',
  ariaLabel,
  className
}) => {
  const {
    isRecording,
    audioState,
    startRecording,
    stopRecording,
    error
  } = useAudio();

  const [isError, setIsError] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Handle error state timeout
  useEffect(() => {
    if (error) {
      setIsError(true);
      const timeout = setTimeout(() => setIsError(false), ERROR_TIMEOUT);
      return () => clearTimeout(timeout);
    }
  }, [error]);

  // Handle recording state changes
  useEffect(() => {
    onStateChange?.(isRecording, error || undefined);
  }, [isRecording, error, onStateChange]);

  const handlePress = useCallback(async () => {
    try {
      if (isRecording) {
        await stopRecording();
      } else {
        await startRecording();
      }
    } catch (err) {
      console.error('Recording action failed:', err);
    }
  }, [isRecording, startRecording, stopRecording]);

  const getButtonLabel = useCallback(() => {
    if (isError) return 'Recording failed';
    if (audioState === AudioState.ANALYZING) return 'Processing audio...';
    return isRecording ? 'Stop recording' : 'Start recording';
  }, [isError, isRecording, audioState]);

  return (
    <Button
      variant="primary"
      size={size}
      disabled={disabled || audioState === AudioState.ANALYZING}
      onPress={handlePress}
      testID={testID}
      accessibilityLabel={ariaLabel || getButtonLabel()}
      accessibilityState={{
        disabled,
        busy: audioState === AudioState.ANALYZING,
        checked: isRecording
      }}
      accessibilityRole="switch"
      className={className}
    >
      <StyledIcon
        isRecording={isRecording}
        isError={isError}
        prefersReducedMotion={prefersReducedMotion}
        role="presentation"
      />
      {getButtonLabel()}
    </Button>
  );
});

RecordButton.displayName = 'RecordButton';

export default RecordButton;