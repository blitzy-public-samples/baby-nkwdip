import React, { useState, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import DatePicker from 'react-datepicker';
import { format } from 'date-fns';
import { debounce } from 'lodash';
import { CryType } from '../../types/baby.types';
import { useHistory } from '../../hooks/useHistory';

// Constants
const DEFAULT_PAGE_SIZE = 50;
const CONFIDENCE_STEP = 5;
const DEBOUNCE_DELAY = 300;

interface HistoryFilterProps {
  babyId: string;
  onFilterChange: (filters: FilterCriteria) => void;
  initialStartDate?: Date;
  initialEndDate?: Date;
  onError?: (error: FilterError) => void;
  presetRanges?: PresetDateRange[];
  defaultConfidence?: number;
}

interface FilterCriteria {
  startDate: Date;
  endDate: Date;
  patternTypes: CryType[];
  confidenceThreshold: number;
  presetRange?: string;
  pageSize: number;
  currentPage: number;
}

interface FilterError {
  code: string;
  message: string;
}

interface PresetDateRange {
  label: string;
  value: string;
  startDate: Date;
  endDate: Date;
}

// Styled Components
const FilterContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  background-color: ${props => props.theme.colors.surface};
  border-radius: 8px;
  box-shadow: ${props => props.theme.shadows.card};

  @media (max-width: 768px) {
    padding: 12px;
  }
`;

const DateRangeContainer = styled.div`
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;

  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const FilterGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const PatternTypeGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
`;

const ConfidenceSlider = styled.input.attrs({ type: 'range' })`
  width: 100%;
  height: 4px;
  border-radius: 2px;
  appearance: none;
  background: ${props => props.theme.colors.primary};
  outline: none;

  &::-webkit-slider-thumb {
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: ${props => props.theme.colors.primary};
    cursor: pointer;
  }
`;

const StyledDatePicker = styled(DatePicker)`
  padding: 8px;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 4px;
  font-size: 14px;
  width: 150px;
`;

export const HistoryFilter: React.FC<HistoryFilterProps> = ({
  babyId,
  onFilterChange,
  initialStartDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  initialEndDate = new Date(),
  onError,
  presetRanges,
  defaultConfidence = 70
}) => {
  // State management
  const [filterCriteria, setFilterCriteria] = useState<FilterCriteria>({
    startDate: initialStartDate,
    endDate: initialEndDate,
    patternTypes: Object.values(CryType),
    confidenceThreshold: defaultConfidence,
    pageSize: DEFAULT_PAGE_SIZE,
    currentPage: 1
  });

  const { refreshHistory } = useHistory({
    babyId,
    startDate: filterCriteria.startDate,
    endDate: filterCriteria.endDate,
    pageSize: filterCriteria.pageSize,
    pageNumber: filterCriteria.currentPage,
    filterCriteria
  });

  // Debounced filter update
  const debouncedFilterChange = useCallback(
    debounce((newFilters: FilterCriteria) => {
      onFilterChange(newFilters);
      refreshHistory();
    }, DEBOUNCE_DELAY),
    [onFilterChange, refreshHistory]
  );

  // Date range handler
  const handleDateChange = useCallback((startDate: Date | null, endDate: Date | null) => {
    if (!startDate || !endDate) {
      onError?.({
        code: 'INVALID_DATE_RANGE',
        message: 'Please select valid start and end dates'
      });
      return;
    }

    if (startDate > endDate) {
      onError?.({
        code: 'INVALID_DATE_ORDER',
        message: 'Start date must be before end date'
      });
      return;
    }

    setFilterCriteria(prev => ({
      ...prev,
      startDate,
      endDate,
      currentPage: 1
    }));
  }, [onError]);

  // Pattern type handler
  const handlePatternTypeChange = useCallback((type: CryType) => {
    setFilterCriteria(prev => ({
      ...prev,
      patternTypes: prev.patternTypes.includes(type)
        ? prev.patternTypes.filter(t => t !== type)
        : [...prev.patternTypes, type],
      currentPage: 1
    }));
  }, []);

  // Confidence threshold handler
  const handleConfidenceChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const threshold = parseInt(event.target.value, 10);
    setFilterCriteria(prev => ({
      ...prev,
      confidenceThreshold: threshold,
      currentPage: 1
    }));
  }, []);

  // Preset range handler
  const handlePresetRangeChange = useCallback((preset: PresetDateRange) => {
    setFilterCriteria(prev => ({
      ...prev,
      startDate: preset.startDate,
      endDate: preset.endDate,
      presetRange: preset.value,
      currentPage: 1
    }));
  }, []);

  // Effect for filter updates
  useEffect(() => {
    debouncedFilterChange(filterCriteria);
  }, [filterCriteria, debouncedFilterChange]);

  return (
    <FilterContainer role="region" aria-label="History filters">
      <DateRangeContainer>
        <FilterGroup>
          <label htmlFor="startDate">Start Date</label>
          <StyledDatePicker
            id="startDate"
            selected={filterCriteria.startDate}
            onChange={date => handleDateChange(date, filterCriteria.endDate)}
            maxDate={filterCriteria.endDate}
            dateFormat="yyyy-MM-dd"
            aria-label="Select start date"
          />
        </FilterGroup>
        <FilterGroup>
          <label htmlFor="endDate">End Date</label>
          <StyledDatePicker
            id="endDate"
            selected={filterCriteria.endDate}
            onChange={date => handleDateChange(filterCriteria.startDate, date)}
            minDate={filterCriteria.startDate}
            maxDate={new Date()}
            dateFormat="yyyy-MM-dd"
            aria-label="Select end date"
          />
        </FilterGroup>
      </DateRangeContainer>

      <FilterGroup>
        <label>Pattern Types</label>
        <PatternTypeGrid>
          {Object.values(CryType).map(type => (
            <label key={type}>
              <input
                type="checkbox"
                checked={filterCriteria.patternTypes.includes(type)}
                onChange={() => handlePatternTypeChange(type)}
                aria-label={`Filter by ${type} patterns`}
              />
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </label>
          ))}
        </PatternTypeGrid>
      </FilterGroup>

      <FilterGroup>
        <label htmlFor="confidence">
          Confidence Threshold: {filterCriteria.confidenceThreshold}%
        </label>
        <ConfidenceSlider
          id="confidence"
          min="0"
          max="100"
          step={CONFIDENCE_STEP}
          value={filterCriteria.confidenceThreshold}
          onChange={handleConfidenceChange}
          aria-label="Adjust confidence threshold"
        />
      </FilterGroup>

      {presetRanges && (
        <FilterGroup>
          <label>Preset Ranges</label>
          <select
            value={filterCriteria.presetRange}
            onChange={e => {
              const preset = presetRanges.find(r => r.value === e.target.value);
              if (preset) handlePresetRangeChange(preset);
            }}
            aria-label="Select preset date range"
          >
            <option value="">Custom Range</option>
            {presetRanges.map(range => (
              <option key={range.value} value={range.value}>
                {range.label}
              </option>
            ))}
          </select>
        </FilterGroup>
      )}
    </FilterContainer>
  );
};

export default HistoryFilter;