import { router, type Href } from 'expo-router';
import React, { useState } from 'react';
import { Text, View } from 'react-native';

import { GlyphText } from '@/components/common/GlyphText';
import { AnnotatedText } from '@/components/common/AnnotatedText';
import { Button } from '@/components/common/Button';
import { FuriganaText } from '@/components/common/FuriganaText';
import { Icon } from '@/components/common/Icon';
import { LessonMarkdown } from '@/components/common/LessonMarkdown';
import { MnemonicImage } from '@/components/common/MnemonicImage';
import { SectionHeading } from '@/components/common/SectionHeading';
import { ExampleSentencesSection } from '@/components/learn/ExampleSentencesSection';
import {
  HERO_FONT_SIZE,
  ItemDetailHeader,
  heroWeightClass,
} from '@/components/learn/ItemDetailHeader';
import { ItemCrossReferences, KanjiBuiltFromSection } from '@/components/learn/ItemCrossReferences';
import { ItemDescriptionSection } from '@/components/learn/ItemDescriptionSection';
import { useItemHref } from '@/components/learn/ItemLinkContext';
import {
  hasCurriculumMnemonic,
  ItemMnemonicSections,
  MNEMONIC_PROSE,
} from '@/components/learn/ItemMnemonicSections';
import { KanjiReadingsSection } from '@/components/learn/KanjiReadingsSection';
import { PersonalMnemonicEditor } from '@/components/learn/PersonalMnemonicEditor';
import { KanjiReadingPrimer } from '@/components/lesson/KanjiReadingPrimer';
import { CONTENT_TYPE_ACCENT } from '@/constants/contentType';
import type {
  CurriculumItemDetail,
  ExampleSentence,
  GrammarRule,
  GrammarVocabLink,
  KanjiReading,
  RelatedGrammarItem,
} from '@/data/curriculum/itemRepository';
import type { ComponentParent } from '@/data/hooks/useComponentParents';
import { useFuriganaPreference } from '@/data/hooks/useFuriganaPreference';
import { useIsKnownWord } from '@/data/hooks/useIsKnownWord';
import { useRelatedItems } from '@/data/hooks/useRelatedItems';
import { cn } from '@/utils/cn';
import { heroFontClass } from '@/utils/heroGlyphFont';
import { getRadicalImage } from '@/utils/radicalImages';

/** Intro → Mnemonic → Examples & links (FR71, UX-DR16). */
export const LESSON_SECTION_COUNT = 3;

export const LESSON_SECTION_LABELS = ['Introduction', 'Mnemonic', 'Examples & links'] as const;

/** The stepper's short forms — the pills have room for one word each. */
export const LESSON_SECTION_STEPS = ['Intro', 'Mnemonic', 'Examples'] as const;

/** Grammar carries no mnemonic: its second section teaches the rules instead. */
export const GRAMMAR_SECTION_STEPS = ['Intro', 'Usage', 'Examples'] as const;

export type LessonSectionProps = {
  item: CurriculumItemDetail;
  kanjiReadings: KanjiReading[];
  grammarRule: GrammarRule | null;
  exampleSentences: ExampleSentence[];
  grammarVocabLinks: GrammarVocabLink[];
  relatedGrammar: RelatedGrammarItem[];
  parents: ComponentParent[];
  showReadingPrimer: boolean;
};

/**
 * The authored grammar essay runs ~900 words: an opening hook, then `How it
 * works`, `Rules and exceptions`, `Casual speech`, `Contrast`. The lesson
 * teaches the first two parts across sections 1 and 2; the rest is reference
 * reading on the detail screen, which the "See the full lesson" button opens.
 */

