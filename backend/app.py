"""
Flask API Server — Depression Detection from Audio

Endpoints:
  GET  /api/health
  POST /api/analyze/upload   — multipart audio file
  POST /api/analyze/record   — raw recorded blob (webm)
"""

import os
import uuid
import tempfile
from flask import Flask, request, jsonify
from flask_cors import CORS

from predict import analyze, MODELS

app = Flask(__name__)
CORS(app, origins=['http://localhost:5173', 'http://localhost:3000'])

ALLOWED_EXTENSIONS = {'wav', 'mp3', 'm4a', 'ogg', 'webm', 'flac', 'aac'}


def _allowed(filename: str) -> bool:
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def _save_temp(file_storage, suffix: str) -> str:
    tmp = os.path.join(tempfile.gettempdir(), f"{uuid.uuid4().hex}{suffix}")
    file_storage.save(tmp)
    return tmp


XGB_PATH = os.path.join(os.path.dirname(__file__), 'models', 'depression_model.joblib')
RF_PATH  = os.path.join(os.path.dirname(__file__), 'models', 'rf_model.joblib')

@app.get('/api/health')
def health():
    return jsonify({
        'status': 'ok',
        'message': 'Depression Detection API is running',
        'model_ready': os.path.exists(XGB_PATH),
        'models': {
            'xgboost': {'ready': os.path.exists(XGB_PATH), 'accuracy': 93.76},
            'rf':      {'ready': os.path.exists(RF_PATH),  'accuracy': 80.18},
        },
    })


@app.post('/api/analyze/upload')
def analyze_upload():
    if 'audio' not in request.files:
        return jsonify({'error': 'No audio file provided'}), 400

    file = request.files['audio']
    if not file.filename or not _allowed(file.filename):
        return jsonify({'error': 'Unsupported file type'}), 400

    model_choice = request.form.get('model', 'xgboost')  # 'xgboost' | 'rf'
    suffix       = '.' + file.filename.rsplit('.', 1)[1].lower()
    tmp_path     = _save_temp(file, suffix)

    try:
        result = analyze(tmp_path, filename=file.filename, model_choice=model_choice)
        return jsonify(result)
    except FileNotFoundError as e:
        return jsonify({'error': str(e)}), 503
    except Exception as e:
        app.logger.exception('Analysis error')
        return jsonify({'error': f'Analysis failed: {e}'}), 500
    finally:
        try: os.remove(tmp_path)
        except OSError: pass


@app.post('/api/analyze/record')
def analyze_record():
    if 'audio' not in request.files:
        return jsonify({'error': 'No audio blob provided'}), 400

    file         = request.files['audio']
    model_choice = request.form.get('model', 'xgboost')
    tmp_path     = _save_temp(file, '.webm')

    try:
        result = analyze(tmp_path, filename='recording.webm', model_choice=model_choice)
        return jsonify(result)
    except FileNotFoundError as e:
        return jsonify({'error': str(e)}), 503
    except Exception as e:
        app.logger.exception('Analysis error')
        return jsonify({'error': f'Analysis failed: {e}'}), 500
    finally:
        try: os.remove(tmp_path)
        except OSError: pass


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
