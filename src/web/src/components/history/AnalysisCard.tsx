/**
 * @fileoverview Material Design 3.0 compliant Analysis Card component
 * Displays historical cry analysis results with enhanced visualization and accessibility
 * Version: 1.0.0
 */

import React from 'react';
import styled from 'styled-components';
import { View, TouchableOpacity, StyleSheet, AccessibilityInfo } from 'react-native';
import Card from '../common/Card';
import Text from '../common/Text';
import { AudioAnalysisResult } from '../../types/audio.types';
import { useTheme } from '../../hooks/useTheme';

interface AnalysisCardProps {
  analysis: AudioAnalysisResult;
  onPress?: () => void;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  isHighlighted?: boolean;
}

const Container = styled(View)`
  width: 100%;
  margin-vertical: ${props => props.theme.spacing.xs};
`;

const ContentContainer = styled(View)`
  padding: ${props => props.theme.spacing.md};
`;

const ConfidenceBar = styled(View)<{ confidence: number; color: string }>`
  height: 8px;
  width: ${props => `${props.confidence * 100}%`};
  background-color: ${props => props.color};
  border-radius: 4px;
`;

const MetadataContainer = styled(View)`
  flex-direction: row;
  justify-content: space-between;
  margin-top: ${props => props.theme.spacing.sm};
`;

const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat('default', {
    hour: 'numeric',
    minute: 'numeric',
    day: 'numeric',
    month: 'short',
  }).format(date);
};

const getConfidenceColor = (confidence: number, isDarkMode: boolean): string => {
  const { theme } = useTheme();
  const { monitor } = theme.colors;

  if (confidence >= 0.8) {
    return isDarkMode ? monitor.confidenceHighDark : monitor.confidenceHigh;
  } else if (confidence >= 0.5) {
    return isDarkMode ? monitor.confidenceMediumDark : monitor.confidenceMedium;
  }
  return isDarkMode ? monitor.confidenceLowDark : monitor.confidenceLow;
};

const AnalysisCard: React.FC<AnalysisCardProps> = React.memo(({
  analysis,
  onPress,
  testID,
  accessibilityLabel,
  accessibilityHint,
  isHighlighted = false,
}) => {
  const { theme, isDarkMode } = useTheme();
  const confidenceColor = getConfidenceColor(analysis.confidence, isDarkMode);
  const formattedTime = formatTimestamp(analysis.timestamp);

  const confidencePercentage = Math.round(analysis.confidence * 100);
  const accessibilityText = `${analysis.needType} detected with ${confidencePercentage}% confidence at ${formattedTime}`;

  React.useEffect(() => {
    if (isHighlighted) {
      AccessibilityInfo.announceForAccessibility(accessibilityText);
    }
  }, [isHighlighted, accessibilityText]);

  return (
    <Container>
      <Card
        variant="elevated"
        elevation={isHighlighted ? 4 : 2}
        testID={testID}
        onPress={onPress}
        accessibilityLabel={accessibilityLabel || accessibilityText}
        accessibilityHint={accessibilityHint || 'Double tap to view detailed analysis'}
        accessibilityRole="button"
        backgroundColor={isHighlighted ? theme.colors.surfaceVariant : theme.colors.surface}
      >
        <ContentContainer>
          <Text
            variant="h2"
            weight="bold"
            testID={`${testID}-need-type`}
            accessibilityRole="header"
          >
            {analysis.needType}
          </Text>

          <View style={styles.confidenceContainer}>
            <ConfidenceBar
              confidence={analysis.confidence}
              color={confidenceColor}
              testID={`${testID}-confidence-bar`}
              accessibilityRole="progressbar"
              accessibilityValue={{
                min: 0,
                max: 100,
                now: confidencePercentage,
              }}
            />
            <Text
              variant="caption"
              color={theme.colors.textSecondary}
              style={styles.confidenceText}
            >
              {`${confidencePercentage}% Confidence`}
            </Text>
          </View>

          <MetadataContainer>
            <Text
              variant="body"
              color={theme.colors.textSecondary}
              testID={`${testID}-timestamp`}
            >
              {formattedTime}
            </Text>
            {analysis.reliability >= 0.9 && (
              <Text
                variant="caption"
                color={theme.colors.success}
                testID={`${testID}-reliability`}
              >
                High Reliability
              </Text>
            )}
          </MetadataContainer>
        </ContentContainer>
      </Card>
    </Container>
  );
});

const styles = StyleSheet.create({
  confidenceContainer: {
    marginVertical: 8,
  },
  confidenceText: {
    marginTop: 4,
    textAlign: 'right',
  },
});

AnalysisCard.displayName = 'AnalysisCard';

export default AnalysisCard;