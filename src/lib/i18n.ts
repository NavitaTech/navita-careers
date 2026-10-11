/**
 * English and Arabic.
 *
 * The game itself stays in English - the universities, cities and the brief all
 * are. But the register and result screens are where a parent stands over their
 * child's shoulder, and in Kuwait the parent is who decides. Those screens
 * flip.
 */
import type { Lang } from './types'

type Dict = Record<string, string>

const en: Dict = {
  'attract.title': 'Where is your future campus?',
  'attract.sub': 'Drag the university onto its city. Sixty seconds.',
  'attract.cta': 'Tap to play',
  'attract.today': "Today's top five",
  'attract.noScores': 'Be the first name on the board',
  'attract.schools': 'Leading schools',

  'howto.title': 'How to play',
  'howto.step': 'Drag each university onto its city on the map.',
  'howto.right': 'Right city',
  'howto.close': 'Right country',
  'howto.got': 'Got it',
  'howto.auto': 'Starting in {n}',

  'hud.time': 'Time',
  'hud.score': 'Score',
  'hud.left': 'Left',
  'hud.streak': 'Streak',

  'game.quit': 'End round',
  'game.tray': 'Drag these onto the map',
  'game.hint': 'Look here',

  'result.title': 'Round complete',
  'result.cleared': 'Full clear',
  'result.score': 'Score',
  'result.correct': 'Correct',
  'result.near': 'Close',
  'result.missed': 'Missed',
  'result.timeBonus': 'Time bonus',
  'result.rank': 'Rank today',
  'result.unranked': 'Claim your place to rank',
  'result.claim': 'Claim your place',
  'result.claimSub': 'Add your name to the board and get your university matches.',
  'result.skip': 'No thanks',
  'result.next': 'Next player',
  'result.again': 'Play again',
  'result.pickCities': 'Which of these would you like to study in?',
  'result.pickCitiesSub': 'Pick up to three. Your counsellor will start here.',

  'register.title': 'Claim your place',
  'register.name': 'Full name',
  'register.namePh': 'Your name',
  'register.phone': 'Mobile number',
  'register.grade': 'Grade',
  'register.major': 'Preferred major',
  'register.school': 'School',
  'register.schoolPh': 'Your school name',
  'register.consent': 'I agree to be contacted by the counselling team about study options.',
  'register.consentRequired': 'We can only save your details if you agree to be contacted.',
  'register.phoneInvalid': 'Enter an 8-digit Kuwait mobile number.',
  'register.nameInvalid': 'Please enter your name.',
  'register.submit': 'Save and see my matches',
  'register.assisted': 'Counsellor entry',
  'register.back': 'Back',
  'register.saved': 'Saved',
  'register.returning': 'Welcome back — we kept your best score.',

  'share.title': 'Your UK shortlist',
  'share.sub': 'Based on {major} and the cities you picked.',
  'share.whatsapp': 'Send to my counsellor',
  'share.qr': 'Scan to keep this',
  'share.qrSub': 'Opens WhatsApp on your phone with your result.',
  'share.download': 'Save my card',
  'share.visit': 'Come and see us at the stand',
  'share.done': 'Done',

  'board.title': 'Leaderboard',
  'board.today': 'Today',
  'board.hour': 'This hour',
  'board.event': 'Whole event',
  'board.schools': 'Schools',
  'board.players': '{n} players',
  'board.empty': 'No scores yet',
  'board.back': 'Back',

  'common.of': 'of',
  'common.seconds': 's',
  'common.points': 'pts',
  'common.close': 'Close',
  'common.cancel': 'Cancel',
  'common.guest': 'Guest',
}

