# Basit Extraction Servisi (Flask + spaCy)
from flask import Flask, request, jsonify
import spacy

app = Flask(__name__)
nlp = spacy.blank("en")  # Hızlı demo için boş model, ileride tr/en_core_web_trf yüklenebilir

@app.route('/extract', methods=['POST'])
def extract():
    text = request.json['text']
    doc = nlp(text)
    # Dummy extraction: sadece kelime sayısı ve örnek entity
    actors = [ent.text for ent in doc.ents]
    eventType = "unknown"  # Buraya anahtar kelime veya model tabanlı sınıflandırma eklenebilir
    stage = "unknown"
    magnitude = None
    context = {}
    return jsonify({
        "eventType": eventType,
        "actors": actors,
        "stage": stage,
        "context": context,
        "magnitude": magnitude
    })

if __name__ == '__main__':
    app.run(port=5000)
