// Adhkar content. Every item carries its source so users can verify it.
// Wording follows the common Hisn al-Muslim texts. Qur'anic passages are written
// in standard (imla'i) spelling with full tashkeel, not the Uthmani rasm.
// Please open an issue if you find any mistake in text, translation, or reference.

export interface Dhikr {
  id: string;
  ar: string;
  en: string;
  source: string;
  /** Suggested number of repetitions. */
  target: number;
}

export type PackId = "general" | "morning" | "evening" | "afterPrayer" | "friday" | "custom";

/** A dhikr the user added themselves. */
export interface CustomDhikr {
  id: string;
  ar: string;
  meaning: string;
  source: string;
  target: number;
}

export interface Pack {
  id: PackId;
  ar: string;
  en: string;
  items: Dhikr[];
}

export const ISTIGHFAR: Record<"short" | "tawba", Dhikr> = {
  short: {
    id: "istighfar",
    ar: "أَسْتَغْفِرُ اللَّهَ",
    en: "I seek the forgiveness of Allah",
    source: "Muslim 2702",
    target: 100,
  },
  tawba: {
    id: "istighfar-tawba",
    ar: "أَسْتَغْفِرُ اللَّهَ وَأَتُوبُ إِلَيْهِ",
    en: "I seek the forgiveness of Allah and repent to Him",
    source: "al-Bukhari 6307",
    target: 100,
  },
};

const SUBHAN_BIHAMDIHI: Dhikr = {
  id: "subhanallah-wabihamdihi",
  ar: "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ",
  en: "Glory be to Allah and praise be to Him",
  source: "al-Bukhari 6405, Muslim 2691",
  target: 100,
};

const TAHLIL: Dhikr = {
  id: "tahlil",
  ar: "لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ",
  en: "None has the right to be worshipped but Allah alone, without partner. His is the dominion and His is the praise, and He is over all things capable",
  source: "al-Bukhari 6403, Muslim 2691",
  target: 100,
};

const SALAWAT: Dhikr = {
  id: "salawat",
  ar: "اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ",
  en: "O Allah, send prayers and peace upon our Prophet Muhammad ﷺ",
  source: "Virtue: Muslim 408",
  target: 10,
};

