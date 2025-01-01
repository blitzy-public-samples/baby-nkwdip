/**
 * @fileoverview Material Design 3.0 compliant Modal component with WCAG 2.1 AA support
 * Implements dynamic theming, animations, and enhanced accessibility features
 * Version: 1.0.0
 */

import React, { useCallback, useEffect, useMemo } from 'react';
import { 
  Modal as RNModal,
  TouchableWithoutFeedback,
  View,
  Animated,
  useWindowDimensions,
  StyleSheet,
  BackHandler,
  AccessibilityInfo,
  Platform
} from 'react-native';
import styled from 'styled-components/native';
import Button from './Button';
import Text from './Text';
import { useTheme } from '../../hooks/useTheme';

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'small' | 'medium' | 'large';
  animationType?: 'slide' | 'fade' | 'none';
  closeOnBackdropPress?: boolean;
  footer?: React.ReactNode;
  testID?: string;
  accessibilityLabel?: string;
  style?: any;
  highContrastMode?: boolean;
  reduceMotion?: boolean;
  onError?: (error: Error) => void;
}

const StyledModalContainer = styled(View)<{
  size: string;
  theme: any;
  highContrastMode: boolean;
}>`
  background-color: ${({ theme, highContrastMode }) => 
    highContrastMode ? '#FFFFFF' : theme.colors.surface};
  border-radius: 16px;
  padding: ${({ theme }) => theme.spacing.lg};
  margin: ${({ theme }) => theme.spacing.lg};
  elevation: 5;
  shadow-color: #000;
  shadow-offset: 0px 2px;
  shadow-opacity: 0.25;
  shadow-radius: 3.84px;
  border: ${({ highContrastMode }) => 
    highContrastMode ? '2px solid #000000' : 'none'};
  max-height: 90%;
`;

const StyledBackdrop = styled(Animated.View)`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
`;

const StyledHeader = styled(View)`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const StyledContent = styled(View)`
  flex: 1;
`;

const StyledFooter = styled(View)`
  margin-top: ${({ theme }) => theme.spacing.lg};
  flex-direction: row;
  justify-content: flex-end;
`;

const Modal: React.FC<ModalProps> = React.memo(({
  visible,
  onClose,
  title,
  children,
  size = 'medium',
  animationType = 'fade',
  closeOnBackdropPress = true,
  footer,
  testID,
  accessibilityLabel,
  style,
  highContrastMode = false,
  reduceMotion = false,
  onError
}) => {
  const { theme } = useTheme();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const fadeAnim = useMemo(() => new Animated.Value(0), []);

  const getModalSize = useCallback(() => {
    const sizes = {
      small: { width: Math.min(300, windowWidth * 0.8) },
      medium: { width: Math.min(500, windowWidth * 0.9) },
      large: { width: Math.min(800, windowWidth * 0.95) }
    };
    return sizes[size];
  }, [size, windowWidth]);

  const handleBackPress = useCallback(() => {
    if (visible) {
      onClose();
      return true;
    }
    return false;
  }, [visible, onClose]);

  const animateBackdrop = useCallback((toValue: number) => {
    if (reduceMotion) {
      fadeAnim.setValue(toValue);
      return;
    }

    Animated.timing(fadeAnim, {
      toValue,
      duration: theme.animation.duration.normal,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim, reduceMotion, theme.animation.duration.normal]);

  useEffect(() => {
    if (visible) {
      animateBackdrop(1);
    } else {
      animateBackdrop(0);
    }
  }, [visible, animateBackdrop]);

  useEffect(() => {
    BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => {
      BackHandler.removeEventListener('hardwareBackPress', handleBackPress);
    };
  }, [handleBackPress]);

  useEffect(() => {
    if (visible) {
      AccessibilityInfo.announceForAccessibility(
        `Modal opened. ${title}`
      );
    }
  }, [visible, title]);

  const modalStyle = useMemo(() => [
    getModalSize(),
    style
  ], [getModalSize, style]);

  return (
    <RNModal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : animationType}
      onRequestClose={onClose}
      testID={testID}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback
        onPress={closeOnBackdropPress ? onClose : undefined}
        accessible={false}
      >
        <StyledBackdrop style={{ opacity: fadeAnim }} />
      </TouchableWithoutFeedback>

      <View style={styles.centeredView}>
        <StyledModalContainer
          size={size}
          theme={theme}
          highContrastMode={highContrastMode}
          style={modalStyle}
          accessibilityRole="dialog"
          accessibilityLabel={accessibilityLabel || `${title} modal`}
          accessibilityViewIsModal
        >
          <StyledHeader>
            <Text
              variant="h2"
              weight="bold"
              color={highContrastMode ? '#000000' : theme.colors.text}
              accessibilityRole="header"
            >
              {title}
            </Text>
            <Button
              variant="text"
              onPress={onClose}
              accessibilityLabel="Close modal"
              accessibilityRole="button"
              testID={`${testID}-close-button`}
            >
              ✕
            </Button>
          </StyledHeader>

          <StyledContent>
            {children}
          </StyledContent>

          {footer && (
            <StyledFooter>
              {footer}
            </StyledFooter>
          )}
        </StyledModalContainer>
      </View>
    </RNModal>
  );
});

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  }
});

Modal.displayName = 'Modal';

export default Modal;