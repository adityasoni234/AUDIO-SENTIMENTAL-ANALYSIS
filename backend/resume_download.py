"""
Resume DAIC-WOZ download from 633 onward.
Uses curl (handles SSL better than urllib) with automatic retry.
Skips files already extracted.
"""

import os
import tarfile
import threading
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE_URL  = "https://dcapswoz.ict.usc.edu/wwwedaic/data/"
OUT_DIR   = "/Users/ieeesbmac1/Desktop/DAIC-WOZ-Dataset"
AUDIO_DIR = os.path.join(OUT_DIR, "audio")

REMAINING = [
    "633_P","635_P","636_P","637_P","638_P","640_P","641_P",
    "649_P","650_P","651_P","652_P","653_P","654_P","655_P","656_P",
    "657_P","658_P","659_P","660_P","661_P","662_P","663_P","664_P",
    "666_P","667_P","669_P","670_P","673_P","676_P","677_P","679_P",
    "680_P","682_P","683_P","684_P","687_P","688_P","689_P","691_P",
    "692_P","693_P","695_P","696_P","697_P","698_P","699_P","702_P",
    "703_P","705_P","707_P","708_P","709_P","710_P","712_P","713_P",
    "715_P","716_P","717_P","718_P",
]

_lock = threading.Lock()

def log(msg):
    with _lock:
        print(msg, flush=True)


def curl_download(url, dest, retries=5):
    """Download url to dest using curl with retry. Returns True on success."""
    for attempt in range(1, retries + 1):
        result = subprocess.run([
            "curl", "-L", "-k",           # -k = ignore SSL cert errors
            "--retry", "3",
            "--retry-delay", "5",
            "--connect-timeout", "30",
            "--max-time", "900",          # 15 min per file max
            "-o", dest,
            url,
        ], capture_output=True)
        if result.returncode == 0 and os.path.getsize(dest) > 10000:
            return True
        log(f"    curl attempt {attempt} failed (rc={result.returncode}), retrying…")
        try: os.remove(dest)
        except OSError: pass
    return False


def download_and_extract(pid_str):
    pid      = int(pid_str.split("_")[0])
    fname    = f"{pid_str}.tar.gz"
    url      = BASE_URL + fname
    tar_path = os.path.join(OUT_DIR, fname)
    wav_out  = os.path.join(AUDIO_DIR, f"{pid}_INTERVIEW.wav")

    if os.path.exists(wav_out):
        log(f"  [SKIP] {pid} — already have it")
        return pid, True

    log(f"  [DL]   {pid} …")
    if not curl_download(url, tar_path):
        log(f"  [FAIL] {pid} — download failed after retries")
        return pid, False

    try:
        with tarfile.open(tar_path, "r:gz") as tar:
            wav_member = None
            for m in tar.getmembers():
                n = m.name.lower()
                if "interview" in n and n.endswith(".wav"):
                    wav_member = m
                    break
            if wav_member is None:
                for m in tar.getmembers():
                    if m.name.lower().endswith(".wav"):
                        wav_member = m
                        break
            if wav_member:
                wav_member.name = os.path.basename(wav_member.name)
                tar.extract(wav_member, AUDIO_DIR)
                extracted = os.path.join(AUDIO_DIR, os.path.basename(wav_member.name))
                if extracted != wav_out:
                    os.rename(extracted, wav_out)
                log(f"  [OK]   {pid}")
            else:
                log(f"  [WARN] {pid} — no wav in archive")
                return pid, False
    except Exception as e:
        log(f"  [FAIL] {pid} extract — {e}")
        return pid, False
    finally:
        try: os.remove(tar_path)
        except OSError: pass

    return pid, True


def main():
    os.makedirs(AUDIO_DIR, exist_ok=True)

    existing = set()
    for f in os.listdir(AUDIO_DIR):
        try: existing.add(int(f.split("_")[0]))
        except ValueError: pass

    to_download = [p for p in REMAINING if int(p.split("_")[0]) not in existing]
    print(f"Files to download: {len(to_download)}  (skipping {len(REMAINING)-len(to_download)} already present)")

    ok = fail = 0
    # Use 2 workers to avoid hammering the server
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = {pool.submit(download_and_extract, p): p for p in to_download}
        for fut in as_completed(futures):
            _, success = fut.result()
            if success: ok += 1
            else: fail += 1
            log(f"  Progress: {ok+fail}/{len(to_download)}  ok={ok}  fail={fail}")

    print(f"\nDone. {ok} succeeded, {fail} failed.")
    print(f"Total audio files in dataset: {len(os.listdir(AUDIO_DIR))}")


if __name__ == "__main__":
    main()
