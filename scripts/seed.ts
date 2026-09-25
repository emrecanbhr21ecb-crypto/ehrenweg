/**
 * Demo içeriği — "Bezirksamt Berlin-Neukölln" pilotu.
 *
 * CLAUDE.md Bölüm 13 madde 11 + proje sahibinin bağlayıcı kararı:
 *   "Demo içerik YALNIZCA Firestore'a seed ile yazılır, ASLA koda. Her demo
 *    belgesi `seed: true` işaretli; `unseed` ile tek komutla silinecek.
 *    Arayüzde 'demo/örnek/faz' afişi olmaz — baştan gerçek ürün gibi görünür."
 *
 * Yazdıkları:
 *   · 10 kategori (DE/EN ad, ikon, renk)                → categories/
 *   · Bezirksamt Berlin-Neukölln (doğrulanmış belediye) → organizations/
 *   · Café Mosaik (partner işletme)                     → organizations/
 *   · 10 yayındaki aktivite + 1 taslak + 1 incelemede   → activities/
 *
 * İki ortamda çalışır:
 *   Emülatör : FIRESTORE_EMULATOR_HOST ayarlıysa otomatik (npm run seed)
 *   Gerçek   : GOOGLE_APPLICATION_CREDENTIALS veya ADC + --project <id>
 *
 * Çalıştırma:
 *   npm run seed                       (emülatör)
 *   npm run seed -- --project ehrenweg-dev
 */

import { applicationDefault, cert, initializeApp } from 'firebase-admin/app'
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'

// --- Ortam -----------------------------------------------------------------

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const emulator = Boolean(process.env['FIRESTORE_EMULATOR_HOST'])
const projectId =
  arg('project') ?? process.env['GCLOUD_PROJECT'] ?? (emulator ? 'demo-ehrenweg' : '')

if (!projectId) {
  console.error(
    '✖ Proje kimliği yok. Emülatör için FIRESTORE_EMULATOR_HOST ayarla ' +
      '(npm run seed) ya da --project ehrenweg-dev ver.',
  )
  process.exit(1)
}

const keyFile = arg('key') ?? process.env['GOOGLE_APPLICATION_CREDENTIALS']

/**
 * Kimlik iki biçimde gelebilir:
 *   · servis hesabı anahtarı  (`"type": "service_account"`)  → cert()
 *   · kullanıcı kimliği / ADC (`"type": "authorized_user"`)  → applicationDefault()
 * Yanlış olanı seçmek "must contain a string project_id" hatası verir, o
 * yüzden dosyanın kendisine bakıyoruz.
 */
function credentialFor(path: string | undefined) {
  if (!path) return applicationDefault()
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as Record<string, string>
  if (parsed['type'] === 'service_account') return cert(parsed)
  process.env['GOOGLE_APPLICATION_CREDENTIALS'] = path
  return applicationDefault()
}

initializeApp({
  projectId,
  ...(emulator ? {} : { credential: credentialFor(keyFile) }),
})

const db = getFirestore()

// --- Yardımcılar -----------------------------------------------------------

const DAY = 24 * 60 * 60 * 1000

/** Bugünden N gün sonra, Berlin saatiyle verilen saatte. */
function inDays(days: number, hour: number, minute = 0): Timestamp {
  const date = new Date(Date.now() + days * DAY)
  date.setHours(hour, minute, 0, 0)
  return Timestamp.fromDate(date)
}

/** Her belge `seed: true` — unseed tek komutla temizlesin. */
const SEED = { seed: true } as const

// --- Kategoriler (CLAUDE.md Bölüm 5) ---------------------------------------

