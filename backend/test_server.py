"""
Quick smoke test for the running Flask server.
Run after: python app.py

Usage:
    python test_server.py                          # health check only
    python test_server.py --file path/to/test.wav  # full analysis test
"""

import argparse
import json
import sys
import requests

BASE = 'http://localhost:5000/api'


def check_health():
    r = requests.get(f'{BASE}/health', timeout=5)
    r.raise_for_status()
    print('Health:', r.json())


def test_upload(filepath: str):
    with open(filepath, 'rb') as f:
        r = requests.post(
            f'{BASE}/analyze/upload',
            files={'audio': (filepath, f, 'audio/wav')},
            timeout=30,
        )
    r.raise_for_status()
    result = r.json()
    print('\nAnalysis result:')
    print(json.dumps(result, indent=2))
    assert result['sentiment'] in ('POSITIVE', 'NEGATIVE', 'NEUTRAL'), 'Bad sentiment'
    assert 0 <= result['confidence'] <= 100, 'Bad confidence'
    print('\nAll checks passed.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--file', help='Audio file to test with')
    args = parser.parse_args()

    try:
        check_health()
    except Exception as e:
        print(f'Server not reachable: {e}')
        print('Make sure you ran: python app.py')
        sys.exit(1)

    if args.file:
        test_upload(args.file)
    else:
        print('Pass --file <audio.wav> to test a full analysis.')
