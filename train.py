"""SE Primer v2 — zorlanma modeli: eğit → ölç → eval kapısı → ONNX + config.json + model kartı.

    python train.py                  # data/oturumlar.csv (gerçek + sentetik)
    python train.py --kaynak gercek  # yalnız gerçek satırlarla (kapıyı geçemeyebilir; dürüst ölçüm)

Tekrarlanabilirlik: sabit TOHUM, oturuma göre sabit bölme, sabit sürümler (requirements.txt).
Eval kapısı (spec.md §8.4): eşiklerden biri tutmazsa çıkış kodu 1, model/ klasörüne DOKUNULMAZ
(önceki yayınlanmış artefakt yerinde kalır).
"""
from __future__ import annotations

import sys as _sys

# Windows konsolu (cp1254) ✓/✗ karakterlerini yazamaz
if hasattr(_sys.stdout, "reconfigure"):
    _sys.stdout.reconfigure(encoding="utf-8")

import argparse
import hashlib
import json
import shutil
import sys
import tempfile
from pathlib import Path

import numpy as np
import pandas as pd
import sklearn
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, recall_score, roc_auc_score
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

TOHUM = 42
SURUM = "2.1.0"
BURASI = Path(__file__).resolve().parent
VERI = BURASI / "data" / "oturumlar.csv"
MODEL_DIR = BURASI / "model"
HEDEF = "zorlandi"

# Sözleşme: sıra değişirse tüm tüketiciler (web, Python kahini, sunucu) yanlış girdi verir.
FEATURES = [
    ("karar_no", "Nöbetteki karar sırası", "1–3"),
    ("konu_puani", "Kararın konusundaki beceri puanı", "puan 0–100"),
    ("sure_baskisi", "Kurala göre sayaç açık mı", "0/1"),
    ("onceki_karar_suresi_sn", "Önceki kararda geçen süre (K1'de 0)", "saniye"),
    ("onceki_gidip_gelme", "Önceki kararda A↔B geçişi (K1'de 0)", "adet"),
    ("onceki_riskli_sayisi", "Bu nöbette şimdiye kadarki B / süre aşımı", "adet"),
    ("ipucu_sayisi", "Bu nöbette açılan ipucu", "adet"),
    ("tutor_mesaj_sayisi", "Bu nöbette tutor'a sorulan soru", "adet"),
    ("gecmis_riskli_oran", "Önceki nöbetlerde riskli karar oranı", "oran 0–1"),
]
ADLAR = [f[0] for f in FEATURES]

# spec.md §8 — eğitimden ÖNCE yazıldı; burada yalnızca okunur, gevşetilmez.
KARAR_ESIGI = 0.50
KAPI = {"auc_min": 0.70, "recall_min": 0.60, "taban_ustu_min": 0.0}
ONNX_TOLERANS = 1e-4


def bol(df: pd.DataFrame):
    """Oturuma göre böl: aynı oturumun kararları hem eğitimde hem testte olmaz (sızıntı yok)."""
    gss = GroupShuffleSplit(n_splits=1, test_size=0.3, random_state=TOHUM)
    tr, te = next(gss.split(df, df[HEDEF], groups=df["oturum_id"]))
    return df.iloc[tr], df.iloc[te]


def olc(y, p) -> dict:
    if len(set(y)) < 2:
        return {"n": int(len(y)), "auc": None, "recall": None, "accuracy": None}
    return {
        "n": int(len(y)),
        "auc": round(float(roc_auc_score(y, p)), 4),
        "recall": round(float(recall_score(y, (p >= KARAR_ESIGI).astype(int))), 4),
        "accuracy": round(float(accuracy_score(y, (p >= KARAR_ESIGI).astype(int))), 4),
    }


