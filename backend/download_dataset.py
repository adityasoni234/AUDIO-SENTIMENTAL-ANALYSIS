"""
DAIC-WOZ Full Dataset Downloader + Extractor
Downloads all participant tar.gz files, extracts audio (.wav), builds labels.csv

Usage:
    python3 download_dataset.py
"""

import os
import csv
import tarfile
import threading
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE_URL   = "https://dcapswoz.ict.usc.edu/wwwedaic/data/"
LABELS_URL = "https://dcapswoz.ict.usc.edu/wwwedaic/labels/Detailed_PHQ8_Labels.csv"
OUT_DIR    = "/Users/ieeesbmac1/Desktop/DAIC-WOZ-Dataset"
AUDIO_DIR  = os.path.join(OUT_DIR, "audio")
LABELS_OUT = os.path.join(OUT_DIR, "labels.csv")

PHQ_THRESHOLD = 10   # PHQ-8 ≥ 10 = Depressed

ALL_FILES = [
    "300_P","301_P","302_P","303_P","304_P","305_P","306_P","307_P","308_P","309_P",
    "310_P","311_P","312_P","313_P","314_P","315_P","316_P","317_P","318_P","319_P",
    "320_P","321_P","322_P","323_P","324_P","325_P","326_P","327_P","328_P","329_P",
    "330_P","331_P","332_P","333_P","334_P","335_P","336_P","337_P","338_P","339_P",
    "340_P","341_P","343_P","344_P","345_P","346_P","347_P","348_P","349_P","350_P",
    "351_P","352_P","353_P","354_P","355_P","356_P","357_P","358_P","359_P","360_P",
    "361_P","362_P","363_P","364_P","365_P","366_P","367_P","368_P","369_P","370_P",
    "371_P","372_P","373_P","374_P","375_P","376_P","377_P","378_P","379_P","380_P",
    "381_P","382_P","383_P","384_P","385_P","386_P","387_P","388_P","389_P","390_P",
    "391_P","392_P","393_P","395_P","396_P","397_P","399_P","400_P","401_P","402_P",
    "403_P","404_P","405_P","406_P","407_P","408_P","409_P","410_P","411_P","412_P",
    "413_P","414_P","415_P","416_P","417_P","418_P","419_P","420_P","421_P","422_P",
    "423_P","424_P","425_P","426_P","427_P","428_P","429_P","430_P","431_P","432_P",
    "433_P","434_P","435_P","436_P","437_P","438_P","439_P","440_P","441_P","442_P",
    "443_P","444_P","445_P","446_P","447_P","448_P","449_P","450_P","451_P","452_P",
    "453_P","454_P","455_P","456_P","457_P","458_P","459_P","461_P","462_P","463_P",
    "464_P","465_P","466_P","467_P","468_P","469_P","470_P","471_P","472_P","473_P",
    "474_P","475_P","476_P","477_P","478_P","479_P","480_P","481_P","482_P","483_P",
    "484_P","485_P","486_P","487_P","488_P","489_P","490_P","491_P","492_P",
    "600_P","601_P","602_P","603_P","604_P","605_P","606_P","607_P","608_P","609_P",
    "612_P","615_P","617_P","618_P","619_P","620_P","622_P","623_P","624_P","625_P",
    "626_P","627_P","628_P","629_P","631_P","632_P","633_P","634_P","635_P","636_P",
    "637_P","638_P","640_P","641_P","649_P","650_P","651_P","652_P","653_P","654_P",
    "655_P","656_P","657_P","658_P","659_P","660_P","661_P","662_P","663_P","664_P",
    "666_P","667_P","669_P","670_P","673_P","676_P","677_P","679_P","680_P","682_P",
    "683_P","684_P","687_P","688_P","689_P","691_P","692_P","693_P","695_P","696_P",
    "697_P","698_P","699_P","702_P","703_P","705_P","707_P","708_P","709_P","710_P",
    "712_P","713_P","715_P","716_P","717_P","718_P",
]

