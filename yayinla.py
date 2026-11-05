"""model/ klasörünü Hugging Face model reposuna yayınlar ve tüketicileri o COMMIT'E sabitler.

    hf auth login                     # bir kez, "Write" token ile (token'ı siz girersiniz)
    python yayinla.py --repo <kullanici>/se-primer-zorlanma

Yaptıkları:
  1. Repo yoksa public olarak açar (ücretsiz katman).
  2. model.onnx + config.json + README.md'yi tek commit'le yükler, `v<sürüm>` etiketi ekler.
  3. app/src/model-source.json'a repo + commit yazar → web uygulaması ve sunucu bu commit'ten indirir.
  4. RELEASE.md'deki sürüm geçmişi tablosuna satır ekler (rollback için önceki commit burada kalır).

Rollback: python yayinla.py --geri-al <eski_commit>   (yalnızca model-source.json'u eski commit'e çevirir)
"""
from __future__ import annotations

import sys as _sys

# Windows konsolu (cp1254) ✓/✗ karakterlerini yazamaz
if hasattr(_sys.stdout, "reconfigure"):
    _sys.stdout.reconfigure(encoding="utf-8")

import argparse
import datetime as dt
import json
import sys
from pathlib import Path

KOK = Path(__file__).resolve().parent
MODEL = KOK / "model"
KAYNAK = KOK / "app" / "src" / "model-source.json"
RELEASE = KOK / "RELEASE.md"
ISARET = "<!-- surum-gecmisi -->"


def kaynak_yaz(repo: str, commit: str, surum: str):
    KAYNAK.write_text(json.dumps({"repo": repo, "commit": commit, "version": surum}, indent=2) + "\n", encoding="utf-8")
    print(f"✓ {KAYNAK.relative_to(KOK)} → {repo}@{commit[:12]}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", help="<kullanici>/<repo>")
    ap.add_argument("--geri-al", metavar="COMMIT", help="tüketicileri önceki bir commit'e döndür")
    args = ap.parse_args()

    eski = json.loads(KAYNAK.read_text(encoding="utf-8"))
    if args.geri_al:
        if not eski.get("repo"):
            sys.exit("✗ model-source.json'da repo yok")
        kaynak_yaz(eski["repo"], args.geri_al, f"geri-alindi-{args.geri_al[:7]}")
        print("→ uygulamayı yeniden derleyip yayınlayın; parite testini --hub ile koşun")
        return
    if not args.repo:
        sys.exit("✗ --repo <kullanici>/<repo> gerekli")

    from huggingface_hub import HfApi

    config = json.loads((MODEL / "config.json").read_text(encoding="utf-8"))
    surum = config["version"]
    api = HfApi()
    api.create_repo(args.repo, repo_type="model", private=False, exist_ok=True)
    info = api.upload_folder(
        repo_id=args.repo,
        folder_path=str(MODEL),
        allow_patterns=["model.onnx", "config.json", "README.md"],
        commit_message=f"v{surum}: AUC {config['metrics']['test']['auc']}, veri sha256 {config['data']['sha256'][:12]}",
    )
    commit = info.oid
    try:
        api.create_tag(args.repo, tag=f"v{surum}", revision=commit, exist_ok=True)
    except TypeError:  # eski huggingface_hub sürümleri exist_ok almaz
        api.create_tag(args.repo, tag=f"v{surum}", revision=commit)
    except Exception as e:  # etiket zaten varsa yayın yine geçerlidir
        print(f"! etiket eklenemedi: {e}")

    url = f"https://huggingface.co/{args.repo}/resolve/{commit}/model.onnx"
    print(f"✓ yayınlandı: {url}")
    kaynak_yaz(args.repo, commit, surum)

    m, d = config["metrics"]["test"], config["data"]
    satir = (f"| v{surum} | {dt.date.today()} | [`{commit[:12]}`](https://huggingface.co/{args.repo}/tree/{commit}) "
             f"| {m['auc']} | {m['recall']} | {d['sessions_by_source'].get('gercek', 0)} gerçek / "
             f"{d['sessions_by_source'].get('sentetik', 0)} sentetik oturum | `{eski.get('commit', '')[:12] or '—'}` |")
    metin = RELEASE.read_text(encoding="utf-8")
    if ISARET in metin:
        # işaret tablonun hemen altında durur; yeni satır tablonun sonuna eklenir
        RELEASE.write_text(metin.replace("\n" + ISARET, "\n" + satir + "\n" + ISARET, 1), encoding="utf-8")
        print("✓ RELEASE.md sürüm geçmişine eklendi")


if __name__ == "__main__":
    main()
