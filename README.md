# SE Primer v2 — davranıştan öğrenen Primer

**v2'de ne değişti:** Geçen haftaki SE Primer, oyuncuya desteği (ipucu, geri sayım) yalnızca **konu puanına** bakan sabit kurallarla veriyordu. v2'de küçük bir model (lojistik regresyon → ONNX), oyuncunun **bu nöbetteki davranışından** (önceki karardaki tereddüt süresi, A↔B gidip gelme, riskli seçimler, ipucu ve tutor kullanımı, geçmiş) **sıradaki kararda zorlanma olasılığını** tahmin eder. `p ≥ 0.50` ise geri sayım kalkar, ipucu açılır ve kararın üstünde "Destek açıldı" notu çıkar. Model desteği yalnızca **artırır**; yüklenemezse oyun v1 kurallarıyla devam eder.

| | Link |
|---|---|
| GitHub repo | [github.com/mervetask990-art/yzm301-se-primer](https://github.com/mervetask990-art/yzm301-se-primer) · geçen haftanın teslimi: [`v1.0` etiketi](https://github.com/mervetask990-art/yzm301-se-primer/tree/v1.0) |
| Hugging Face model (commit'e sabit) | [taskinmerve/se-primer-zorlanma@03d54fe](https://huggingface.co/taskinmerve/se-primer-zorlanma/tree/03d54fe50427aa06dea6073544c6dc725cf6f557) · `model.onnx`: [`resolve/03d54fe…/model.onnx`](https://huggingface.co/taskinmerve/se-primer-zorlanma/resolve/03d54fe50427aa06dea6073544c6dc725cf6f557/model.onnx) |
| Canlı uygulama | _eklenecek_ |
| Demo video (60–90 sn) | _eklenecek_ |

## Kurulum (3 komut)

Python 3.11, Node 20+. Proje kökünde:

```bash
pip install -r requirements.txt
python data/veri_hazirla.py && python train.py && python tests/parite.py
cd app && npm install && npm run dev
```

1. Bağımlılıklar (sürümleri sabit).
2. Veri (`data/oturumlar.csv`) → eğitim + eval kapısı → `model/` → Python test kahininin parite kontrolü.
3. Uygulama: http://localhost:3000 (model HF'ten commit'e sabit URL ile iner). Tutor için `app/.env` içine `GEMINI_API_KEY` (isteğe bağlı).

Testler (uygulama açıkken, ayrı terminalde, repo kökünde): `npm install && npm run cy:run`. Diferansiyel test paneli: http://localhost:3000/?parite=1

## Ödev adımları → dosyalar

| Adım | Dosya | Durum |
|---|---|---|
| 1. Spec, eval metriği, kabul eşiği (eğitimden **önce**) | [spec.md §8](spec.md), KÖ-12/13/14; eşik commit'i `9ebcbec` | ✅ |
| 2. Veri + sözlük + `kaynak` | [data/oturumlar.csv](data/oturumlar.csv), [data/SOZLUK.md](data/SOZLUK.md), ham gerçek veri [data/gercek/](data/gercek/) | ✅ 20 gerçek oturum (3 kişi), 635 sentetik |
| 3. Tekrarlanabilir eğitim + eval kapısı | [train.py](train.py) (TOHUM 42, oturuma göre bölme, eşik altı → çıkış 1, artefakt yazılmaz) | ✅ v2.0 kapıda durdu, v2.1 geçti |
| 4. Artefakt + sözleşme + model kartı | [model/model.onnx](model/model.onnx), [model/config.json](model/config.json), [model/README.md](model/README.md) | ✅ ONNX–sklearn farkı 8.7e-8 |
| 5. Yayın, sürümleme, rollback, Shadow/Canary, ödünleşim | [RELEASE.md](RELEASE.md), [yayinla.py](yayinla.py), [app/src/model-source.json](app/src/model-source.json) | ✅ HF `v2.1.0` → `03d54fe` |
| 6. Uygulamada çıkarım | [app/src/model.ts](app/src/model.ts) (`onnxruntime-web`), [App.tsx](app/src/App.tsx), `data-cy="p"` | ✅ |
| 6. Diferansiyel test | [tests/parite.py](tests/parite.py) (Python kahini), [tests/parite.json](tests/parite.json), [cypress/e2e/model.cy.ts](cypress/e2e/model.cy.ts) | ✅ 5/5, `|Δ| < 1e-6` |
| 6. Regresyon testi | geçen haftanın 23 E2E testi ([paths](cypress/e2e/paths.cy.ts), [pusula](cypress/e2e/pusula.cy.ts), [growth](cypress/e2e/growth.cy.ts)) | ✅ 31/31 (23 eski + 8 yeni) |
| 7. Sınav tasarımı | [SINAV_TASARIMI.md](SINAV_TASARIMI.md) | ✅ |
| Bonus: kendi sunucu | [app/predict-server.ts](app/predict-server.ts) `POST /api/predict` (`onnxruntime-node`), [render.yaml](render.yaml), `python tests/parite.py --sunucu <url>` | ✅ yerelde 5/5 · Render: _eklenecek_ |

## Sonuç: ne ölçtük (dürüst özet)

| Sürüm | Test AUC | Recall@0.5 | Yalnız gerçek oyuncu AUC | Karar |
|---|---|---|---|---|
| v2.0.0 | 0.688 | 0.592 | 0.49 (n = 24) | ❌ eval kapısı durdurdu, **yayınlanmadı** |
| v2.1.0 | **0.727** | **0.604** | **0.46** (n = 18) | ✅ kapı geçildi, yayınlandı — kartta uyarıyla |

- **Gerçek veri varsayımımı yanlışladı.** Sentetik üreticiyi "riskli seçim yapan yine riskli seçer" diye yazmıştım; arkadaşlarım B'den sonra çoğunlukla A'ya döndü (%59 → %39). İlk model gerçek oyuncularda bu yüzden ters çalıştı.
- **Etiket sorunu (geçerleme):** Tekrar oynayan oyuncu diğer sonu görmek için **bilerek** B seçiyor; `zorlandi` etiketi zorlanma ile keşfi ayıramıyor. v3: "Neden bu seçeneği seçtin?" sorusu.
- **Eşikler hiç değiştirilmedi.** v2.1'de yalnızca sentetik üreticinin varsayımları düzeltildi ve bu düzeltme yeniden eğitimden önce [spec.md §8.5](spec.md)'e yazıldı. Kapı karışık (sentetik baskın) test kümesinde geçildi; **gerçek oyuncularda modelin işe yaradığına dair kanıt yok** ve bu model kartında açıkça yazılı.

## Sentetik veri: üretici kuralı ve tohum

[data/veri_hazirla.py](data/veri_hazirla.py), `TOHUM = 42`, 180 sanal oyuncu, her biri 1–6 nöbet. Oyun kuralları (puan, kademe, 60/45 sn sayaç, ipucu) uygulamadakiyle aynı. Her oyuncunun gizli bir kararsızlık eğilimi `z ~ N(0,1)` var; model `z`'yi görmez.

```
karar süresi  t ~ LogNormal(log 9 + 0.45·z + 0.6·(1 − puan/100) + 0.25·[K3], 0.45)
gidip gelme   g ~ Poisson(0.6 + 0.3·|z| + 0.3·[ipucu açık])
keşif         = 0.35·(nöbet sırası) + 1.5·(puan − 50)/100
logit         = −0.5 + 0.8·z + keşif − 1.1·[önceki karar B] + 0.08·(önceki süre − 9) − 0.4·[ipucu açık] + N(0, 0.8)
zorlandi      = Bernoulli(σ(logit)); sayaç varsa ve t > süre → süre doldu, zorlandi = 1
```

v2.0 kuralı ve neden değiştiği: [spec.md §8.5](spec.md). Gerçek satırlar oyunun veri toplama modundan gelir (rastgele oturum/oyuncu kimliği, ad/cihaz/konum yok; [data/SOZLUK.md](data/SOZLUK.md)).

## Yapay zekâ araçları beyanı

> Bu bölümü kendi deneyimimle düzenledim.

- **Claude Code** (bu repoda): spec §8 taslağı, veri toplama modu, `train.py`, `onnx_aktar` uyarlaması, parite testleri, `RELEASE.md` ve sınav taslağı. Her adımı tek tek inceleyip onayladım; eşik değerlerini ve hedef tanımını eğitimden önce ben sabitledim.
- **Elle düzelttiklerim / yönlendirdiklerim:** Ajanın "agent'lar gerçek kullanıcı gibi oynasın" önerisini değil, gerçek arkadaşlarımla veri toplamayı seçtim. v2.0 kapıda durunca eşiği düşürmek yerine gerçek veriye bakıp sentetik varsayımı düzeltme kararını verdim. `SINAV_TASARIMI.md`'yi kendi kelimelerimle yeniden yazdım.
- **Ajanın hataları ve yakalananlar:** sentetik üreticinin yanlış varsayımı (gerçek veri ortaya çıkardı); yayın betiğinin `rollout` ayarını silmesi; bir Cypress testinin tıklamayı gidip gelme saymayan yanlış beklentisi; Windows'ta pandas 3.1'in Smart App Control'e takılması (3.0.3'e sabitlendi).
- **Kaynaklar:** başlangıç reposu [seyyah/huggingface-hello-web](https://github.com/seyyah/huggingface-hello-web) (`onnx_aktar`, `onnxruntime-web` kalıbı); Mitchell vd. 2019 (model kartı); Breck vd. 2017, Shankar vd. 2022, Amershi vd. 2019, Sommerville Bl. 8/25 ([RELEASE.md](RELEASE.md) içinde).

---

# v1 (geçen hafta)


**Yazılım mühendisliği, oynanan bir kitap.** Her seçim bir durum geçişi, her son bir kabul kriteri.

**Pusula (ana mod):** Kendi sorunu veya krizini yaz ("Canlıda sorgular yavaşladı", "Mikroservise geçmeli miyiz?"). Pusula cevap vermez: önce seni anlamak için soru sorar, sonra yol haritası çıkarır. Her yol için **hangi mantıkla** seçildiğini, **o yoldan gidersen nereye varacağını**, riskini ve **hangi koşulda anlamlı olduğunu** gösterir. Bir yol seçtikçe harita derinleşir; geri dönüp "başka bir senaryodan geçseydim?" diye diğer dalı deneyebilir, kendi yolunu ekleyip aynı biçimde analiz ettirebilirsin. Sonunda cevabı sen yazarsın.

**Seninle büyür:** Primer altı konuda (deploy, test, güvenlik, gözlemlenebilirlik, performans, ekip) ustalığını kanıttan ölçer ve ana ekranda radar olarak gösterir. Bir konuda güçlendikçe o konudaki destek azalır: ipuçları kapanır, süre kısalır, Pusula sonucu göstermeden önce **tahminini** ister ve tahmin isabetinin zamanla nasıl değiştiğini gösterir. Araştırdığın kavramları **kendi kelimelerinle** deftere yazarsın; 1, 3, 7 ve 14 gün sonra geri gelir, eski notuna bakmadan yeniden açıklarsın.

**Örnek kriz:** Oyuncu 08:00'de çöken bir hastane randevu sisteminin nöbetçi mühendisidir. Üç karar verir (mimari, test, KVKK); uygulama her kararın teknik sonucunu gösterir ve **cevabı değil, araştırılacak kavramları** verir. AI tutor ipucu verir, cevabı vermez.

**Seninle birlikte öğrenir:** Her nöbet cihazdaki bir öğrenme günlüğüne yazılır. Bir sonraki nöbette Primer seni adınla karşılar, en çok risk aldığın kararı ve sıradaki araştırmanı hatırlatır, hazırsan seviye atlamayı önerir; tutor da araştırdığın kavramlar ve kendi notun üzerinden soru sorar.

| | Link |
|---|---|
| Çalışan uygulama (AI Studio) | [ai.studio/apps/d17850a4-…](https://ai.studio/apps/d17850a4-60ef-4c0a-9474-516a887f8330?fullscreenApplet=true) |
| Demo video (60 sn, Cypress) | [youtu.be/c8XlkiVAW4g](https://youtu.be/c8XlkiVAW4g) |
| Repo | [github.com/mervetask990-art/yzm301-se-primer](https://github.com/mervetask990-art/yzm301-se-primer) |

## İçerik

| Dosya | Ne |
|---|---|
| [spec.md](spec.md) | Problem, kapsam / kapsam dışı, 5 kabul örneği, akış şeması, izlenebilirlik |
| [DESIGN.md](DESIGN.md) | Renk token'ları, tipografi, bileşenler, ekranlar |
| [design/](design/) | Google Stitch ekranları |
| [scenario/scenario.json](scenario/scenario.json) | Senaryo durum makinesi: kararlar, sonuçlar, araştırma noktaları, sonlar |
| [prompts/stitch.md](prompts/stitch.md) | Stitch'e verilen prompt'lar |
| [prompts/ai-studio.md](prompts/ai-studio.md) | AI Studio Build prompt'u + tutor sistem prompt'u |
| [eval/](eval/) | Tutor eval: 20 cevap, hata türleri, oranlar |
| [cypress/e2e/paths.cy.ts](cypress/e2e/paths.cy.ts) | Örnek kriz: 8 yol + kişiselleştirme + tutor + öğrenme günlüğü (14 test) |
| [cypress/e2e/pusula.cy.ts](cypress/e2e/pusula.cy.ts) | Pusula: netleştirme, harita, kendi yolu, geri dönüp dal değiştirme, çevrimdışı mod (4 test) |
| [cypress/e2e/growth.cy.ts](cypress/e2e/growth.cy.ts) | Beceri haritası, azalan destek, tahmin, defter ve aralıklı tekrar (5 test) |
| [app/src/skills.ts](app/src/skills.ts) | Beceri modeli: konular, kademeler, puan kuralları, tekrar aralıkları |
| [app/src/pusula/model.ts](app/src/pusula/model.ts) | Pusula veri modeli, JSON şemaları, yönlendirme denetimi, çevrimdışı harita |
| `app/` | AI Studio'dan dışa aktarılan, düzeltilip geliştirilen uygulama kodu |

## AI Studio çıktısında yapılan düzeltmeler

| Sorun | Düzeltme |
|---|---|
| Deneyimli seviyede 60 sn sayaç her saniye kendini sıfırlıyordu, süre hiç dolmuyordu | Geri çağırmalar `ref`'te tutuldu, sayaç yalnızca karar değişince yeniden başlar (`DecisionScreen.tsx`) |
| Saat 08:10 / 08:30 gibi değerlerle koda gömülüydü | `scenario.json` dakikalarından hesaplanıyor (`App.tsx`) |
| "MIMARI" başlığı (Türkçe büyük harf hatası) | `toLocaleUpperCase('tr-TR')` |
| Tutor yalnızca prompt kuralına güveniyordu | Sunucuda cevap sızıntısı denetimi (`server.ts`, `guardReply`) |
| Ayar ekranı olmadığı hâlde "ayarlarından güncelleyebilirsin" yazıyordu | Kaldırıldı; yerine gizlilik notu ve "Günlüğü sıfırla" |
| `npm install` esbuild sürüm çakışmasıyla başarısız oluyordu | `esbuild` `^0.28.0` |

## Çalıştırma ve test

Uygulamayı yerelde başlat (tutor için `app/.env` içine `GEMINI_API_KEY` koy; anahtar yoksa tutor yedek mesaj verir, oyun çalışır):

```bash
cd app && npm install && npm run dev
```

Ayrı bir terminalde, repo kökünde Cypress'i kur ve koş:

```bash
npm install
```

```bash
npm run cy:run
```

Uygulama 3000 dışında bir portta açılırsa: `CYPRESS_BASE_URL=http://localhost:5173 npm run cy:run`. Videolar `cypress/videos/` altına düşer; 60 sn demo buradan kesilir.

## Ürün kararı: yapmadığım 3 özellik

1. **Kullanıcı hesabı ve bulut senkronizasyonu** — Öğrenme günlüğü cihazda tutuluyor; giriş ekranı, öğrenme anına gelmeden oyuncuyu kaybettirir ve sağlık temalı bir uygulamada gereksiz kişisel veri toplar.
2. **Tutor'un doğru cevabı en sonda açıklaması** — Cevabı vermek, oyuncunun araştırma noktalarını kendi başına kovalama motivasyonunu öldürür; ürünün tek farkı budur.
3. **Zayıf konuya göre otomatik kriz üreteci** — Yapay zekânın ürettiği senaryoların doğruluğu ve iki sonunun adil olup olmadığı eval edilmeden öğrenciye sunulamaz; elle yazılmış, 8 yolu test edilmiş tek senaryo daha güvenilirdir.

**Pusula neden ikinci bir senaryo değil:** Ödev ikinci bölümü kapsam dışı tutuyor ve SE Primer'da hâlâ tek bir sabit senaryo var (08:00 randevu krizi). Pusula sabit bir hikâye, puanlanan son ya da "doğru yol" üretmez. Örnek krizde öğretilen düşünme biçimini (mantık → varış → risk → koşul → araştır) öğrencinin kendi sorusuna uygular, cevabı yine öğrenciye bırakır. Bu yüzden ayrı bir eval ve Cypress testleriyle (KÖ-7, KÖ-9) sınırları belirlenmiş bir **araç** olarak eklendi; senaryo kapsamı genişletilmedi.

## Kaynaklar

Ödev kaynakçası: Stephenson (1995) *The Diamond Age*; GitHub Spec Kit; Google Stitch ve AI Studio; Cypress belgeleri; Sommerville (2016) Bölüm 5; 6698 sayılı KVKK.
