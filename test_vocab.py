import re

with open('/Users/riyazahmed/Projects/japanese-learning/curriculum/_build/generate_content/web/examples/n5/kanji/many.prompt.md', 'r') as f:
    text = f.read()

# Extract vocabulary list
vocab_section = text.split('## Vocabulary you may use')[1].split('## Real usage, for style only')[0]

for line in vocab_section.split('\n'):
    if line.startswith('-'):
        # Check if the pronunciation or kanji contains "oo" or "ta"
        if 'おお' in line or 'た' in line or 'oo' in line or 'ta' in line:
            print(line)