export const PACKS: Record<Exclude<PackId, "custom">, Pack> = {
  general: {
    id: "general",
    ar: "أذكار",
    en: "Adhkar",
    items: [
      SUBHAN_BIHAMDIHI,
      {
        id: "two-light-words",
        ar: "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ الْعَظِيمِ",
        en: "Glory be to Allah and praise be to Him; glory be to Allah, the Magnificent",
        source: "al-Bukhari 7563, Muslim 2694",
        target: 33,
      },
      {
        id: "baqiyat",
        ar: "سُبْحَانَ اللَّهِ، وَالْحَمْدُ لِلَّهِ، وَلَا إِلَهَ إِلَّا اللَّهُ، وَاللَّهُ أَكْبَرُ",
        en: "Glory be to Allah, praise be to Allah, none has the right to be worshipped but Allah, and Allah is the Greatest",
        source: "Muslim 2137",
        target: 33,
      },
      {
        id: "hawqala",
        ar: "لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ",
        en: "There is no might nor power except with Allah",
        source: "al-Bukhari 6384, Muslim 2704",
        target: 33,
      },
      TAHLIL,
      SALAWAT,
      {
        id: "dua-yunus",
        ar: "لَا إِلَهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ",
        en: "None has the right to be worshipped but You; glory be to You, I have been among the wrongdoers",
        source: "al-Anbiya 21:87, at-Tirmidhi 3505",
        target: 33,
      },
      {
        id: "hasbunallah",
        ar: "حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ",
        en: "Allah is sufficient for us, and He is the best Disposer of affairs",
        source: "Al 'Imran 3:173, al-Bukhari 4563",
        target: 33,
      },
      {
        id: "rabbana-atina",
        ar: "رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ",
        en: "Our Lord, give us good in this world and good in the Hereafter, and protect us from the punishment of the Fire",
        source: "al-Baqarah 2:201, al-Bukhari 6389",
        target: 10,
      },
    ],
  },

  morning: {
    id: "morning",
    ar: "أذكار الصباح",
    en: "Morning adhkar",
    items: [
      {
        id: "m-asbahna",
        ar: "أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ، رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَذَا الْيَوْمِ وَخَيْرَ مَا بَعْدَهُ، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَذَا الْيَوْمِ وَشَرِّ مَا بَعْدَهُ، رَبِّ أَعُوذُ بِكَ مِنَ الْكَسَلِ وَسُوءِ الْكِبَرِ، رَبِّ أَعُوذُ بِكَ مِنْ عَذَابٍ فِي النَّارِ وَعَذَابٍ فِي الْقَبْرِ",
        en: "We have entered the morning and the dominion belongs to Allah... My Lord, I ask You for the good of this day and what follows it, and seek refuge in You from its evil and the evil of what follows it. My Lord, I seek refuge in You from laziness and the misery of old age, and from punishment in the Fire and in the grave",
        source: "Muslim 2723",
        target: 1,
      },
      {
        id: "m-bika-asbahna",
        ar: "اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ النُّشُورُ",
        en: "O Allah, by You we enter the morning and by You we enter the evening, by You we live and by You we die, and to You is the resurrection",
        source: "at-Tirmidhi 3391",
        target: 1,
      },
      {
        id: "sayyid-al-istighfar",
        ar: "اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ لَكَ بِذَنْبِي فَاغْفِرْ لِي، فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ",
        en: "O Allah, You are my Lord; none has the right to be worshipped but You. You created me and I am Your servant, and I keep Your covenant and promise as best I can. I seek refuge in You from the evil I have done. I acknowledge Your favour upon me and I acknowledge my sin, so forgive me, for none forgives sins but You",
        source: "al-Bukhari 6306",
        target: 1,
      },
      {
        id: "bismillah-alladhi",
        ar: "بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ",
        en: "In the name of Allah, with whose name nothing on earth or in the heavens can cause harm, and He is the All-Hearing, the All-Knowing",
        source: "Abu Dawud 5088, at-Tirmidhi 3388",
        target: 3,
      },
      {
        id: "ikhlas",
        ar: "قُلْ هُوَ اللَّهُ أَحَدٌ ۝ اللَّهُ الصَّمَدُ ۝ لَمْ يَلِدْ وَلَمْ يُولَدْ ۝ وَلَمْ يَكُنْ لَهُ كُفُوًا أَحَدٌ",
        en: "Say: He is Allah, the One. Allah, the Eternal Refuge. He neither begets nor is born, nor is there to Him any equivalent (al-Ikhlas)",
        source: "al-Ikhlas 112, Abu Dawud 5082",
        target: 3,
      },
      {
        id: "falaq",
        ar: "قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ ۝ مِنْ شَرِّ مَا خَلَقَ ۝ وَمِنْ شَرِّ غَاسِقٍ إِذَا وَقَبَ ۝ وَمِنْ شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ ۝ وَمِنْ شَرِّ حَاسِدٍ إِذَا حَسَدَ",
        en: "Say: I seek refuge in the Lord of daybreak, from the evil of what He created... and from the evil of an envier when he envies (al-Falaq)",
        source: "al-Falaq 113, Abu Dawud 5082",
        target: 3,
      },
      {
        id: "nas",
        ar: "قُلْ أَعُوذُ بِرَبِّ النَّاسِ ۝ مَلِكِ النَّاسِ ۝ إِلَهِ النَّاسِ ۝ مِنْ شَرِّ الْوَسْوَاسِ الْخَنَّاسِ ۝ الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ ۝ مِنَ الْجِنَّةِ وَالنَّاسِ",
        en: "Say: I seek refuge in the Lord of mankind, the King of mankind, the God of mankind, from the evil of the retreating whisperer... (an-Nas)",
        source: "an-Nas 114, Abu Dawud 5082",
        target: 3,
      },
      { ...SUBHAN_BIHAMDIHI, id: "m-subhanallah-wabihamdihi", source: "Muslim 2692" },
      { ...TAHLIL, id: "m-tahlil" },
    ],
  },

  evening: {
    id: "evening",
    ar: "أذكار المساء",
    en: "Evening adhkar",
    items: [
      {
        id: "e-amsayna",
        ar: "أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ، رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَذِهِ اللَّيْلَةِ وَخَيْرَ مَا بَعْدَهَا، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَذِهِ اللَّيْلَةِ وَشَرِّ مَا بَعْدَهَا، رَبِّ أَعُوذُ بِكَ مِنَ الْكَسَلِ وَسُوءِ الْكِبَرِ، رَبِّ أَعُوذُ بِكَ مِنْ عَذَابٍ فِي النَّارِ وَعَذَابٍ فِي الْقَبْرِ",
        en: "We have entered the evening and the dominion belongs to Allah... My Lord, I ask You for the good of this night and what follows it, and seek refuge in You from its evil and the evil of what follows it. My Lord, I seek refuge in You from laziness and the misery of old age, and from punishment in the Fire and in the grave",
        source: "Muslim 2723",
        target: 1,
      },
      {
        id: "e-bika-amsayna",
        ar: "اللَّهُمَّ بِكَ أَمْسَيْنَا، وَبِكَ أَصْبَحْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ الْمَصِيرُ",
        en: "O Allah, by You we enter the evening and by You we enter the morning, by You we live and by You we die, and to You is the final return",
        source: "at-Tirmidhi 3391",
        target: 1,
      },
      {
        id: "e-sayyid-al-istighfar",
        ar: "اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ لَكَ بِذَنْبِي فَاغْفِرْ لِي، فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ",
        en: "O Allah, You are my Lord; none has the right to be worshipped but You. You created me and I am Your servant, and I keep Your covenant and promise as best I can. I seek refuge in You from the evil I have done. I acknowledge Your favour upon me and I acknowledge my sin, so forgive me, for none forgives sins but You",
        source: "al-Bukhari 6306",
        target: 1,
      },
      {
        id: "e-kalimat-tammat",
        ar: "أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ",
        en: "I seek refuge in the perfect words of Allah from the evil of what He has created",
        source: "Muslim 2709",
        target: 3,
      },
      {
        id: "e-bismillah-alladhi",
        ar: "بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ",
        en: "In the name of Allah, with whose name nothing on earth or in the heavens can cause harm, and He is the All-Hearing, the All-Knowing",
        source: "Abu Dawud 5088, at-Tirmidhi 3388",
        target: 3,
      },
      {
        id: "e-ikhlas",
        ar: "قُلْ هُوَ اللَّهُ أَحَدٌ ۝ اللَّهُ الصَّمَدُ ۝ لَمْ يَلِدْ وَلَمْ يُولَدْ ۝ وَلَمْ يَكُنْ لَهُ كُفُوًا أَحَدٌ",
        en: "Say: He is Allah, the One. Allah, the Eternal Refuge. He neither begets nor is born, nor is there to Him any equivalent (al-Ikhlas)",
        source: "al-Ikhlas 112, Abu Dawud 5082",
        target: 3,
      },
      {
        id: "e-falaq",
        ar: "قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ ۝ مِنْ شَرِّ مَا خَلَقَ ۝ وَمِنْ شَرِّ غَاسِقٍ إِذَا وَقَبَ ۝ وَمِنْ شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ ۝ وَمِنْ شَرِّ حَاسِدٍ إِذَا حَسَدَ",
        en: "Say: I seek refuge in the Lord of daybreak, from the evil of what He created... and from the evil of an envier when he envies (al-Falaq)",
        source: "al-Falaq 113, Abu Dawud 5082",
        target: 3,
      },
      {
        id: "e-nas",
        ar: "قُلْ أَعُوذُ بِرَبِّ النَّاسِ ۝ مَلِكِ النَّاسِ ۝ إِلَهِ النَّاسِ ۝ مِنْ شَرِّ الْوَسْوَاسِ الْخَنَّاسِ ۝ الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ ۝ مِنَ الْجِنَّةِ وَالنَّاسِ",
        en: "Say: I seek refuge in the Lord of mankind, the King of mankind, the God of mankind, from the evil of the retreating whisperer... (an-Nas)",
        source: "an-Nas 114, Abu Dawud 5082",
        target: 3,
      },
      { ...SUBHAN_BIHAMDIHI, id: "e-subhanallah-wabihamdihi", source: "Muslim 2692" },
    ],
  },

  afterPrayer: {
    id: "afterPrayer",
    ar: "أذكار بعد الصلاة",
    en: "After prayer",
    items: [
      {
        id: "p-istighfar",
        ar: "أَسْتَغْفِرُ اللَّهَ",
        en: "I seek the forgiveness of Allah",
        source: "Muslim 591",
        target: 3,
      },
      {
        id: "p-antas-salam",
        ar: "اللَّهُمَّ أَنْتَ السَّلَامُ وَمِنْكَ السَّلَامُ، تَبَارَكْتَ يَا ذَا الْجَلَالِ وَالْإِكْرَامِ",
        en: "O Allah, You are Peace and from You is peace; blessed are You, O Possessor of majesty and honour",
        source: "Muslim 591",
        target: 1,
      },
      { id: "p-subhanallah", ar: "سُبْحَانَ اللَّهِ", en: "Glory be to Allah", source: "Muslim 597", target: 33 },
      { id: "p-alhamdulillah", ar: "الْحَمْدُ لِلَّهِ", en: "Praise be to Allah", source: "Muslim 597", target: 33 },
      { id: "p-allahuakbar", ar: "اللَّهُ أَكْبَرُ", en: "Allah is the Greatest", source: "Muslim 597", target: 33 },
      { ...TAHLIL, id: "p-tahlil", source: "Muslim 597", target: 1 },
    ],
  },

  friday: {
    id: "friday",
    ar: "يوم الجمعة",
    en: "Friday",
    items: [
      { ...SALAWAT, id: "f-salawat", source: "Abu Dawud 1047, Muslim 408", target: 100 },
      SUBHAN_BIHAMDIHI,
      {
        id: "f-hawqala",
        ar: "لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ",
        en: "There is no might nor power except with Allah",
        source: "al-Bukhari 6384, Muslim 2704",
        target: 33,
      },
    ],
  },
};

export const PACK_ORDER: PackId[] = ["general", "morning", "evening", "afterPrayer", "friday", "custom"];

export function customPack(list: CustomDhikr[]): Pack {
  return {
    id: "custom",
    ar: "أذكاري",
    en: "My adhkar",
    items: list.map((c) => ({ id: c.id, ar: c.ar, en: c.meaning, source: c.source, target: Math.max(1, c.target) })),
  };
}

/** The packs available to this user (the custom one only if it has items). */
export function packFor(id: PackId, custom: CustomDhikr[]): Pack {
  if (id === "custom") return custom.length ? customPack(custom) : PACKS.general;
  return PACKS[id];
}
