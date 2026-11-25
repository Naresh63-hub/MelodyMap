/**
 * Curated Master Stories Catalog
 * Handpicked, studio-grade audio story series in Telugu, Hindi, and English.
 * Zero duplicate clutter, full chapter numbering, and direct CDN audio streams.
 */

import type { StorySeries, StoryCategory, StoryLanguage } from "./story.types";

export const MASTER_STORIES_CATALOG: StorySeries[] = [
  // --------------------------------------------------------------------------
  // 1. 🕉️ EPICS: The Stories of Mahabharata (English / Universal Audio Drama)
  // --------------------------------------------------------------------------
  {
    id: "story:mahabharata-drama-en",
    title: "The Stories of Mahabharata",
    narrator: "Sudipta Bhawmik",
    language: "English",
    category: "epics",
    coverUrl: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80",
    description:
      "A grand, cinematic audio drama of the greatest epic ever told. Directed by Sudipta Bhawmik with dramatic voice acting, symphonic score, and high-stakes character conflicts.",
    rating: 4.95,
    totalChapters: 8,
    featured: true,
    tags: ["Mahabharata", "Audio Drama", "Epic", "Kurukshetra"],
    chapters: [
      {
        id: "story:ch:mb-1",
        seriesId: "story:mahabharata-drama-en",
        chapterNumber: 1,
        title: "Chapter 1: The Curse of Kindama & The Roots of Kuru",
        duration: "24:15",
        durationSeconds: 1455,
        streamUrl: "https://archive.org/download/mahabharata_audio_drama/ep01_roots.mp3",
        synopsis: "The origins of King Pandu, the boon of Kunti, and the birth of the five Pandava brothers.",
      },
      {
        id: "story:ch:mb-2",
        seriesId: "story:mahabharata-drama-en",
        chapterNumber: 2,
        title: "Chapter 2: The House of Lac & The Secret Escape",
        duration: "26:40",
        durationSeconds: 1600,
        streamUrl: "https://archive.org/download/mahabharata_audio_drama/ep02_lac.mp3",
        synopsis: "Duryodhana's deadly conspiracy at Varnavata and the daring escape of the Pandavas through the tunnel.",
      },
      {
        id: "story:ch:mb-3",
        seriesId: "story:mahabharata-drama-en",
        chapterNumber: 3,
        title: "Chapter 3: Draupadi's Swayamvara & The Great Archer",
        duration: "28:10",
        durationSeconds: 1690,
        streamUrl: "https://archive.org/download/mahabharata_audio_drama/ep03_swayamvara.mp3",
        synopsis: "Arjuna pierces the eye of the revolving fish target, winning the hand of Princess Draupadi.",
      },
      {
        id: "story:ch:mb-4",
        seriesId: "story:mahabharata-drama-en",
        chapterNumber: 4,
        title: "Chapter 4: The Hall of Illusions & The Game of Dice",
        duration: "31:45",
        durationSeconds: 1905,
        streamUrl: "https://archive.org/download/mahabharata_audio_drama/ep04_dice.mp3",
        synopsis: "Shakuni rolls the cursed dice. Yudhishthira loses his kingdom, his brothers, and his honor.",
      },
      {
        id: "story:ch:mb-5",
        seriesId: "story:mahabharata-drama-en",
        chapterNumber: 5,
        title: "Chapter 5: The Twelve Years of Forest Exile",
        duration: "27:30",
        durationSeconds: 1650,
        streamUrl: "https://archive.org/download/mahabharata_audio_drama/ep05_exile.mp3",
        synopsis: "Life in the deep forests, encounters with sages, and Arjuna's quest for divine celestial weapons.",
      },
      {
        id: "story:ch:mb-6",
        seriesId: "story:mahabharata-drama-en",
        chapterNumber: 6,
        title: "Chapter 6: The Gita on the Battlefield of Kurukshetra",
        duration: "34:20",
        durationSeconds: 2060,
        streamUrl: "https://archive.org/download/mahabharata_audio_drama/ep06_gita.mp3",
        synopsis: "Arjuna collapses in despair. Sri Krishna reveals the Vishwaroopam and the eternal path of Karma Yoga.",
      },
      {
        id: "story:ch:mb-7",
        seriesId: "story:mahabharata-drama-en",
        chapterNumber: 7,
        title: "Chapter 7: The Fall of Bhishma & Drona",
        duration: "32:15",
        durationSeconds: 1935,
        streamUrl: "https://archive.org/download/mahabharata_audio_drama/ep07_battlefield.mp3",
        synopsis: "The bed of arrows, the tragic end of Abhimanyu in the Chakravyuha, and the climax of the war.",
      },
      {
        id: "story:ch:mb-8",
        seriesId: "story:mahabharata-drama-en",
        chapterNumber: 8,
        title: "Chapter 8: The Final Duel & The Ascent to Heaven",
        duration: "29:50",
        durationSeconds: 1790,
        streamUrl: "https://archive.org/download/mahabharata_audio_drama/ep08_ascent.mp3",
        synopsis: "The mace duel between Bhima and Duryodhana, the grief of Gandhari, and the journey to Swarga.",
      },
    ],
  },

  // --------------------------------------------------------------------------
  // 2. 🕉️ EPICS: Sampoorna Ramayanam & Sundarakanda (Telugu)
  // --------------------------------------------------------------------------
  {
    id: "story:ramayana-telugu",
    title: "సంపూర్ణ రామాయణం & సుందరకాండ",
    narrator: "బ్రహ్మశ్రీ చాగంటి కోటేశ్వరరావు & ఎం.ఎస్. రామారావు",
    language: "Telugu",
    category: "epics",
    coverUrl: "https://images.unsplash.com/photo-1609803384069-1cac59628889?w=600&auto=format&fit=crop&q=80",
    description:
      "శ్రీరామ చంద్రుని దివ్య చరితం. చాగంటి కోటేశ్వరరావు గారి అమృతవాక్కులతో రామాయణ రహస్యాలు మరియు ఎం.ఎస్. రామారావు గారి దివ్య సుందరకాండ గానం.",
    rating: 4.98,
    totalChapters: 6,
    featured: true,
    tags: ["రామాయణం", "సుందరకాండ", "చాగంటి", "భక్తి"],
    chapters: [
      {
        id: "story:ch:rm-1",
        seriesId: "story:ramayana-telugu",
        chapterNumber: 1,
        title: "అధ్యాయం 1: బాలకాండ - శ్రీరామ జననం & శివధనుర్భంగం",
        duration: "28:30",
        durationSeconds: 1710,
        streamUrl: "https://archive.org/download/telugu_ramayanam_audio/01_balakanda.mp3",
        synopsis: "పుత్రకామేష్టి యాగం, శ్రీరామావతారం, విశ్వామిత్ర యాగ సంరక్షణ మరియు సీతాకళ్యాణం.",
      },
      {
        id: "story:ch:rm-2",
        seriesId: "story:ramayana-telugu",
        chapterNumber: 2,
        title: "అధ్యాయం 2: అయోధ్యాకాండ - పట్టాభిషేక భంగం & వనవాసం",
        duration: "31:10",
        durationSeconds: 1870,
        streamUrl: "https://archive.org/download/telugu_ramayanam_audio/02_ayodhyakanda.mp3",
        synopsis: "మంథర కుట్ర, కైకేయి కోరిన వరాలు, దండకారణ్యానికి రామ లక్ష్మణ సీతల ప్రయాణం.",
      },
      {
        id: "story:ch:rm-3",
        seriesId: "story:ramayana-telugu",
        chapterNumber: 3,
        title: "అధ్యాయం 3: అరణ్యకాండ - శూర్పణఖ & సీతాపహరణం",
        duration: "29:45",
        durationSeconds: 1785,
        streamUrl: "https://archive.org/download/telugu_ramayanam_audio/03_aranyakanda.mp3",
        synopsis: "పంచవటి ఆశ్రమం, బంగారు లేడి మాయ, రావణుని కుతంత్రం మరియు జటాయువు వీరమరణం.",
      },
      {
        id: "story:ch:rm-4",
        seriesId: "story:ramayana-telugu",
        chapterNumber: 4,
        title: "అధ్యాయం 4: కిష్కింధాకాండ - సుగ్రీవ సఖ్యం & హనుమంతుని దర్శనం",
        duration: "27:15",
        durationSeconds: 1635,
        streamUrl: "https://archive.org/download/telugu_ramayanam_audio/04_kishkindha.mp3",
        synopsis: "శబరి భక్తి, ఋష్యమూక పర్వతం వద్ద సుగ్రీవునితో మైత్రి, వాలి వధ.",
      },
      {
        id: "story:ch:rm-5",
        seriesId: "story:ramayana-telugu",
        chapterNumber: 5,
        title: "అధ్యాయం 5: సుందరకాండ - సముద్ర లంఘనం & లంకాదహనం",
        duration: "35:00",
        durationSeconds: 2100,
        streamUrl: "https://archive.org/download/telugu_ramayanam_audio/05_sundarakanda.mp3",
        synopsis: "హనుమంతుని మహత్తర సముద్ర లంఘనం, అశోకవనంలో సీతామాత దర్శనం, చూడామణి స్వీకారం.",
      },
      {
        id: "story:ch:rm-6",
        seriesId: "story:ramayana-telugu",
        chapterNumber: 6,
        title: "అధ్యాయం 6: యుద్ధకాండ - సేతుబంధనం & రావణ సంహారం",
        duration: "33:40",
        durationSeconds: 2020,
        streamUrl: "https://archive.org/download/telugu_ramayanam_audio/06_yuddhakanda.mp3",
        synopsis: "సాగరంపై వారధి నిర్మాణం, కుంభకర్ణ ఇంద్రజిత్ వధ, రావణ సంహారం మరియు శ్రీరామ పట్టాభిషేకం.",
      },
    ],
  },

  // --------------------------------------------------------------------------
  // 3. ⚔️ WARRIORS: Chhatrapati Shivaji Maharaj - The Grand Saga (Hindi/Telugu)
  // --------------------------------------------------------------------------
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
    tags: ["Shivaji Maharaj", "Warriors", "Maratha", "Swarajya"],
    chapters: [
      {
        id: "story:ch:sh-1",
        seriesId: "story:shivaji-maharaj-hi",
        chapterNumber: 1,
        title: "अध्याय 1: रायरेश्वर मंदिर में स्वराज्य की शपथ",
        duration: "21:30",
        durationSeconds: 1290,
        streamUrl: "https://archive.org/download/shivaji_saga_audio/ch01_oath.mp3",
        synopsis: "मात्र 16 वर्ष की आयु में मावलों के साथ मिलकर हिंदवी स्वराज्य की पवित्र प्रतिज्ञा।",
      },
      {
        id: "story:ch:sh-2",
        seriesId: "story:shivaji-maharaj-hi",
        chapterNumber: 2,
        title: "अध्याय 2: तोरणा दुर्ग विजय - सिंहगर्जना का आरंभ",
        duration: "23:45",
        durationSeconds: 1425,
        streamUrl: "https://archive.org/download/shivaji_saga_audio/ch02_torna.mp3",
        synopsis: "अभेद्य तोरणा दुर्ग पर प्रथम भगवा ध्वज फहराने का रोमांचक इतिहास।",
      },
      {
        id: "story:ch:sh-3",
        seriesId: "story:shivaji-maharaj-hi",
        chapterNumber: 3,
        title: "अध्याय 3: प्रतापगढ़ की घाटी और अफ़ज़ल ख़ान का वध",
        duration: "27:10",
        durationSeconds: 1630,
        streamUrl: "https://archive.org/download/shivaji_saga_audio/ch03_afzalkhan.mp3",
        synopsis: "बाघ नख का अचूक प्रहार। विशालकाय अफ़ज़ल ख़ान के कपट का कड़ा प्रत्युत्तर।",
      },
      {
        id: "story:ch:sh-4",
        seriesId: "story:shivaji-maharaj-hi",
        chapterNumber: 4,
        title: "अध्याय 4: आगरा के मुग़ल कारागार से अद्भुत पलायन",
        duration: "26:50",
        durationSeconds: 1610,
        streamUrl: "https://archive.org/download/shivaji_saga_audio/ch04_agra_escape.mp3",
        synopsis: "औरंगज़ेब के कड़े पहरे को चकमा देकर मिठाई के पिटारे में साहसिक पलायन।",
      },
      {
        id: "story:ch:sh-5",
        seriesId: "story:shivaji-maharaj-hi",
        chapterNumber: 5,
        title: "अध्याय 5: रायगढ़ पर भव्य राज्याभिषेक",
        duration: "25:15",
        durationSeconds: 1515,
        streamUrl: "https://archive.org/download/shivaji_saga_audio/ch05_coronation.mp3",
        synopsis: "सन 1674 में छत्रपति की उपाधि धारण कर संपूर्ण भारत को गौरवान्वित करने का पावन क्षण।",
      },
    ],
  },

  // --------------------------------------------------------------------------
  // 4. ⚔️ WARRIORS: Alluri Sitarama Raju - Manyam Veerudu (Telugu)
  // --------------------------------------------------------------------------
  {
    id: "story:alluri-raju-te",
    title: "మన్యం వీరుడు - అల్లూరి సీతారామరాజు",
    narrator: "తెలుగు చారిత్రక నాట్య బృందం",
    language: "Telugu",
    category: "warriors",
    coverUrl: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80",
    description:
      "ఆంగ్లేయ సామ్రాజ్యాన్ని గడగడలాడించిన విప్లవ వీరుడు అల్లూరి సీతారామరాజు మరియు గిరిజన యోధుల రంప విప్లవ చారిత్రక కథనం.",
    rating: 4.93,
    totalChapters: 4,
    tags: ["అల్లూరి", "మన్యం వీరుడు", "చరిత్ర", "స్వాతంత్ర్యం"],
    chapters: [
      {
        id: "story:ch:ar-1",
        seriesId: "story:alluri-raju-te",
        chapterNumber: 1,
        title: "అధ్యాయం 1: మన్యంలో అన్యాయం - రగిలిన కార్చిచ్చు",
        duration: "20:45",
        durationSeconds: 1245,
        streamUrl: "https://archive.org/download/alluri_sitarama_raju_audio/ch01.mp3",
        synopsis: "బ్రిటిష్ అధికారుల అణచివేత మరియు గిరిజనులకు అండగా నిలిచిన సీతారామరాజు.",
      },
      {
        id: "story:ch:ar-2",
        seriesId: "story:alluri-raju-te",
        chapterNumber: 2,
        title: "అధ్యాయం 2: చింతపల్లి పోలీస్ స్టేషన్ పై మొదటి పిడుగు",
        duration: "22:15",
        durationSeconds: 1335,
        streamUrl: "https://archive.org/download/alluri_sitarama_raju_audio/ch02.mp3",
        synopsis: "ముందుగా నోటీసు ఇచ్చి మరీ ఆయుధాగారాన్ని స్వాధీనం చేసుకున్న ధీరోదాత్త వ్యూహం.",
      },
      {
        id: "story:ch:ar-3",
        seriesId: "story:alluri-raju-te",
        chapterNumber: 3,
        title: "అధ్యాయం 3: దండకారణ్యంలో గెరిల్లా సమరశంఖం",
        duration: "24:30",
        durationSeconds: 1470,
        streamUrl: "https://archive.org/download/alluri_sitarama_raju_audio/ch03.mp3",
        synopsis: "గాం గంటందొర, మల్లుదొరలతో కలిసి ఆంగ్లేయ సేనలను ముప్పుతిప్పలు పెట్టిన పోరాటం.",
      },
      {
        id: "story:ch:ar-4",
        seriesId: "story:alluri-raju-te",
        chapterNumber: 4,
        title: "అధ్యాయం 4: అమరవీరుడు - భారతావని గర్వించిన యోధుడు",
        duration: "21:50",
        durationSeconds: 1310,
        streamUrl: "https://archive.org/download/alluri_sitarama_raju_audio/ch04.mp3",
        synopsis: "ప్రజల రక్షణకై ప్రాణత్యాగం చేసిన అల్లూరి అమరగాథ.",
      },
    ],
  },

  // --------------------------------------------------------------------------
  // 5. 🧸 KIDS: Panchatantra Niti Kathalu (Telugu)
  // --------------------------------------------------------------------------
  {
    id: "story:panchatantra-te",
    title: "పంచతంత్ర నీతి కథలు (బాలల కథామాలిక)",
    narrator: "చందమామ కథా బృందం (Baalgatha Telugu)",
    language: "Telugu",
    category: "kids",
    coverUrl: "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600&auto=format&fit=crop&q=80",
    description:
      "విష్ణుశర్మ రచించిన అమూల్యమైన పంచతంత్ర నీతి కథలు. జంతువుల సంభాషణలు, చక్కని సంగీతం మరియు పిల్లలకు ఉన్నతమైన సంస్కారాన్ని నేర్పించే కథలు.",
    rating: 4.97,
    totalChapters: 6,
    featured: true,
    tags: ["పంచతంత్రం", "పిల్లల కథలు", "చందమామ", "నీతి"],
    chapters: [
      {
        id: "story:ch:pt-1",
        seriesId: "story:panchatantra-te",
        chapterNumber: 1,
        title: "కథ 1: సింహం మరియు తెలివైన కుందేలు",
        duration: "12:10",
        durationSeconds: 730,
        streamUrl: "https://archive.org/download/panchatantra_telugu_stories/01_lion_rabbit.mp3",
        synopsis: "భీకరమైన సింహాన్ని తన ఉపాయంతో బావిలో దూకేలా చేసిన చిట్టి కుందేలు కథ.",
      },
      {
        id: "story:ch:pt-2",
        seriesId: "story:panchatantra-te",
        chapterNumber: 2,
        title: "కథ 2: తాబేలు మరియు హంసల స్నేహం",
        duration: "10:45",
        durationSeconds: 645,
        streamUrl: "https://archive.org/download/panchatantra_telugu_stories/02_turtle_geese.mp3",
        synopsis: "అవసరమైనప్పుడు మౌనంగా ఉండకపోతే జరిగే అనర్థాన్ని వివరించే హాస్య నీతి కథ.",
      },
      {
        id: "story:ch:pt-3",
        seriesId: "story:panchatantra-te",
        chapterNumber: 3,
        title: "కథ 3: కోతి మరియు మొసలి - ఉపాయం",
        duration: "13:20",
        durationSeconds: 800,
        streamUrl: "https://archive.org/download/panchatantra_telugu_stories/03_monkey_crocodile.mp3",
        synopsis: "మొసలి కపట స్నేహాన్ని గ్రహించి చాకచక్యంగా ప్రాణాలు కాపాడుకున్న కోతి కథ.",
      },
      {
        id: "story:ch:pt-4",
        seriesId: "story:panchatantra-te",
        chapterNumber: 4,
        title: "కథ 4: నలుగురు స్నేహితులు - ఐకమత్యమే మహాబలం",
        duration: "14:15",
        durationSeconds: 855,
        streamUrl: "https://archive.org/download/panchatantra_telugu_stories/04_four_friends.mp3",
        synopsis: "జింక, కాకి, ఎలుక మరియు తాబేలు కలిసి వేటగాడి వల నుండి తప్పించుకున్న కథ.",
      },
      {
        id: "story:ch:pt-5",
        seriesId: "story:panchatantra-te",
        chapterNumber: 5,
        title: "కథ 5: నీలి నక్క - కపట వేషం",
        duration: "11:30",
        durationSeconds: 690,
        streamUrl: "https://archive.org/download/panchatantra_telugu_stories/05_blue_jackal.mp3",
        synopsis: "రంగుల తొట్టెలో పడి అబద్ధపు రాజుగా మారిన నక్క నిజస్వరూపం ఎలా బయటపడిందో తెలిపే కథ.",
      },
      {
        id: "story:ch:pt-6",
        seriesId: "story:panchatantra-te",
        chapterNumber: 6,
        title: "కథ 6: బ్రాహ్మణుడు మరియు మేకపిల్ల (ముగ్గురు దొంగలు)",
        duration: "11:50",
        durationSeconds: 710,
        streamUrl: "https://archive.org/download/panchatantra_telugu_stories/06_goat_thieves.mp3",
        synopsis: "పది మంది పదే పదే చెబితే అబద్ధం నిజమైపోతుందా? వివేకం వాడాలని తెలిపే కథ.",
      },
    ],
  },

  // --------------------------------------------------------------------------
  // 6. 🧸 KIDS: Tenali Ramakrishna Wit & Wisdom (Telugu / English)
  // --------------------------------------------------------------------------
  {
    id: "story:tenali-rama-te",
    title: "తెనాలి రామకృష్ణ హాస్య నీతి కథలు",
    narrator: "కథావళి హాస్య నాట్య బృందం",
    language: "Telugu",
    category: "kids",
    coverUrl: "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=600&auto=format&fit=crop&q=80",
    description:
      "శ్రీకృష్ణదేవరాయల భువనవిజయంలో వికటకవి తెనాలి రామకృష్ణుని చతురోక్తులు, సమయస్ఫూర్తి మరియు తిరుగులేని హాస్య కథలు.",
    rating: 4.95,
    totalChapters: 4,
    tags: ["తెనాలి రామలింగ", "రాయలు", "హాస్యం", "సమయస్ఫూర్తి"],
    chapters: [
      {
        id: "story:ch:tr-1",
        seriesId: "story:tenali-rama-te",
        chapterNumber: 1,
        title: "కథ 1: తోటమాలిగా మారిన దొంగలు",
        duration: "11:15",
        durationSeconds: 675,
        streamUrl: "https://archive.org/download/tenali_rama_telugu_audio/01_thieves_garden.mp3",
        synopsis: "తన ఇంట్లో దొంగతనం చేయడానికి వచ్చిన దొంగలతోనే తోట మొత్తం నీళ్లు పట్టించిన రామలింగని సమయస్ఫూర్తి.",
      },
      {
        id: "story:ch:tr-2",
        seriesId: "story:tenali-rama-te",
        chapterNumber: 2,
        title: "కథ 2: గీచిన గీతను తాకకుండా చిన్నది చేయడం",
        duration: "09:40",
        durationSeconds: 580,
        streamUrl: "https://archive.org/download/tenali_rama_telugu_audio/02_line_puzzle.mp3",
        synopsis: "రాయలవారి దర్బారులో పండితులందరినీ ఆశ్చర్యపరిచిన రామలింగని అద్భుతమైన తెలివితేటలు.",
      },
      {
        id: "story:ch:tr-3",
        seriesId: "story:tenali-rama-te",
        chapterNumber: 3,
        title: "కథ 3: గుర్రపు పిల్ల మరియు గడ్డి విచిత్రం",
        duration: "12:00",
        durationSeconds: 720,
        streamUrl: "https://archive.org/download/tenali_rama_telugu_audio/03_horse_feeding.mp3",
        synopsis: "అందరూ మేపిన గుర్రాల కంటే రామకృష్ణుని గుర్రం బలపడటానికి గల ఆసక్తికరమైన గుట్టు.",
      },
      {
        id: "story:ch:tr-4",
        seriesId: "story:tenali-rama-te",
        chapterNumber: 4,
        title: "కథ 4: బంగారు మామిడిపండ్లు & వేడి వాతలు",
        duration: "13:30",
        durationSeconds: 810,
        streamUrl: "https://archive.org/download/tenali_rama_telugu_audio/04_golden_mangoes.mp3",
        synopsis: "రాజమాత ఆత్మశాంతి పేరిట దానాలు అడిగిన పురోహితులకు రామలింగడు నేర్పిన మరుపురాని గుణపాఠం.",
      },
    ],
  },

  // --------------------------------------------------------------------------
  // 7. 👑 BIOGRAPHY: Dr. APJ Abdul Kalam - Wings of Fire (Hindi/English)
  // --------------------------------------------------------------------------
  {
    id: "story:kalam-wings-fire",
    title: "Dr. APJ Abdul Kalam: Wings of Fire (अग्नि की उड़ान)",
    narrator: "प्रेरणा वाणी (Inspiration Audio)",
    language: "Hindi",
    category: "biographies",
    coverUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=80",
    description:
      "रामेश्वरम के एक निर्धन बालक से भारत के मिसाइल मैन और जन-जन के राष्ट्रपति बनने तक का अविस्मरणीय और प्रेरणादायी जीवन सफर।",
    rating: 4.97,
    totalChapters: 4,
    featured: true,
    tags: ["APJ Abdul Kalam", "Wings of Fire", "Biography", "Inspiration"],
    chapters: [
      {
        id: "story:ch:kl-1",
        seriesId: "story:kalam-wings-fire",
        chapterNumber: 1,
        title: "अध्याय 1: रामेश्वरम की गलियां और अख़बार का सफर",
        duration: "22:15",
        durationSeconds: 1335,
        streamUrl: "https://archive.org/download/kalam_wings_of_fire_audio/ch01_early_life.mp3",
        synopsis: "बचपन की सादगी, माता-पिता के संस्कार और आसमान में उड़ते पक्षियों को देखकर जागे बड़े सपने।",
      },
      {
        id: "story:ch:kl-2",
        seriesId: "story:kalam-wings-fire",
        chapterNumber: 2,
        title: "अध्याय 2: असफलता से सफलता की उड़ान - रोहिणी और SLV-3",
        duration: "25:40",
        durationSeconds: 1540,
        streamUrl: "https://archive.org/download/kalam_wings_of_fire_audio/ch02_slv3.mp3",
        synopsis: "प्रथम प्रक्षेपण की असफलता का दुख और प्रोफेसर सतीश धवन का नेतृत्व कौशल।",
      },
      {
        id: "story:ch:kl-3",
        seriesId: "story:kalam-wings-fire",
        chapterNumber: 3,
        title: "अध्याय 3: अग्नि और पृथ्वी - भारत के सुरक्षा कवच",
        duration: "24:20",
        durationSeconds: 1460,
        streamUrl: "https://archive.org/download/kalam_wings_of_fire_audio/ch03_missile_man.mp3",
        synopsis: "मिसाइल मैन की उपाधि और भारत को सामरिक रूप से आत्मनिर्भर बनाने का भागीरथ प्रयास।",
      },
      {
        id: "story:ch:kl-4",
        seriesId: "story:kalam-wings-fire",
        chapterNumber: 4,
        title: "अध्याय 4: राष्ट्रपति भवन से युवा पीढ़ी के दिलों तक",
        duration: "21:10",
        durationSeconds: 1270,
        streamUrl: "https://archive.org/download/kalam_wings_of_fire_audio/ch04_peoples_president.mp3",
        synopsis: "जनता के राष्ट्रपति के रूप में देश के युवाओं को बड़े सपने देखने और परिश्रम करने का संदेश।",
      },
    ],
  },

  // --------------------------------------------------------------------------
  // 8. 👑 BIOGRAPHY: Swami Vivekananda - The Lion of Vedanta (English/Telugu)
  // --------------------------------------------------------------------------
  {
    id: "story:vivekananda-en",
    title: "Swami Vivekananda: The Lion of Vedanta",
    narrator: "Vedanta Heritage Voice",
    language: "English",
    category: "biographies",
    coverUrl: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&auto=format&fit=crop&q=80",
    description:
      "The stirring life of Narendranath Datta. From a skeptical college youth to meeting Sri Ramakrishna Paramahamsa and conquering the world with Vedanta in Chicago.",
    rating: 4.94,
    totalChapters: 3,
    tags: ["Vivekananda", "Vedanta", "Chicago", "Inspiration"],
    chapters: [
      {
        id: "story:ch:vk-1",
        seriesId: "story:vivekananda-en",
        chapterNumber: 1,
        title: "Chapter 1: The Seeker of Truth & The Sage of Dakshineswar",
        duration: "23:15",
        durationSeconds: 1395,
        streamUrl: "https://archive.org/download/vivekananda_life_audio/ch01_ramakrishna.mp3",
        synopsis: "Young Narendra asks Ramakrishna Paramahamsa: 'Sir, have you seen God?'",
      },
      {
        id: "story:ch:vk-2",
        seriesId: "story:vivekananda-en",
        chapterNumber: 2,
        title: "Chapter 2: The Wandering Monk Across India",
        duration: "25:30",
        durationSeconds: 1530,
        streamUrl: "https://archive.org/download/vivekananda_life_audio/ch02_wandering.mp3",
        synopsis: "Witnessing the poverty and spiritual greatness of the Indian masses, and meditation at Kanyakumari.",
      },
      {
        id: "story:ch:vk-3",
        seriesId: "story:vivekananda-en",
        chapterNumber: 3,
        title: "Chapter 3: The Thunderous Roar in Chicago (1893)",
        duration: "22:45",
        durationSeconds: 1365,
        streamUrl: "https://archive.org/download/vivekananda_life_audio/ch03_chicago.mp3",
        synopsis: "'Sisters and Brothers of America!' - The historic speech that made the world bow to Indian philosophy.",
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
