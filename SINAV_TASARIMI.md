# Sizinle uyumlanan sınav tasarımı (vize hazırlık)

> Taslak Claude Code ile birlikte kuruldu; senaryo, çeldiriciler ve puanlama bu projede **yaşadığımız** sorunlardan
> seçildi. Son hâli kendi kelimelerimle düzenledim.

## Tasarım ilkesi

Ders provasındaki sınav "300 girdilik diferansiyel test nedir?" diye sorabilirdi; bu ezberle cevaplanır. Primer
oyuncuyla uyumlandığı gibi sınav da öğrenciyle uyumlanmalı: **tek bir somut senaryo**, öğrencinin kendi kurduğu
sisteme benzer, ve cevabı tek kelime değil **gerekçe** olan sorular. Bilinen terimi söylemek puan getirmez; terimi
yanlış yere koymak puan götürür.

## Soru (60 dk, kapalı kitap, 1 sayfa)

Bir ekip, öğrencinin kod sorusunda **takılıp takılmayacağını** tahmin eden küçük bir lojistik regresyon modeli eğitti
ve `model.onnx` olarak üç yere koydu: tarayıcı (`onnxruntime-web`), Android uygulaması ve bir Python servisi.
Python'da `p = 0.7312`, tarayıcıda `p = 0.7309` çıkıyor. Ekip "eğitim doğruluğu %94, model doğru" diyor ve
`main` dalındaki model URL'siyle yayına çıkmak istiyor.

**a) (25p)** 300 rastgele girdiyle Python ile tarayıcıyı karşılaştıran bir test yazacaksınız. Bu testte **test kahini
(oracle)** hangisidir ve neden? `|Δ| = 3·10⁻⁴` farkı **hata mı**? Toleransı neye göre seçersiniz (float32,
çalışma zamanı, kararın eşiğe uzaklığı)? Bir girdi eşiğin (0.5) tam yanındaysa tolerans içindeki bir fark bile neyi
değiştirebilir?

**b) (25p)** "Eğitim doğruluğu %94" cümlesinde **doğrulama (verification)** ile **geçerleme (validation)** hangi
noktada karışıyor? Bu modelin "doğru inşa edildiğini" ve "doğru şeyi inşa ettiğini" ayrı ayrı nasıl kanıtlarsınız?
Hangisi parite testiyle, hangisi gerçek öğrencilerle yapılır?

**c) (25p)** Model güncellendi; eski 20 E2E testi geçiyor, 21. adımda öğrenci her soruda ipucu görmeye başladı.
Bu bir **regresyon** mu? Güncellemeden önce hangi **karakterizasyon testi** yazılmış olsaydı bunu yakalardı?

**d) (25p)** `main` dalı yerine neden **commit'e sabit URL**? Yeni modeli **gölge → %5 kanarya → aşamalı** açacaksınız:
gölge aşamasında hangi veriyi toplarsınız ve neden bu veri, yeni sürümü eğitmek için tam yayındaki veriden daha
temizdir?

## Beklenen temel kavramlar ve çeldiriciler

| Kısım | Beklenen öz | Çeldirici (puan götürür) |
|---|---|---|
| a | Kahin = referans uygulama (Python/sklearn), ama kahin de hatalı olabilir; tolerans float32 hassasiyeti ve karar eşiğine göre seçilir; 3·10⁻⁴ > 10⁻⁴ ise ya tolerans ya girdi dönüşümü (sıra, tip) incelenir | "Farklılık yuvarlamadır, önemsiz" (gerekçesiz); toleransı test geçsin diye büyütmek |
| b | Doğrulama = spesifikasyona uygunluk (parite, sözleşme, birim testi); geçerleme = gerçek ihtiyacı karşılıyor mu (gerçek öğrenci, hold-out, eşik önceden yazılmış) | Eğitim doğruluğunu geçerleme sanmak; test verisine bakıp eşiği sonradan ayarlamak |
| c | Evet, regresyon: önceden çalışan davranış bozuldu; karakterizasyon testi = mevcut davranışı (ipucu oranı, kaç kararda destek) "doğru mu" sormadan kayda almak | "Testler geçti, sorun yok"; regresyonu yalnız çökme sanmak |
| d | Sürümleme / yeniden üretilebilirlik / rollback; gölgede model müdahale etmediği için etiketler modelin kendi etkisinden (geri besleme döngüsü) arınmış | "main her zaman en günceli verir, daha iyi"; kanaryayı A/B testiyle tamamen aynı saymak |

## Puanlama

Her kısımda: **kavramı doğru yere koymak (10p) + bu senaryoya özgü gerekçe (10p) + bir sınır / karşı örnek (5p)**.
Tanım ezberi tek başına en fazla 5p alır. "Bilmiyorum ama şöyle ölçerdim" diye mantıklı bir ölçüm öneren cevap,
doğru terimi gerekçesiz yazan cevaptan fazla puan alır. Bu, Primer'ın "cevabı değil, araştırma noktasını göster"
ilkesinin sınavdaki karşılığıdır.
