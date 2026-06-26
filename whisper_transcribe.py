#!/usr/bin/env python3
import sys
import json
import whisper

if len(sys.argv) < 2:
    print(json.dumps({"error": "No audio file provided"}))
    sys.exit(1)

audio_path = sys.argv[1]
model_name = sys.argv[2] if len(sys.argv) > 2 else "base"

try:
    model = whisper.load_model(model_name)
    result = model.transcribe(audio_path, fp16=False)
    print(json.dumps({"text": result["text"].strip(), "language": result.get("language", "unknown")}))
except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)
