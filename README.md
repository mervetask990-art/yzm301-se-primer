# SE Primer

**Yazılım mühendisliği, oynanan bir kitap.** Her seçim bir durum geçişi, her son bir kabul kriteri.

**Pusula (ana mod):** Kendi sorunu veya krizini yaz ("Canlıda sorgular yavaşladı", "Mikroservise geçmeli miyiz?"). Pusula cevap vermez: önce seni anlamak için soru sorar, sonra yol haritası çıkarır. Her yol için **hangi mantıkla** seçildiğini, **o yoldan gidersen nereye varacağını**, riskini ve **hangi koşulda anlamlı olduğunu** gösterir. Bir yol seçtikçe harita derinleşir; geri dönüp "başka bir senaryodan geçseydim?" diye diğer dalı deneyebilir, kendi yolunu ekleyip aynı biçimde analiz ettirebilirsin. Sonunda cevabı sen yazarsın.

**Seninle büyür:** Primer altı konuda (deploy, test, güvenlik, gözlemlenebilirlik, performans, ekip) ustalığını kanıttan ölçer ve ana ekranda radar olarak gösterir. Bir konuda güçlendikçe o konudaki destek azalır: ipuçları kapanır, süre kısalır, Pusula sonucu göstermeden önce **tahminini** ister ve tahmin isabetinin zamanla nasıl değiştiğini gösterir. Araştırdığın kavramları **kendi kelimelerinle** deftere yazarsın; 1, 3, 7 ve 14 gün sonra geri gelir, eski notuna bakmadan yeniden açıklarsın.

**Örnek kriz:** Oyuncu 08:00'de çöken bir hastane randevu sisteminin nöbetçi mühendisidir. Üç karar verir (mimari, test, KVKK); uygulama her kararın teknik sonucunu gösterir ve **cevabı değil, araştırılacak kavramları** verir. AI tutor ipucu verir, cevabı vermez.

**Seninle birlikte öğrenir:** Her nöbet cihazdaki bir öğrenme günlüğüne yazılır. Bir sonraki nöbette Primer seni adınla karşılar, en çok risk aldığın kararı ve sıradaki araştırmanı hatırlatır, hazırsan seviye atlamayı önerir; tutor da araştırdığın kavramlar ve kendi notun üzerinden soru sorar.

| | Link |
|---|---|
| Çalışan uygulama (AI Studio) | [ai.studio/apps/d17850a4-…](https://ai.studio/apps/d17850a4-60ef-4c0a-9474-516a887f8330?fullscreenApplet=true) |
| Demo video (60 sn, Cypress) | `<video linki>` |
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
3. **İkinci senaryo** — Tek senaryonun 8 yolunu test ve eval ile sağlamlaştırmak, yarım test edilmiş iki senaryodan daha değerlidir.

## Kaynaklar

Ödev kaynakçası: Stephenson (1995) *The Diamond Age*; GitHub Spec Kit; Google Stitch ve AI Studio; Cypress belgeleri; Sommerville (2016) Bölüm 5; 6698 sayılı KVKK.
