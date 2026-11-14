import type { ComplexAnimationBuilder } from 'react-native-reanimated';

/**
 * The one UI spring — react-spring's default (tension 170, friction 26,
 * mass 1). Soft and easy to see, settles in about 0.4 s, never bounces.
 */
export const SPRING = { mass: 1, stiffness: 170, damping: 26 } as const;

/** The same feel, slower, for bars, rings and counters filling to a value. */
export const FILL_SPRING = { mass: 1, stiffness: 90, damping: 19 } as const;

/**
 * Loose on purpose: only for motions whose point is to swing — the close-answer
 * shake and the unlock wobble. Start it with a velocity and it sways and settles.
 */
export const SHAKE_SPRING = { mass: 1, stiffness: 400, damping: 12 } as const;

/** Delay between items that animate one after the other. */
export const STAGGER_MS = 50;

/**
 * Runs an entering/exiting animation (FadeInDown, ZoomIn, …) on `SPRING`
 * instead of a fixed duration. Accepts the class or a configured instance:
 * `soft(FadeIn)`, `soft(ZoomIn.delay(100))`.
 */
export function soft<B extends ComplexAnimationBuilder>(builder: { springify(): B }): B {
  return builder
    .springify()
    .mass(SPRING.mass)
    .stiffness(SPRING.stiffness)
    .damping(SPRING.damping);
}

/** Like `soft`, on `FILL_SPRING` — a calmer entrance. */
export function softSlow<B extends ComplexAnimationBuilder>(builder: { springify(): B }): B {
  return builder
    .springify()
    .mass(FILL_SPRING.mass)
    .stiffness(FILL_SPRING.stiffness)
    .damping(FILL_SPRING.damping);
}
