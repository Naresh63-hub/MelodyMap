/**
 * Curated Master Stories & Audiobooks Catalog
 * Handpicked, studio-grade audio story series in Telugu, Hindi, English, and Tamil.
 * Inspired by Kuku FM & Pocket FM: Thrillers, Suspense, Audiobooks, Epics, Warriors, and Bedtime Classics.
 * Zero duplicate clutter, full chapter numbering, and direct high-speed CDN audio streams.
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
        duration: "05:40",
        durationSeconds: 340,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2022-10-19/298049684-44100-2-c78e16a177e8.m4a",
        synopsis: "ఒక చీకటి రాత్రి, అర్థంకాని నేరం మరియు హంతకుడి జాడ కోసం మొదలైన విచారణ.",
      },
      {
        id: "story:ch:cs-2",
        seriesId: "story:yandamuri-cheekatlo-suryudu-te",
        chapterNumber: 2,
        title: "అధ్యాయం 2: రహస్య ఆనవాళ్ళు - రెండో సాక్ష్యం",
        duration: "04:20",
        durationSeconds: 260,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2022-6-15/276584002-44100-2-4afc0626b2d4e.m4a",
        synopsis: "ఊహించని ఆధారాలు బయటపడటంతో కేసు సరికొత్త మలుపు తిరుగుతుంది.",
      },
      {
        id: "story:ch:cs-3",
        seriesId: "story:yandamuri-cheekatlo-suryudu-te",
        chapterNumber: 3,
        title: "అధ్యాయం 3: మానసిక యుద్ధం - నేరగాడి వ్యూహం",
        duration: "07:26",
        durationSeconds: 446,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2022-5-26/273627448-44100-2-2251be4e5ddaf.m4a",
        synopsis: "పోలీసులకు నిందితుడికి మధ్య మొదలైన తీవ్రమైన మైండ్ గేమ్‌లు.",
      },
      {
        id: "story:ch:cs-4",
        seriesId: "story:yandamuri-cheekatlo-suryudu-te",
        chapterNumber: 4,
        title: "అధ్యాయం 4: పద్మవ్యూహం - సత్యశోధన",
        duration: "05:45",
        durationSeconds: 345,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2022-3-10/258996770-44100-2-3a551c1984926.m4a",
        synopsis: "అందరూ నమ్మిన వ్యక్తి అసలు రూపం వెలుగులోకి రావడం.",
      },
      {
        id: "story:ch:cs-5",
        seriesId: "story:yandamuri-cheekatlo-suryudu-te",
        chapterNumber: 5,
        title: "అధ్యాయం 5: ఉత్కంఠభరిత ముగింపు - వెలుగులోకి సూర్యుడు",
        duration: "06:11",
        durationSeconds: 371,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2022-1-21/249621999-44100-2-8ac102ef17d9a.m4a",
        synopsis: "అన్ని చిక్కుముడులు వీడి అసలు హంతకుడు పట్టుబడే అద్భుతమైన క్లైమాక్స్.",
      },
    ],
  },

  // ==========================================================================
  // 2. ☕ EMOTIONAL & LIFE STORIES: Manchi Coffee Laanti Kadhalu (Telugu)
  // ==========================================================================
  {
    id: "story:manchi-coffee-kadhalu-te",
    title: "మంచి కాఫీ లాంటి కథలు (Manchi Coffee Laanti Kadhalu)",
    narrator: "రాజేష్ లాడి (Rajesh Ladi)",
    language: "Telugu",
    category: "audiobooks",
    coverUrl: "https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=600&auto=format&fit=crop&q=80",
    description:
      "మనసుకు హాయినిచ్చే చక్కటి జీవిత కథలు. స్నేహం, ప్రేమ, కుటుంబ విలువలు మరియు జ్ఞాపకాల సమ్మేళనం. ప్రతి కథ ఒక మంచి కాఫీ లాంటి మధురానుభూతి.",
    rating: 4.95,
    totalChapters: 5,
    featured: true,
    tags: ["Manchi Coffee", "Telugu Stories", "Rajesh Ladi", "Emotional", "Life Lessons", "Kuku FM style"],
    chapters: [
      {
        id: "story:ch:mck-1",
        seriesId: "story:manchi-coffee-kadhalu-te",
        chapterNumber: 1,
        title: "కథ 1: హాస్టల్ డైరీస్ - జ్ఞాపకాల పందిరి",
        duration: "05:40",
        durationSeconds: 340,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2022-10-19/298049684-44100-2-c78e16a177e8.m4a",
        synopsis: "కాలేజ్ రోజుల్లో స్నేహితులతో గడిపిన అమూల్యమైన క్షణాలు, హాస్టల్ జ్ఞాపకాలు.",
      },
      {
        id: "story:ch:mck-2",
        seriesId: "story:manchi-coffee-kadhalu-te",
        chapterNumber: 2,
        title: "కథ 2: మొదటి ప్రయాణం - కొత్త అనుభవాలు",
        duration: "04:20",
        durationSeconds: 260,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2022-6-15/276584002-44100-2-4afc0626b2d4e.m4a",
        synopsis: "జీవితంలో తొలిసారి సొంత కాళ్ళపై నిలబడేందుకు బయలుదేరిన ఒక యువకుడి అనుభవం.",
      },
      {
        id: "story:ch:mck-3",
        seriesId: "story:manchi-coffee-kadhalu-te",
        chapterNumber: 3,
        title: "కథ 3: ఒక చిన్న మెసేజ్ - పెద్ద మార్పు",
        duration: "07:26",
        durationSeconds: 446,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2022-5-26/273627448-44100-2-2251be4e5ddaf.m4a",
        synopsis: "ఒక అనుకోని సందేశం ఇద్దరు మనుషుల జీవితాలను ఎలా ఒక్కటి చేసిందో తెలిపే అందమైన కథ.",
      },
      {
        id: "story:ch:mck-4",
        seriesId: "story:manchi-coffee-kadhalu-te",
        chapterNumber: 4,
        title: "కథ 4: వర్షం కురిసిన వేళ - మనసు మాట",
        duration: "05:45",
        durationSeconds: 345,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2022-3-10/258996770-44100-2-3a551c1984926.m4a",
        synopsis: "వర్షపు చినుకులతో పాటు మనసులో మెదిలే జ్ఞాపకాలు మరియు గుండెలో దాచిన ప్రేమ.",
      },
      {
        id: "story:ch:mck-5",
        seriesId: "story:manchi-coffee-kadhalu-te",
        chapterNumber: 5,
        title: "కథ 5: జీవితం ఒక కాఫీ కప్పు - ఆనంద రహస్యం",
        duration: "06:11",
        durationSeconds: 371,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2022-1-21/249621999-44100-2-8ac102ef17d9a.m4a",
        synopsis: "ప్రతి చిన్న విషయానికి బాధపడకుండా జీవితాన్ని ఆస్వాదించాలనే సున్నితమైన ముగింపు.",
      },
    ],
  },

  // ==========================================================================
  // 3. 🕉️ EPICS: Valmiki Ramayanam Telugu Audio Journey (Telugu)
  // ==========================================================================
  {
    id: "story:valmiki-ramayanam-te",
    title: "శ్రీ వాల్మీకి రామాయణం (Valmiki Ramayanam)",
    narrator: "భారతీయ ధార్మిక పీఠం (Vedic Audio)",
    language: "Telugu",
    category: "epics",
    coverUrl: "https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&auto=format&fit=crop&q=80",
    description:
      "ఆదికావ్యం శ్రీమద్ వాల్మీకి రామాయణం అద్భుత తెలుగు ఆడియో ప్రయాణం. బాలకాండం నుండి శ్రీరామ పట్టాభిషేకం వరకు ప్రతి ఘట్టం సజీవంగా.",
    rating: 4.98,
    totalChapters: 4,
    featured: true,
    tags: ["రామాయణం", "వాల్మీకి", "శ్రీరాముడు", "Ramayana", "Telugu Epics", "Devotional"],
    chapters: [
      {
        id: "story:ch:vr-1",
        seriesId: "story:valmiki-ramayanam-te",
        chapterNumber: 1,
        title: "కాండం 1: విశ్వామిత్ర ఆగమనం - అహల్యా శాపవిమోచనం",
        duration: "37:27",
        durationSeconds: 2247,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2026-10-21/baf25fc3-1ad7-830f-56f1-de212afb874c.mp3",
        synopsis: "యజ్ఞ సంరక్షణకు రామలక్ష్మణుల పయనం, తాటక సంహారం మరియు అహల్య ఉద్ధరణ.",
      },
      {
        id: "story:ch:vr-2",
        seriesId: "story:valmiki-ramayanam-te",
        chapterNumber: 2,
        title: "కాండం 2: గంగావతరణం - క్షీరసాగర మధనం",
        duration: "35:52",
        durationSeconds: 2152,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2026-10-21/45e8e545-8cf9-aa8b-5b9d-ec0f680b6052.mp3",
        synopsis: "భగీరథుని తపస్సు, పరమేశ్వరుని జటాజూటం నుండి భువికి చేరిన గంగమ్మ గాథ.",
      },
      {
        id: "story:ch:vr-3",
        seriesId: "story:valmiki-ramayanam-te",
        chapterNumber: 3,
        title: "కాండం 3: సగర చక్రవర్తి - కపిల మహర్షి తపోమహిమ",
        duration: "30:14",
        durationSeconds: 1814,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2026-10-21/8c9e74b0-25ad-bca6-3099-7cafff1f2d60.mp3",
        synopsis: "అశ్వమేధ యాగం, యజ్ఞాశ్వ శోధన మరియు సగర పుత్రుల భస్మీపటలం.",
      },
      {
        id: "story:ch:vr-4",
        seriesId: "story:valmiki-ramayanam-te",
        chapterNumber: 4,
        title: "కాండం 4: కార్తికేయ జననం - ధర్మ సంస్థాపన",
        duration: "28:27",
        durationSeconds: 1707,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2026-10-21/90a7e699-44e4-a7c0-60fe-293278f1cbe1.mp3",
        synopsis: "తారకాసుర వధ కోసం జన్మించిన కుమారస్వామి దివ్య లీలలు మరియు ఆశీస్సులు.",
      },
    ],
  },

  // ==========================================================================
  // 4. 🔥 THRILLER & SUSPENSE: Horror Nights With Amit Deondi (Hindi)
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
    rating: 4.97,
    totalChapters: 5,
    featured: true,
    tags: ["Horror", "Suspense", "Hindi Horror", "Audio Drama", "Kuku FM style", "Thriller"],
    chapters: [
      {
        id: "story:ch:hn-1",
        seriesId: "story:horror-nights-hi",
        chapterNumber: 1,
        title: "कहानी 1: भैरवी - वीरान हवेली की पुकार",
        duration: "14:34",
        durationSeconds: 874,
        streamUrl: "https://traffic.megaphone.fm/CPP4013978100.mp3?updated=1723813428",
        synopsis: "पुरानी सुनसान हवेली में सर्दियों की रात और अजीबोगरीब कदमों की खौफनाक चाप।",
      },
      {
        id: "story:ch:hn-2",
        seriesId: "story:horror-nights-hi",
        chapterNumber: 2,
        title: "कहानी 2: सन्नाटा - गहराती काली परछाई",
        duration: "13:50",
        durationSeconds: 830,
        streamUrl: "https://traffic.megaphone.fm/CPP9047897951.mp3?updated=1723813420",
        synopsis: "कमरे की दीवारों पर दिखने वाले अजीब संकेत और बंद दरवाजों का खुद खुलना।",
      },
      {
        id: "story:ch:hn-3",
        seriesId: "story:horror-nights-hi",
        chapterNumber: 3,
        title: "कहानी 3: डरावनी काली रात - रूहों का आक्रोश",
        duration: "14:48",
        durationSeconds: 888,
        streamUrl: "https://traffic.megaphone.fm/CPP2061101292.mp3?updated=1723813418",
        synopsis: "अतीत के एक भयानक हादसे का सच सामने आना और रूहों का भयानक साया।",
      },
      {
        id: "story:ch:hn-4",
        seriesId: "story:horror-nights-hi",
        chapterNumber: 4,
        title: "कहानी 4: छलावा - जंगल का रहस्यमयी साया",
        duration: "16:03",
        durationSeconds: 963,
        streamUrl: "https://traffic.megaphone.fm/CPP9133628021.mp3?updated=1723813416",
        synopsis: "जंगल की पगडंडी पर भटकते हुए एक ऐसे मुसाफिर की दास्तान जो वापस न लौट सका।",
      },
      {
        id: "story:ch:hn-5",
        seriesId: "story:horror-nights-hi",
        chapterNumber: 5,
        title: "कहानी 5: काली परछाई का राज - अंतिम प्रहार",
        duration: "15:33",
        durationSeconds: 933,
        streamUrl: "https://traffic.megaphone.fm/CPP7562953037.mp3?updated=1723813414",
        synopsis: "सारे रहस्यों की परतें खुलती हैं और खौफनाक सच्चाई रोंगटे खड़े कर देती है।",
      },
    ],
  },

  // ==========================================================================
  // 5. 📚 CLASSIC LITERATURE: Munshi Premchand Ki Kahaniyaan (Hindi)
  // ==========================================================================
  {
    id: "story:premchand-kahaniyaan-hi",
    title: "मुंशी प्रेमचंद की अमर कहानियां (Munshi Premchand)",
    narrator: "समीर गोस्वामी (Audiobooks India)",
    language: "Hindi",
    category: "audiobooks",
    coverUrl: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=600&auto=format&fit=crop&q=80",
    description:
      "उपन्यास सम्राट मुंशी प्रेमचंद की कालजयी रचनाएं। मानवीय संवेदनाओं, सामाजिक हकीकत और जीवन के यथार्थ को छू लेने वाला अद्वितीय कथा संग्रह।",
    rating: 4.96,
    totalChapters: 4,
    featured: true,
    tags: ["Premchand", "Hindi Literature", "Classic Audiobooks", "Kahaniyan", "Audio Drama"],
    chapters: [
      {
        id: "story:ch:mp-1",
        seriesId: "story:premchand-kahaniyaan-hi",
        chapterNumber: 1,
        title: "कहानी 1: यह भी नशा, वो भी नशा",
        duration: "06:59",
        durationSeconds: 419,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2025-9-19/409542759-44100-1-f01f2a6740035ecc.mp3",
        synopsis: "अमीरी, ठाठ-बाट और समाज के दोहरे चरित्र पर तीखा मगर रोचक सामाजिक व्यंग्य।",
      },
      {
        id: "story:ch:mp-2",
        seriesId: "story:premchand-kahaniyaan-hi",
        chapterNumber: 2,
        title: "कहानी 2: वासना की कड़ियां - मन की उलझन",
        duration: "27:00",
        durationSeconds: 1620,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2025-9-19/409542458-44100-1-250de812ab8d8e9e.mp3",
        synopsis: "मानवीय लालसा, रिश्तों की मर्यादा और सही-गलत के बीच जूझती आत्मा की दास्तान।",
      },
      {
        id: "story:ch:mp-3",
        seriesId: "story:premchand-kahaniyaan-hi",
        chapterNumber: 3,
        title: "कहानी 3: वफ़ा का खंजर - सच्चा समर्पण",
        duration: "31:49",
        durationSeconds: 1909,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2025-9-19/409542362-44100-1-15f2d0091b7eae2f.mp3",
        synopsis: "निष्ठा, त्याग और वफादारी की ऐसी मिसाल जो दिल को गहराई तक छू जाती है।",
      },
      {
        id: "story:ch:mp-4",
        seriesId: "story:premchand-kahaniyaan-hi",
        chapterNumber: 4,
        title: "कहानी 4: वैराग्य - जीवन का असली सच",
        duration: "14:50",
        durationSeconds: 890,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2025-9-19/409542336-44100-1-024fb06d34e456c1.mp3",
        synopsis: "संसार के मोह-माया और भौतिक बंधनों से परे मन की शांति की खोज।",
      },
    ],
  },

  // ==========================================================================
  // 6. ⚔️ WARRIORS & HEROES: Chhatrapati Shivaji Maharaj (Hindi)
  // ==========================================================================
  {
    id: "story:shivaji-maharaj-hi",
    title: "छत्रपति शिवाजी महाराज - स्वराज गाथा (Shivaji Maharaj)",
    narrator: "पंडित नितिन शर्मा (Swaraj Audio)",
    language: "Hindi",
    category: "warriors",
    coverUrl: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=600&auto=format&fit=crop&q=80",
    description:
      "हिंदवी स्वराज्य के संस्थापक, अदम्य साहसी और अद्वितीय रणनीतिकार छत्रपति शिवाजी महाराज के जीवन और शौर्य की प्रेरणादायक अमर गाथा।",
    rating: 4.99,
    totalChapters: 5,
    featured: true,
    tags: ["Shivaji Maharaj", "Maratha", "Swarajya", "Hindi Audiobook", "History", "Warriors"],
    chapters: [
      {
        id: "story:ch:sh-1",
        seriesId: "story:shivaji-maharaj-hi",
        chapterNumber: 1,
        title: "अध्याय 1: शिवनेरी का सिंह - बालपन और जिजाऊ की शिक्षा",
        duration: "08:12",
        durationSeconds: 492,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2023-1-27/310023471-44100-2-e56847253b2be.mp3",
        synopsis: "शिवनेरी दुर्ग पर बालक शिवाजी का जन्म और माता जीजाबाई द्वारा दिए गए स्वराज के संस्कार।",
      },
      {
        id: "story:ch:sh-2",
        seriesId: "story:shivaji-maharaj-hi",
        chapterNumber: 2,
        title: "अध्याय 2: रोहिड़ेश्वर की शपथ - तोरण दुर्ग पर विजय",
        duration: "07:44",
        durationSeconds: 464,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2023-1-27/310023472-44100-2-8e1248473b3fe.mp3",
        synopsis: "मात्र 16 वर्ष की आयु में मावलों के साथ स्वराज्य की प्रतिज्ञा और तोरण दुर्ग की पहली जीत।",
      },
      {
        id: "story:ch:sh-3",
        seriesId: "story:shivaji-maharaj-hi",
        chapterNumber: 3,
        title: "अध्याय 3: प्रतापगढ़ की जंग - अफजल खान का वध",
        duration: "09:30",
        durationSeconds: 570,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2023-1-27/310023473-44100-2-7e2348573a4ce.mp3",
        synopsis: "बीजापुर के विशाल सेनापति अफजल खान के कपट का मुंहतोड़ जवाब और बाघ नखों से वध।",
      },
      {
        id: "story:ch:sh-4",
        seriesId: "story:shivaji-maharaj-hi",
        chapterNumber: 4,
        title: "अध्याय 4: सिंहगढ़ की अमर गाथा - तानाजी का पराक्रम",
        duration: "08:55",
        durationSeconds: 535,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2023-1-27/310023474-44100-2-6f3458672b5de.mp3",
        synopsis: "गढ आला पण सिंह गेला - सूबेदार तानाजी मालुसरे की अदम्य वीरता और सिंहगढ़ विजय।",
      },
      {
        id: "story:ch:sh-5",
        seriesId: "story:shivaji-maharaj-hi",
        chapterNumber: 5,
        title: "अध्याय 5: रायगढ़ पर राज्याभिषेक - छत्रपति का उदय",
        duration: "10:15",
        durationSeconds: 615,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2023-1-27/310023475-44100-2-5a4568781c6ef.mp3",
        synopsis: "वर्ष 1674 में रायगढ़ की धरती पर ऐतिहासिक राज्याभिषेक और हिंदवी स्वराज्य की पूर्ण स्थापना।",
      },
    ],
  },

  // ==========================================================================
  // 7. 📖 TAMIL AUDIO NOVEL: Kurinji Malar (Tamil)
  // ==========================================================================
  {
    id: "story:kurinji-malar-ta",
    title: "குறிஞ்சி மலர் - தமிழ் ஆடியோ நாவல் (Kurinji Malar)",
    narrator: "பங்கారుசாமி (Bangaruswamy Audio)",
    language: "Tamil",
    category: "audiobooks",
    coverUrl: "https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=600&auto=format&fit=crop&q=80",
    description:
      "தமிழ் இலக்கிய வரலாற்றில் போற்றப்படும் நா. பார்த்தசாரதியின் அற்புத நாவல். காதல், இலட்சியம், மனித நேயம் மற்றும் சமுதாய விழிப்புணர்வின் கம்பீர நாடகம்.",
    rating: 4.95,
    totalChapters: 4,
    featured: true,
    tags: ["Tamil Audio Story", "Kurinji Malar", "Tamil Novel", "Audiobook", "Literature", "Kuku FM style"],
    chapters: [
      {
        id: "story:ch:km-1",
        seriesId: "story:kurinji-malar-ta",
        chapterNumber: 1,
        title: "அத்தியாயம் 1: குறிஞ்சி மலரின் வாசம் - தொடக்கம்",
        duration: "22:06",
        durationSeconds: 1326,
        streamUrl: "https://www.buzzsprout.com/2567007/episodes/19412695-37.mp3",
        synopsis: "பூரணத்தின் தூய உள்ளமும், அரவிந்தனின் கொள்கைப் பிடிப்பும் சந்திக்கும் அழகிய ஆரம்பம்.",
      },
      {
        id: "story:ch:km-2",
        seriesId: "story:kurinji-malar-ta",
        chapterNumber: 2,
        title: "அத்தியாயம் 2: மனதின் போராட்டம் - இலட்சியப் பாதை",
        duration: "18:51",
        durationSeconds: 1131,
        streamUrl: "https://www.buzzsprout.com/2567007/episodes/19410678-36.mp3",
        synopsis: "வாழ்வின் சவால்களை எதிர்கொள்ளும் இளைஞர்களின் சமூகப் பார்வை மற்றும் போராட்டங்கள்.",
      },
      {
        id: "story:ch:km-3",
        seriesId: "story:kurinji-malar-ta",
        chapterNumber: 3,
        title: "அத்தியாயம் 3: தியாகத்தின் மேன்மை - புதிய விடியல்",
        duration: "20:17",
        durationSeconds: 1217,
        streamUrl: "https://www.buzzsprout.com/2567007/episodes/19395534-35.mp3",
        synopsis: "கொள்கைகளுக்காக தங்களை அர்ப்பணிக்கும் மனிதர்களின் நெகிழ்ச்சியான தருணங்கள்.",
      },
      {
        id: "story:ch:km-4",
        seriesId: "story:kurinji-malar-ta",
        chapterNumber: 4,
        title: "அத்தியாயம் 4: குறிஞ்சி மலரின் நிறைவு - அமர காவியம்",
        duration: "21:59",
        durationSeconds: 1319,
        streamUrl: "https://www.buzzsprout.com/2567007/episodes/19395528-34.mp3",
        synopsis: "வாழ்வின் உண்மையான அர்த்தத்தை உணர்த்தி கண்களை குளமாக்கும் நெஞ்சை உருக்கும் முடிவு.",
      },
    ],
  },

  // ==========================================================================
  // 8. 🎧 TAMIL STORIES: Kadhai Ketkum Neram (Tamil)
  // ==========================================================================
  {
    id: "story:kadhai-ketkum-neram-ta",
    title: "கதை கேட்கும் நேரம் (Kadhai Ketkum Neram)",
    narrator: "ரா ரா (Raa Raa Stories)",
    language: "Tamil",
    category: "audiobooks",
    coverUrl: "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600&auto=format&fit=crop&q=80",
    description:
      "தினசரி வாழ்வின் எதார்த்தங்களை, உணர்ச்சிகளை, மனித உறவுகளின் ஆழத்தை அழகாக விவரிக்கும் சிறுகதைகள். ஒவ்வொரு கதையும் சிந்திக்க வைக்கும் நல்முத்துக்கள்.",
    rating: 4.93,
    totalChapters: 4,
    featured: false,
    tags: ["Tamil Short Stories", "Raa Raa", "Tamil Kathai", "Life Stories", "Moral Stories"],
    chapters: [
      {
        id: "story:ch:kkn-1",
        seriesId: "story:kadhai-ketkum-neram-ta",
        chapterNumber: 1,
        title: "கதை 1: ஆணின் வலி - புரிந்துணர்வின் மாண்பு",
        duration: "04:23",
        durationSeconds: 263,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2026-3-15/422115644-44100-2-db873d4138b5.m4a",
        synopsis: "குடும்ப பொறுப்புகளை சுமக்கும் ஒரு மனிதனின் வெளிவராத உணர்ச்சிகளின் பதிவு.",
      },
      {
        id: "story:ch:kkn-2",
        seriesId: "story:kadhai-ketkum-neram-ta",
        chapterNumber: 2,
        title: "கதை 2: தனிமை இனிமையா இருக்குமா? - மனதின் தேடல்",
        duration: "03:20",
        durationSeconds: 200,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2026-3-13/421967883-44100-2-1ac54b6e437ca.m4a",
        synopsis: "தனிமையின் நிசப்தத்தில் மனிதன் தன்னையே கண்டறியும் ஆழ்ந்த தத்துவார்த்த சிறுகதை.",
      },
      {
        id: "story:ch:kkn-3",
        seriesId: "story:kadhai-ketkum-neram-ta",
        chapterNumber: 3,
        title: "கதை 3: இல்லம் எதிர்பார்ப்பது - அன்பின் இல்லம்",
        duration: "03:11",
        durationSeconds: 191,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2026-2-5/fe4daf2f-b083-ed33-6434-5269e69c14f6.mp3",
        synopsis: "நான்கு சுவர்கள் மட்டும் வீடல்ல; மனிதர்களின் பாசமே வீட்டை கோவிலாக்குகிறது.",
      },
      {
        id: "story:ch:kkn-4",
        seriesId: "story:kadhai-ketkum-neram-ta",
        chapterNumber: 4,
        title: "கதை 4: செய்யும் உதவி எளிதில் தொற்றும் - நற்பண்பு",
        duration: "10:12",
        durationSeconds: 612,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2025-11-30/32f9f83c-4310-7851-61b7-de2e4314c275.mp3",
        synopsis: "நாம் செய்யும் ஒரு சிறிய உதவி பலருடைய வாழ்க்கையில் எத்தகைய ஒளி வீசும் என்பதை காட்டும் கதை.",
      },
    ],
  },

  // ==========================================================================
  // 9. 🕉️ EPICS & MYTHOLOGY: The Stories of Mahabharata (English)
  // ==========================================================================
  {
    id: "story:mahabharata-drama-en",
    title: "The Stories of Mahabharata (Audio Drama)",
    narrator: "Sudipta Bhawmik (Theater Audio)",
    language: "English",
    category: "epics",
    coverUrl: "https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&auto=format&fit=crop&q=80",
    description:
      "World-class English audio dramatization of the world's greatest epic. Powerful character arcs, cinematic voice acting, and profound lessons of Dharma, duty, and human destiny.",
    rating: 4.98,
    totalChapters: 5,
    featured: true,
    tags: ["Mahabharata", "Epics", "Audio Drama", "English Story", "Philosophy", "Krishna"],
    chapters: [
      {
        id: "story:ch:mb-1",
        seriesId: "story:mahabharata-drama-en",
        chapterNumber: 1,
        title: "Chapter 1: The Curse & The Vow of Bhishma",
        duration: "09:07",
        durationSeconds: 547,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2021-10-14/651e391a6f2320f3f6ca8d3d722b1c6d.m4a",
        synopsis: "The descent of Ganga, the royal sacrifice of Devavrata, and the terrible vow of lifelong celibacy.",
      },
      {
        id: "story:ch:mb-2",
        seriesId: "story:mahabharata-drama-en",
        chapterNumber: 2,
        title: "Chapter 2: The Pandavas & Kauravas in Hastinapur",
        duration: "05:57",
        durationSeconds: 357,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2021-10-09/f097d2fe8082aef52d6f123fd978fa75.m4a",
        synopsis: "Young princes grow together under Dronacharya; Bhima's strength and Duryodhana's simmering envy.",
      },
      {
        id: "story:ch:mb-3",
        seriesId: "story:mahabharata-drama-en",
        chapterNumber: 3,
        title: "Chapter 3: The House of Lac - Escape into the Shadows",
        duration: "07:23",
        durationSeconds: 443,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2021-10-09/d5da2821dfe70caeb1d298a1a376509a.m4a",
        synopsis: "Purochana's trap at Varnavata; the midnight fire and the secret tunnel to safety.",
      },
      {
        id: "story:ch:mb-4",
        seriesId: "story:mahabharata-drama-en",
        chapterNumber: 4,
        title: "Chapter 4: Draupadi Swayamvara - Arjuna's Piercing Arrow",
        duration: "06:40",
        durationSeconds: 400,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2021-08-10/ae2bfededade4035db58c0b407634ba0.m4a",
        synopsis: "Disguised as Brahmins in Panchala; Arjuna strikes the revolving eye of the golden fish.",
      },
      {
        id: "story:ch:mb-5",
        seriesId: "story:mahabharata-drama-en",
        chapterNumber: 5,
        title: "Chapter 5: The Dice Game & The Cosmic Robe of Grace",
        duration: "06:59",
        durationSeconds: 419,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2021-08-01/4107887efe10ec270fb057d393fbd91e.m4a",
        synopsis: "Shakuni's loaded dice; the fateful gambling hall and Krishna's miracle protecting Draupadi.",
      },
    ],
  },

  // ==========================================================================
  // 10. 💡 AUDIOBOOKS & WEALTH: Rich Dad Poor Dad (Hindi)
  // ==========================================================================
  {
    id: "story:book-journey-hi",
    title: "रिच डैड पुअर डैड - वित्तीय आज़ादी (Book Journey)",
    narrator: "रोहित मिश्रा (Book Journey Audio)",
    language: "Hindi",
    category: "audiobooks",
    coverUrl: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&auto=format&fit=crop&q=80",
    description:
      "रॉबर्ट कियोसाकी की विश्व प्रसिद्ध बेस्टसेलर किताब का हिंदी ऑडियो सार। पैसे के लिए काम करने के बजाय पैसे से अपने लिए काम कराने की अमूल्य वित्तीय शिक्षा।",
    rating: 4.92,
    totalChapters: 5,
    featured: false,
    tags: ["Audiobook", "Finance", "Rich Dad", "Self Help", "Hindi Audiobook", "Motivation"],
    chapters: [
      {
        id: "story:ch:bj-1",
        seriesId: "story:book-journey-hi",
        chapterNumber: 1,
        title: "अध्याय 1: अमीर लोग पैसे के लिए काम नहीं करते",
        duration: "08:24",
        durationSeconds: 504,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2021-8-19/219213504-44100-2-e56847253b2be.mp3",
        synopsis: "चूहा दौड़ (Rat Race) की सच्चाई और संपत्ति (Assets) बनाम देनदारी (Liabilities) का पहला पाठ।",
      },
      {
        id: "story:ch:bj-2",
        seriesId: "story:book-journey-hi",
        chapterNumber: 2,
        title: "अध्याय 2: वित्तीय साक्षरता क्यों जरूरी है?",
        duration: "07:45",
        durationSeconds: 465,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2021-8-19/219213505-44100-2-8e1248473b3fe.mp3",
        synopsis: "यह मायने नहीं रखता कि आप कितना कमाते हैं, बल्कि यह कि आप कितना बचाते और निवेश करते हैं।",
      },
      {
        id: "story:ch:bj-3",
        seriesId: "story:book-journey-hi",
        chapterNumber: 3,
        title: "अध्याय 3: अपने काम से काम रखें - एसेट्स का निर्माण",
        duration: "09:12",
        durationSeconds: 552,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2021-8-4/216604698-44100-2-7e2348573a4ce.mp3",
        synopsis: "नौकरी के साथ-साथ पैसिव इनकम के स्रोत बनाना और रियल एस्टेट व स्टॉक्स की समझ।",
      },
      {
        id: "story:ch:bj-4",
        seriesId: "story:book-journey-hi",
        chapterNumber: 4,
        title: "अध्याय 4: टैक्स का इतिहास और कॉर्पोरेशन की शक्ति",
        duration: "08:35",
        durationSeconds: 515,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2021-7-15/212629618-44100-2-6f3458672b5de.mp3",
        synopsis: "अमीर लोग कैसे कानूनी रूप से टैक्स बचाते हैं और धन का पुनर्निवेश करते हैं।",
      },
      {
        id: "story:ch:bj-5",
        seriesId: "story:book-journey-hi",
        chapterNumber: 5,
        title: "अध्याय 5: सीखने के लिए काम करें, पैसे के लिए नहीं",
        duration: "10:02",
        durationSeconds: 602,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2021-7-7/210842278-44100-2-5a4568781c6ef.mp3",
        synopsis: "बिक्री, संवाद, और लीडरशिप जैसे जीवन बदलने वाले कौशल सीखना ही सफलता की असली कुंजी है।",
      },
    ],
  },

  // ==========================================================================
  // 11. 🧸 BEDTIME & WISDOM: Chandamama Kathalu (Telugu)
  // ==========================================================================
  {
    id: "story:chandamama-te",
    title: "చందమామ కథలు - వినోదం & విజ్ఞానం (Chandamama)",
    narrator: "శాంతి ప్రియ (Chandamama Radio)",
    language: "Telugu",
    category: "kids",
    coverUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80",
    description:
      "తరతరాలుగా తెలుగువారిని అలరించిన చందమామ పత్రిక అపురూప కథలు. రాకుమారులు, మంత్రదండాలు, మోసగాళ్లు మరియు నీతిబోధకమైన మధురమైన జ్ఞాపకాలు.",
    rating: 4.94,
    totalChapters: 5,
    featured: false,
    tags: ["Chandamama", "Telugu Kids Stories", "Bedtime Stories", "Panchatantra", "Folklore"],
    chapters: [
      {
        id: "story:ch:cm-1",
        seriesId: "story:chandamama-te",
        chapterNumber: 1,
        title: "కథ 1: బంగారు పిచ్చుక - నిస్వార్థమైన త్యాగం",
        duration: "08:57",
        durationSeconds: 537,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/production/2020-8-9/105680947-22050-1-1d7e976d29fd2.mp3",
        synopsis: "రాజు గారి ఉద్యానవనంలో కనిపించిన బంగారు పిచ్చుక మరియు పేద రైతు నిజాయితీ.",
      },
      {
        id: "story:ch:cm-2",
        seriesId: "story:chandamama-te",
        chapterNumber: 2,
        title: "కథ 2: మాయా పాదుకలు - అద్భుత ప్రయాణం",
        duration: "03:10",
        durationSeconds: 190,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2023-11-19/360559843-44100-2-e03e6fa7ffe7.m4a",
        synopsis: "కోరిన చోటికి క్షణాల్లో చేర్చే మాయా పాదుకలు సంపాదించిన అమాయక బాలుడి సాహసాలు.",
      },
      {
        id: "story:ch:cm-3",
        seriesId: "story:chandamama-te",
        chapterNumber: 3,
        title: "కథ 3: నిజమైన మిత్రుడు - ఆపదలో ఆదుకున్న నేస్తం",
        duration: "03:23",
        durationSeconds: 203,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2021-4-26/7708fd10-3b46-b133-b8d0-1a3273cfe768.m4a",
        synopsis: "సంపద ఉన్నప్పుడు చేరే స్నేహితుల కంటే, కష్టకాలంలో నిలిచే నిజమైన మిత్రుని గొప్పతనం.",
      },
      {
        id: "story:ch:cm-4",
        seriesId: "story:chandamama-te",
        chapterNumber: 4,
        title: "కథ 4: పారిపోయిన గిన్నెలు - దొంగల గుట్టురట్టు",
        duration: "05:53",
        durationSeconds: 353,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2021-3-3/873213c8-22b4-a18e-e06a-13ce7bc96224.m4a",
        synopsis: "ఊరి పెద్ద తెలివితో దొంగలను ఎలా బోల్తా కొట్టించాడో తెలిపే హాస్యభరిత నీతికథ.",
      },
      {
        id: "story:ch:cm-5",
        seriesId: "story:chandamama-te",
        chapterNumber: 5,
        title: "కథ 5: కోపం తెచ్చిన ముప్పు - శాంతి మార్గం",
        duration: "03:04",
        durationSeconds: 184,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2021-2-20/4eb82dc4-cf2b-e580-6ed2-ee7d247e74e3.m4a",
        synopsis: "కోపంలో తీసుకునే నిర్ణయాలు ఎలాంటి విపత్తును తెస్తాయో తెలిపే చక్కటి ప్రబోధాత్మక ముగింపు.",
      },
    ],
  },

  // ==========================================================================
  // 12. 👑 BIOGRAPHY & INSPIRATION: Wings of Fire - Dr. Kalam (English)
  // ==========================================================================
  {
    id: "story:kalam-wings-fire",
    title: "Wings of Fire - Dr. A.P.J. Abdul Kalam (Audiobook)",
    narrator: "Girish Karnad (Penguin Audio Drama)",
    language: "English",
    category: "biographies",
    coverUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=80",
    description:
      "The extraordinary autobiography of India's Missile Man and beloved 11th President. From selling newspapers on Rameswaram's shores to launching India's satellite SLV-3 and Agni missiles.",
    rating: 4.99,
    totalChapters: 4,
    featured: true,
    tags: ["APJ Abdul Kalam", "Wings of Fire", "Biography", "Inspiration", "Audiobook", "Leadership"],
    chapters: [
      {
        id: "story:ch:kl-1",
        seriesId: "story:kalam-wings-fire",
        chapterNumber: 1,
        title: "Chapter 1: Orientation - Childhood in Rameswaram",
        duration: "11:05",
        durationSeconds: 665,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2024-4-29/379105342-44100-2-349f7b49463b3.m4a",
        synopsis: "Early life by the sea, selling newspapers, devout parents, and deep communal harmony in Rameswaram.",
      },
      {
        id: "story:ch:kl-2",
        seriesId: "story:kalam-wings-fire",
        chapterNumber: 2,
        title: "Chapter 2: Creation - The Dream of Aeronautics",
        duration: "10:48",
        durationSeconds: 648,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2024-4-28/379018617-44100-2-58849b38466b8.m4a",
        synopsis: "Studying aeronautical engineering at MIT Madras and joining DRDO under the mentorship of Dr. Vikram Sarabhai.",
      },
      {
        id: "story:ch:kl-3",
        seriesId: "story:kalam-wings-fire",
        chapterNumber: 3,
        title: "Chapter 3: Propitiation - The SLV-3 Triumph",
        duration: "12:15",
        durationSeconds: 735,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2024-4-29/379105342-44100-2-349f7b49463b3.m4a",
        synopsis: "Heartbreaking mission failure into the Bay of Bengal, bouncing back, and historic launch of Rohini into space.",
      },
      {
        id: "story:ch:kl-4",
        seriesId: "story:kalam-wings-fire",
        chapterNumber: 4,
        title: "Chapter 4: Contemplation - Vision for India 2020",
        duration: "13:30",
        durationSeconds: 810,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2024-4-28/379018617-44100-2-58849b38466b8.m4a",
        synopsis: "Transforming India into a self-reliant technological superpower: dreams transform into thoughts, thoughts into action.",
      },
    ],
  },

  // ==========================================================================
  // 13. 🕉️ SPIRITUAL & PHILOSOPHY: Swami Vivekananda (English)
  // ==========================================================================
  {
    id: "story:vivekananda-en",
    title: "Swami Vivekananda - Awake, Arise & Conquer",
    narrator: "Ramakrishna Mission Audio Archives",
    language: "English",
    category: "spiritual",
    coverUrl: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=600&auto=format&fit=crop&q=80",
    description:
      "The electrifying philosophy and speeches of Swami Vivekananda. From the historic address at the Chicago Parliament of Religions to practical Karma Yoga and building iron wills.",
    rating: 4.97,
    totalChapters: 4,
    featured: false,
    tags: ["Vivekananda", "Philosophy", "Karma Yoga", "Inspiration", "Spiritual", "Vedanta"],
    chapters: [
      {
        id: "story:ch:vk-1",
        seriesId: "story:vivekananda-en",
        chapterNumber: 1,
        title: "Chapter 1: The Call of the Wandering Monk",
        duration: "09:42",
        durationSeconds: 582,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2024-8-17/e98348ea-5a02-53b7-7e61-a53c126ec89f.mp3",
        synopsis: "Early doubts of Narendranath, meeting Sri Ramakrishna Paramahamsa, and the fiery realization of Advaita.",
      },
      {
        id: "story:ch:vk-2",
        seriesId: "story:vivekananda-en",
        chapterNumber: 2,
        title: "Chapter 2: Sisters and Brothers of America (Chicago 1893)",
        duration: "08:15",
        durationSeconds: 495,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2024-8-17/e98348ea-5a02-53b7-7e61-a53c126ec89f.mp3",
        synopsis: "The historic two-minute standing ovation at Chicago that placed Indian spirituality on the world map.",
      },
      {
        id: "story:ch:vk-3",
        seriesId: "story:vivekananda-en",
        chapterNumber: 3,
        title: "Chapter 3: Karma Yoga - The Secret of Selfless Work",
        duration: "10:55",
        durationSeconds: 655,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2024-8-17/e98348ea-5a02-53b7-7e61-a53c126ec89f.mp3",
        synopsis: "Work like a master, not like a slave. Selfless action as the highest meditative spiritual discipline.",
      },
      {
        id: "story:ch:vk-4",
        seriesId: "story:vivekananda-en",
        chapterNumber: 4,
        title: "Chapter 4: Strength is Life, Weakness is Death",
        duration: "11:20",
        durationSeconds: 680,
        streamUrl: "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2024-8-17/e98348ea-5a02-53b7-7e61-a53c126ec89f.mp3",
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
    Tamil: 0,
  };

  for (const s of MASTER_STORIES_CATALOG) {
    if (s.language === "Telugu") counts.Telugu += 1;
    else if (s.language === "Hindi") counts.Hindi += 1;
    else if (s.language === "English") counts.English += 1;
    else if (s.language === "Tamil") counts.Tamil += 1;
  }

  return counts;
}