/** Section 1 — everything before the essay's first `## ` heading. */
function grammarOverview(markdown: string): string {
  return markdown.split(/^## /m)[0].trimEnd();
}

/**
 * Section 2 — the essay's first `## ` section, heading included. Every lesson
 * but one opens on the rules ("How it works" in 149 of 171 files, the same
 * slot under another name in the rest); the one without any `## ` heading is
 * short enough to sit whole in section 1, and leaves this empty.
 */
function grammarHowItWorks(markdown: string): string {
  const firstSection = markdown.split(/^## /m)[1];
  return firstSection ? `## ${firstSection.trimEnd()}` : '';
}

/**
 * The teach card's subject, shown above whichever section is on screen (spec
 * screen 11 keeps the glyph in view while the mnemonic is read).
 */
export function LessonHero({ item }: { item: CurriculumItemDetail }) {
  const { modeForItem } = useFuriganaPreference();
  const isKnownWord = useIsKnownWord(item.itemType === 'vocabulary' ? item.id : null);
  const accent = CONTENT_TYPE_ACCENT[item.itemType];

  if (item.itemType === 'vocabulary') {
    const isLongWord = item.primaryForm.length > 4;
    const heroSize = isLongWord ? HERO_FONT_SIZE.word : HERO_FONT_SIZE.glyph;
    return (
      <ItemDetailHeader itemType="vocabulary" meaning={item.meaning} size="lg">
        <FuriganaText
          text={item.furigana ?? item.primaryForm}
          mode={modeForItem(item.id)}
          isKnownWord={isKnownWord}
          className={cn(heroWeightClass(heroSize), accent.deep)}
          style={heroSize}
        />
      </ItemDetailHeader>
    );
  }

  const heroSize = item.itemType === 'grammar' ? HERO_FONT_SIZE.pattern : HERO_FONT_SIZE.glyph;
  return (
    <ItemDetailHeader itemType={item.itemType} meaning={item.meaning} size="lg">
      <GlyphText
        className={cn('text-center', heroFontClass(item.primaryForm, heroSize.fontSize), accent.deep)}
        style={heroSize}>
        {item.primaryForm}
      </GlyphText>
    </ItemDetailHeader>
  );
}

/**
 * Section 1 — what the item *is*: description and pattern structure (grammar).
 * No examples, no cross-links: those are section 3. The hero above it carries
 * the glyph and meaning for every section, so a radical's introduction is the
 * hero alone — its story and illustration belong with the mnemonic.
 *
 * Kanji readings live in the Mnemonic section, next to the reading mnemonic
 * they explain. A radical's description sits with its story there too.
 */
export function LessonIntroSection({ item, grammarRule }: LessonSectionProps) {
  const { mode: furiganaMode, knownKanji } = useFuriganaPreference();
  const hrefFor = useItemHref();

  return (
    <View testID="lesson-section-intro">
      {item.itemType === 'radical' ? null : <ItemDescriptionSection item={item} />}

      {item.itemType === 'grammar' && grammarRule ? (
        <>
          {grammarRule.explanationMarkdown ? (
            <View className="mt-4" testID="grammar-lesson-body">
              <LessonMarkdown
                markdown={grammarOverview(grammarRule.explanationMarkdown)}
                mode={furiganaMode}
                knownKanji={knownKanji}
              />
            </View>
          ) : null}

          <View className="mt-4">
            <SectionHeading label="Structure" />
            <Text className="mt-1 text-body text-primary">{grammarRule.structure}</Text>
          </View>

          {/* Accepted forms, conjugation rules and the caution notes are
              reference material: they live on the detail screen with the rest
              of the essay, one tap away and without leaving the lesson stack. */}
          <Button
            label="See the full lesson"
            variant="secondary"
            onPress={() => router.push(hrefFor(item.id) as Href)}
            testID="grammar-full-lesson-link"
            className="mt-space-lg"
          />
        </>
      ) : null}
    </View>
  );
}

/**
 * The lesson's illustration slot (spec screen 11). Radicals are the only type
 * the curriculum draws, so the slot is theirs: the bundled image when one
 * exists, and the dashed placeholder when it does not — the space is part of
 * the layout rather than an error state.
 */
function LessonMnemonicImageSlot({ item }: { item: CurriculumItemDetail }) {
  const [imageFailed, setImageFailed] = useState(false);

  if (item.itemType !== 'radical') {
    return null;
  }

  if (!getRadicalImage(item.visualMnemonicUrl) || imageFailed) {
    return (
      <View
        accessible
        accessibilityLabel="Illustration coming soon"
        testID="lesson-mnemonic-image-placeholder"
        className="mt-space-md h-[132px] items-center justify-center gap-space-sm rounded-radius-lg border-[1.5px] border-dashed border-border bg-surface">
        <Icon name="image" size={26} strokeWidth={1.8} className="text-faint" />
        <Text className="text-caption font-ui-semibold text-faint">
          Illustration coming soon
        </Text>
      </View>
    );
  }

  return (
    <View className="mt-space-md">
      <MnemonicImage
        className="h-48"
        imageUrl={item.visualMnemonicUrl}
        mnemonicText={item.mnemonicText}
        meaning={item.meaning}
        primaryForm={item.primaryForm}
        onLoadError={() => setImageFailed(true)}
        testID="radical-mnemonic-image"
      />
    </View>
  );
}

/** Grammar's section 2 — the rules, with its own furigana reader. */
function GrammarRulesSection({ markdown }: { markdown: string }) {
  const { mode, knownKanji } = useFuriganaPreference();

  return (
    <View className="mt-space-md" testID="grammar-how-it-works">
      <LessonMarkdown markdown={markdown} mode={mode} knownKanji={knownKanji} />
    </View>
  );
}

/**
 * Section 2 — how to remember it: the curriculum's mnemonics and description,
 * the radical's visual mnemonic, and the learner's own mnemonic. Paging
 * replaces the old collapsed mnemonic disclosure, so nothing here hides behind
 * a tap.
 *
 * Grammar has no mnemonic of its own, so this page carries the essay's rules
 * section instead — the stepper calls it "Usage" for grammar.
 *
 * A radical's `mnemonic_text` reads as the image's story, not under a "Mnemonic"
 * heading; its optional `description` (content pipeline Rev 3) is the separate
 * look-alike/nuance block, same as on kanji and vocabulary. The illustration
 * sits with that story, which is what it illustrates.
 */
export function LessonMnemonicSectionView({
  item,
  parents,
  kanjiReadings,
  grammarRule,
  showReadingPrimer,
}: LessonSectionProps) {
  if (item.itemType === 'grammar') {
    const rules = grammarRule?.explanationMarkdown
      ? grammarHowItWorks(grammarRule.explanationMarkdown)
      : '';

    return (
      <View testID="lesson-section-mnemonic">
        {rules ? <GrammarRulesSection markdown={rules} /> : null}

        <PersonalMnemonicEditor itemId={item.id} />
      </View>
    );
  }

  if (item.itemType === 'radical') {
    return (
      <View testID="lesson-section-mnemonic">
        {item.mnemonicText ? (
          <AnnotatedText
            text={item.mnemonicText}
            className={cn(MNEMONIC_PROSE, 'mt-space-md')}
            testID="radical-description"
          />
        ) : null}

        <LessonMnemonicImageSlot item={item} />

        <ItemDescriptionSection item={item} />
      </View>
    );
  }

  const hasContent = hasCurriculumMnemonic(item) || Boolean(item.description);
  const readingsBlock =
    item.itemType === 'kanji' ? (
      <View testID="lesson-kanji-readings">
        {showReadingPrimer ? <KanjiReadingPrimer /> : null}
        <KanjiReadingsSection kanjiReadings={kanjiReadings} />
      </View>
    ) : null;
  // Radical composition sits next to the meaning mnemonic (which references the
  // same radicals) instead of only down on the cross-links section.
  const builtFromSection =
    item.itemType === 'kanji' ? <KanjiBuiltFromSection parents={parents} /> : null;

  return (
    <View testID="lesson-section-mnemonic">
      {builtFromSection}

      {hasContent ? (
        <ItemMnemonicSections item={item} parents={parents} readingSlot={readingsBlock} />
      ) : (
        <>
          <Text className="mt-4 text-body text-secondary" testID="lesson-mnemonic-empty">
            No mnemonic for this one yet — write your own below.
          </Text>
          {readingsBlock}
        </>
      )}

      <PersonalMnemonicEditor itemId={item.id} />
    </View>
  );
}

/** Section 3 — where it shows up: example sentences and graph cross-links. */
export function LessonExamplesSection({
  item,
  exampleSentences,
  grammarVocabLinks,
  relatedGrammar,
  parents,
}: LessonSectionProps) {
  const related = useRelatedItems(item.id, item.itemType);
  // Kanji's parents (the "Built from" radicals) now render on the mnemonic
  // page, so a non-empty `parents` no longer means this section has content.
  const componentsShownHere = item.itemType !== 'kanji';
  const hasNothing =
    exampleSentences.length === 0 &&
    related.length === 0 &&
    (!componentsShownHere || parents.length === 0) &&
    grammarVocabLinks.length === 0 &&
    relatedGrammar.length === 0;

  return (
    <View testID="lesson-section-examples">
      <ExampleSentencesSection
        sentences={exampleSentences}
        testIDPrefix={`${item.itemType}-example`}
      />
      <ItemCrossReferences
        item={item}
        related={related}
        parents={parents}
        grammarVocabLinks={grammarVocabLinks}
        relatedGrammar={relatedGrammar}
        hideBuiltFrom
      />
      {hasNothing ? (
        <Text className="mt-4 text-body text-secondary" testID="lesson-examples-empty">
          No examples or links for this one yet.
        </Text>
      ) : null}
    </View>
  );
}
