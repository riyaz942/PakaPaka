import { createContext, useContext } from 'react';

export type CurriculumUpdateContextValue = {
  showCurriculumUpdatedBanner: boolean;
  dismissCurriculumUpdatedBanner: () => void;
};

export const CurriculumUpdateContext = createContext<CurriculumUpdateContextValue | null>(
  null,
);

export function useCurriculumUpdateBanner(): CurriculumUpdateContextValue {
  const context = useContext(CurriculumUpdateContext);
  if (!context) {
    throw new Error('useCurriculumUpdateBanner must be used within DatabaseProvider');
  }
  return context;
}