const CATEGORIES = [
  {
    id: 'environment',
    de: 'Umwelt & Natur',
    en: 'Environment & nature',
    icon: '🌱',
    color: '#10B981',
  },
  {
    id: 'elderly_care',
    de: 'Senior:innen',
    en: 'Seniors',
    icon: '🤝',
    color: '#F43F5E',
  },
  {
    id: 'language_teaching',
    de: 'Sprache vermitteln',
    en: 'Teaching language',
    icon: '📣',
    color: '#F59E0B',
  },
  {
    id: 'language_learning',
    de: 'Sprache lernen',
    en: 'Learning language',
    icon: '📚',
    color: '#0EA5E9',
  },
  {
    id: 'children_youth',
    de: 'Kinder & Jugend',
    en: 'Children & youth',
    icon: '🧒',
    color: '#8B5CF6',
  },
  { id: 'culture', de: 'Kultur', en: 'Culture', icon: '🎭', color: '#D946EF' },
  { id: 'sports', de: 'Sport', en: 'Sports', icon: '⚽', color: '#84CC16' },
  {
    id: 'digital_skills',
    de: 'Digitale Fähigkeiten',
    en: 'Digital skills',
    icon: '💻',
    color: '#06B6D4',
  },
  {
    id: 'community',
    de: 'Nachbarschaft',
    en: 'Neighbourhood',
    icon: '🏘️',
    color: '#F97316',
  },
  { id: 'other', de: 'Sonstiges', en: 'Other', icon: '✨', color: '#6B7280' },
] as const

// --- Kurumlar --------------------------------------------------------------

const NEUKOELLN = 'seed_org_neukoelln'
const CAFE = 'seed_org_cafe_mosaik'

const ORGANIZATIONS = [
  {
    id: NEUKOELLN,
    name: 'Bezirksamt Berlin-Neukölln',
    type: 'municipality',
    city: 'Berlin-Neukölln',
    country: 'DE',
    verified: true,
    status: 'approved',
    logoURL: null,
    website: 'https://www.berlin.de/ba-neukoelln/',
    contactEmail: 'ehrenamt@ba-neukoelln.berlin.de',
    description: {
      de: 'Das Bezirksamt Neukölln koordiniert Freiwilligenarbeit, Nachbarschaftsprojekte und Integrationsangebote im Bezirk.',
      en: 'The Neukölln district office coordinates volunteering, neighbourhood projects and integration offers across the district.',
    },
    features: { cashVouchers: false },
  },
  {
    id: CAFE,
    name: 'Café Mosaik',
    type: 'partner_business',
    city: 'Berlin-Neukölln',
    country: 'DE',
    verified: true,
    status: 'approved',
    logoURL: null,
    website: 'https://example.org/cafe-mosaik',
    contactEmail: 'hallo@cafe-mosaik.example',
    description: {
      de: 'Nachbarschaftscafé an der Karl-Marx-Straße. Partner für Gutscheine und Treffpunkt für Sprachcafés.',
      en: 'Neighbourhood café on Karl-Marx-Straße. Voucher partner and meeting point for language cafés.',
    },
    features: { cashVouchers: false },
  },
] as const

// --- Aktiviteler -----------------------------------------------------------

interface SeedActivity {
  id: string
  orgId: string
  orgName: string
  type: 'volunteering' | 'training'
  status: 'published' | 'draft' | 'pending_review'
  title: { de: string; en: string }
  description: { de: string; en: string }
  simpleDescription: { de: string; en: string }
  categoryId: string
  skillsGained: string[]
  languagesUsed: string[]
  address: string
  lat: number | null
  lng: number | null
  online: boolean
  startInDays: number
  startHour: number
  durationHours: number
  capacity: number
  applicants: number
  requiresApplication: boolean
  minLevel: number
  ip: number
  coverImageURL: string | null
}

const NK = 'Bezirksamt Berlin-Neukölln'

