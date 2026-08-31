#!/usr/bin/env python3
"""Two repairs the mechanical gate cannot catch, applied to restyle/out/*.json.

1. Landing word: several items ended on an accepted *synonym* rather than the
   meaning the learner is actually quizzed on (米 landing on "USA", 鳥 on
   "chicken"). The story must land on the item's primary meaning; where a
   component shares that word, it is simply tagged twice on distinct spans.
2. Joint phrases: four items tagged a whole slash-joined synonym entry inline
   ("<radical>corpse / body</radical>"), which reads as broken prose. One word
   of the pair satisfies the gate, so the tag is trimmed to that word.
"""
import glob
import json
import os

FIXES = {
    "k-rice": "A farmer beats the stalks until grains burst free across the barn floor. He piles every scattered <radical>rice</radical> grain into one heap. Merchants weigh the heap and ship it out as sacks of <kanji>rice</kanji>.",
    "k-utilize": "A hiker finds a boxy frame with crossed bars beside the trail. Curious, she puts it to <radical>use</radical>, feeding it coins for tea. Even on a bare mountain, someone found a way to <kanji>utilize</kanji> it.",
    "k-grass": "The <radical>sun</radical> beats down on a cracked garden box all day. Even so, <radical>ten</radical> thin blades of <radical>grass</radical> push through the dirt. The gardener gives up and lets the whole box run wild with <kanji>grass</kanji>.",
    "k-beginning": "A scientist lights the first match of a brand new invention. She frames the burnt matchstick on her wall as its <radical>beginning</radical>. Visitors still point at that match as where everything had its <kanji>beginning</kanji>.",
    "k-barley": "A stalk of <radical>barley</radical> bows low in a strong wind. It keeps bending until its head touches the dirt. That endlessly bowing stalk is one tall shaft of <kanji>barley</kanji>.",
    "k-sword": "A cook grabs a long <radical>sword</radical> to slice open a stubborn bag of rice. The blade chips at the tip and bends sideways. He shrugs and keeps chopping with the bent <kanji>sword</kanji>.",
    "k-fur": "A dog sheds a single strand of <radical>fur</radical> onto the porch. Wind lifts it and twists it into a tight curl. That stray curling strand is one piece of <kanji>fur</kanji>.",
    "k-park": "A groundskeeper drapes a <radical>clothing</radical> sheet over the flowerbeds like a tent. He stakes it down with a wooden <radical>earth</radical> marker so it will not blow away. Rain pools in a stone <radical>mouth</radical> fountain, turning the plot into his <kanji>park</kanji>.",
    "k-angle": "A carpenter drags his <radical>angle</radical> gauge to every crooked joint on a birdhouse. Thirty degrees here, ninety there, no two joints match. He shrugs and calls every mismatched joint a perfect <kanji>angle</kanji>.",
    "k-door": "Toto the turtle sells a sample <radical>door</radical> that never stays shut. He chases it down every street as it swings open again and again. The whole town now knows him by that one runaway <kanji>door</kanji>.",
    "k-bird": "A clumsy <radical>bird</radical> waddles into the convenience store, wings tucked like it is cold. It flops onto the rice ball shelf with a thud. The clerk sighs and carries the <kanji>bird</kanji> back outside.",
    "k-goods": "A <radical>mouth</radical> shouts a price for a crate of <radical>goods</radical> in the crowded market. Another mouth shouts back an even higher price. By closing time both have sold every last one of their <kanji>goods</kanji>.",
    "k-sultry": "Through the window you watch the <radical>sun</radical> blaze over the crosswalk. An <radical>old</radical> man shuffles across without hurrying for anyone. The asphalt shimmers in the thick <kanji>sultry</kanji> air.",
    "k-people": "A <radical>corpse</radical> sprawls on the floor, and the whole party crowd flops down beside it. A clerk stamps every forehead with the same <radical>family name</radical>. They open one tired <radical>mouth</radical> each and groan together as the ruler's <kanji>subjects</kanji>.",
    "k-substitute": "A <radical>person</radical> dreads standing guard all night at the <radical>ceremony</radical>. They stuff a coat with straw and lean it against the post instead. Nobody notices the swap, and the dummy becomes their <kanji>substitute</kanji>.",
    "k-advance": "An <radical>old bird</radical> refuses to fly anymore. It hops off its perch onto the winding <radical>road</radical> below. Wings folded, it walks step by step to <kanji>advance</kanji>.",
    "k-possess": "You balance a coin on level <radical>ground</radical>, and it tips into a <radical>slide</radical>. The coin slips down through a window where the <radical>moon</radical> hangs. It drops into your palm, and now you <kanji>possess</kanji> it.",
}

applied = 0
for path in sorted(glob.glob(os.path.join(os.path.dirname(__file__), "out", "*.json"))):
    data = json.load(open(path))
    hits = [s for s in data if s in FIXES]
    for slug in hits:
        data[slug] = FIXES[slug]
        applied += 1
    if hits:
        json.dump(data, open(path, "w"), ensure_ascii=False, indent=1)
        print(f"{os.path.basename(path)}: patched {', '.join(hits)}")

print(f"\napplied {applied}/{len(FIXES)}")
missing = set(FIXES) - {s for p in glob.glob(os.path.join(os.path.dirname(__file__), "out", "*.json")) for s in json.load(open(p))}
if missing:
    print("NOT FOUND (batch not landed yet):", ", ".join(sorted(missing)))
