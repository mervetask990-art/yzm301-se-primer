---
library_name: sklearn
tags:
- onnx
- tabular-classification
- education
- adaptive-learning
pipeline_tag: tabular-classification
license: mit
---

# SE Primer — zorlanma modeli v2.1.0

Model kartı (Mitchell vd., 2019 *Model Cards for Model Reporting* başlıklarıyla).

## Amaç
[SE Primer](https://github.com/mervetask990-art/yzm301-se-primer), yazılım mühendisliği öğrencisini bir kriz
senaryosunda karar vermeye koyan bir oyundur. Bu model, **kararın başında**, oyuncunun bu nöbetteki davranışından
**sıradaki kararda zorlanma** (riskli B seçeneği veya süre aşımı) olasılığını tahmin eder.

- `p ≥ 0.5` → **destek modu**: geri sayım kaldırılır, ipucu kartı açılır.
- `p < 0.5` → v1'in sabit kuralları (konu puanına göre ipucu / sayaç) aynen çalışır.
- Model desteği yalnızca **artırır**; hiçbir oyuncunun desteğini azaltmaz.

## Kullanılmaması gereken durumlar
- Öğrenciyi **notlandırmak, sıralamak veya elemek** için. Model "zorlanma" tahmin eder, yetkinlik ölçmez.
- SE Primer'daki 3 kararlı senaryo dışındaki oyunlar / dersler için (girdiler bu senaryoya özgüdür).
- Kişi hakkında karar veren herhangi bir sistemde (işe alım, sınav, disiplin).
- Klinik veya psikolojik değerlendirme (kararsızlık ölçüsü kaygı teşhisi değildir).

## Model
- `Pipeline(StandardScaler → LogisticRegression(class_weight="balanced"))`, tohum = 42
- Python 3.11, scikit-learn 1.9.1, ONNX opset 17
- ONNX ile sklearn arasındaki en büyük olasılık farkı: 8.74e-08 (tolerans 1e-4)

### Girdiler (sıra = sözleşme, `config.json → features`)
| # | Özellik | Anlamı | Birim |
|---|---|---|---|
| 1 | `karar_no` | Nöbetteki karar sırası | 1–3 |
| 2 | `konu_puani` | Kararın konusundaki beceri puanı | puan 0–100 |
| 3 | `sure_baskisi` | Kurala göre sayaç açık mı | 0/1 |
| 4 | `onceki_karar_suresi_sn` | Önceki kararda geçen süre (K1'de 0) | saniye |
| 5 | `onceki_gidip_gelme` | Önceki kararda A↔B geçişi (K1'de 0) | adet |
| 6 | `onceki_riskli_sayisi` | Bu nöbette şimdiye kadarki B / süre aşımı | adet |
| 7 | `ipucu_sayisi` | Bu nöbette açılan ipucu | adet |
| 8 | `tutor_mesaj_sayisi` | Bu nöbette tutor'a sorulan soru | adet |
| 9 | `gecmis_riskli_oran` | Önceki nöbetlerde riskli karar oranı | oran 0–1 |

Girdi tensörü `input`: float32 `[n, 9]` · Çıktı `probabilities`: `[n, 2]`, sütun 1 = P(zorlandı).

### Standartlaştırılmış katsayılar (büyükten küçüğe)
| Özellik | Katsayı |
|---|---|
| `onceki_karar_suresi_sn` | +0.719 |
| `gecmis_riskli_oran` | +0.567 |
| `karar_no` | -0.287 |
| `konu_puani` | +0.279 |
| `onceki_riskli_sayisi` | -0.112 |
| `tutor_mesaj_sayisi` | +0.063 |
| `ipucu_sayisi` | -0.050 |
| `sure_baskisi` | -0.029 |
| `onceki_gidip_gelme` | -0.018 |

## Veri
- `data/oturumlar.csv`, sha256 `2d1547bf75e2a7d4…`; 1965 karar, 655 oturum (sentetik: 1905 satır / 635 oturum, gercek: 60 satır / 20 oturum).
- Bir satır = bir karar; etiket `zorlandi` oyunun kendisinden gelir (elle etiketleme yok). Pozitif oranı 0.4743.
- Gerçek satırlar: arkadaşlara oynatılan oturumlar, kişisel veri yok (rastgele oturum/oyuncu kimliği). Sözlük: `data/SOZLUK.md`.
- Sentetik satırlar: kuralı ve tohumu `data/veri_hazirla.py` ve `README.md`'de.

## Değerlendirme
Bölme: GroupShuffleSplit(test_size=0.3, groups=oturum_id), tohum 42. Kabul eşikleri eğitimden önce `spec.md §8.4`'te yazıldı.

| Metrik (test) | Değer | Kabul eşiği |
|---|---|---|
| ROC-AUC | 0.7269 | ≥ 0.7 |
| Recall (zorlanan, eşik 0.5) | 0.6043 | ≥ 0.6 |
| Accuracy (eşik 0.5) | 0.6684 | — |
| v1 kural tabanı AUC (`1 − konu_puani/100`) | 0.4194 | model bundan iyi olmalı (fark 0.3075) |
| Test kümesi | 591 karar | — |

**Yalnız gerçek test satırları:** n = 18, AUC = 0.4625, recall = 0.5.
Gerçek test satırı az olduğu için bu sayının güven aralığı geniştir; kapı karışık test kümesi üzerinde uygulanır.

> ⚠️ **Gerçek oyuncularda işe yaradığına dair kanıt yok.** Yalnız gerçek satırlarda AUC 0.4625 (0.5 = yazı-tura). Kapı, sentetik verinin baskın olduğu karışık test kümesinde geçildi; model büyük ölçüde sentetik üreticinin varsayımlarını öğreniyor. Bu sürüm ders demosu ve boru hattının (eğit → ONNX → yayın → parite) uçtan uca doğrulanması için yayınlandı. Gerçek bir sınıfa açılmadan önce **gölge modda** (`RELEASE.md`) yeterli gerçek veri toplanmalı ve yalnız gerçek veride yeniden ölçülmelidir. Ek olarak `zorlandi` etiketi zorlanma ile bilinçli keşfi (diğer sonu merak etmek) ayıramıyor (`spec.md §8.5`).


## Sınırlar ve etik notlar
- **Sentetik veri baskın.** Sentetik veri, gizli bir "kararsızlık" eğiliminin süreye ve gidip gelmeye yansıdığı
  varsayımıyla üretildi. Model bu varsayımı öğrenir; gerçek oyuncularda ilişki daha zayıf olabilir. Gerçek satırlardaki metrik ayrıca raporlanır.
- **Küçük ve homojen gerçek örneklem**: aynı sınıftan birkaç arkadaş; genel öğrenci kitlesini temsil etmez.
- **Geri besleme döngüsü**: destek modu açıldığında oyuncu ipucu görür ve B seçme olasılığı düşer. Sonraki sürüm
  eğitilirken `destek_modu = 1` satırları ayrı değerlendirilmelidir.
- `onceki_gidip_gelme` fare ile dokunmatik ekranda farklı ölçekte ölçülür.
- Yanlış pozitif maliyeti düşüktür (gereksiz ipucu); yanlış negatif v1 davranışına döner. Bu yüzden recall önceliklidir.

## Kullanım
```
https://huggingface.co/<kullanici>/<repo>/resolve/<commit>/model.onnx
```
Tüketiciler `main` dalını değil, **commit'e sabitlenmiş** URL'yi kullanır (bkz. `RELEASE.md`).
