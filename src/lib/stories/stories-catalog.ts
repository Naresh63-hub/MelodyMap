/**
 * Curated Master Stories & Audiobooks Catalog
 * Handpicked, studio-grade audio story series in Telugu, Hindi, and English.
 * Inspired by Kuku FM & Pocket FM: Thrillers, Suspense, Audiobooks, Epics, Warriors, and Bedtime Classics.
 * Zero duplicate clutter, full chapter numbering, and direct CDN audio streams.
 */

import type { StorySeries, StoryCategory, StoryLanguage } from "./story.types";

export const MASTER_STORIES_CATALOG: StorySeries[] = [
  // ==========================================================================
  // 1. 🔥 THRILLER & SUSPENSE: Cheekatlo Suryudu - Yandamuri Veerendranath (Telugu)
  // ==========================================================================
  {
    id: "story:yandamuri-cheekatlo-suryudu-te",
    title: "చీకట్లో సూర్యుడు (Cheekatlo Suryudu)",
    narrator: "యండమూరి వీరేంద్రనాథ్ (TeluguOne Audio)",
    language: "Telugu",
    category: "thriller",
    coverUrl: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80",
    description:
      "ప్రముఖ నవలా చక్రవర్తి యండమూరి వీరేంద్రనాథ్ కలం నుండి జాలువారిన సంచలనాత్మక సైకలాజికల్ క్రైమ్ థ్రిల్లర్ ఆడియోబుక్. ప్రతి క్షణం ఊపిరి బిగబట్టించే సస్పెన్స్.",
    rating: 4.96,
    totalChapters: 5,
    featured: true,
    tags: ["యండమూరి", "క్రైమ్", "థ్రిల్లర్", "Telugu Audiobook", "Suspense", "Yandamuri"],
    chapters: [
      {
        id: "story:ch:cs-1",
        seriesId: "story:yandamuri-cheekatlo-suryudu-te",
        chapterNumber: 1,
        title: "అధ్యాయం 1: చీకట్లో సూర్యుడు - మిస్టరీ ఆరంభం",
        duration: "12:01",
        durationSeconds: 721,
        streamUrl: "https://audio4.redcircle.com/episodes/f64cfd34-e497-4182-975f-9f7b365e0c51/stream.mp3",
        synopsis: "ఒక చీకటి రాత్రి, అర్థంకాని నేరం మరియు హంతకుడి జాడ కోసం మొదలైన విచారణ.",
      },
      {
        id: "story:ch:cs-2",
        seriesId: "story:yandamuri-cheekatlo-suryudu-te",
        chapterNumber: 2,
        title: "అధ్యాయం 2: రహస్య ఆనవాళ్ళు - రెండో సాక్ష్యం",
        duration: "11:12",
        durationSeconds: 672,
        streamUrl: "https://audio4.redcircle.com/episodes/7e687fcc-191c-45e8-8999-2a55e12722cd/stream.mp3",
        synopsis: "ఊహించని ఆధారాలు బయటపడటంతో కేసు సరికొత్త మలుపు తిరుగుతుంది.",
      },
      {
        id: "story:ch:cs-3",
        seriesId: "story:yandamuri-cheekatlo-suryudu-te",
        chapterNumber: 3,
        title: "అధ్యాయం 3: మానసిక యుద్ధం - నేరగాడి వ్యూహం",
        duration: "12:34",
        durationSeconds: 754,
        streamUrl: "https://audio4.redcircle.com/episodes/6c6469cc-030b-4ef8-995a-e354083dd032/stream.mp3",
        synopsis: "పోలీసులకు నిందితుడికి మధ్య మొదలైన తీవ్రమైన మైండ్ గేమ్‌లు.",
      },
      {
        id: "story:ch:cs-4",
        seriesId: "story:yandamuri-cheekatlo-suryudu-te",
        chapterNumber: 4,
        title: "అధ్యాయం 4: పద్మవ్యూహం - సత్యశోధన",
        duration: "12:14",
        durationSeconds: 734,
        streamUrl: "https://audio4.redcircle.com/episodes/3ecf2027-9105-4c3d-9df8-f15408c92368/stream.mp3",
        synopsis: "అందరూ నమ్మిన వ్యక్తి అసలు రూపం వెలుగులోకి రావడం.",
      },
      {
        id: "story:ch:cs-5",
        seriesId: "story:yandamuri-cheekatlo-suryudu-te",
        chapterNumber: 5,
        title: "అధ్యాయం 5: ఉత్కంఠభరిత ముగింపు - వెలుగులోకి సూర్యుడు",
        duration: "10:10",
        durationSeconds: 610,
        streamUrl: "https://audio4.redcircle.com/episodes/5cf4fec9-7319-42fe-9bf9-b1c79877e991/stream.mp3",
        synopsis: "అన్ని చిక్కుముడులు వీడి అసలు హంతకుడు పట్టుబడే అద్భుతమైన క్లైమాక్స్.",
      },
    ],
  },

  // ==========================================================================
  // 2. 🔥 THRILLER & SUSPENSE: Horror Nights With Amit Deondi (Hindi)
  // ==========================================================================
  {
    id: "story:horror-nights-hi",
    title: "हॉरर नाइट्स - डार्क मिस्ट्रीज (Horror Nights)",
    narrator: "अमित देयोंदी (Audio Pitara)",
    language: "Hindi",
    category: "thriller",
    coverUrl: "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600&auto=format&fit=crop&q=80",
    description:
      "रोंगटे खड़े कर देने वाली सच्ची और काल्पनिक खौफनाक दास्तानें। अंधेरी रातों के अनसुलझे रहस्य और डरावनी आवाज़ों का रोंगटे खड़े करने वाला ऑडियो ड्रामा।",
    rating: 4.94,
    totalChapters: 5,
    featured: true,
    tags: ["Horror", "Suspense", "Hindi Horror", "Audio Drama", "Kuku FM style", "Thriller"],
    chapters: [
      {
        id: "story:ch:hn-1",
        seriesId: "story:horror-nights-hi",
        chapterNumber: 1,
        title: "कहानी 1: हॉन्टेड क्रिसमस - हवेली का रहस्य (Part 1)",
        duration: "15:07",
        durationSeconds: 907,
        streamUrl: "https://traffic.megaphone.fm/CPP2022181212.mp3?updated=1734962809",
        synopsis: "पुरानी सुनसान हवेली में सर्दियों की रात और अजीबोगरीब कदमों की चाप।",
      },
      {
        id: "story:ch:hn-2",
        seriesId: "story:horror-nights-hi",
        chapterNumber: 2,
        title: "कहानी 2: खौफनाक साया - गहराती परछाई (Part 2)",
        duration: "14:37",
        durationSeconds: 877,
        streamUrl: "https://traffic.megaphone.fm/CPP4342892647.mp3?updated=1735130015",
        synopsis: "कमरे की दीवारों पर दिखने वाले अजीब संकेत और बंद दरवाजों का खुद खुलना।",
      },
      {
        id: "story:ch:hn-3",
        seriesId: "story:horror-nights-hi",
        chapterNumber: 3,
        title: "कहानी 3: रूहानी आवाजें - अंधेरे का खेल (Part 3)",
        duration: "14:57",
        durationSeconds: 897,
        streamUrl: "https://traffic.megaphone.fm/CPP9968750427.mp3?updated=1735193848",
        synopsis: "अतीत के एक भयानक हादसे का सच सामने आना और रूहों का आक्रोश।",
      },
      {
        id: "story:ch:hn-4",
        seriesId: "story:horror-nights-hi",
        chapterNumber: 4,
        title: "कहानी 4: अनसुलझा खौफ - बचने की जद्दोजहद (Part 4)",
        duration: "13:55",
        durationSeconds: 835,
        streamUrl: "https://traffic.megaphone.fm/CPP6870397683.mp3?updated=1735218304",
        synopsis: "उस खौफनाक रात से जिंदा निकलने की कोशिश और रहस्यमयी तांत्रिक शक्ति।",
      },
      {
        id: "story:ch:hn-5",
        seriesId: "story:horror-nights-hi",
        chapterNumber: 5,
        title: "कहानी 5: अंतिम प्रहार - खौफ का अंत (Part 5)",
        duration: "19:23",
        durationSeconds: 1163,
        streamUrl: "https://traffic.megaphone.fm/CPP8570516928.mp3?updated=1735297857",
        synopsis: "हवेली के अंतिम रहस्य का पर्दाफाश और सब कुछ बदल देने वाला अंत।",
      },
    ],
  },

  // ==========================================================================
  // 3. 🔥 THRILLER & MYSTERY: Bethala Kathalu (Telugu)
  // ==========================================================================
  {
    id: "story:bethala-kathalu-te",
    title: "బేతాళ కథలు (Bethala Kathalu - Mystery Thrillers)",
    narrator: "సురేష్ కుమార్ (Suresh Kumar)",
    language: "Telugu",
    category: "thriller",
    coverUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80",
    description:
      "విక్రమార్క మహారాజు మరియు శవంలో ఆవహించిన బేతాళుని మధ్య సాగే విచిత్ర, రసవత్తర మరియు గగుర్పొడిచే కథా సంభాషణలు. ప్రతి కథలోనూ ఒక చిక్కుప్రశ్న.",
    rating: 4.93,
    totalChapters: 5,
    tags: ["బేతాళ కథలు", "విక్రమార్కుడు", "తెలుగు", "సస్పెన్స్", "Mystery"],
    chapters: [
      {
        id: "story:ch:bk-1",
        seriesId: "story:bethala-kathalu-te",
        chapterNumber: 1,
        title: "కథ 1: విక్రమార్కుడు మరియు విచిత్ర బేతాళ సవాల్",
        duration: "06:11",
        durationSeconds: 371,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2021-8-19/219281072-44100-2-2d46d05024c6.m4a",
        synopsis: "శ్మశాన వాటికలో బేతాళుని భుజాన వేసుకున్న విక్రమార్కుడు మరియు మొదటి చిక్కుప్రశ్న.",
      },
      {
        id: "story:ch:bk-2",
        seriesId: "story:bethala-kathalu-te",
        chapterNumber: 2,
        title: "కథ 2: మంత్రగాడి కుట్ర మరియు రాకుమారి",
        duration: "06:20",
        durationSeconds: 380,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2021-8-19/219273797-44100-2-90654789aca1e.m4a",
        synopsis: "కపట మంత్రగాడు రాకుమారిని బలి ఇవ్వాలని చేసిన కుతంత్రం మరియు ధీరోదాత్త తీర్పు.",
      },
      {
        id: "story:ch:bk-3",
        seriesId: "story:bethala-kathalu-te",
        chapterNumber: 3,
        title: "కథ 3: ముగ్గురు ప్రేమికులు మరియు ప్రాణత్యాగం",
        duration: "05:35",
        durationSeconds: 335,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2021-8-4/216601390-44100-2-481f583b7780b.m4a",
        synopsis: "ఒకే కన్య కోసం ప్రాణాలు అర్పించిన ముగ్గురు యువకులలో ఎవరి త్యాగం గొప్పది?",
      },
      {
        id: "story:ch:bk-4",
        seriesId: "story:bethala-kathalu-te",
        chapterNumber: 4,
        title: "కథ 4: వింత దొంగతనం మరియు పండితుడి న్యాయం",
        duration: "11:11",
        durationSeconds: 671,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2021-7-15/212663475-44100-2-477ef80365354.m4a",
        synopsis: "ఎవరికీ దొరకకుండా జరిగిన దొంగతనాన్ని కేవలం బుద్ధిబలంతో చేధించిన వైనం.",
      },
      {
        id: "story:ch:bk-5",
        seriesId: "story:bethala-kathalu-te",
        chapterNumber: 5,
        title: "కథ 5: మాయా దీవి మరియు అదృశ్య నగరం",
        duration: "09:08",
        durationSeconds: 548,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2021-7-7/210846448-44100-2-75d745edcb106.m4a",
        synopsis: "సాగర గర్భంలో దాగి ఉన్న మాయా నగరం మరియు బేతాళుని చివరి సంభాషణ.",
      },
    ],
  },

  // ==========================================================================
  // 4. 💡 AUDIOBOOKS & GROWTH: Book Journey Insider (Hindi Audiobooks)
  // ==========================================================================
  {
    id: "story:book-journey-hi",
    title: "बुक जर्नी इनसाइडर - बेस्टसेलर ऑडियोबुक्स (Hindi Audiobooks)",
    narrator: "Book Journey Insider",
    language: "Hindi",
    category: "audiobooks",
    coverUrl: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=600&auto=format&fit=crop&q=80",
    description:
      "दुनिया की सबसे लोकप्रिय किताबों के संपूर्ण हिंदी ऑडियोबुक सारांश। जीवन में सफलता, आदतें बदलने, धन कमाने और मानसिक शांति के व्यावहारिक उपाय।",
    rating: 4.97,
    totalChapters: 5,
    featured: true,
    tags: ["Audiobook", "Hindi Audiobook", "Self-Help", "Motivation", "Kuku FM style", "Mindset"],
    chapters: [
      {
        id: "story:ch:bj-1",
        seriesId: "story:book-journey-hi",
        chapterNumber: 1,
        title: "ऑडियोबुक 1: The First 20 Hours - कोई भी नया हुनर तेजी से सीखें",
        duration: "28:14",
        durationSeconds: 1694,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2026-10-20/437210636-44100-2-c35b77dd608c2.mp3",
        synopsis: "जोश कॉफ़मैन की मशहूर किताब का ऑडियो सारांश: मात्र 20 घंटों में किसी भी नए कौशल में महारत कैसे हासिल करें।",
      },
      {
        id: "story:ch:bj-2",
        seriesId: "story:book-journey-hi",
        chapterNumber: 2,
        title: "ऑडियोबुक 2: How to Sleep Well - गहरी नींद और मानसिक ऊर्जा",
        duration: "26:16",
        durationSeconds: 1576,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2026-10-18/437067819-44100-2-bdaa8d7ee84b4.mp3",
        synopsis: "डॉ. नील स्टेनली की पुस्तक: जीवन में तनावमुक्त रहने और कार्यकुशलता बढ़ाने के लिए उत्तम नींद का विज्ञान।",
      },
      {
        id: "story:ch:bj-3",
        seriesId: "story:book-journey-hi",
        chapterNumber: 3,
        title: "ऑडियोबुक 3: The Power of 30 Small Habits - 30 छोटी आदतें, बड़े नतीजे",
        duration: "31:56",
        durationSeconds: 1916,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2026-10-14/436710836-44100-2-3b6cb8168ff3f8.mp3",
        synopsis: "दैनिक जीवन की 30 ऐसी सूक्ष्म आदतें जो आपकी सोच, स्वास्थ्य और आर्थिक स्थिति को पूरी तरह बदल सकती हैं।",
      },
      {
        id: "story:ch:bj-4",
        seriesId: "story:book-journey-hi",
        chapterNumber: 4,
        title: "ऑडियोबुक 4: Life After 21 Days - 21 दिन में जीवन रूपांतरण",
        duration: "29:53",
        durationSeconds: 1793,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2026-10-11/436497298-44100-2-18a07984235ec.mp3",
        synopsis: "माइंडसेट, अनुशासन और नए संकल्पों को अपनी स्थायी दिनचर्या बनाने का 21 दिवसीय व्यावहारिक फॉर्मूला।",
      },
      {
        id: "story:ch:bj-5",
        seriesId: "story:book-journey-hi",
        chapterNumber: 5,
        title: "ऑडियोबुक 5: The Let Them Theory - लोगों की परवाह करना छोड़ें",
        duration: "32:45",
        durationSeconds: 1965,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2026-10-7/436150993-44100-2-30a7719c1e2588.mp3",
        synopsis: "मेल रॉबिंस का प्रसिद्ध सिद्धांत: 'लेट देम' अपनाकर अनावश्यक मानसिक तनाव और दूसरों के नियंत्रण से मुक्ति पाएं।",
      },
    ],
  },

  // ==========================================================================
  // 5. 💡 AUDIOBOOKS & WISDOM: Nanna Neethi Kathalu (Telugu)
  // ==========================================================================
  {
    id: "story:nanna-neethi-te",
    title: "నాన్న నీతి కథలు (Nanna Neethi Kathalu - Life Wisdom)",
    narrator: "నాన్న నీతి కథామాలిక (Nanna Stories)",
    language: "Telugu",
    category: "audiobooks",
    coverUrl: "https://images.unsplash.com/photo-1476820865390-c52aeebb9891?w=600&auto=format&fit=crop&q=80",
    description:
      "జీవితాన్ని తీర్చిదిద్దే అపురూపమైన తెలుగు నీతి మరియు వ్యక్తిత్వ వికాస కథలు. అనుభవాలు, బంధాలు, మానవతా విలువలు మరియు ఆత్మీయ సంభాషణలు.",
    rating: 4.95,
    totalChapters: 5,
    tags: ["నీతి కథలు", "తెలుగు ఆడియో", "జీవిత సత్యాలు", "కుటుంబం", "ప్రేరణ"],
    chapters: [
      {
        id: "story:ch:nn-1",
        seriesId: "story:nanna-neethi-te",
        chapterNumber: 1,
        title: "కథ 1: మతాబుల మతలబు - జీవితంలో వెలుగులు",
        duration: "08:19",
        durationSeconds: 499,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2024-4-29/379133664-44100-2-04f66433e3753.m4a",
        synopsis: "క్షణికమైన ఆర్భాటాల కంటే నిరంతరం నిలిచే అంతర్గత వెలుగే నిజమైన సంపద అని చాటే కథ.",
      },
      {
        id: "story:ch:nn-2",
        seriesId: "story:nanna-neethi-te",
        chapterNumber: 2,
        title: "కథ 2: పదహారు వేల రూపాయలు - విలువల పాఠం",
        duration: "06:01",
        durationSeconds: 361,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2024-4-28/379023003-44100-2-e1edcf4715341.m4a",
        synopsis: "డబ్బు కంటే నమ్మకం, నిజాయితీ జీవితంలో ఎంతటి ఉన్నత స్థానానికి చేర్చుతాయో తెలిపే నిజజీవిత కథ.",
      },
      {
        id: "story:ch:nn-3",
        seriesId: "story:nanna-neethi-te",
        chapterNumber: 3,
        title: "కథ 3: నిర్వాసుడి మోక్షప్రాప్తి - అంతర్గత శాంతి",
        duration: "08:31",
        durationSeconds: 511,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/production/2023-2-15/318221752-48000-2-2421e4492c99b.mp3",
        synopsis: "కోరికలను అదుపులో ఉంచుకుని నిరాడంబరంగా జీవించడంలోనే మోక్షం ఉందని తెలిపే ఆధ్యాత్మిక కథ.",
      },
      {
        id: "story:ch:nn-4",
        seriesId: "story:nanna-neethi-te",
        chapterNumber: 4,
        title: "కథ 4: మొక్కలు మన పిల్లలలాంటివి - కరివేపాకు కథ",
        duration: "14:25",
        durationSeconds: 865,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/production/2023-1-27/315099961-44100-2-fdb01cb8f26b5.mp3",
        synopsis: "ప్రకృతిని, చెట్లను పిల్లల్లాగే ప్రేమతో పెంచితే అవి ఇచ్చే చల్లని నీడను వివరించే హృద్యమైన కథ.",
      },
      {
        id: "story:ch:nn-5",
        seriesId: "story:nanna-neethi-te",
        chapterNumber: 5,
        title: "కథ 5: పిల్లలు దగ్గరుండటమే మేలా? - తల్లిదండ్రుల అనురాగం",
        duration: "12:16",
        durationSeconds: 736,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/production/2023-1-26/314924924-44100-2-d930f468e54e2.mp3",
        synopsis: "వృద్ధాప్యంలో తల్లిదండ్రులకు కావాల్సింది సంపద కాదు, పిల్లల చిన్న ఆత్మీయ పలకరింపు అని తెలిపే కథనం.",
      },
    ],
  },

  // ==========================================================================
  // 6. 🕉️ EPICS: The Stories of Mahabharata (English / Universal Audio Drama)
  // ==========================================================================
  {
    id: "story:mahabharata-drama-en",
    title: "The Stories of Mahabharata",
    narrator: "Sudipta Bhawmik",
    language: "English",
    category: "epics",
    coverUrl: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80",
    description:
      "A grand, cinematic audio drama of the greatest epic ever told. Directed by Sudipta Bhawmik with dramatic voice acting, symphonic score, and high-stakes character conflicts.",
    rating: 4.98,
    totalChapters: 6,
    featured: true,
    tags: ["Mahabharata", "Audio Drama", "Epic", "Kurukshetra"],
    chapters: [
      {
        id: "story:ch:mb-1",
        seriesId: "story:mahabharata-drama-en",
        chapterNumber: 1,
        title: "Chapter 1: The Final Departure",
        duration: "15:53",
        durationSeconds: 953,
        streamUrl: "https://sphinx.acast.com/p/open/s/61a5495fd20fb600197c82fd/e/67ba0c93c665638d47a6b770/media.mp3",
        synopsis: "The culmination of the Kuru clan, the ascent of the Pandavas, and the final spiritual transition.",
      },
      {
        id: "story:ch:mb-2",
        seriesId: "story:mahabharata-drama-en",
        chapterNumber: 2,
        title: "Chapter 2: Vanaprastha & The End of Yadavas",
        duration: "23:42",
        durationSeconds: 1422,
        streamUrl: "https://sphinx.acast.com/p/open/s/61a5495fd20fb600197c82fd/e/6766fd542dc5d9b993b0b3da/media.mp3",
        synopsis: "The twilight of Dwarka, Gandhari's curse unfolding, and the retirement of the elders to the quiet forest.",
      },
      {
        id: "story:ch:mb-3",
        seriesId: "story:mahabharata-drama-en",
        chapterNumber: 3,
        title: "Chapter 3: Yudhishthira, The King of Hastinapur",
        duration: "17:43",
        durationSeconds: 1063,
        streamUrl: "https://sphinx.acast.com/p/open/s/61a5495fd20fb600197c82fd/e/6715470683ac9fccac2d7de7/media.mp3",
        synopsis: "The crowning of King Dharma, rebuilding the shattered empire, and the heavy burden of the crown.",
      },
      {
        id: "story:ch:mb-4",
        seriesId: "story:mahabharata-drama-en",
        chapterNumber: 4,
        title: "Chapter 4: The Mourning on Kurukshetra",
        duration: "22:08",
        durationSeconds: 1328,
        streamUrl: "https://sphinx.acast.com/p/open/s/61a5495fd20fb600197c82fd/e/66a699eb30d20f0a5f6a6d0a/media.mp3",
        synopsis: "Gandhari, Kunti, and the widows mourn the fallen heroes on the desolate battleground of Kurukshetra.",
      },
      {
        id: "story:ch:mb-5",
        seriesId: "story:mahabharata-drama-en",
        chapterNumber: 5,
        title: "Chapter 5: Ashwatthama's Midnight Revenge",
        duration: "22:55",
        durationSeconds: 1375,
        streamUrl: "https://sphinx.acast.com/p/open/s/61a5495fd20fb600197c82fd/e/665cf09f413fbf0012f0b142/media.mp3",
        synopsis: "The nocturnal raid on the sleeping Pandava encampment and the unleasing of the Brahmashira weapon.",
      },
      {
        id: "story:ch:mb-6",
        seriesId: "story:mahabharata-drama-en",
        chapterNumber: 6,
        title: "Chapter 6: Day Eighteen - The Fall of Duryodhana",
        duration: "29:57",
        durationSeconds: 1797,
        streamUrl: "https://sphinx.acast.com/p/open/s/61a5495fd20fb600197c82fd/e/65ff062f4cc0d00016230c02/media.mp3",
        synopsis: "The final duel between Bhima and Duryodhana at the lake of Dwaipayana, concluding the 18-day war.",
      },
    ],
  },

  // ==========================================================================
  // 7. 🕉️ EPICS: Sampoorna Ramayanam & Ayodhyakanda (Telugu)
  // ==========================================================================
  {
    id: "story:ramayana-telugu",
    title: "సంపూర్ణ రామాయణం (Sampoorna Ramayanam)",
    narrator: "బ్రహ్మశ్రీ చాగంటి కోటేశ్వరరావు & ఆకాశవాణి",
    language: "Telugu",
    category: "epics",
    coverUrl: "https://images.unsplash.com/photo-1609803384069-1cac59628889?w=600&auto=format&fit=crop&q=80",
    description:
      "శ్రీరామ చంద్రుని దివ్య చరితం. చాగంటి కోటేశ్వరరావు గారి అమృతవాక్కులతో రామాయణ రహస్యాలు మరియు ఆకాశవాణి శ్రవ్య రూపకం.",
    rating: 4.98,
    totalChapters: 5,
    featured: true,
    tags: ["రామాయణం", "చాగంటి", "సుందరకాండ", "భక్తి"],
    chapters: [
      {
        id: "story:ch:rm-1",
        seriesId: "story:ramayana-telugu",
        chapterNumber: 1,
        title: "అధ్యాయం 1: శ్రీ రామ లక్ష్మణ సంవాదం",
        duration: "11:54",
        durationSeconds: 714,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2024-2-27/372388198-44100-2-89a881a1d4c9b.m4a",
        synopsis: "ధర్మ రక్షణకై శ్రీరాముడు లక్ష్మణునికి బోధించిన క్షమాగుణం మరియు రాజధర్మ రహస్యాలు.",
      },
      {
        id: "story:ch:rm-2",
        seriesId: "story:ramayana-telugu",
        chapterNumber: 2,
        title: "అధ్యాయం 2: అయోధ్యా కాండ - శ్రీ రామ సీతా సంవాదం",
        duration: "13:53",
        durationSeconds: 833,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2024-2-17/371194546-44100-2-38cd947a9e604.m4a",
        synopsis: "వనవాసానికి వెళ్లే ముందు సీతాదేవి శ్రీరామునితో పలికిన అద్భుత పాతివ్రత్య వచనాలు.",
      },
      {
        id: "story:ch:rm-3",
        seriesId: "story:ramayana-telugu",
        chapterNumber: 3,
        title: "అధ్యాయం 3: శ్రీ రామ వనవాస నిర్ణయం",
        duration: "31:23",
        durationSeconds: 1883,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2024-2-5/369750929-44100-2-789c1edd6f8b.m4a",
        synopsis: "తండ్రి మాట కోసం రాజ్యభోగాలను తృణప్రాయంగా వదిలి దండకారణ్యానికి ప్రయాణమైన ధర్మమూర్తి.",
      },
      {
        id: "story:ch:rm-4",
        seriesId: "story:ramayana-telugu",
        chapterNumber: 4,
        title: "అధ్యాయం 4: అయోధ్యా కాండ - కైకేయి వరములు కోరుట",
        duration: "32:46",
        durationSeconds: 1966,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2024-1-27/368933167-44100-2-0f3e4c03427d2.m4a",
        synopsis: "దశరథ మహారాజును కైకేయి అడిగిన రెండు కోరికలు మరియు రఘువంశంలో మొదలైన తీవ్ర వేదన.",
      },
      {
        id: "story:ch:rm-5",
        seriesId: "story:ramayana-telugu",
        chapterNumber: 5,
        title: "అధ్యాయం 5: అయోధ్యా కాండ - మంథర దుర్బుద్ధి",
        duration: "23:53",
        durationSeconds: 1433,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2024-1-23/368480400-44100-2-ecbacae249a25.m4a",
        synopsis: "కైకేయి మనసును విషపూరితం చేసిన మంథర కుట్ర మరియు పట్టాభిషేక విఘాత పరిణామాలు.",
      },
    ],
  },

  // ==========================================================================
  // 8. ⚔️ WARRIORS: Chhatrapati Shivaji Maharaj - The Grand Saga (Hindi)
  // ==========================================================================
  {
    id: "story:shivaji-maharaj-hi",
    title: "छत्रपति शिवाजी महाराज - स्वराज गाथा",
    narrator: "वीर रस नाट्य मंडली (Veer Gatha Troupe)",
    language: "Hindi",
    category: "warriors",
    coverUrl: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=600&auto=format&fit=crop&q=80",
    description:
      "हिंदवी स्वराज्य के संस्थापक, अदम्य साहसी और गुरिल्ला युद्ध के जनक छत्रपति शिवाजी महाराज की रोंगटे खड़े कर देने वाली शौर्य गाथा।",
    rating: 4.96,
    totalChapters: 5,
    featured: true,
    tags: ["Shivaji", "Shivaji Maharaj", "Warriors", "Maratha", "Swarajya"],
    chapters: [
      {
        id: "story:ch:sh-1",
        seriesId: "story:shivaji-maharaj-hi",
        chapterNumber: 1,
        title: "अध्याय 1: छत्रपति शिवाजी महाराज का भव्य राज्याभिषेक",
        duration: "15:41",
        durationSeconds: 941,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2021-4-24/59155b52-e725-b02a-4070-faf898f53f85.mp3",
        synopsis: "सन 1674 में रायगढ़ दुर्ग पर 32 मण स्वर्ण सिंहासन पर छत्रपति के रूप में पावन राज्यारोहण।",
      },
      {
        id: "story:ch:sh-2",
        seriesId: "story:shivaji-maharaj-hi",
        chapterNumber: 2,
        title: "अध्याय 2: स्वराज्य जननी राजमाता जिजाऊ का पावन स्मरण",
        duration: "14:33",
        durationSeconds: 873,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2021-4-24/1b60b47e-f5ae-c12d-875d-87e2c78adedd.mp3",
        synopsis: "शिवाजी महाराज को स्वराज्य के संस्कार देने वाली माता जीजाबाई का अंतिम समय और उनका अमर मार्गदर्शन।",
      },
      {
        id: "story:ch:sh-3",
        seriesId: "story:shivaji-maharaj-hi",
        chapterNumber: 3,
        title: "अध्याय 3: दक्षिण दिग्विजय का सिंहनाद",
        duration: "14:56",
        durationSeconds: 896,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2021-4-24/ea931dc2-ec70-8d59-d075-6c026a3b846b.mp3",
        synopsis: "कर्नाटक और जिंजी तक मराठा साम्राज्य का विस्तार और अजेय नौसेना तथा दुर्गों की स्थापना।",
      },
      {
        id: "story:ch:sh-4",
        seriesId: "story:shivaji-maharaj-hi",
        chapterNumber: 4,
        title: "अध्याय 4: युवराज संभाजी और स्वराज्य की रक्षा",
        duration: "13:25",
        durationSeconds: 805,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2021-4-24/f3b5f11d-f982-d201-8a6e-4696a984c93a.mp3",
        synopsis: "मुग़ल सल्तनत के षड्यंत्रों के विरुद्ध स्वराज्य की सीमाओं को अभेद्य बनाए रखने का संघर्ष।",
      },
      {
        id: "story:ch:sh-5",
        seriesId: "story:shivaji-maharaj-hi",
        chapterNumber: 5,
        title: "अध्याय 5: हिंदवी स्वराज्य की अमर ज्योति और महाप्रयाण",
        duration: "13:08",
        durationSeconds: 788,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2021-4-24/1b7867b5-bb27-02d5-197a-d5159095bbe1.mp3",
        synopsis: "एक युगपुरुष का अमर लोक में प्रयाण और पूरे भारतवर्ष में स्वराज्य की प्रज्वलित अमर मशाल।",
      },
    ],
  },

  // ==========================================================================
  // 9. ⚔️ WARRIORS: Vikram & Betal Thrilling Tales (Hindi / Studio Drama)
  // ==========================================================================
  {
    id: "story:vikram-betal-hi",
    title: "विक्रम और बेताल - शौर्य एवं नीति गाथा",
    narrator: "Shemaroo Audio Drama",
    language: "Hindi",
    category: "warriors",
    coverUrl: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80",
    description:
      "उज्जैन के चक्रवर्ती राजा विक्रमादित्य के अदम्य साहस, न्यायप्रियता और प्रेत बेताल की बुद्धिमान पहेलियों का रोमांचक नाट्य रूपांतरण।",
    rating: 4.93,
    totalChapters: 5,
    tags: ["Vikram Betal", "Warriors", "Shemaroo", "Mystery", "Strategy"],
    chapters: [
      {
        id: "story:ch:vb-1",
        seriesId: "story:vikram-betal-hi",
        chapterNumber: 1,
        title: "कहानी 1: राजा विक्रम और बेताल की रहस्यमयी चुनौती",
        duration: "05:01",
        durationSeconds: 301,
        streamUrl: "https://traffic.megaphone.fm/ISP5132487186.mp3?updated=1719816152",
        synopsis: "शमशान के बरगद से लटकते बेताल को लाने का तांत्रिक का वचन और विक्रम का अडिग संकल्प।",
      },
      {
        id: "story:ch:vb-2",
        seriesId: "story:vikram-betal-hi",
        chapterNumber: 2,
        title: "कहानी 2: सत्यनिष्ठ न्याय और तलवार की धार",
        duration: "06:23",
        durationSeconds: 383,
        streamUrl: "https://traffic.megaphone.fm/ISP1224696139.mp3?updated=1719816152",
        synopsis: "बेताल द्वारा सुनाई गई पेचीदा समस्या और राजा विक्रम का विवेकपूर्ण सटीक न्याय।",
      },
      {
        id: "story:ch:vb-3",
        seriesId: "story:vikram-betal-hi",
        chapterNumber: 3,
        title: "कहानी 3: राजकुमारी, तीन प्रेमी और महान बलिदान",
        duration: "07:04",
        durationSeconds: 424,
        streamUrl: "https://traffic.megaphone.fm/ISP3592097047.mp3?updated=1719816151",
        synopsis: "किसका त्याग सबसे बड़ा था? विक्रम के मौन तोड़ते ही बेताल का फिर उड़ जाना।",
      },
      {
        id: "story:ch:vb-4",
        seriesId: "story:vikram-betal-hi",
        chapterNumber: 4,
        title: "कहानी 4: मित्रता, कर्तव्य और राजधर्म की परीक्षा",
        duration: "05:21",
        durationSeconds: 321,
        streamUrl: "https://traffic.megaphone.fm/ISP2950698402.mp3?updated=1719816151",
        synopsis: "राजधर्म और व्यक्तिगत मित्रता के बीच संतुलन बनाने की अद्भुत ऐतिहासिक दास्तान।",
      },
      {
        id: "story:ch:vb-5",
        seriesId: "story:vikram-betal-hi",
        chapterNumber: 5,
        title: "कहानी 5: अंतिम कूट प्रश्न और तांत्रिक का अंत",
        duration: "06:24",
        durationSeconds: 384,
        streamUrl: "https://traffic.megaphone.fm/ISP6381670543.mp3?updated=1719816150",
        synopsis: "दुष्ट तांत्रिक के षड्यंत्र को विफल कर विक्रम द्वारा बेताल को वरदान प्राप्त करने का रोमांचक अंत।",
      },
    ],
  },

  // ==========================================================================
  // 10. 🧸 KIDS: Chandamama Kathalu (Telugu)
  // ==========================================================================
  {
    id: "story:chandamama-te",
    title: "చందమామ కథలు (Chandamama Kathalu)",
    narrator: "చందమామ కథా బృందం (Chandamama Audio)",
    language: "Telugu",
    category: "kids",
    coverUrl: "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600&auto=format&fit=crop&q=80",
    description:
      "తరతరాలుగా తెలుగు పిల్లలను అలరిస్తున్న అమరమైన చందమామ కథలు. నీతి, హాస్యం, ధైర్యం మరియు మానవతా విలువలను నేర్పించే కథామాలిక.",
    rating: 4.97,
    totalChapters: 5,
    featured: true,
    tags: ["చందమామ", "పిల్లల కథలు", "నీతి కథలు", "Chandamama"],
    chapters: [
      {
        id: "story:ch:cm-1",
        seriesId: "story:chandamama-te",
        chapterNumber: 1,
        title: "కథ 1: బంగారు మామిడిపండు",
        duration: "09:37",
        durationSeconds: 577,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2020-10-22/73dab6e488567196bb4da15649c6ddbb.m4a",
        synopsis: "దురాశ దుఃఖానికి చేటు అని తెలియజేస్తూ ఒక పేద రైతుకు లభించిన బంగారు ఫలం కథ.",
      },
      {
        id: "story:ch:cm-2",
        seriesId: "story:chandamama-te",
        chapterNumber: 2,
        title: "కథ 2: పారిన ఎత్తు - ఉపాయం",
        duration: "04:56",
        durationSeconds: 296,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2020-10-20/0f19e2a6136cd6a64e67d4eccb81e0a2.m4a",
        synopsis: "శత్రువు ఎంత బలవంతుడైనా సమయస్ఫూర్తితో విజయం సాధించవచ్చని చూపే చక్కని కథ.",
      },
      {
        id: "story:ch:cm-3",
        seriesId: "story:chandamama-te",
        chapterNumber: 3,
        title: "కథ 3: ఇష్టం ఉంటే కష్టం ఉండదు",
        duration: "05:20",
        durationSeconds: 320,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2020-10-14/f8992bf815ac87e3e9e06adb8b249328.m4a",
        synopsis: "మంచి లక్ష్యాన్ని ప్రేమించి పని చేస్తే ఎలాంటి కష్టమైనా సులభమవుతుందని బోధించే కథ.",
      },
      {
        id: "story:ch:cm-4",
        seriesId: "story:chandamama-te",
        chapterNumber: 4,
        title: "కథ 4: అన్నం చారు - తెలివైన బాలుడు",
        duration: "06:16",
        durationSeconds: 376,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2020-10-10/ae7c9d16d4d20fff80c8e990c1ed892f.m4a",
        synopsis: "ఆకలితో ఉన్న బాటసారికి అన్నదానం చేసి తన బుద్ధికుశలతను నిరూపించుకున్న కుర్రాడి కథ.",
      },
      {
        id: "story:ch:cm-5",
        seriesId: "story:chandamama-te",
        chapterNumber: 5,
        title: "కథ 5: సార్థకత - మంచి మనసు",
        duration: "05:00",
        durationSeconds: 300,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2020-10-08/fc9dde5854bbf7886a356414eb29e142.m4a",
        synopsis: "తోటివారికి సహాయం చేయడంలోనే మానవ జీవితానికి నిజమైన సార్థకత ఉంటుందని తెలిపే కథ.",
      },
    ],
  },

  // ==========================================================================
  // 11. 🧸 KIDS: Panchatantra Stories (Telugu / Baalgatha)
  // ==========================================================================
  {
    id: "story:panchatantra-te",
    title: "పంచతంత్ర నీతి కథలు (Baalgatha Telugu)",
    narrator: "లలితా ద్విభాషి (Baalgatha Telugu)",
    language: "Telugu",
    category: "kids",
    coverUrl: "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=600&auto=format&fit=crop&q=80",
    description:
      "పిల్లలకు చక్కటి నీతి సూత్రాలను నేర్పే పంచతంత్ర & జాతక కథలు. లలితా ద్విభాషి గారి స్పష్టమైన తేటతెలుగు కథనం.",
    rating: 4.95,
    totalChapters: 5,
    tags: ["పంచతంత్రం", "పిల్లల కథలు", "Baalgatha", "నీతి"],
    chapters: [
      {
        id: "story:ch:pt-1",
        seriesId: "story:panchatantra-te",
        chapterNumber: 1,
        title: "కథ 1: ప్రసవక్తారమైన పోటీ",
        duration: "14:02",
        durationSeconds: 842,
        streamUrl: "https://play.hubhopper.com/d90658b9ab15da3b437d7b56e5c025f2.mp3?s=rss-feed",
        synopsis: "అందరిలోనూ ఏదో ఒక ప్రత్యేక ప్రతిభ దాగి ఉంటుందని చాటిచెప్పే అడవి జంతువుల పోటీ కథ.",
      },
      {
        id: "story:ch:pt-2",
        seriesId: "story:panchatantra-te",
        chapterNumber: 2,
        title: "కథ 2: పాఠశాలకు వేళయింది",
        duration: "05:43",
        durationSeconds: 343,
        streamUrl: "https://play.hubhopper.com/88dc110b73657be8d903fe8ccf33ac2c.mp3?s=rss-feed",
        synopsis: "పిల్లలు బడికి వెళ్లడంలో ఉండే ఆనందం మరియు నేర్చుకోవాలనే తపనను తెలిపే కథ.",
      },
      {
        id: "story:ch:pt-3",
        seriesId: "story:panchatantra-te",
        chapterNumber: 3,
        title: "కథ 3: తాతయ్య చేప & రేడియో",
        duration: "08:36",
        durationSeconds: 516,
        streamUrl: "https://play.hubhopper.com/def63490549c370b3a2850694aaf3a40.mp3?s=rss-feed",
        synopsis: "నది ఒడ్డున విచిత్రమైన రేడియో శబ్దాలు విన్న చేప పిల్లల సరదా సాహస కథ.",
      },
      {
        id: "story:ch:pt-4",
        seriesId: "story:panchatantra-te",
        chapterNumber: 4,
        title: "కథ 4: కళ్ళు & వివేకం",
        duration: "20:47",
        durationSeconds: 1247,
        streamUrl: "https://play.hubhopper.com/000dffff212aa8223a9aa6fb30034fc2.mp3?s=rss-feed",
        synopsis: "బాహ్య సౌందర్యం కంటే అంతర్గత వివేకమే మిన్న అని వివరించే పంచతంత్ర కథ.",
      },
      {
        id: "story:ch:pt-5",
        seriesId: "story:panchatantra-te",
        chapterNumber: 5,
        title: "కథ 5: ఠక్ ఠక్ - తెలివైన ఉపాయం",
        duration: "13:41",
        durationSeconds: 821,
        streamUrl: "https://play.hubhopper.com/5326cd3d231cbd3433d2c38271696d85.mp3?s=rss-feed",
        synopsis: "ఆపద ఎదురైనప్పుడు అధైర్యపడకుండా చిరు ఉపాయంతో బయటపడిన కథ.",
      },
    ],
  },

  // ==========================================================================
  // 12. 🧸 KIDS: Akbar Birbal & Gonu Jha Folktales (Hindi)
  // ==========================================================================
  {
    id: "story:akbar-birbal-hi",
    title: "अकबर बीरबल और गोनू झा के किस्से (Akbar Birbal Folktales)",
    narrator: "कुलबेली (Kulbeli Folk Troupe)",
    language: "Hindi",
    category: "kids",
    coverUrl: "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=600&auto=format&fit=crop&q=80",
    description:
      "बीरबल और गोनू झा की हाजिरजवाबी, तीक्ष्ण बुद्धि और रोचक लोककथाएं। बच्चों और बड़ों को समान रूप से गुदगुदाने वाली मजेदार कहानियां।",
    rating: 4.92,
    totalChapters: 5,
    tags: ["Akbar Birbal", "बीरबल", "गोनू झा", "Kids", "Moral Stories", "Hindi Stories"],
    chapters: [
      {
        id: "story:ch:ab-1",
        seriesId: "story:akbar-birbal-hi",
        chapterNumber: 1,
        title: "किस्सा 1: गोनू झा के मनोरंजक किस्से - चतुराई का मुकाबला",
        duration: "07:32",
        durationSeconds: 452,
        streamUrl: "https://play.hubhopper.com/1738f3919731144d8af67eb2730e3301.mp3?s=rss-feed&v=02f33d9e0aac",
        synopsis: "पंडितों की बड़ी सभा में गोनू झा ने अपनी अद्वितीय बुद्धि से सबको निरुत्तर किया।",
      },
      {
        id: "story:ch:ab-2",
        seriesId: "story:akbar-birbal-hi",
        chapterNumber: 2,
        title: "किस्सा 2: दूध से भागने वाली बिल्ली - अनोखी युक्ति",
        duration: "10:17",
        durationSeconds: 617,
        streamUrl: "https://play.hubhopper.com/d7ba7aa1032cd1cc9b2bd2af41a889c0.mp3?s=rss-feed&v=6b49396862bd",
        synopsis: "दूध पीने से डरने वाली बिल्ली की मजेदार कहानी जिसने दरबारियों को लोटपोट कर दिया।",
      },
      {
        id: "story:ch:ab-3",
        seriesId: "story:akbar-birbal-hi",
        chapterNumber: 3,
        title: "किस्सा 3: गोनू झा का बैल - बुद्धि का चमत्कार",
        duration: "08:54",
        durationSeconds: 534,
        streamUrl: "https://play.hubhopper.com/ae5fe156e32ce485b6bf402b6bbbe718.mp3?s=rss-feed&v=b3d39c773a42",
        synopsis: "असंभव को संभव बना दिखाने वाली हास्यप्रद लोककथा।",
      },
      {
        id: "story:ch:ab-4",
        seriesId: "story:akbar-birbal-hi",
        chapterNumber: 4,
        title: "किस्सा 4: बीरबल की परीक्षा - समझदार कौन?",
        duration: "09:57",
        durationSeconds: 597,
        streamUrl: "https://play.hubhopper.com/678112229fbbf80c85cf4285559fc42b.mp3?s=rss-feed&v=3215bddd0fc8",
        synopsis: "बादशाह अकबर द्वारा ली गई कठिन परीक्षा और बीरबल का लाजवाब उत्तर।",
      },
      {
        id: "story:ch:ab-5",
        seriesId: "story:akbar-birbal-hi",
        chapterNumber: 5,
        title: "किस्सा 5: गोनू झा की चतुराई - लालची का अंत",
        duration: "03:43",
        durationSeconds: 223,
        streamUrl: "https://play.hubhopper.com/b09a134030062306764cb988c6db0150.mp3?s=rss-feed&v=1fa3718d44c2",
        synopsis: "धोखेबाज व्यापारी को सबक सिखाने की अत्यंत रोचक और बुद्धिमत्तापूर्ण कथा।",
      },
    ],
  },

  // ==========================================================================
  // 13. 👑 BIOGRAPHY: Dr. APJ Abdul Kalam - Wings of Fire (Hindi / Universal)
  // ==========================================================================
  {
    id: "story:kalam-wings-fire",
    title: "Dr. APJ Abdul Kalam: Wings of Fire (अग्नि की उड़ान)",
    narrator: "प्रेरणा वाणी (Wings of Fire Audio)",
    language: "Hindi",
    category: "biographies",
    coverUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=80",
    description:
      "रामेश्वरम के एक निर्धन बालक से भारत के मिसाइल मैन और जन-जन के राष्ट्रपति बनने तक का अविस्मरणीय और प्रेरणादायी जीवन सफर।",
    rating: 4.97,
    totalChapters: 4,
    featured: true,
    tags: ["APJ Abdul Kalam", "Kalam", "Wings of Fire", "Biography", "Inspiration"],
    chapters: [
      {
        id: "story:ch:kl-1",
        seriesId: "story:kalam-wings-fire",
        chapterNumber: 1,
        title: "अध्याय 1: Part 1 - रामेश्वरम की गलियां और सादा बचपन",
        duration: "07:35",
        durationSeconds: 455,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2021-5-8/194828159-44100-2-043346c5ae52f.m4a",
        synopsis: "रामेश्वरम की संकरी गलियों में अख़बार बांटना, पिता के संस्कार और आसमान में उड़ते पंछियों से मिली प्रेरणा।",
      },
      {
        id: "story:ch:kl-2",
        seriesId: "story:kalam-wings-fire",
        chapterNumber: 2,
        title: "अध्याय 2: Part 2 - अंतरिक्ष अनुसंधान और SLV-3 की सफलता",
        duration: "06:57",
        durationSeconds: 417,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/production/2021-5-9/195197038-44100-2-9c32742429b81.mp3",
        synopsis: "इसरो की स्थापना, प्रोफ़ेसर सतीश धवन का नेतृत्व और भारत के पहले उपग्रह प्रक्षेपण यान का निर्माण।",
      },
      {
        id: "story:ch:kl-3",
        seriesId: "story:kalam-wings-fire",
        chapterNumber: 3,
        title: "अध्याय 3: Part 3 - अग्नि और पृथ्वी - भारत के सुरक्षा कवच",
        duration: "07:30",
        durationSeconds: 450,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/production/2021-6-17/206053070-44100-2-29578da4d86dd.mp3",
        synopsis: "डीआरडीओ में मिसाइल मैन का दायित्व, अग्नि प्रक्षेपास्त्र की गर्जना और पोखरण परमाणु परीक्षण का गौरव।",
      },
      {
        id: "story:ch:kl-4",
        seriesId: "story:kalam-wings-fire",
        chapterNumber: 4,
        title: "अध्याय 4: Part 4 - राष्ट्रपति भवन से देश के युवाओं तक",
        duration: "04:11",
        durationSeconds: 251,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2021-6-17/206102105-44100-2-daa99382caaa9.m4a",
        synopsis: "जन-जन के राष्ट्रपति का सादगीपूर्ण जीवन और 2020 विकसित भारत के सपने को साकार करने का आह्वान।",
      },
    ],
  },

  // ==========================================================================
  // 14. 👑 BIOGRAPHY: Swami Vivekananda - The Lion of Vedanta (English)
  // ==========================================================================
  {
    id: "story:vivekananda-en",
    title: "Swami Vivekananda: The Lion of Vedanta",
    narrator: "Awakening Wisdom Foundation",
    language: "English",
    category: "biographies",
    coverUrl: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&auto=format&fit=crop&q=80",
    description:
      "The stirring life of Narendranath Datta. From a skeptical college youth to meeting Sri Ramakrishna Paramahamsa and conquering the world with Vedanta in Chicago.",
    rating: 4.95,
    totalChapters: 4,
    tags: ["Vivekananda", "Vedanta", "Philosophy", "Inspiration", "Chicago"],
    chapters: [
      {
        id: "story:ch:vk-1",
        seriesId: "story:vivekananda-en",
        chapterNumber: 1,
        title: "Chapter 1: Power of Concentration & Mind Control",
        duration: "09:00",
        durationSeconds: 540,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2024-8-17/b2740ee7-2e40-5960-4d31-b6baf0c9eb59.mp3",
        synopsis: "The science of focus, pranayama, and turning mental distractions into absolute inner willpower.",
      },
      {
        id: "story:ch:vk-2",
        seriesId: "story:vivekananda-en",
        chapterNumber: 2,
        title: "Chapter 2: Secrets of Karma Yoga & Selfless Action",
        duration: "24:36",
        durationSeconds: 1476,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2024-8-17/70af13bb-682c-e49a-f594-1a89be64125f.mp3",
        synopsis: "How work done without ego becomes the highest form of worship and spiritual liberation.",
      },
      {
        id: "story:ch:vk-3",
        seriesId: "story:vivekananda-en",
        chapterNumber: 3,
        title: "Chapter 3: Awakening Wisdom: Faith & Strength",
        duration: "11:46",
        durationSeconds: 706,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2023-10-29/087d2193-5430-408b-9d94-3ad62826ea5a.mp3",
        synopsis: "'You have to grow from the inside out.' Cultivating unshakeable self-belief and spiritual courage.",
      },
      {
        id: "story:ch:vk-4",
        seriesId: "story:vivekananda-en",
        chapterNumber: 4,
        title: "Chapter 4: Knowledge & Fearlessness in Action",
        duration: "15:39",
        durationSeconds: 939,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2023-9-27/7fa6b6cc-7a37-e30e-1871-8cf70762942e.mp3",
        synopsis: "The roaring message of Vedanta: fear is death, strength is life. Standing firm in the face of all trials.",
      },
    ],
  },
];