const ACTIVITIES: SeedActivity[] = [
  {
    id: 'seed_act_hasenheide',
    orgId: NEUKOELLN,
    orgName: NK,
    type: 'volunteering',
    status: 'published',
    title: {
      de: 'Frühjahrsputz in der Hasenheide',
      en: 'Spring clean-up in Hasenheide',
    },
    description: {
      de: 'Gemeinsam sammeln wir Müll im Volkspark Hasenheide ein. Handschuhe, Greifzangen und Säcke stellen wir. Danach gibt es Tee und Kuchen im Parkcafé. Für alle ab 16 Jahren, keine Vorkenntnisse nötig.',
      en: 'Together we collect litter in Volkspark Hasenheide. We provide gloves, grabbers and bags. Afterwards there is tea and cake at the park café. Everyone from 16, no experience needed.',
    },
    simpleDescription: {
      de: 'Wir machen den Park sauber. Wir sammeln Müll. Du brauchst nichts mitbringen. Danach trinken wir zusammen Tee.',
      en: 'We clean the park. We collect rubbish. You do not need to bring anything. Afterwards we drink tea together.',
    },
    categoryId: 'environment',
    skillsGained: ['teamwork', 'gardening'],
    languagesUsed: ['de', 'en', 'ar', 'tr'],
    address: 'Volkspark Hasenheide, Columbiadamm 160, 10965 Berlin',
    lat: 52.4836,
    lng: 13.4142,
    online: false,
    startInDays: 6,
    startHour: 10,
    durationHours: 3,
    capacity: 30,
    applicants: 12,
    requiresApplication: true,
    minLevel: 0,
    ip: 30,
    coverImageURL: null,
  },
  {
    id: 'seed_act_sprachcafe',
    orgId: NEUKOELLN,
    orgName: NK,
    type: 'training',
    status: 'published',
    title: { de: 'Deutsch-Sprachcafé', en: 'German language café' },
    description: {
      de: 'Jeden Dienstag üben wir in kleinen Gruppen Deutsch sprechen. Alle Niveaus willkommen. Muttersprachler:innen aus der Nachbarschaft moderieren die Tische. Kostenlos, Getränke inklusive.',
      en: 'Every Tuesday we practise speaking German in small groups. All levels welcome. Native speakers from the neighbourhood host the tables. Free, drinks included.',
    },
    simpleDescription: {
      de: 'Wir sprechen zusammen Deutsch. In kleinen Gruppen. Alle dürfen kommen. Es kostet nichts.',
      en: 'We speak German together. In small groups. Everybody may come. It is free.',
    },
    categoryId: 'language_learning',
    skillsGained: ['communication', 'translating'],
    languagesUsed: ['de', 'en', 'ar', 'fa', 'uk'],
    address: 'Café Mosaik, Karl-Marx-Straße 131, 12043 Berlin',
    lat: 52.4762,
    lng: 13.4391,
    online: false,
    startInDays: 3,
    startHour: 18,
    durationHours: 2,
    capacity: 24,
    applicants: 19,
    requiresApplication: false,
    minLevel: 0,
    ip: 20,
    coverImageURL: null,
  },
  {
    id: 'seed_act_senioren',
    orgId: NEUKOELLN,
    orgName: NK,
    type: 'volunteering',
    status: 'published',
    title: {
      de: 'Seniorenbegleitung: Spaziergang & Gespräch',
      en: 'Senior companionship: walks & conversation',
    },
    description: {
      de: 'Begleite ältere Nachbar:innen bei einem Spaziergang oder beim Einkauf. Ein bis zwei Stunden pro Woche reichen. Eine kurze Einführung und eine Ansprechperson bekommst du vom Bezirksamt.',
      en: 'Accompany older neighbours on a walk or to the shops. One or two hours a week is enough. You get a short introduction and a contact person from the district office.',
    },
    simpleDescription: {
      de: 'Du gehst mit einem alten Menschen spazieren. Oder du hilfst beim Einkaufen. Ein bis zwei Stunden pro Woche.',
      en: 'You go for a walk with an older person. Or you help with shopping. One or two hours a week.',
    },
    categoryId: 'elderly_care',
    skillsGained: ['communication', 'first_aid'],
    languagesUsed: ['de'],
    address: 'Seniorenzentrum Rollberg, Morusstraße 18a, 12053 Berlin',
    lat: 52.4757,
    lng: 13.4264,
    online: false,
    startInDays: 9,
    startHour: 14,
    durationHours: 2,
    capacity: 12,
    applicants: 5,
    requiresApplication: true,
    minLevel: 0,
    ip: 25,
    coverImageURL: null,
  },
  {
    id: 'seed_act_tafel',
    orgId: NEUKOELLN,
    orgName: NK,
    type: 'volunteering',
    status: 'published',
    title: {
      de: 'Lebensmittelausgabe bei der Tafel',
      en: 'Food distribution at the food bank',
    },
    description: {
      de: 'Wir sortieren gespendete Lebensmittel und geben sie an Familien aus. Körperlich etwas anstrengend, aber ein sehr direkter Beitrag. Arbeitskleidung wird gestellt.',
      en: 'We sort donated food and hand it out to families. Physically a bit demanding, but a very direct contribution. Work clothes are provided.',
    },
    simpleDescription: {
      de: 'Wir sortieren Essen. Wir geben Essen an Familien. Die Arbeit ist etwas schwer. Kleidung bekommst du von uns.',
      en: 'We sort food. We give food to families. The work is a bit hard. We give you clothes.',
    },
    categoryId: 'community',
    skillsGained: ['teamwork', 'organisation'],
    languagesUsed: ['de', 'en', 'tr', 'ar'],
    address: 'Tafel-Ausgabestelle Neukölln, Sonnenallee 64, 12045 Berlin',
    lat: 52.4826,
    lng: 13.4372,
    online: false,
    startInDays: 4,
    startHour: 9,
    durationHours: 4,
    capacity: 16,
    applicants: 16,
    requiresApplication: true,
    minLevel: 0,
    ip: 40,
    coverImageURL: null,
  },
  {
    id: 'seed_act_hausaufgaben',
    orgId: NEUKOELLN,
    orgName: NK,
    type: 'volunteering',
    status: 'published',
    title: {
      de: 'Hausaufgabenhilfe für Grundschulkinder',
      en: 'Homework help for primary school children',
    },
    description: {
      de: 'Zweimal pro Woche unterstützen wir Kinder der 3. bis 6. Klasse bei den Hausaufgaben. Wichtig sind Geduld und Zuverlässigkeit, nicht perfektes Deutsch. Für diese Aktivität ist ein erweitertes Führungszeugnis nötig; das Bezirksamt hilft bei der Beantragung.',
      en: 'Twice a week we help children from years 3 to 6 with their homework. Patience and reliability matter more than perfect German. An extended certificate of good conduct is required; the district office helps you apply for it.',
    },
    simpleDescription: {
      de: 'Du hilfst Kindern bei den Hausaufgaben. Zweimal in der Woche. Du brauchst kein perfektes Deutsch. Du brauchst Geduld.',
      en: 'You help children with homework. Twice a week. You do not need perfect German. You need patience.',
    },
    categoryId: 'children_youth',
    skillsGained: ['teaching', 'childcare', 'communication'],
    languagesUsed: ['de', 'tr', 'ar'],
    address: 'Hermann-Boddin-Schule, Leinestraße 35, 12049 Berlin',
    lat: 52.47,
    lng: 13.431,
    online: false,
    startInDays: 11,
    startHour: 15,
    durationHours: 2,
    capacity: 10,
    applicants: 3,
    requiresApplication: true,
    minLevel: 2,
    ip: 25,
    coverImageURL: null,
  },
  {
    id: 'seed_act_digital',
    orgId: NEUKOELLN,
    orgName: NK,
    type: 'training',
    status: 'published',
    title: {
      de: 'Smartphone-Sprechstunde für Anfänger:innen',
      en: 'Smartphone clinic for beginners',
    },
    description: {
      de: 'Behördentermine online buchen, E-Mails schreiben, Apps sicher nutzen: in der offenen Sprechstunde beantworten wir genau die Frage, die du mitbringst. Bring dein eigenes Gerät mit.',
      en: 'Booking appointments with authorities online, writing emails, using apps safely: in this open clinic we answer exactly the question you bring. Bring your own device.',
    },
    simpleDescription: {
      de: 'Du hast eine Frage zu deinem Handy? Wir helfen dir. Bring dein Handy mit.',
      en: 'Do you have a question about your phone? We help you. Bring your phone.',
    },
    categoryId: 'digital_skills',
    skillsGained: ['it_support', 'communication'],
    languagesUsed: ['de', 'en', 'ar', 'ru'],
    address: 'Stadtbibliothek Neukölln, Karl-Marx-Straße 66, 12043 Berlin',
    lat: 52.4797,
    lng: 13.437,
    online: false,
    startInDays: 7,
    startHour: 16,
    durationHours: 2,
    capacity: 20,
    applicants: 8,
    requiresApplication: false,
    minLevel: 0,
    ip: 20,
    coverImageURL: null,
  },
  {
    id: 'seed_act_english',
    orgId: CAFE,
    orgName: 'Café Mosaik',
    type: 'training',
    status: 'published',
    title: { de: 'English conversation club', en: 'English conversation club' },
    description: {
      de: 'Entspannte Gesprächsrunde auf Englisch. Wir reden über Alltag, Arbeit und Bewerbungen. Niveau A2 aufwärts. Online per Videokonferenz, den Link bekommst du nach der Anmeldung.',
      en: 'A relaxed conversation circle in English. We talk about everyday life, work and job applications. Level A2 and up. Online by video call, you get the link after signing up.',
    },
    simpleDescription: {
      de: 'Wir sprechen Englisch zusammen. Im Internet. Du bekommst einen Link.',
      en: 'We speak English together. On the internet. You get a link.',
    },
    categoryId: 'language_learning',
    skillsGained: ['communication'],
    languagesUsed: ['en'],
    address: '',
    lat: null,
    lng: null,
    online: true,
    startInDays: 5,
    startHour: 19,
    durationHours: 1,
    capacity: 15,
    applicants: 6,
    requiresApplication: true,
    minLevel: 0,
    ip: 10,
    coverImageURL: null,
  },
  {
    id: 'seed_act_fussball',
    orgId: NEUKOELLN,
    orgName: NK,
    type: 'volunteering',
    status: 'published',
    title: {
      de: 'Fußballtraining für Kinder begleiten',
      en: 'Support children’s football training',
    },
    description: {
      de: 'Der Nachbarschaftsverein sucht Helfer:innen für das Kindertraining am Samstag: Aufwärmen, Material, Betreuung am Spielfeldrand. Fußballkenntnisse sind willkommen, aber keine Bedingung.',
      en: 'The neighbourhood club is looking for helpers for Saturday children’s training: warm-up, equipment, supervision at the sidelines. Football knowledge is welcome but not required.',
    },
    simpleDescription: {
      de: 'Kinder spielen Fußball. Du hilfst dem Trainer. Am Samstag. Du musst nicht gut Fußball spielen.',
      en: 'Children play football. You help the coach. On Saturday. You do not need to play football well.',
    },
    categoryId: 'sports',
    skillsGained: ['teamwork', 'childcare', 'event_support'],
    languagesUsed: ['de', 'tr'],
    address: 'Sportplatz Werbellinstraße, Werbellinstraße 50, 12053 Berlin',
    lat: 52.4794,
    lng: 13.4283,
    online: false,
    startInDays: 8,
    startHour: 10,
    durationHours: 3,
    capacity: 8,
    applicants: 2,
    requiresApplication: true,
    minLevel: 0,
    ip: 30,
    coverImageURL: null,
  },
  {
    id: 'seed_act_kiezfest',
    orgId: NEUKOELLN,
    orgName: NK,
    type: 'volunteering',
    status: 'published',
    title: {
      de: 'Aufbauteam für das Kiezfest Rollberg',
      en: 'Set-up team for the Rollberg street festival',
    },
    description: {
      de: 'Für das Nachbarschaftsfest brauchen wir Hände: Pavillons aufbauen, Tische tragen, Schilder aufhängen. Wer möchte, bleibt danach zum Fest. Verpflegung ist für alle Helfenden frei.',
      en: 'For the neighbourhood festival we need hands: putting up gazebos, carrying tables, hanging signs. Anyone who wants can stay for the festival. Food is free for all helpers.',
    },
    simpleDescription: {
      de: 'Wir bauen ein Fest auf. Wir tragen Tische. Danach ist das Fest. Essen ist für dich kostenlos.',
      en: 'We set up a festival. We carry tables. Afterwards there is the festival. Food is free for you.',
    },
    categoryId: 'culture',
    skillsGained: ['event_support', 'teamwork', 'crafts'],
    languagesUsed: ['de', 'en', 'ar', 'tr', 'ku'],
    address: 'Rollbergstraße 26, 12053 Berlin',
    lat: 52.4744,
    lng: 13.4282,
    online: false,
    startInDays: 14,
    startHour: 8,
    durationHours: 5,
    capacity: 25,
    applicants: 9,
    requiresApplication: true,
    minLevel: 0,
    ip: 50,
    coverImageURL: null,
  },
  {
    id: 'seed_act_bewerbung',
    orgId: NEUKOELLN,
    orgName: NK,
    type: 'training',
    status: 'published',
    title: {
      de: 'Bewerbungswerkstatt: Lebenslauf & Anschreiben',
      en: 'Application workshop: CV & cover letter',
    },
    description: {
      de: 'Wir bauen gemeinsam deinen Lebenslauf im deutschen Format und schreiben ein Anschreiben. Zwei Termine hintereinander. Laptops sind vor Ort vorhanden. Ehrenamtliche Personalerinnen geben Feedback.',
      en: 'Together we build your CV in the German format and write a cover letter. Two sessions in a row. Laptops are available on site. Volunteer recruiters give feedback.',
    },
    simpleDescription: {
      de: 'Wir schreiben zusammen deinen Lebenslauf. Und einen Brief für die Firma. Computer sind da.',
      en: 'We write your CV together. And a letter for the company. Computers are there.',
    },
    categoryId: 'digital_skills',
    skillsGained: ['communication', 'organisation', 'it_support'],
    languagesUsed: ['de', 'en'],
    address: 'Jobcenter-Nachbarschaftsraum, Mainzer Straße 27, 12053 Berlin',
    lat: 52.4736,
    lng: 13.4348,
    online: false,
    startInDays: 12,
    startHour: 13,
    durationHours: 3,
    capacity: 14,
    applicants: 11,
    requiresApplication: true,
    minLevel: 0,
    ip: 30,
    coverImageURL: null,
  },

  // --- Kurum panelinin dolu görünmesi için: bir taslak, bir inceleme ---
  {
    id: 'seed_act_draft_garten',
    orgId: NEUKOELLN,
    orgName: NK,
    type: 'volunteering',
    status: 'draft',
    title: {
      de: 'Gemeinschaftsgarten anlegen (Entwurf)',
      en: 'Build a community garden (draft)',
    },
    description: {
      de: 'Auf der Brachfläche an der Weichselstraße soll ein Gemeinschaftsgarten entstehen. Termin und Materialliste stehen noch nicht fest.',
      en: 'A community garden is to be created on the empty plot on Weichselstraße. Date and material list are not fixed yet.',
    },
    simpleDescription: { de: '', en: '' },
    categoryId: 'environment',
    skillsGained: ['gardening', 'teamwork'],
    languagesUsed: ['de'],
    address: 'Weichselstraße 52, 12045 Berlin',
    lat: 52.4838,
    lng: 13.4447,
    online: false,
    startInDays: 30,
    startHour: 11,
    durationHours: 4,
    capacity: 20,
    applicants: 0,
    requiresApplication: true,
    minLevel: 0,
    ip: 40,
    coverImageURL: null,
  },
  {
    id: 'seed_act_review_naehcafe',
    orgId: NEUKOELLN,
    orgName: NK,
    type: 'training',
    status: 'pending_review',
    title: { de: 'Nähcafé für Anfänger:innen', en: 'Sewing café for beginners' },
    description: {
      de: 'Nähmaschinen, Stoffreste und erfahrene Nachbar:innen: wir reparieren Kleidung und nähen einfache Taschen. Material wird gestellt.',
      en: 'Sewing machines, fabric scraps and experienced neighbours: we repair clothes and sew simple bags. Materials provided.',
    },
    simpleDescription: {
      de: 'Wir nähen zusammen. Wir reparieren Kleidung. Du brauchst nichts mitbringen.',
      en: 'We sew together. We repair clothes. You do not need to bring anything.',
    },
    categoryId: 'culture',
    skillsGained: ['crafts'],
    languagesUsed: ['de', 'tr', 'ar'],
    address: 'Nachbarschaftsheim Neukölln, Schierker Straße 53, 12051 Berlin',
    lat: 52.4695,
    lng: 13.4397,
    online: false,
    startInDays: 18,
    startHour: 17,
    durationHours: 2,
    capacity: 12,
    applicants: 0,
    requiresApplication: true,
    minLevel: 0,
    ip: 20,
    coverImageURL: null,
  },
]

