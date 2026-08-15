import { useCallback, useMemo, useState } from 'react';
import {
  type AccessibilityActionEvent,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import {
  ActionCard,
  AtRiskSection,
  GoalRing,
  LevelProgressBar,
  ReadingReadiness,
  ReviewForecast,
} from '@/components/engagement';
import {
  HOME_SECTION_CAPTIONS,
  HOME_SECTION_LABELS,
  PREVIEW_AT_RISK_ALL_ITEMS,
  PREVIEW_AT_RISK_TOP_ITEMS,
  PREVIEW_AT_RISK_TOTAL_COUNT,
  PREVIEW_FORECAST,
  PREVIEW_GOAL_RING_PERCENT,
  PREVIEW_LEVEL,
  PREVIEW_LEVEL_OVERALL_PERCENT,
  PREVIEW_LEVEL_PER_TYPE,
  PREVIEW_READING_TARGET,
} from '@/components/engagement/homeLayoutPreviewData';
import { MaxContentWidth } from '@/constants/theme';
import {
  defaultHomeLayout,
  isRequiredHomeSection,
  type HomeSectionEntry,
  type HomeSectionId,
} from '@/core/engagement/homeLayout';
import { useDatabase } from '@/data/hooks/useDatabase';
import { useReducedMotion } from '@/data/hooks/useReducedMotion';
import { getHomeLayout, setHomeLayout } from '@/data/user/preferencesRepository';
import { cn } from '@/utils/cn';

/** Uniform tile height — the load-bearing simplification for drag maths. */
const HOME_LAYOUT_ROW_HEIGHT = 140;

function renderSectionPreview(id: HomeSectionId) {
  switch (id) {
    case 'goal-ring':
      return (
        <View className="items-center rounded-radius-xl bg-surface p-space-md shadow-e2">
          <GoalRing variant="hero" percent={PREVIEW_GOAL_RING_PERCENT} />
        </View>
      );
    case 'review-cta':
      return (
        <ActionCard
          title="Review"
          subtitle="12 items ready"
          glyph="復"
          accent
          onPress={() => {}}
          accessibilityLabel="Review 12 items due"
        />
      );
    case 'lesson-cta':
      return (
        <ActionCard
          title="Today's lesson"
          subtitle="3 of 5 lesson items remaining today"
          glyph="学"
          onPress={() => {}}
          accessibilityLabel="Start today's lesson"
        />
      );
    case 'level-progress':
      return (
        <LevelProgressBar
          level={PREVIEW_LEVEL}
          perType={PREVIEW_LEVEL_PER_TYPE}
          overallPercent={PREVIEW_LEVEL_OVERALL_PERCENT}
        />
      );
    case 'review-forecast':
      return <ReviewForecast forecast={PREVIEW_FORECAST} />;
    case 'reading-readiness':
      return <ReadingReadiness target={PREVIEW_READING_TARGET} onPress={() => {}} />;
    case 'at-risk':
      return (
        <AtRiskSection
          totalCount={PREVIEW_AT_RISK_TOTAL_COUNT}
          topItems={PREVIEW_AT_RISK_TOP_ITEMS}
          allItems={PREVIEW_AT_RISK_ALL_ITEMS}
          onStartRevision={() => {}}
        />
      );
    default:
      return null;
  }
}

type HomeLayoutRowProps = {
  entry: HomeSectionEntry;
  index: number;
  total: number;
  onMoveUp: (id: HomeSectionId) => void;
  onMoveDown: (id: HomeSectionId) => void;
  onToggleVisible: (id: HomeSectionId) => void;
  onDrop: (id: HomeSectionId, deltaRows: number) => void;
  reducedMotion: boolean;
};

function HomeLayoutRow({
  entry,
  index,
  total,
  onMoveUp,
  onMoveDown,
  onToggleVisible,
  onDrop,
  reducedMotion,
}: HomeLayoutRowProps) {
  const required = isRequiredHomeSection(entry.id);
  const label = HOME_SECTION_LABELS[entry.id];
  const caption = HOME_SECTION_CAPTIONS[entry.id];
  const positionLabel = `${label}, position ${index + 1} of ${total}${entry.visible ? '' : ', hidden'}`;

  const translateY = useSharedValue(0);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .withTestId(`home-layout-row-pan-${entry.id}`)
        .onUpdate((event) => {
          translateY.value = event.translationY;
        })
        .onEnd((event) => {
          const rawDelta = Math.round(event.translationY / HOME_LAYOUT_ROW_HEIGHT);
          const clamped = Math.max(-index, Math.min(total - 1 - index, rawDelta));
          translateY.value = reducedMotion ? 0 : withTiming(0, { duration: 150 });
          if (clamped !== 0) {
            runOnJS(onDrop)(entry.id, clamped);
          }
        }),
    [entry.id, index, total, onDrop, reducedMotion, translateY],
  );

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
    switch (event.nativeEvent.actionName) {
      case 'moveUp':
        onMoveUp(entry.id);
        break;
      case 'moveDown':
        onMoveDown(entry.id);
        break;
      case 'toggleVisibility':
        onToggleVisible(entry.id);
        break;
      default:
        break;
    }
  };

  const accessibilityActions = [
    { name: 'moveUp', label: 'Move up' },
    { name: 'moveDown', label: 'Move down' },
    ...(required ? [] : [{ name: 'toggleVisibility', label: entry.visible ? 'Hide' : 'Show' }]),
  ];

  return (
    <Animated.View
      accessible
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={handleAccessibilityAction}
      accessibilityLabel={positionLabel}
      testID={`home-layout-row-${entry.id}`}
      style={[rowStyle, { height: HOME_LAYOUT_ROW_HEIGHT }]}
      className={cn(
        'flex-row overflow-hidden rounded-radius-lg border border-border bg-surface',
        !entry.visible && 'opacity-50',
      )}>
      <GestureDetector gesture={pan}>
        <View
          className="w-12 items-center justify-center"
          testID={`home-layout-row-grip-${entry.id}`}>
          <Icon name="grip" />
        </View>
      </GestureDetector>

      <View className="flex-1 justify-center py-space-sm pr-space-sm">
        <View className="flex-row items-center gap-space-xs">
          <Text className="text-body-sm font-ui-extrabold text-primary">{label}</Text>
          {!entry.visible ? (
            <View className="rounded-radius-full bg-surface-elevated px-space-xs py-[1px]">
              <Text className="text-overline font-ui-bold text-muted">Hidden</Text>
            </View>
          ) : null}
        </View>
        {caption ? (
          <Text className="mt-[2px] text-caption font-ui-medium text-muted" numberOfLines={1}>
            {caption}
          </Text>
        ) : null}

        <View
          className="mt-space-xs flex-1 overflow-hidden rounded-radius-md"
          pointerEvents="none">
          <View style={{ transform: [{ scale: 0.62 }] }}>{renderSectionPreview(entry.id)}</View>
        </View>
      </View>

      <View className="w-12 items-center justify-center">
        {required ? (
          <Icon name="locked" className="text-faint" testID={`home-layout-row-lock-${entry.id}`} />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={entry.visible ? `Hide ${label}` : `Show ${label}`}
            onPress={() => onToggleVisible(entry.id)}
            testID={`home-layout-row-visibility-${entry.id}`}
            className="h-11 w-11 items-center justify-center">
            <Icon name={entry.visible ? 'eye' : 'eyeOff'} />
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

export default function HomeLayoutScreen() {
  const { userDb } = useDatabase();
  const { reducedMotion } = useReducedMotion();
  const [entries, setEntries] = useState<HomeSectionEntry[]>(() => getHomeLayout(userDb));

  const persist = useCallback(
    (next: HomeSectionEntry[]) => setHomeLayout(userDb, next),
    [userDb],
  );

  const moveByDelta = useCallback(
    (id: HomeSectionId, delta: number) => {
      setEntries((prev) => {
        const from = prev.findIndex((entry) => entry.id === id);
        if (from === -1 || delta === 0) return prev;
        const to = Math.max(0, Math.min(prev.length - 1, from + delta));
        if (to === from) return prev;
        const next = [...prev];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const handleMoveUp = useCallback((id: HomeSectionId) => moveByDelta(id, -1), [moveByDelta]);
  const handleMoveDown = useCallback((id: HomeSectionId) => moveByDelta(id, 1), [moveByDelta]);

  const handleToggleVisible = useCallback(
    (id: HomeSectionId) => {
      if (isRequiredHomeSection(id)) return;
      setEntries((prev) => {
        const next = prev.map((entry) =>
          entry.id === id ? { ...entry, visible: !entry.visible } : entry,
        );
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const handleReset = useCallback(() => {
    const next = defaultHomeLayout();
    setEntries(next);
    persist(next);
  }, [persist]);

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title="Customize Home"
        backAccessibilityLabel="Back to Settings"
        backTestID="home-layout-back"
      />
      <View className="flex-1" style={{ alignSelf: 'center', maxWidth: MaxContentWidth, width: '100%' }}>
        <ScrollView contentContainerClassName="px-space-lg pb-space-xl pt-space-md">
          <Text className="text-caption font-ui-medium text-muted">
            Drag to reorder, or use the eye to hide a section. Review and Today&apos;s lesson can
            move but not hide. Changes save immediately.
          </Text>

          <View className="mt-space-md gap-space-sm">
            {entries.map((entry, index) => (
              <HomeLayoutRow
                key={entry.id}
                entry={entry}
                index={index}
                total={entries.length}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
                onToggleVisible={handleToggleVisible}
                onDrop={moveByDelta}
                reducedMotion={reducedMotion}
              />
            ))}
          </View>

          <Button
            label="Reset to default"
            variant="secondary"
            onPress={handleReset}
            className="mt-space-lg w-full"
            testID="home-layout-reset-button"
          />
        </ScrollView>
      </View>
    </View>
  );
}
