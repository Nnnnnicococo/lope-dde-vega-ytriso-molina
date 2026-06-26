import os
import uuid
import tempfile
import yt_dlp
import whisper
import anthropic
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

anthropic_client = anthropic.Anthropic()
whisper_model = None


def get_whisper_model():
    global whisper_model
    if whisper_model is None:
        whisper_model = whisper.load_model("base")
    return whisper_model


def download_audio(url: str, output_dir: str) -> str:
    output_path = os.path.join(output_dir, "audio")
    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": output_path,
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "192",
            }
        ],
        "quiet": True,
        "no_warnings": True,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])
    return output_path + ".mp3"


def transcribe_audio(audio_path: str) -> str:
    model = get_whisper_model()
    result = model.transcribe(audio_path)
    return result["text"].strip()


def summarize_transcription(transcription: str) -> str:
    response = anthropic_client.messages.create(
        model="claude-opus-4-8",
        max_tokens=1024,
        thinking={"type": "adaptive"},
        messages=[
            {
                "role": "user",
                "content": (
                    "Por favor, genera un resumen claro y conciso del siguiente texto "
                    "transcrito de un video. El resumen debe capturar los puntos principales "
                    "y la idea central del contenido.\n\n"
                    f"TRANSCRIPCIÓN:\n{transcription}"
                ),
            }
        ],
    )
    for block in response.content:
        if block.type == "text":
            return block.text
    return ""


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/transcribe", methods=["POST"])
def transcribe():
    data = request.get_json()
    url = (data or {}).get("url", "").strip()

    if not url:
        return jsonify({"error": "Por favor ingresa una URL válida"}), 400

    if not any(domain in url for domain in ["youtube.com", "youtu.be", "tiktok.com"]):
        return jsonify({"error": "Solo se admiten URLs de YouTube y TikTok"}), 400

    with tempfile.TemporaryDirectory() as tmpdir:
        try:
            audio_path = download_audio(url, tmpdir)
        except Exception as e:
            return jsonify({"error": f"Error al descargar el video: {str(e)}"}), 500

        try:
            transcription = transcribe_audio(audio_path)
        except Exception as e:
            return jsonify({"error": f"Error al transcribir el audio: {str(e)}"}), 500

    if not transcription:
        return jsonify({"error": "No se pudo obtener una transcripción del video"}), 500

    try:
        summary = summarize_transcription(transcription)
    except Exception as e:
        return jsonify({"error": f"Error al generar el resumen: {str(e)}"}), 500

    return jsonify({"transcription": transcription, "summary": summary})


if __name__ == "__main__":
    app.run(debug=True)
