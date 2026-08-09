import React, { useState } from 'react';
import { Text, View } from 'react-native';

import { AnnotatedText } from '@/components/common/AnnotatedText';
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
import { ItemCrossReferences } from '@/components/learn/ItemCrossReferences';
import { ItemDescriptionSection } from '@/components/learn/ItemDescriptionSection';
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
  CurriculumParentItem,
  ExampleSentence,
  GrammarRule,
  GrammarVocabLink,
  KanjiReading,
  RelatedGrammarItem,
} from '@/data/curriculum/itemRepository';
import { useFuriganaPreference } from '@/data/hooks/useFuriganaPreference';
import { useIsKnownWord } from '@/data/hooks/useIsKnownWord';
import { useRelatedItems } from '@/data/hooks/useRelatedItems';
import { cn } from '@/utils/cn';
import { getRadicalImage } from '@/utils/radicalImages';

/** Intro → Mnemonic → Examples & links (FR71, UX-DR16). */
export const LESSON_SECTION_COUNT = 3;

export const LESSON_SECTION_LABELS = ['Introduction', 'Mnemonic', 'Examples & links'] as const;

/** The stepper's short forms — the pills have room for one word each. */
export const LESSON_SECTION_STEPS = ['Intro', 'Mnemonic', 'Examples'] as const;

export type LessonSectionProps = {
  item: CurriculumItemDetail;
  kanjiReadings: KanjiReading[];
  grammarRule: GrammarRule | null;
  exampleSentences: ExampleSentence[];
  grammarVocabLinks: GrammarVocabLink[];
  relatedGrammar: RelatedGrammarItem[];
  parents: CurriculumParentItem[];
  showReadingPrimer: boolean;
};

function formatConjugationValue(value: unknown): string {
  if (typeof value === 'boolean') {
    return value ? 'yes' : 'no';
  }
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
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
      <Text className={cn('text-center', heroWeightClass(heroSize), accent.deep)} style={heroSize}>
        {item.primaryForm}
      </Text>
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

  return (
    <View testID="lesson-section-intro">
      {item.itemType === 'radical' ? null : <ItemDescriptionSection item={item} />}

      {item.itemType === 'grammar' && grammarRule ? (
        <>
          {grammarRule.explanationMarkdown ? (
            <View className="mt-4" testID="grammar-lesson-body">
              <LessonMarkdown
                markdown={grammarRule.explanationMarkdown}
                mode={furiganaMode}
                knownKanji={knownKanji}
              />
            </View>
          ) : null}

          <View className="mt-4">
            <SectionHeading label="Structure" />
            <Text className="mt-1 text-body text-primary">{grammarRule.structure}</Text>
          </View>

          {grammarRule.acceptedForms.length > 0 ? (
            <View className="mt-4">
              <SectionHeading label="Accepted forms" />
              {grammarRule.acceptedForms.map((form) => (
                <Text key={form} className="mt-1 text-body text-primary">
                  • {form}
                </Text>
              ))}
            </View>
          ) : null}

          {Object.keys(grammarRule.conjugationRules).length > 0 ? (
            <View className="mt-4">
              <SectionHeading label="Conjugation rules" />
              {Object.entries(grammarRule.conjugationRules).map(([key, value]) => (
                <Text key={key} className="mt-1 text-body text-primary">
                  {key}: {formatConjugationValue(value)}
                </Text>
              ))}
            </View>
          ) : null}

          {grammarRule.cautionNotes.length > 0 ? (
            <View className="mt-4" testID="grammar-caution-notes">
              <Text className="text-overline font-ui-bold uppercase tracking-[0.08em] text-feedback-warning-deep">
                Watch out
              </Text>
              {grammarRule.cautionNotes.map((note, index) => (
                <View
                  key={index}
                  className="mt-2 border-l-2 border-feedback-warning py-space-xs pl-space-md">
                  <Text className="text-body font-ui text-primary">{note}</Text>
                </View>
              ))}
            </View>
          ) : null}
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

/**
 * Section 2 — how to remember it: the curriculum's mnemonics and description,
 * the radical's visual mnemonic, and the learner's own mnemonic. Paging
 * replaces the old collapsed mnemonic disclosure, so nothing here hides behind
 * a tap.
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
  showReadingPrimer,
}: LessonSectionProps) {
  if (item.itemType === 'radical') {
    return (
      <View testID="lesson-section-mnemonic">
        {item.mnemonicText ? (
          <AnnotatedText
            text={item.mnemonicText}
            itemType="radical"
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

  return (
    <View testID="lesson-section-mnemonic">
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
  const hasNothing =
    exampleSentences.length === 0 &&
    related.length === 0 &&
    parents.length === 0 &&
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
      />
      {hasNothing ? (
        <Text className="mt-4 text-body text-secondary" testID="lesson-examples-empty">
          No examples or links for this one yet.
        </Text>
      ) : null}
    </View>
  );
}
