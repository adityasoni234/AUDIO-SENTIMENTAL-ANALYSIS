"""
Download and extract the RAVDESS Audio-Speech dataset from Zenodo.

Zenodo record 1188976 contains a single zip for all 24 actors:
  Audio_Speech_Actors_01-24.zip  (~208 MB)

Usage:
    python download_ravdess.py
    python download_ravdess.py --out ./data/RAVDESS
"""

import argparse
import os
import zipfile
import requests
from tqdm import tqdm

ZENODO_URL = 'https://zenodo.org/records/1188976/files/Audio_Speech_Actors_01-24.zip?download=1'
ZIP_NAME   = 'Audio_Speech_Actors_01-24.zip'


def download_file(url: str, dest: str):
    resp = requests.get(url, stream=True, timeout=120)
    resp.raise_for_status()
    total = int(resp.headers.get('content-length', 0))
    with open(dest, 'wb') as f, tqdm(
        total=total, unit='B', unit_scale=True, desc=ZIP_NAME
    ) as bar:
        for chunk in resp.iter_content(chunk_size=65536):
            f.write(chunk)
            bar.update(len(chunk))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', default='./data/RAVDESS', help='Output directory')
    args = parser.parse_args()

    os.makedirs(args.out, exist_ok=True)
    zip_path = os.path.join(args.out, ZIP_NAME)

    if not os.path.exists(zip_path):
        print(f"Downloading {ZIP_NAME} (~208 MB) from Zenodo…")
        try:
            download_file(ZENODO_URL, zip_path)
        except requests.HTTPError as e:
            print(f"\nDownload failed: {e}")
            print("Manual download: https://zenodo.org/records/1188976")
            return
    else:
        print(f"Already downloaded: {zip_path}")

    print(f"Extracting to {args.out}…")
    with zipfile.ZipFile(zip_path, 'r') as z:
        z.extractall(args.out)

    # Remove zip to free disk space
    os.remove(zip_path)

    wav_count = sum(
        len([f for f in files if f.endswith('.wav')])
        for _, _, files in os.walk(args.out)
    )
    print(f"\nDone!  {wav_count} .wav files in {args.out}")
    print(f"Now run:  python train.py --data {args.out}")


if __name__ == '__main__':
    main()
