#!/usr/bin/env python3
"""app-v81, part 2: the drug list was chemo-shaped and thin. Aaron typed Keytruda and got nothing.

WHAT GOES IN AND WHAT DOES NOT. Every line here follows the rules the existing ones were written
to, and they are not style preferences -- each was paid for:

  * WHAT THE MEDICINE DOES, not what the reader HAS, wherever a drug treats several things. The
    generator's guard exists because a card once told a breast cancer patient she had ovarian
    cancer. Where a drug has one plain everyday use the house style does name it ("Treats
    depression, and is also used for anxiety") -- the rule is against asserting a DIAGNOSIS under
    someone's name, not against plain language.
  * No dose, no schedule, no strength.
  * No dosage form and no route. Lidocaine reads "Numbs the area where it is used" and not "a
    cream", because the same name is also a rinse and a patch.
  * No fever claim. A fever during chemotherapy is a thing to report, not to suppress, and this app
    tracks Temperature.
  * No instruction to the reader. The app describes; the care team prescribes.
  * A NAME THAT CANNOT CARRY ONE TRUE SENTENCE GETS NONE. Excedrin is deliberately absent because
    the bare name covers products with different ingredients. Same reasoning keeps combination
    cough and cold brands out below.

American spellings throughout, matching the file.
"""
import sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent
HTML = ROOT / 'index.html'

def die(msg):
    print('PATCH FAILED: ' + msg); sys.exit(1)

src = HTML.read_text(encoding='utf-8')
if "'pembrolizumab'" in src:
    die('already applied')
if "const APP_VERSION = 'app-v81'" not in src:
    die('part 1 has not been applied -- run harness-v81-purpose-hint.py first')

ANCHOR = "  'vicodin': 'A strong pain reliever that also contains acetaminophen.'\n};"
if src.count(ANCHOR) != 1:
    die('the end of MED_PURPOSE is not where it was -- nothing written')