def onnx_aktar(model, X_ornek: pd.DataFrame, hedef: Path) -> float:
    """model.onnx yazar ve sklearn ile farkını döndürür (başlangıç reposundaki onnx_aktar'ın uyarlaması)."""
    import onnxruntime as ort
    from skl2onnx import to_onnx
    from skl2onnx.common.data_types import FloatTensorType

    onx = to_onnx(model, initial_types=[("input", FloatTensorType([None, X_ornek.shape[1]]))],
                  options={id(model): {"zipmap": False}}, target_opset=17)
    hedef.write_bytes(onx.SerializeToString())
    oturum = ort.InferenceSession(str(hedef))
    p_onnx = oturum.run(["probabilities"], {"input": X_ornek.to_numpy(np.float32)})[0]
    return float(np.abs(p_onnx - model.predict_proba(X_ornek)).max())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--kaynak", choices=["hepsi", "gercek"], default="hepsi")
    args = ap.parse_args()

    if not VERI.exists():
        sys.exit("✗ data/oturumlar.csv yok. Önce: python data/veri_hazirla.py")
    ham = VERI.read_bytes()
    df = pd.read_csv(VERI)
    if args.kaynak == "gercek":
        df = df[df["kaynak"] == "gercek"]
    df = df.dropna(subset=ADLAR + [HEDEF]).reset_index(drop=True)
    if df["oturum_id"].nunique() < 5:
        sys.exit(f"✗ yetersiz veri: {df['oturum_id'].nunique()} oturum")

    egitim, test = bol(df)
    X_tr, y_tr = egitim[ADLAR].astype(float), egitim[HEDEF].astype(int)
    X_te, y_te = test[ADLAR].astype(float), test[HEDEF].astype(int)

    model = Pipeline([
        ("scaler", StandardScaler()),
        ("lr", LogisticRegression(random_state=TOHUM, class_weight="balanced", max_iter=1000)),
    ])
    model.fit(X_tr, y_tr)
    p_te = model.predict_proba(X_te)[:, 1]

    # v1 kural tabanı: destek yalnızca konu puanına bakıyordu → "zorlanma skoru" = 1 − puan/100
    taban = 1 - X_te["konu_puani"].to_numpy() / 100
    metrik = olc(y_te, p_te)
    metrik["taban_auc"] = round(float(roc_auc_score(y_te, taban)), 4) if len(set(y_te)) > 1 else None
    metrik["taban_ustu"] = (round(metrik["auc"] - metrik["taban_auc"], 4)
                            if metrik["auc"] is not None and metrik["taban_auc"] is not None else None)
    gercek_maske = (test["kaynak"] == "gercek").to_numpy()
    metrik_gercek = olc(y_te[gercek_maske], p_te[gercek_maske])

    print(f"veri: {len(df)} satır, {df['oturum_id'].nunique()} oturum "
          f"(gerçek {int((df['kaynak'] == 'gercek').sum())} satır) · eğitim {len(egitim)} / test {len(test)}")
    print(f"test: AUC {metrik['auc']} · recall@{KARAR_ESIGI} {metrik['recall']} · "
          f"accuracy {metrik['accuracy']} · kural tabanı AUC {metrik['taban_auc']}")
    print(f"yalnız gerçek test satırları: {metrik_gercek}")

    # ---- Eval kapısı
    hatalar = []
    if metrik["auc"] is None or metrik["auc"] < KAPI["auc_min"]:
        hatalar.append(f"AUC {metrik['auc']} < {KAPI['auc_min']}")
    if metrik["recall"] is None or metrik["recall"] < KAPI["recall_min"]:
        hatalar.append(f"recall {metrik['recall']} < {KAPI['recall_min']}")
    if metrik["taban_ustu"] is None or metrik["taban_ustu"] <= KAPI["taban_ustu_min"]:
        hatalar.append(f"model kural tabanını geçemedi (fark {metrik['taban_ustu']})")
    if hatalar:
        print("✗ EVAL KAPISI GEÇİLMEDİ — artefakt yazılmadı, model/ değişmedi:")
        for h in hatalar:
            print(f"   - {h}")
        sys.exit(1)
    print("✓ eval kapısı geçildi")

    # ---- Artefakt: önce geçici klasöre, ONNX kontrolü de geçerse model/'e taşı
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        fark = onnx_aktar(model, X_te, tmp / "model.onnx")
        if fark > ONNX_TOLERANS:
            sys.exit(f"✗ ONNX çıktısı sklearn'den sapıyor (maks fark {fark:.2e} > {ONNX_TOLERANS}) — yayın yok")
        print(f"✓ model.onnx: sklearn ile maks fark {fark:.1e}")

        ornek = X_te.iloc[0]
        lr = model.named_steps["lr"]
        config = {
            "name": "se-primer-zorlanma",
            "version": SURUM,
            "description": "SE Primer: oyuncunun sıradaki kararda zorlanma (B seçme / süre aşımı) olasılığı.",
            "target": HEDEF,
            "classes": [str(c) for c in model.classes_],
            "class_labels": {"0": "zorlanmadı (A seçti)", "1": "zorlandı (B seçti veya süre doldu)"},
            "output": {"name": "probabilities", "index": 1, "meaning": "P(zorlandi = 1)"},
            "decision_threshold": KARAR_ESIGI,
            "decision_rule": "p >= decision_threshold → destek modu: sayaç yok, ipucu açık (yalnızca desteği artırır)",
            "input": {"name": "input", "dtype": "float32", "shape": [None, len(ADLAR)]},
            "features": [
                {"name": n, "label": l, "unit": u, "example": float(ornek[n]),
                 "min": float(df[n].min()), "max": float(df[n].max())}
                for n, l, u in FEATURES
            ],
            "coefficients_standardized": {n: round(float(c), 4) for n, c in zip(ADLAR, lr.coef_[0])},
            "metrics": {"test": metrik, "test_gercek": metrik_gercek},
            "acceptance": {**KAPI, "kaynak": "spec.md §8.4"},
            "onnx_max_abs_diff": float(f"{fark:.2e}"),
            "data": {
                "file": "data/oturumlar.csv",
                "sha256": hashlib.sha256(ham).hexdigest(),
                "rows": int(len(df)),
                "sessions": int(df["oturum_id"].nunique()),
                "rows_by_source": {k: int(v) for k, v in df["kaynak"].value_counts().items()},
                "sessions_by_source": {k: int(v) for k, v in df.groupby("kaynak")["oturum_id"].nunique().items()},
                "positive_rate": round(float(df[HEDEF].mean()), 4),
                "split": "GroupShuffleSplit(test_size=0.3, groups=oturum_id)",
                "kaynak_filtresi": args.kaynak,
            },
            "seed": TOHUM,
            "sklearn_version": sklearn.__version__,
            "python_version": f"{sys.version_info.major}.{sys.version_info.minor}",
        }
        (tmp / "config.json").write_text(json.dumps(config, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        (tmp / "README.md").write_text(model_karti(config), encoding="utf-8")

        MODEL_DIR.mkdir(exist_ok=True)
        for f in ("model.onnx", "config.json", "README.md"):
            shutil.copy(tmp / f, MODEL_DIR / f)
    print(f"✓ artefakt yazıldı → model/ (model.onnx, config.json, README.md)")


def gercek_uyari(mg: dict) -> str:
    if mg["auc"] is None or mg["auc"] >= 0.6:
        return ""
    return (f"\n> ⚠️ **Gerçek oyuncularda işe yaradığına dair kanıt yok.** Yalnız gerçek satırlarda AUC {mg['auc']} "
            "(0.5 = yazı-tura). Kapı, sentetik verinin baskın olduğu karışık test kümesinde geçildi; model büyük "
            "ölçüde sentetik üreticinin varsayımlarını öğreniyor. Bu sürüm ders demosu ve boru hattının "
            "(eğit → ONNX → yayın → parite) uçtan uca doğrulanması için yayınlandı. Gerçek bir sınıfa açılmadan önce "
            "**gölge modda** (`RELEASE.md`) yeterli gerçek veri toplanmalı ve yalnız gerçek veride yeniden ölçülmelidir. "
            "Ek olarak `zorlandi` etiketi zorlanma ile bilinçli keşfi (diğer sonu merak etmek) ayıramıyor (`spec.md §8.5`).\n")


def model_karti(c: dict) -> str:
    m, mg, d = c["metrics"]["test"], c["metrics"]["test_gercek"], c["data"]
    ozellik = "\n".join(f"| {i + 1} | `{f['name']}` | {f['label']} | {f['unit']} |" for i, f in enumerate(c["features"]))
    katsayi = "\n".join(f"| `{k}` | {v:+.3f} |" for k, v in sorted(c["coefficients_standardized"].items(),
                                                                  key=lambda kv: -abs(kv[1])))
    kaynak = ", ".join(f"{k}: {v} satır / {d['sessions_by_source'].get(k, 0)} oturum"
                       for k, v in d["rows_by_source"].items())
    return f"""---
library_name: sklearn
tags:
- onnx
- tabular-classification
- education
- adaptive-learning
pipeline_tag: tabular-classification
license: mit
---

# SE Primer — zorlanma modeli v{c["version"]}

Model kartı (Mitchell vd., 2019 *Model Cards for Model Reporting* başlıklarıyla).

## Amaç
[SE Primer](https://github.com/mervetask990-art/yzm301-se-primer), yazılım mühendisliği öğrencisini bir kriz
senaryosunda karar vermeye koyan bir oyundur. Bu model, **kararın başında**, oyuncunun bu nöbetteki davranışından
**sıradaki kararda zorlanma** (riskli B seçeneği veya süre aşımı) olasılığını tahmin eder.

- `p ≥ {c["decision_threshold"]}` → **destek modu**: geri sayım kaldırılır, ipucu kartı açılır.
- `p < {c["decision_threshold"]}` → v1'in sabit kuralları (konu puanına göre ipucu / sayaç) aynen çalışır.
- Model desteği yalnızca **artırır**; hiçbir oyuncunun desteğini azaltmaz.

## Kullanılmaması gereken durumlar
- Öğrenciyi **notlandırmak, sıralamak veya elemek** için. Model "zorlanma" tahmin eder, yetkinlik ölçmez.
- SE Primer'daki 3 kararlı senaryo dışındaki oyunlar / dersler için (girdiler bu senaryoya özgüdür).
- Kişi hakkında karar veren herhangi bir sistemde (işe alım, sınav, disiplin).
- Klinik veya psikolojik değerlendirme (kararsızlık ölçüsü kaygı teşhisi değildir).

## Model
- `Pipeline(StandardScaler → LogisticRegression(class_weight="balanced"))`, tohum = {c["seed"]}
- Python {c["python_version"]}, scikit-learn {c["sklearn_version"]}, ONNX opset 17
- ONNX ile sklearn arasındaki en büyük olasılık farkı: {c["onnx_max_abs_diff"]} (tolerans 1e-4)

### Girdiler (sıra = sözleşme, `config.json → features`)
| # | Özellik | Anlamı | Birim |
|---|---|---|---|
{ozellik}

Girdi tensörü `input`: float32 `[n, {len(c["features"])}]` · Çıktı `probabilities`: `[n, 2]`, sütun 1 = P(zorlandı).

### Standartlaştırılmış katsayılar (büyükten küçüğe)
| Özellik | Katsayı |
|---|---|
{katsayi}

## Veri
- `data/oturumlar.csv`, sha256 `{d["sha256"][:16]}…`; {d["rows"]} karar, {d["sessions"]} oturum ({kaynak}).
- Bir satır = bir karar; etiket `zorlandi` oyunun kendisinden gelir (elle etiketleme yok). Pozitif oranı {d["positive_rate"]}.
- Gerçek satırlar: arkadaşlara oynatılan oturumlar, kişisel veri yok (rastgele oturum/oyuncu kimliği). Sözlük: `data/SOZLUK.md`.
- Sentetik satırlar: kuralı ve tohumu `data/veri_hazirla.py` ve `README.md`'de.

## Değerlendirme
Bölme: {d["split"]}, tohum {c["seed"]}. Kabul eşikleri eğitimden önce `spec.md §8.4`'te yazıldı.

| Metrik (test) | Değer | Kabul eşiği |
|---|---|---|
| ROC-AUC | {m["auc"]} | ≥ {c["acceptance"]["auc_min"]} |
| Recall (zorlanan, eşik {c["decision_threshold"]}) | {m["recall"]} | ≥ {c["acceptance"]["recall_min"]} |
| Accuracy (eşik {c["decision_threshold"]}) | {m["accuracy"]} | — |
| v1 kural tabanı AUC (`1 − konu_puani/100`) | {m["taban_auc"]} | model bundan iyi olmalı (fark {m["taban_ustu"]}) |
| Test kümesi | {m["n"]} karar | — |

**Yalnız gerçek test satırları:** n = {mg["n"]}, AUC = {mg["auc"]}, recall = {mg["recall"]}.
Gerçek test satırı az olduğu için bu sayının güven aralığı geniştir; kapı karışık test kümesi üzerinde uygulanır.
{gercek_uyari(mg)}

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
"""


if __name__ == "__main__":
    main()