/**
 * Puan kuralları — CLAUDE.md Bölüm 6 varsayılanları.
 *
 * Firestore'a yazılmasının sebebi: admin panelinden değiştirilebilsin
 * (Bölüm 9 "puan kuralları editörü"). Uygulama belge yoksa koddaki
 * varsayılanlara düşüyor, yani bu seed zorunlu değil — ama kuralların
 * nereden geldiğini görünür kılıyor.
 */
const SCORING = {
  maxIpPerActivity: 60,
  ipPerHour: 10,
  bonuses: { newCategory: 15, monthlyFour: 25, trainerMultiplier: 1.5 },
  penalties: { noShowIp: 5, noShowStreakLimit: 3, restrictionDays: 14 },
  levels: [
    { level: 1, activities: 0, hours: 0, categories: 0 },
    { level: 2, activities: 3, hours: 0, categories: 0 },
    { level: 3, activities: 8, hours: 20, categories: 0 },
    { level: 4, activities: 15, hours: 50, categories: 3 },
    { level: 5, activities: 30, hours: 120, categories: 0 },
  ],
  version: 1,
}

// --- Yazma -----------------------------------------------------------------

async function seed(): Promise<void> {
  console.log(`→ Proje: ${projectId}${emulator ? ' (emülatör)' : ' (GERÇEK)'}`)

  const batch = db.batch()

  for (const [index, category] of CATEGORIES.entries()) {
    batch.set(
      db.collection('categories').doc(category.id),
      {
        name: { de: category.de, en: category.en },
        icon: category.icon,
        color: category.color,
        order: index,
        ...SEED,
      },
      { merge: true },
    )
  }

  for (const organization of ORGANIZATIONS) {
    const { id, ...data } = organization
    batch.set(
      db.collection('organizations').doc(id),
      {
        ...data,
        appliedBy: 'seed',
        appliedAt: FieldValue.serverTimestamp(),
        reviewedBy: 'seed',
        reviewedAt: FieldValue.serverTimestamp(),
        reviewNote: '',
        createdAt: FieldValue.serverTimestamp(),
        ...SEED,
      },
      { merge: true },
    )
  }

  for (const activity of ACTIVITIES) {
    const startAt = inDays(activity.startInDays, activity.startHour)
    const endAt = Timestamp.fromMillis(
      startAt.toMillis() + activity.durationHours * 60 * 60 * 1000,
    )

    batch.set(
      db.collection('activities').doc(activity.id),
      {
        orgId: activity.orgId,
        orgName: activity.orgName,
        createdBy: 'seed',
        type: activity.type,
        title: activity.title,
        description: activity.description,
        simpleDescription: activity.simpleDescription,
        categoryId: activity.categoryId,
        skillsGained: activity.skillsGained,
        languagesUsed: activity.languagesUsed,
        location: {
          address: activity.address,
          lat: activity.lat,
          lng: activity.lng,
        },
        online: activity.online,
        startAt,
        endAt,
        // Son başvuru: başlangıçtan bir gün önce.
        applicationDeadline: activity.requiresApplication
          ? Timestamp.fromMillis(startAt.toMillis() - DAY)
          : null,
        capacity: activity.capacity,
        requiresApplication: activity.requiresApplication,
        minLevel: activity.minLevel,
        status: activity.status,
        rewards: { ip: activity.ip },
        hoursCredited: activity.durationHours,
        coverImageURL: activity.coverImageURL,
        passportEnabled: true,
        // Kontenjan doluluğu gerçekçi görünsün diye önceden dolduruluyor.
        // Gerçek başvurular bunun ÜSTÜNE eklenir.
        stats: { applicants: activity.applicants, attendees: 0 },
        submittedAt:
          activity.status === 'published' ? FieldValue.serverTimestamp() : null,
        reviewedBy: activity.status === 'published' ? 'seed' : null,
        reviewedAt:
          activity.status === 'published' ? FieldValue.serverTimestamp() : null,
        reviewNote: '',
        createdAt: FieldValue.serverTimestamp(),
        ...SEED,
      },
      { merge: true },
    )
  }

  batch.set(
    db.collection('config').doc('scoring'),
    { ...SCORING, ...SEED },
    { merge: true },
  )

  await batch.commit()

  const published = ACTIVITIES.filter((a) => a.status === 'published').length
  console.log(
    `✔ ${CATEGORIES.length} kategori, ${ORGANIZATIONS.length} kurum, ` +
      `${ACTIVITIES.length} aktivite (${published} yayında) + puan kuralları yazıldı.`,
  )
  console.log('  Hepsi `seed: true` işaretli — "npm run unseed" ile silinir.')
}

seed()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('✖ Seed başarısız:', error)
    process.exit(1)
  })