_print_lock = threading.Lock()

def log(msg):
    with _print_lock:
        print(msg, flush=True)


def download_and_extract(pid_str):
    """Download one participant tar.gz, extract only the _INTERVIEW.wav, delete archive."""
    pid    = int(pid_str.split("_")[0])
    fname  = f"{pid_str}.tar.gz"
    url    = BASE_URL + fname
    tar_path = os.path.join(OUT_DIR, fname)
    wav_out  = os.path.join(AUDIO_DIR, f"{pid}_INTERVIEW.wav")

    if os.path.exists(wav_out):
        log(f"  [SKIP] {pid} — already extracted")
        return pid, True

    # Download
    try:
        urllib.request.urlretrieve(url, tar_path)
    except Exception as e:
        log(f"  [FAIL] {pid} download — {e}")
        return pid, False

    # Extract only the interview wav
    try:
        with tarfile.open(tar_path, "r:gz") as tar:
            for member in tar.getmembers():
                name = member.name.lower()
                if "interview" in name and name.endswith(".wav"):
                    member.name = os.path.basename(member.name)
                    tar.extract(member, AUDIO_DIR)
                    extracted = os.path.join(AUDIO_DIR, os.path.basename(member.name))
                    if extracted != wav_out:
                        os.rename(extracted, wav_out)
                    log(f"  [OK] {pid} → {wav_out}")
                    break
            else:
                # Fallback: extract first wav found
                for member in tar.getmembers():
                    if member.name.lower().endswith(".wav"):
                        member.name = f"{pid}_INTERVIEW.wav"
                        tar.extract(member, AUDIO_DIR)
                        log(f"  [OK-fallback] {pid}")
                        break
    except Exception as e:
        log(f"  [FAIL] {pid} extract — {e}")
        return pid, False
    finally:
        try:
            os.remove(tar_path)
        except OSError:
            pass

    return pid, True


def download_labels():
    """Download Detailed_PHQ8_Labels.csv and write simplified labels.csv."""
    import io
    log("Downloading PHQ-8 labels...")
    raw = urllib.request.urlopen(LABELS_URL).read().decode("utf-8")
    reader = csv.DictReader(io.StringIO(raw))

    rows = []
    for row in reader:
        try:
            pid   = int(row.get("Participant_ID") or row.get("participant_ID") or list(row.values())[0])
            total = int(float(row.get("PHQ_8Total") or row.get("PHQ8_Total") or 0))
            label = "Depressed" if total >= PHQ_THRESHOLD else "Non-Depressed"
            rows.append((pid, total, label))
        except (ValueError, KeyError):
            continue

    with open(LABELS_OUT, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["Participant_ID", "PHQ_Score", "Label"])
        for r in rows:
            w.writerow(r)

    dep = sum(1 for r in rows if r[2] == "Depressed")
    log(f"Labels saved → {LABELS_OUT}  ({len(rows)} participants, {dep} depressed)")
    return {r[0]: r[1] for r in rows}


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(AUDIO_DIR, exist_ok=True)

    # 1. Labels
    download_labels()

    # 2. Audio files — parallel download (4 workers to be polite to server)
    log(f"\nDownloading {len(ALL_FILES)} participant archives → {OUT_DIR}")
    log("This will take a long time (full dataset ~80-100 GB). Progress is saved — safe to interrupt and resume.\n")

    ok = fail = 0
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(download_and_extract, p): p for p in ALL_FILES}
        for fut in as_completed(futures):
            _, success = fut.result()
            if success:
                ok += 1
            else:
                fail += 1
            log(f"  Progress: {ok+fail}/{len(ALL_FILES)}  (ok={ok} fail={fail})")

    log(f"\nDone. {ok} succeeded, {fail} failed.")
    log(f"Audio files: {AUDIO_DIR}")
    log(f"Labels:      {LABELS_OUT}")


if __name__ == "__main__":
    main()
