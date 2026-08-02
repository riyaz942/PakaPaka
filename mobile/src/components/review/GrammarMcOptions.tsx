import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { cn } from '@/utils/cn';

type GrammarMcOptionsProps = {
  /** Shuffled options, correct answer included (built at queue time). */
  options: string[];
  /** Called with the chosen option — submits through the normal evaluator path. */
  onSelect: (option: string) => void;
  disabled?: boolean;
};

/**
 * Apprentice-stage grammar answer input (Plan 08): four tappable options
 * instead of the free-text field. Selection submits immediately; grading goes
 * through the same evaluator/session path as a typed answer.
 */
export function GrammarMcOptions({ options, onSelect, disabled }: GrammarMcOptionsProps) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <View accessibilityRole="radiogroup" className="gap-space-sm">
      {options.map((option) => {
        const isSelected = selected === option;
        return (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityLabel={option}
            accessibilityState={{ disabled: !!disabled, selected: isSelected }}
            disabled={disabled}
            onPress={() => {
              setSelected(option);
              onSelect(option);
            }}
            className={cn(
              'min-h-[44px] justify-center rounded-radius-md px-space-md py-space-sm',
              // Soft fill + deep text, the rule every type-coloured surface
              // follows — the base gold does not clear AA for a label.
              isSelected
                ? 'border-2 border-content-grammar bg-content-grammar-soft'
                : 'border border-border bg-surface-elevated',
            )}>
            <Text
              className={cn(
                'text-center text-body-lg font-jp-medium',
                isSelected ? 'text-content-grammar-deep' : 'text-primary',
              )}>
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
