import Constants from 'expo-constants';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';

import { ScreenHeader } from '@/components/common/ScreenHeader';
import { SectionHeading } from '@/components/common/SectionHeading';
import { API_BASE_URL } from '@/config/api';
import { MaxContentWidth } from '@/constants/theme';

const SOURCE_URL = 'https://github.com/riyaz942/pakapaka';
const PRIVACY_URL = `${API_BASE_URL}/privacy-policy`;

type Attribution = {
  id: string;
  name: string;
  body: string;
  license: string;
  links: { label: string; url: string }[];
};

/**
 * In-app copy of the repository NOTICE. The CC BY-SA sources require the
 * attribution to reach the people who receive the curriculum database, and
 * they receive it through the app — keep this list in step with NOTICE.
 */
const ATTRIBUTIONS: Attribution[] = [
  {
    id: 'edrdg',
    name: 'JMdict, KANJIDIC2 and KRADFILE',
    body:
      'This app uses the JMdict, KANJIDIC2 and KRADFILE/RADKFILE dictionary files. These files are the property of the Electronic Dictionary Research and Development Group (EDRDG), and are used in conformance with the Group’s licence.',
    license: 'CC BY-SA 4.0',
    links: [
      { label: 'EDRDG licence', url: 'https://www.edrdg.org/edrdg/licence.html' },
      { label: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
    ],
  },
  {
    id: 'jmdict-furigana',
    name: 'JmdictFurigana',
    body:
      'Furigana on vocabulary, example sentences and reading passages is derived from the JmdictFurigana project by Doublevil, itself derived from JMdict.',
    license: 'CC BY-SA 4.0',
    links: [
      { label: 'JmdictFurigana', url: 'https://github.com/Doublevil/JmdictFurigana' },
      { label: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
    ],
  },
  {
    id: 'kanjivg',
    name: 'KanjiVG',
    body:
      'Kanji and radical stroke-order data and the stroke and component images are derived from KanjiVG, copyright © Ulrich Apel.',
    license: 'CC BY-SA 3.0',
    links: [
      { label: 'KanjiVG', url: 'https://kanjivg.tagaini.net/' },
      { label: 'CC BY-SA 3.0', url: 'https://creativecommons.org/licenses/by-sa/3.0/' },
    ],
  },
];

function LinkText({ label, url }: { label: string; url: string }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Open ${label}`}
      onPress={() => {
        void Linking.openURL(url);
      }}
      className="min-h-[44px] justify-center">
      <Text className="text-body-sm font-ui-bold text-brand-text underline">{label}</Text>
    </Pressable>
  );
}

export default function AboutScreen() {
  const version = Constants.expoConfig?.version;

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="About" backAccessibilityLabel="Back to Settings" backTestID="about-back" />
      <View className="flex-1" style={{ alignSelf: 'center', maxWidth: MaxContentWidth, width: '100%' }}>
        <ScrollView contentContainerClassName="px-space-lg pb-space-xl pt-space-md">
          <Text className="text-title font-ui-extrabold text-primary">PakaPaka</Text>
          {version ? (
            <Text className="mt-[2px] text-caption font-ui-medium text-muted" testID="about-version">
              Version {version}
            </Text>
          ) : null}
          <Text className="mt-space-sm text-body-sm font-ui-medium text-secondary">
            Free and open source. The code is licensed under MIT. The curriculum content is
            licensed under CC BY-SA 4.0.
          </Text>
          <LinkText label="Source code on GitHub" url={SOURCE_URL} />
          <LinkText label="Privacy policy" url={PRIVACY_URL} />

          <View className="mt-space-lg">
            <SectionHeading label="Data sources" />
            <View className="mt-space-sm gap-space-sm">
              {ATTRIBUTIONS.map((attribution) => (
                <View
                  key={attribution.id}
                  testID={`about-attribution-${attribution.id}`}
                  className="rounded-radius-md border border-border bg-surface px-space-md pt-space-md shadow-e1">
                  <Text className="text-body font-ui-bold text-primary">{attribution.name}</Text>
                  <Text className="mt-[2px] text-caption font-ui-bold text-muted">
                    {attribution.license}
                  </Text>
                  <Text className="mt-space-xs text-body-sm font-ui-medium text-secondary">
                    {attribution.body}
                  </Text>
                  <View className="flex-row flex-wrap gap-x-space-md">
                    {attribution.links.map((link) => (
                      <LinkText key={link.url} label={link.label} url={link.url} />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}
