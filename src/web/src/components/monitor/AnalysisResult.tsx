/**
 * @fileoverview Analysis Result component for displaying baby cry analysis outcomes
 * Implements Material Design 3.0 with WCAG 2.1 AA compliance
 * Version: 1.0.0
 */

import React, { useMemo, useCallback } from 'react';
import styled from 'styled-components';
import Card from '../common/Card';
import Text from '../common/Text';
import PatternDisplay from './PatternDisplay';
import { AudioAnalysisResult } from '../../types/audio.types';

// Styled components with Material Design 3.0 principles
const StyledContainer = styled.div`
  padding: 16px;
  margin-top: 16px;
  min-height: 200px;
  aria-live: polite;
  role: region;
`;

const ResultSection = styled.div`
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ActionButtons = styled.div`
  display: flex;
  flex-direction: row;
  gap: 8px;
  margin-top: 16px;
  min-height: 48px;
  touch-action: manipulation;
`;

interface AnalysisResultProps {
  result: AudioAnalysisResult;
  onActionSelected: (action: string) => void;
  className?: string;
  onError?: (error: Error) => void;
  theme?: any;
}

const getRecommendedActions = (needType: string, confidence: number): Array<{ action: string; priority: number }> => {
  if (confidence < 0.5) return [];

  const baseActions = {
    hunger: [
      { action: 'Feed baby', priority: 1 },
      { action: 'Check last feeding time', priority: 2 },
    ],
    pain: [
      { action: 'Check for discomfort', priority: 1 },
      { action: 'Check temperature', priority: 2 },
      { action: 'Contact healthcare provider', priority: 3 },
    ],
    tiredness: [
      { action: 'Prepare for sleep', priority: 1 },
      { action: 'Create calm environment', priority: 2 },
    ],
    discomfort: [
      { action: 'Check diaper', priority: 1 },
      { action: 'Adjust clothing/temperature', priority: 2 },
    ],
  };

  return (baseActions[needType] || []).map(action => ({
    ...action,
    priority: confidence >= 0.8 ? action.priority : action.priority + 1,
  }));
};

const formatConfidence = (confidence: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(confidence);
};

const AnalysisResult: React.FC<AnalysisResultProps> = ({
  result,
  onActionSelected,
  className,
  onError,
  theme,
}) => {
  const handleError = useCallback((error: Error) => {
    console.error('Analysis result error:', error);
    onError?.(error);
  }, [onError]);

  const recommendedActions = useMemo(() => {
    try {
      return getRecommendedActions(result.needType, result.confidence);
    } catch (error) {
      handleError(error as Error);
      return [];
    }
  }, [result.needType, result.confidence, handleError]);

  const confidenceLevel = useMemo(() => {
    if (result.confidence >= 0.8) return 'High';
    if (result.confidence >= 0.5) return 'Medium';
    return 'Low';
  }, [result.confidence]);

  return (
    <Card
      variant="elevated"
      elevation={2}
      className={className}
      testID="analysis-result"
      accessibilityLabel="Analysis Result"
    >
      <StyledContainer>
        <ResultSection>
          <Text
            variant="h2"
            weight="bold"
            accessibilityRole="header"
          >
            Analysis Result
          </Text>
          
          <PatternDisplay
            analysisResult={result}
            isAnalyzing={false}
            onError={handleError}
          />

          <Text
            variant="body"
            color={theme?.colors?.textSecondary}
            accessibilityLabel={`Confidence level: ${confidenceLevel} at ${formatConfidence(result.confidence)}`}
          >
            Confidence: {formatConfidence(result.confidence)} ({confidenceLevel})
          </Text>
        </ResultSection>

        <ResultSection>
          <Text
            variant="h4"
            weight="medium"
            accessibilityRole="heading"
          >
            Recommended Actions
          </Text>

          <ActionButtons>
            {recommendedActions.map(({ action, priority }) => (
              <Card
                key={action}
                variant="outlined"
                onPress={() => onActionSelected(action)}
                accessibilityRole="button"
                accessibilityLabel={`${action} - Priority ${priority}`}
                accessibilityHint="Double tap to take action"
              >
                <Text variant="body">
                  {action}
                </Text>
              </Card>
            ))}
          </ActionButtons>
        </ResultSection>

        {result.alternativeNeedTypes?.length > 0 && (
          <ResultSection>
            <Text
              variant="caption"
              color={theme?.colors?.textSecondary}
              accessibilityLabel="Alternative possibilities"
            >
              Alternative possibilities: {result.alternativeNeedTypes.join(', ')}
            </Text>
          </ResultSection>
        )}
      </StyledContainer>
    </Card>
  );
};

AnalysisResult.displayName = 'AnalysisResult';

export default React.memo(AnalysisResult);