/**
 * Returns all series matching category and language filters.
 */
export function getStoriesCatalog(options?: {
  category?: StoryCategory | "all" | undefined;
  language?: StoryLanguage | undefined;
  query?: string | undefined;
}): StorySeries[] {
  let list = MASTER_STORIES_CATALOG;

  if (options?.category && options.category !== "all") {
    list = list.filter((s) => s.category === options.category);
  }

  if (options?.language && options.language !== "All") {
    list = list.filter((s) => s.language.toLowerCase() === options.language?.toLowerCase());
  }

  if (options?.query) {
    const q = options.query.toLowerCase().trim();
    list = list.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.narrator.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        (s.tags && s.tags.some((t) => t.toLowerCase().includes(q))),
    );
  }

  return list;
}

/**
 * Finds a single story series by ID.
 */
export function getStorySeriesById(id: string): StorySeries | undefined {
  return MASTER_STORIES_CATALOG.find((s) => s.id === id);
}

/**
 * Returns catalog counts grouped by language.
 */
export function getStoryLanguageCounts(): Record<StoryLanguage, number> {
  const counts: Record<StoryLanguage, number> = {
    All: MASTER_STORIES_CATALOG.length,
    Telugu: 0,
    Hindi: 0,
    English: 0,
  };

  for (const s of MASTER_STORIES_CATALOG) {
    if (s.language === "Telugu") counts.Telugu += 1;
    else if (s.language === "Hindi") counts.Hindi += 1;
    else if (s.language === "English") counts.English += 1;
  }

  return counts;
}
