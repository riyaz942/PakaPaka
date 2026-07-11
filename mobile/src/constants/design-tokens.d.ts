export const expoBrand: {
  readonly splash: string;
  readonly splashGradientStart: string;
  readonly splashGradientEnd: string;
};

type SemanticPalette = {
  readonly background: string;
  readonly surface: string;
  readonly border: string;
  readonly primary: string;
  readonly secondary: string;
  readonly muted: string;
  readonly onPrimary: string;
  readonly feedbackInfo: string;
};

export const semanticColors: {
  readonly light: SemanticPalette;
  readonly dark: SemanticPalette;
};
