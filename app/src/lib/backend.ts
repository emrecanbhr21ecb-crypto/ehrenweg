/**
 * Cloud Functions mı, istemci mi? — tek anahtar.
 *
 * ⚠️ MİMARİ SAPMA (docs/DECISIONS.md §7). CLAUDE.md Bölüm 12 aktivite
 * akışını dört onCall fonksiyonuna veriyor: `submitActivity`, `reviewActivity`,
 * `applyToActivity`, `decideApplication`. Bu fonksiyonlar YAZILDI ve
 * derleniyor (`functions/src/activities.ts`), ancak Cloud Functions **Blaze**
 * planı istiyor ve proje Spark'ta. Bu yüzden aynı iş şimdilik istemcide
 * Firestore transaction'ı ile yapılıyor; **doğruluk ve yetki denetimi
 * `firestore.rules` tarafında** duruyor:
 *
 *   - kontenjan ve son başvuru tarihi → `activities/{id}/applicants/{uid}`
 *     create kuralı, aktivite belgesini `get()` ile okuyup kontrol eder
 *   - sayaç (`stats.applicants`) → yalnız ±1, yalnız kendi başvurusu
 *     `getAfter()` ile aynı commit içinde doğrulanarak
 *   - durum geçişleri (draft → pending_review → published) → rol + geçiş
 *     tablosu kuralda
 *
 * Yani istemci kodu "iyi niyetli yol"dur; kötü niyetli istemci kuraldan
 * geçemez. tests/firestore.rules.test.ts bunu saldırı senaryolarıyla
 * kanıtlıyor.
 *
 * Blaze açıldığında tek yapılacak: aşağıdaki bayrağı `true` yapmak ve
 * `firestore.rules` içindeki ilgili `allow create/update` bloklarını
 * `if false` hâline getirmek.
 */

import { httpsCallable } from 'firebase/functions'

import { functions } from '@/lib/firebase'

/**
 * Blaze açılınca `true` yapılacak. Şu an `false`: Cloud Functions dağıtılmadı,
 * çağrı yapılırsa `internal` hatası döner ve akış ölür.
 */
export const CLOUD_FUNCTIONS_ENABLED = false

/**
 * Cloud Function varsa onu çağırır, yoksa istemci uygulamasını çalıştırır.
 *
 * İki yolu tek imzada tutmanın sebebi: geçiş günü çağrı yerlerine
 * dokunulmayacak, yalnız bayrak değişecek.
 */
export async function callOrLocal<TInput, TResult>(
  name: string,
  input: TInput,
  local: (input: TInput) => Promise<TResult>,
): Promise<TResult> {
  if (!CLOUD_FUNCTIONS_ENABLED) return local(input)

  const callable = httpsCallable<TInput, TResult>(functions, name)
  const response = await callable(input)
  return response.data
}