NEW = """  'vicodin': 'A strong pain reliever that also contains acetaminophen.',

  // ---- app-v81: the list was chemo-shaped and thin -------------------------------------------
  // Aaron typed Keytruda, one of the most widely used cancer medicines there is, and the app had
  // nothing to say. Immunotherapy, the targeted drugs and the everyday medications a patient is
  // ALSO taking were all missing. Named by both generic and brand, because a caregiver reads
  // whichever is on the bottle.

  // Immunotherapy and targeted medicines. These describe the mechanism rather than the cancer:
  // every one of them is used for several, and naming one under somebody's medication would be
  // the exact defect the table's generator carries nine guards against.
  'pembrolizumab': 'Helps the immune system find and attack cancer cells.',
  'keytruda': 'Helps the immune system find and attack cancer cells.',
  'nivolumab': 'Helps the immune system find and attack cancer cells.',
  'opdivo': 'Helps the immune system find and attack cancer cells.',
  'atezolizumab': 'Helps the immune system find and attack cancer cells.',
  'tecentriq': 'Helps the immune system find and attack cancer cells.',
  'trastuzumab': 'Targets a protein found on the surface of some cancer cells.',
  'herceptin': 'Targets a protein found on the surface of some cancer cells.',
  'pertuzumab': 'Targets a protein found on the surface of some cancer cells.',
  'perjeta': 'Targets a protein found on the surface of some cancer cells.',
  'bevacizumab': 'Slows the growth of the blood vessels a tumor needs to feed itself.',
  'avastin': 'Slows the growth of the blood vessels a tumor needs to feed itself.',
  'rituximab': 'Targets a protein on the surface of certain white blood cells.',
  'rituxan': 'Targets a protein on the surface of certain white blood cells.',

  // Chemotherapy. Same reasoning, and the mechanism is also the honest answer to "what is it for" --
  // these are given in many different combinations for many different cancers.
  'paclitaxel': 'A chemotherapy medicine that stops cancer cells from dividing.',
  'taxol': 'A chemotherapy medicine that stops cancer cells from dividing.',
  'docetaxel': 'A chemotherapy medicine that stops cancer cells from dividing.',
  'taxotere': 'A chemotherapy medicine that stops cancer cells from dividing.',
  'etoposide': 'A chemotherapy medicine that stops cancer cells from dividing.',
  'vincristine': 'A chemotherapy medicine that stops cancer cells from dividing.',
  'vinorelbine': 'A chemotherapy medicine that stops cancer cells from dividing.',
  'irinotecan': 'A chemotherapy medicine that stops cancer cells from dividing.',
  'doxorubicin': 'A chemotherapy medicine that stops cancer cells from dividing.',
  'adriamycin': 'A chemotherapy medicine that stops cancer cells from dividing.',
  'carboplatin': 'A chemotherapy medicine that damages the DNA of cancer cells.',
  'cisplatin': 'A chemotherapy medicine that damages the DNA of cancer cells.',
  'oxaliplatin': 'A chemotherapy medicine that damages the DNA of cancer cells.',
  'eloxatin': 'A chemotherapy medicine that damages the DNA of cancer cells.',
  'cyclophosphamide': 'A chemotherapy medicine that damages the DNA of cancer cells.',
  'cytoxan': 'A chemotherapy medicine that damages the DNA of cancer cells.',
  'fluorouracil': 'A chemotherapy medicine that blocks a chemical cancer cells need to grow.',
  'capecitabine': 'A chemotherapy medicine that blocks a chemical cancer cells need to grow.',
  'xeloda': 'A chemotherapy medicine that blocks a chemical cancer cells need to grow.',
  'gemcitabine': 'A chemotherapy medicine that stops cancer cells from copying their DNA.',
  'gemzar': 'A chemotherapy medicine that stops cancer cells from copying their DNA.',
  'methotrexate': 'Blocks a vitamin that fast-growing cells need, and is also used for some immune conditions.',
  'pemetrexed': 'A chemotherapy medicine that blocks vitamins cancer cells need to grow.',
  'alimta': 'A chemotherapy medicine that blocks vitamins cancer cells need to grow.',

  // Hormone treatments.
  'tamoxifen': 'Blocks the effect of estrogen on cells that respond to it.',
  'anastrozole': 'Lowers the amount of estrogen the body makes.',
  'arimidex': 'Lowers the amount of estrogen the body makes.',
  'letrozole': 'Lowers the amount of estrogen the body makes.',
  'femara': 'Lowers the amount of estrogen the body makes.',
  'leuprolide': 'Lowers the amount of sex hormones the body makes.',
  'lupron': 'Lowers the amount of sex hormones the body makes.',

  // Supportive care -- the drugs given alongside treatment.
  // NOT "the nausea that comes with chemotherapy" -- that phrasing reads as a timing instruction
  // and the table's own guard rejects it, in both spellings, on purpose.
  'aprepitant': 'Helps prevent the nausea and vomiting that chemotherapy can cause.',
  'emend': 'Helps prevent the nausea and vomiting that chemotherapy can cause.',
  'palonosetron': 'Prevents and settles nausea and vomiting.',
  'aloxi': 'Prevents and settles nausea and vomiting.',
  'olanzapine': 'Calms nausea, and is also used for some mental health conditions.',
  'zyprexa': 'Calms nausea, and is also used for some mental health conditions.',
  'megestrol': 'A hormone medicine that can improve appetite.',
  'megace': 'A hormone medicine that can improve appetite.',
  'mirtazapine': 'Treats depression, and can also help with sleep and appetite.',
  'remeron': 'Treats depression, and can also help with sleep and appetite.',
  'sucralfate': 'Coats and protects the lining of the stomach and gut.',
  'carafate': 'Coats and protects the lining of the stomach and gut.',
  'prednisone': 'A steroid that calms swelling and immune reactions.',
  'methylprednisolone': 'A steroid that calms swelling and immune reactions.',
  'medrol': 'A steroid that calms swelling and immune reactions.',
  'hydroxyzine': 'Eases itching and anxiety. It causes drowsiness.',
  'vistaril': 'Eases itching and anxiety. It causes drowsiness.',
  'bisacodyl': 'A laxative that stimulates the bowel to ease constipation.',
  'dulcolax': 'A laxative that stimulates the bowel to ease constipation.',

  // Stronger pain relief.
  'hydromorphone': 'A strong pain reliever for moderate to severe pain.',
  'dilaudid': 'A strong pain reliever for moderate to severe pain.',
  'fentanyl': 'A very strong pain reliever for severe ongoing pain.',
  'methadone': 'A long-acting strong pain reliever.',
  'naloxone': 'Reverses the effects of opioid medicines in an emergency.',
  'narcan': 'Reverses the effects of opioid medicines in an emergency.',
  'naproxen': 'Eases pain and swelling.',
  'aleve': 'Eases pain and swelling.',
  'aspirin': 'Eases pain and swelling, and makes the blood less likely to clot.',

  // Infections.
  'amoxicillin': 'An antibiotic, for infections caused by bacteria.',
  'azithromycin': 'An antibiotic, for infections caused by bacteria.',
  'zithromax': 'An antibiotic, for infections caused by bacteria.',
  'cephalexin': 'An antibiotic, for infections caused by bacteria.',
  'keflex': 'An antibiotic, for infections caused by bacteria.',
  'fluconazole': 'Treats infections caused by fungus or yeast.',
  'diflucan': 'Treats infections caused by fungus or yeast.',
  'nystatin': 'Treats infections caused by yeast.',
  'acyclovir': 'Treats infections caused by certain viruses.',
  'zovirax': 'Treats infections caused by certain viruses.',
  'valacyclovir': 'Treats infections caused by certain viruses.',
  'valtrex': 'Treats infections caused by certain viruses.',

  // Blood thinners.
  'enoxaparin': 'Makes the blood less likely to clot.',
  'lovenox': 'Makes the blood less likely to clot.',
  'apixaban': 'Makes the blood less likely to clot.',
  'eliquis': 'Makes the blood less likely to clot.',
  'rivaroxaban': 'Makes the blood less likely to clot.',
  'xarelto': 'Makes the blood less likely to clot.',
  'warfarin': 'Makes the blood less likely to clot.',
  'coumadin': 'Makes the blood less likely to clot.',

  // The everyday medications a patient is also taking, which the list had none of at all.
  'levothyroxine': 'Replaces thyroid hormone when the body makes too little.',
  'synthroid': 'Replaces thyroid hormone when the body makes too little.',
  'lisinopril': 'Relaxes blood vessels to lower blood pressure.',
  'losartan': 'Relaxes blood vessels to lower blood pressure.',
  'amlodipine': 'Relaxes blood vessels to lower blood pressure.',
  'metoprolol': 'Slows the heart and lowers blood pressure.',
  'atorvastatin': 'Lowers cholesterol.',
  'lipitor': 'Lowers cholesterol.',
  'simvastatin': 'Lowers cholesterol.',
  'zocor': 'Lowers cholesterol.',
  'metformin': 'Lowers blood sugar.',
  'escitalopram': 'Treats depression, and is also used for anxiety.',
  'lexapro': 'Treats depression, and is also used for anxiety.',
  'citalopram': 'Treats depression, and is also used for anxiety.',
  'celexa': 'Treats depression, and is also used for anxiety.',
  'trazodone': 'Treats depression, and is also used to help with sleep.',
  'zolpidem': 'Helps with falling asleep.',
  'ambien': 'Helps with falling asleep.',
  'melatonin': 'A hormone the body makes at night, used to help with sleep.',

  // Supplements, where the honest description is simply what it is.
  'magnesium oxide': 'A magnesium supplement, for low magnesium levels.',
  'potassium chloride': 'A potassium supplement, for low potassium levels.',
  'calcium carbonate': 'A calcium supplement that also neutralizes stomach acid.',
  'tums': 'A calcium supplement that also neutralizes stomach acid.',
  // CYANOCOBALAMIN AND VITAMIN B12 ARE DELIBERATELY ABSENT. Every description in this table is
  // checked for digits, because a digit in a description is nearly always a dose that escaped. The
  // only true short line for this one has the 12 in the drug's own name, and widening a safety
  // guard so my own sentence fits through it is the move this project has been burned by. A name
  // that cannot carry one true sentence under the rules gets none -- the same reasoning that keeps
  // Excedrin out, a few dozen lines above.
  'cholecalciferol': 'A vitamin D supplement.',
  'vitamin d': 'A vitamin D supplement.'
};"""

src = src.replace(ANCHOR, NEW, 1)
HTML.write_text(src, encoding='utf-8')
print('app-v81 part 2 applied: the drug list is no longer chemo-shaped and thin')
