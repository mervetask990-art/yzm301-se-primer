# RELEASE — SE Primer zorlanma modeli

Model reposu (Hugging Face, public, ücretsiz katman): bkz. `app/src/model-source.json → repo`.
Tüketiciler modeli **`main` dalından değil, commit'e sabitlenmiş URL'den** indirir:

```
https://huggingface.co/<kullanici>/<repo>/resolve/<commit>/model.onnx
https://huggingface.co/<kullanici>/<repo>/resolve/<commit>/config.json
```

Sabitlenen commit tek bir yerde durur: [`app/src/model-source.json`](app/src/model-source.json). Web uygulaması
([`app/src/model.ts`](app/src/model.ts)), sunucu ([`app/predict-server.ts`](app/predict-server.ts)) ve Python test kahini
(`python tests/parite.py --hub`) aynı dosyayı okur. `main` hareketli bir hedeftir: biri yeni model yüklediğinde
tüketici haberi olmadan değişir. Commit ise değişmez (Sommerville Bl. 25, konfigürasyon yönetimi: her yayın
**tanımlanabilir ve yeniden üretilebilir** bir temel çizgiye (baseline) bağlıdır).

## Sürüm geçmişi

| Sürüm | Tarih | HF commit | Test AUC | Recall@0.5 | Veri | Önceki commit (rollback hedefi) |
|---|---|---|---|---|---|---|
| v2.0.0 | 2026-11-05 | **yayınlanmadı** — eval kapısında durdu | 0.6876 | 0.592 | 20 gerçek / 584 sentetik oturum | — |
| v2.1.0 | 2026-11-05 | [`03d54fe50427`](https://huggingface.co/taskinmerve/se-primer-zorlanma/tree/03d54fe50427aa06dea6073544c6dc725cf6f557) | 0.7269 | 0.6043 | 20 gerçek / 635 sentetik oturum | `—` |
<!-- surum-gecmisi -->

v2.0.0'ın kapıda durduğu çıktı (`python train.py`, gerçek + sentetik):

```
test: AUC 0.6876 · recall@0.5 0.592 · accuracy 0.6392 · kural tabanı AUC 0.5942
yalnız gerçek test satırları: {'n': 24, 'auc': 0.4931, 'recall': 0.25, 'accuracy': 0.4167}
✗ EVAL KAPISI GEÇİLMEDİ — artefakt yazılmadı, model/ değişmedi:
   - AUC 0.6876 < 0.7
   - recall 0.592 < 0.6
```

Neden ve sonrası: `spec.md §8.5` (gerçek veri, sentetik üreticinin varsayımını yanlışladı; eşikler değiştirilmeden v2.1).

Satırları `python yayinla.py` ekler; her satır bir commit'e ve `config.json → data.sha256` ile bir veri dosyasına bağlıdır.

## v2.0'da ne değişti

| | v1 (geçen hafta) | v2.0 |
|---|---|---|
| Destek (ipucu, sayaç) neye göre? | Sabit kural: yalnızca konu puanı (§3) | Kural **+** model: bu nöbetteki davranıştan zorlanma olasılığı |
| Girdi | Seviye, konu puanı | 9 davranış girdisi (tereddüt süresi, A↔B gidip gelme, riskli seçimler, ipucu, tutor, geçmiş) |
| Oyunu nasıl değiştirir? | — | `p ≥ 0.50` → sayaç kalkar, ipucu açılır, "Destek açıldı" notu |
| Veri | — | Veri toplama modu, `data/oturumlar.csv` (gerçek + sentetik) |
| Test | 23 E2E | 23 E2E (regresyon) + parite (5 vaka) + KÖ-12/13 |

Model yalnızca desteği **artırır**. Yüklenemezse, tahmin hata verirse ya da oyuncu kanarya grubunda değilse oyun
v1 kurallarıyla devam eder. Bu bilinçli bir **zarif düşüş** (graceful degradation) kararıdır: model bozulursa
oyuncu v1'i görür, kırık bir oyun görmez.

## Rollback (geri alma)

Sorun belirtileri: parite testi kırılır, `destek_modu` oranı beklenmedik biçimde %80'e fırlar / sıfıra iner,
oyuncular "ipucu her yerde açılıyor" der, tarayıcı konsolunda `Sözleşme uyuşmuyor` hatası görülür.

1. **Önceki commit'e dön** (sürüm geçmişindeki son sütun):
   ```bash
   python yayinla.py --geri-al <onceki_commit>
   ```
   Bu yalnızca `app/src/model-source.json`'u değiştirir; HF'deki dosyalara dokunmaz (eski commit orada durur).
2. Doğrula: `python tests/parite.py --hub` ve `npm run cy:run`.
3. Uygulamayı yeniden yayınla (AI Studio / GitHub Pages). Kullanıcı tarafında önbellek sorunu yoktur: URL commit
   içerdiği için yeni URL = yeni dosya.
4. **Acil durdurma (v1'e dön):** `rollout.mode` değerini `"shadow"` yap. Model hesaplamaya ve kaydetmeye devam eder ama
   oyunu değiştirmez: bu, modeli tamamen kapatmaktan daha iyidir çünkü sorunu incelemek için veri akmaya devam eder.

**Dürüstlük notu:** HF'te şu an tek yayınlanmış sürüm var (v2.1.0 → `03d54fe`); v2.0.0 eval kapısında durduğu
için hiç yayınlanmadı. Bu yüzden "önceki commit'e dön" yolu henüz gerçek iki sürüm arasında denenmedi. İlk durumda
geri alma = **v1 kurallarına dönmek**tir: `rollout.mode = "shadow"` (model kaydeder, oyunu değiştirmez) ya da
model yüklenemezse otomatik v1 (KÖ-14). Bir sonraki sürüm yayınlandığında `--geri-al 03d54fe…` ile dönüp
`python tests/parite.py --hub` koşmak, geri dönüş yolunun gerçekten çalıştığını gösterecek ilk test olacaktır.

## Yeni sürümü güvenle devreye alma

Uygulamada gerçekten uygulanabilir: [`app/src/model-source.json`](app/src/model-source.json) → `rollout`.
Oyuncu kovası `oyuncu_id`'den FNV-1a ile hesaplanır (0–99); aynı oyuncu her oturumda aynı grupta kalır, bir nöbette
destek görüp diğerinde görmemek gibi tutarsız bir deneyim yaşamaz (`app/src/model.ts → modelAppliesTo`).

| Aşama | `rollout` | Senaryomuzda ne olur | Geçiş ölçütü (bir sonrakine) | Geri dönüş tetiği |
|---|---|---|---|---|
| **1. Shadow (gölge)** | `{"mode": "shadow"}` | Model her kararda hesaplanır, `model_p` CSV'ye yazılır; oyun **v1 kurallarıyla** oynanır (`destek_modu = 0`). Oyuncu hiçbir şey fark etmez. | En az 30 oturumluk gölge verisinde modelin AUC'si eval eşiğinin (0.70) çok altında değil; `p ≥ 0.5` oranı %20–60 arasında (her şeye destek açan model işe yaramaz) | Gerçek veride AUC < 0.60 → yayın yok |
| **2. Canary (kanarya)** | `{"mode": "canary", "percent": 5}` | Oyuncuların %5'inde model desteği açar | Kanarya grubunda nöbet tamamlama oranı ve iyi son (Son A) oranı kontrol grubundan düşük değil; konsol hatası yok | Tamamlama oranı düşerse → `shadow` |
| **3. Progressive rollout (aşamalı geçiş)** | `percent`: 25 → 50 → 100 | Her adımda aynı ölçütler; her adım en az bir gün veya 20 oturum | Ölçütler korunuyor | Herhangi bir adımda bozulma → bir önceki `percent` |
| **4. Tam** | `{"mode": "full"}` | Herkes | — | Rollback bölümü |

**Not (dürüstlük):** Bu ödev teslimindeki yayın `mode: "full"` ile yapıldı, çünkü ders demosunda modelin oyunu
değiştirdiğinin görülmesi gerekiyor ve gerçek kullanıcı trafiği yok (birkaç arkadaş). Gerçek bir sınıfa açılırken
yukarıdaki sıra izlenmelidir. Gölge aşamasının asıl değeri şudur: `destek_modu = 0` iken toplanan etiketler modelin
kendi müdahalesinden **etkilenmemiştir**, bu yüzden bir sonraki sürümü eğitmek için en temiz veridir
(geri besleme döngüsü, bkz. model kartı → sınırlar).

## Mimari dağıtım kararı ve ödünleşim matrisi

**Karar: birincil tüketici tarayıcı (`onnxruntime-web`).** Sunucu (`/api/predict`, `onnxruntime-node`) aynı model
için ikinci tüketici ve parite tanığıdır. Mobil (Expo) bu sürümde yok.

| Soru | Tarayıcı — `onnxruntime-web` (**seçilen**) | Cihaz içi mobil — Expo + `onnxruntime-react-native` | Kendi sunucumuz — Express `/api/predict` (Render.com) |
|---|---|---|---|
| **1. İnternet zorunlu mu, gecikme nasıl?** | İlk açılışta model (~1 KB) + config + WASM çalışma zamanı (~10 MB, CDN önbelleği) iner; sonra her tahmin **yerelde, < 1 ms**. Tahmin kararın başında yapılır, oyuncu beklemez. Model inmezse oyun v1 ile çalışır. | Model APK'ya gömülürse **internetsiz** çalışır, gecikme yok. Ama model güncellemek için uygulama mağazası / yeni APK gerekir (sürümleme yavaşlar). | Her kararda bir ağ gidiş-dönüşü (Render ücretsiz katmanda **soğuk başlatma 30–50 sn** olabilir). Zamanlayıcılı bir oyunda kararın başında bu gecikme kabul edilemez. |
| **2. Veri cihazdan çıkar mı?** (KVKK) | **Çıkmaz.** 9 davranış girdisi tarayıcıda hesaplanır ve kullanılır. CSV yalnızca oyuncu "CSV indir"e basarsa çıkar. | Çıkmaz. | **Çıkar:** her kararda davranış verisi sunucuya gider. Kişisel veri olmasa da tereddüt / hata örüntüsü bir öğrenci hakkında hassas sayılabilir; aydınlatma metni, saklama süresi ve log politikası gerekir. |
| **3. Model gizli kalır mı?** | **Hayır.** `model.onnx` herkese iner; Netron ile açılıp katsayılar okunabilir. Bizim için sorun değil: model zaten public HF reposunda, katsayılar model kartında yazılı ve "sır" değil. | Hayır. APK açılıp model çıkarılabilir. | **Evet**, dosya sunucuda kalır. Ama istek-yanıt ile **tersine mühendislik riski** vardır: 9 girdili bir lojistik regresyon, ~10 iyi seçilmiş istekle katsayılarına kadar çözülebilir. Hız sınırı (rate limit) gerekir. |
| Maliyet | GitHub Pages / AI Studio: ücretsiz | Expo: ücretsiz | Render ücretsiz katman: uyku ve soğuk başlatma |
| **Sonuç** | Gizlilik + gecikme en iyi; gizlilik gerektirmeyen küçük model için doğru yer | Çevrimdışı gerekseydi tercih edilirdi | Model gizli olsaydı ya da büyük olsaydı tercih edilirdi |

Neden sunucu yine de var? (1) Diferansiyel testte **üçüncü bir bağımsız tüketici**: aynı ONNX dosyası farklı bir
çalışma zamanında (`onnxruntime-node`) aynı sonucu vermeli. (2) İleride model gizli tutulmak istenirse (ör. sınav
gibi bir kullanımda) geçiş yolu hazır olur.

## Kaynaklar

- Sommerville, *Software Engineering* (10. baskı), Bl. 25 Konfigürasyon Yönetimi (sürüm, temel çizgi, yayın);
  Bl. 8 Yazılım Testi (doğrulama vs. geçerleme); Bl. 17–18 dağıtık ve servis odaklı mimariler (istemci vs. sunucu ödünleşimi).
- Amershi vd. (2019), *Software Engineering for Machine Learning: A Case Study* — modelin dağıtımdan sonra da
  izlenmesi; "yaşayan" yaşam döngüsü (gölge aşamasındaki `model_p` kaydı bunun için).
- Shankar vd. (2022), *Operationalizing Machine Learning: An Interview Study* — Velocity, Validation, Versioning
  (3V): commit'e sabit URL = Versioning; eval kapısı + parite = Validation; tek komutla yayın/geri alma = Velocity.
- Breck vd. (2017), *The ML Test Score* — "eğitim ve sunum (serving) aynı skoru üretir" testi (parite), "model
  sürümü geri alınabilir" testi (rollback).
- Mitchell vd. (2019), *Model Cards for Model Reporting* — `model/README.md`.
- Hugging Face Hub belgeleri: `resolve/<revision>` URL'leri ve `revision` parametresi.
