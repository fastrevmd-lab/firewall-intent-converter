import { useState, useMemo, useRef, useCallback, useEffect } from 'react';

export default function AutocompleteInput({
  value,
  onChange,
  onCommit,
  onCancel,
  suggestions = [],
  multiToken = false,
  className = '',
  autoFocus = false,
  onBlur,
  placeholder,
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const blurTimerRef = useRef(null);
  const inputRef = useRef(null);

  // Extract the current token being typed (last comma-separated segment in multiToken mode)
  const currentToken = useMemo(() => {
    if (!multiToken) return value.trim();
    const parts = value.split(',');
    return (parts[parts.length - 1] || '').trim();
  }, [value, multiToken]);

  const filteredSuggestions = useMemo(() => {
    if (!currentToken || currentToken.length === 0) return [];
    const lower = currentToken.toLowerCase();
    return suggestions
      .filter(s => s.toLowerCase().includes(lower) && s.toLowerCase() !== lower)
      .slice(0, 8);
  }, [currentToken, suggestions]);

  // Show dropdown when there are filtered results
  useEffect(() => {
    setShowDropdown(filteredSuggestions.length > 0);
    setHighlightIndex(-1);
  }, [filteredSuggestions]);

  const selectSuggestion = useCallback((suggestion) => {
    if (multiToken) {
      const parts = value.split(',');
      parts[parts.length - 1] = ' ' + suggestion;
      const newValue = parts.join(',').replace(/^[\s,]+/, '');
      onChange(newValue + ', ');
    } else {
      onChange(suggestion);
      if (onCommit) onCommit();
    }
    setShowDropdown(false);
    setHighlightIndex(-1);
    if (inputRef.current) inputRef.current.focus();
  }, [value, multiToken, onChange, onCommit]);

  const handleKeyDown = useCallback((e) => {
    if (showDropdown && filteredSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIndex(prev =>
          prev < filteredSuggestions.length - 1 ? prev + 1 : 0
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIndex(prev =>
          prev > 0 ? prev - 1 : filteredSuggestions.length - 1
        );
        return;
      }
      if (e.key === 'Enter' && highlightIndex >= 0) {
        e.preventDefault();
        e.stopPropagation();
        selectSuggestion(filteredSuggestions[highlightIndex]);
        return;
      }
      if (e.key === 'Tab' && highlightIndex >= 0) {
        e.preventDefault();
        selectSuggestion(filteredSuggestions[highlightIndex]);
        return;
      }
    }

    if (e.key === 'Enter') {
      if (onCommit) onCommit();
      return;
    }
    if (e.key === 'Escape') {
      if (showDropdown) {
        setShowDropdown(false);
        setHighlightIndex(-1);
      } else if (onCancel) {
        onCancel();
      }
      return;
    }
  }, [showDropdown, filteredSuggestions, highlightIndex, selectSuggestion, onCommit, onCancel]);

  const handleBlur = useCallback((e) => {
    // Delay blur to allow click on dropdown items
    blurTimerRef.current = setTimeout(() => {
      setShowDropdown(false);
      setHighlightIndex(-1);
      if (onBlur) onBlur(e);
    }, 150);
  }, [onBlur]);

  const handleFocus = useCallback(() => {
    if (filteredSuggestions.length > 0) {
      setShowDropdown(true);
    }
  }, [filteredSuggestions]);

  const handleItemMouseDown = useCallback((e, suggestion) => {
    // Prevent blur from firing before selection
    e.preventDefault();
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    selectSuggestion(suggestion);
  }, [selectSuggestion]);

  // Cleanup blur timer
  useEffect(() => {
    return () => {
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    };
  }, []);

  return (
    <div className="autocomplete-wrapper">
      <input
        ref={inputRef}
        className={className}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onFocus={handleFocus}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onClick={(e) => e.stopPropagation()}
      />
      {showDropdown && filteredSuggestions.length > 0 && (
        <div className="autocomplete-dropdown">
          {filteredSuggestions.map((s, i) => (
            <div
              key={s}
              className={`autocomplete-dropdown-item${i === highlightIndex ? ' highlighted' : ''}`}
              onMouseDown={(e) => handleItemMouseDown(e, s)}
              onMouseEnter={() => setHighlightIndex(i)}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
