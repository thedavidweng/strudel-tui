import React, { useState, useEffect } from 'react';
import { Text } from 'ink';

const MOON_PHASES = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];
const BRAILLE_DOTS = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

interface MoonSpinnerProps {
  color?: string;
  label?: string;
  variant?: 'moon' | 'braille';
}

const MoonSpinner: React.FC<MoonSpinnerProps> = ({ color = '#4FA8FF', label, variant = 'moon' }) => {
  const [frame, setFrame] = useState(0);
  const frames = variant === 'moon' ? MOON_PHASES : BRAILLE_DOTS;
  const interval = variant === 'moon' ? 120 : 80;

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame(prev => (prev + 1) % frames.length);
    }, interval);
    return () => clearInterval(timer);
  }, [frames.length, interval]);

  return (
    <Text color={color}>
      {frames[frame]}{label ? ` ${label}` : ''}
    </Text>
  );
};

export default MoonSpinner;