const ar: Dict = {
  'attract.title': 'وين جامعتك الجاية؟',
  'attract.sub': 'اسحب الجامعة على مدينتها. ستون ثانية.',
  'attract.cta': 'المس للعب',
  'attract.today': 'أعلى خمس نتائج اليوم',
  'attract.noScores': 'كن أول اسم على اللوحة',
  'attract.schools': 'أبرز المدارس',

  'howto.title': 'كيف تلعب',
  'howto.step': 'اسحب كل جامعة على مدينتها في الخريطة.',
  'howto.right': 'المدينة الصحيحة',
  'howto.close': 'الدولة الصحيحة',
  'howto.got': 'فهمت',
  'howto.auto': 'يبدأ خلال {n}',

  'hud.time': 'الوقت',
  'hud.score': 'النقاط',
  'hud.left': 'المتبقي',
  'hud.streak': 'متتالية',

  'game.quit': 'إنهاء الجولة',
  'game.tray': 'اسحب هذه على الخريطة',
  'game.hint': 'انظر هنا',

  'result.title': 'انتهت الجولة',
  'result.cleared': 'أكملت الجولة',
  'result.score': 'النقاط',
  'result.correct': 'صحيحة',
  'result.near': 'قريبة',
  'result.missed': 'خاطئة',
  'result.timeBonus': 'مكافأة الوقت',
  'result.rank': 'ترتيبك اليوم',
  'result.unranked': 'سجّل اسمك ليظهر ترتيبك',
  'result.claim': 'سجّل مركزك',
  'result.claimSub': 'أضف اسمك للوحة واحصل على الجامعات المناسبة لك.',
  'result.skip': 'لا شكراً',
  'result.next': 'اللاعب التالي',
  'result.again': 'العب مرة أخرى',
  'result.pickCities': 'أي مدينة تحب تدرس فيها؟',
  'result.pickCitiesSub': 'اختر حتى ثلاث. مستشارك سيبدأ من هنا.',

  'register.title': 'سجّل مركزك',
  'register.name': 'الاسم الكامل',
  'register.namePh': 'اسمك',
  'register.phone': 'رقم الموبايل',
  'register.grade': 'الصف',
  'register.major': 'التخصص المفضل',
  'register.school': 'المدرسة',
  'register.schoolPh': 'اسم مدرستك',
  'register.consent': 'أوافق على تواصل فريق الإرشاد معي بخصوص خيارات الدراسة.',
  'register.consentRequired': 'لا نستطيع حفظ بياناتك إلا بموافقتك على التواصل.',
  'register.phoneInvalid': 'أدخل رقم موبايل كويتي من ثماني خانات.',
  'register.nameInvalid': 'الرجاء إدخال اسمك.',
  'register.submit': 'احفظ وأظهر الجامعات',
  'register.assisted': 'إدخال بواسطة المستشار',
  'register.back': 'رجوع',
  'register.saved': 'تم الحفظ',
  'register.returning': 'أهلاً بعودتك — احتفظنا بأفضل نتيجة لك.',

  'share.title': 'قائمتك المختصرة',
  'share.sub': 'بناءً على {major} والمدن التي اخترتها.',
  'share.whatsapp': 'أرسلها لمستشاري',
  'share.qr': 'امسح لتحتفظ بها',
  'share.qrSub': 'يفتح واتساب على جوالك مع نتيجتك.',
  'share.download': 'احفظ بطاقتي',
  'share.visit': 'تعال زرنا في الجناح',
  'share.done': 'تم',

  'board.title': 'لوحة الصدارة',
  'board.today': 'اليوم',
  'board.hour': 'هذه الساعة',
  'board.event': 'المعرض كامل',
  'board.schools': 'المدارس',
  'board.players': '{n} لاعب',
  'board.empty': 'لا توجد نتائج بعد',
  'board.back': 'رجوع',

  'common.of': 'من',
  'common.seconds': 'ث',
  'common.points': 'نقطة',
  'common.close': 'إغلاق',
  'common.cancel': 'إلغاء',
  'common.guest': 'ضيف',
}

const DICTS: Record<Lang, Dict> = { en, ar }

/** Looks a string up, filling {placeholders}. Falls back to English, then the key. */
export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  const text = DICTS[lang][key] ?? en[key] ?? key
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (match, name) => String(vars[name] ?? match))
}

export const isRtl = (lang: Lang): boolean => lang === 'ar'

/** Grade and major values are stored in English; these are only for display. */
export const GRADE_LABELS: Record<Lang, Record<string, string>> = {
  en: { '10': 'Grade 10', '11': 'Grade 11', '12': 'Grade 12', University: 'University', Parent: 'Parent' },
  ar: { '10': 'الصف ١٠', '11': 'الصف ١١', '12': 'الصف ١٢', University: 'جامعة', Parent: 'ولي أمر' },
}

export const MAJOR_LABELS: Record<Lang, Record<string, string>> = {
  en: {
    Medicine: 'Medicine',
    Engineering: 'Engineering',
    Business: 'Business',
    'Computer Science': 'Computer Science',
    Law: 'Law',
    Other: 'Other',
  },
  ar: {
    Medicine: 'الطب',
    Engineering: 'الهندسة',
    Business: 'إدارة الأعمال',
    'Computer Science': 'علوم الحاسب',
    Law: 'القانون',
    Other: 'أخرى',
  },
}
