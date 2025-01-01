/**
 * @fileoverview Material Design 3.0 compliant chart component for visualizing cry pattern history
 * Implements responsive, accessible, and theme-aware visualizations with WCAG 2.1 AA support
 * Version: 1.0.0
 */

import React, { useRef, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { Chart, ChartConfiguration, ChartData, ChartOptions } from 'chart.js/auto';
import { format } from 'date-fns';
import ResizeObserver from 'resize-observer-polyfill';
import { useHistory } from '../../hooks/useHistory';
import { Loading } from '../common/Loading';
import { useTheme } from '../../hooks/useTheme';
import { CryType } from '../../types/baby.types';

interface HistoryChartProps {
  babyId: string;
  startDate: Date;
  endDate: Date;
  onPatternSelect?: (pattern: CryType) => void;
}

// Styled components for chart container and accessibility elements
const ChartContainer = styled.div`
  width: 100%;
  height: 300px;
  margin: ${({ theme }) => theme.spacing.md} 0;
  padding: ${({ theme }) => theme.spacing.md};
  background-color: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.components.card.borderRadius};
  box-shadow: ${({ theme }) => theme.elevation.low};
  position: relative;

  @media (max-width: 768px) {
    height: 200px;
  }
`;

const AccessibleMessage = styled.div`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`;

/**
 * Processes chart data with theme support and accessibility attributes
 */
const processChartData = (distribution: Record<string, number>, colors: any): ChartData => {
  const labels = Object.keys(distribution);
  const data = Object.values(distribution);
  const total = data.reduce((sum, value) => sum + value, 0);
  
  return {
    labels,
    datasets: [{
      data: data.map(value => ((value / total) * 100).toFixed(1)),
      backgroundColor: labels.map(label => colors.monitor[`confidence${label}`] || colors.primary),
      borderColor: colors.border,
      borderWidth: 1,
      hoverOffset: 4,
      borderRadius: 4,
    }],
  };
};

/**
 * Configures chart options with accessibility and responsiveness
 */
const setupChartOptions = (colors: any, isDarkMode: boolean): ChartOptions => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: {
    duration: 750,
    easing: 'easeOutQuart',
  },
  plugins: {
    legend: {
      display: true,
      position: 'bottom',
      labels: {
        color: colors.text,
        padding: 16,
        generateLabels: (chart) => {
          const data = chart.data.datasets[0].data;
          return chart.data.labels?.map((label, i) => ({
            text: `${label}: ${data[i]}%`,
            fillStyle: chart.data.datasets[0].backgroundColor[i],
            strokeStyle: colors.border,
            lineWidth: 1,
            hidden: false,
          })) || [];
        },
      },
    },
    tooltip: {
      enabled: true,
      backgroundColor: colors.surface,
      titleColor: colors.text,
      bodyColor: colors.text,
      borderColor: colors.border,
      borderWidth: 1,
      padding: 12,
      displayColors: true,
      callbacks: {
        label: (context) => `${context.label}: ${context.raw}%`,
      },
    },
  },
  layout: {
    padding: {
      top: 16,
      right: 16,
      bottom: 16,
      left: 16,
    },
  },
});

const HistoryChart: React.FC<HistoryChartProps> = ({
  babyId,
  startDate,
  endDate,
  onPatternSelect,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const { theme, isDarkMode } = useTheme();
  const { distribution, isLoading } = useHistory({
    babyId,
    startDate,
    endDate,
    pageSize: 1000,
    pageNumber: 1,
  });

  // Process chart data with theme support
  const chartData = useMemo(() => 
    processChartData(distribution, theme.colors),
    [distribution, theme.colors]
  );

  // Configure chart options
  const options = useMemo(() => 
    setupChartOptions(theme.colors, isDarkMode),
    [theme.colors, isDarkMode]
  );

  // Initialize and cleanup chart
  useEffect(() => {
    if (!canvasRef.current || !chartData || isLoading) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Destroy existing chart
    if (chartRef.current) {
      chartRef.current.destroy();
    }

    // Create new chart
    chartRef.current = new Chart(ctx, {
      type: 'doughnut',
      data: chartData,
      options: options,
    });

    // Cleanup on unmount
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [chartData, options, isLoading]);

  // Handle responsive resizing
  useEffect(() => {
    if (!canvasRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      if (chartRef.current) {
        chartRef.current.resize();
      }
    });

    resizeObserver.observe(canvasRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Generate accessible description
  const accessibleDescription = useMemo(() => {
    if (!chartData.labels || !chartData.datasets[0].data) return '';
    
    return chartData.labels.map((label, index) => 
      `${label}: ${chartData.datasets[0].data[index]}%`
    ).join(', ');
  }, [chartData]);

  if (isLoading) {
    return (
      <ChartContainer>
        <Loading size="large" overlay />
      </ChartContainer>
    );
  }

  return (
    <ChartContainer>
      <AccessibleMessage role="status" aria-live="polite">
        Cry pattern distribution: {accessibleDescription}
      </AccessibleMessage>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Cry pattern distribution chart"
        tabIndex={0}
      />
    </ChartContainer>
  );
};

export default HistoryChart;