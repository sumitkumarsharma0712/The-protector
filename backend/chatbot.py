import os
import re
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Common database of doctors
DOCTORS = [
    {"name": "Dr. Sharma", "specialty": "Psychologist", "rating": "4.9"},
    {"name": "Dr. Anjali", "specialty": "Counsellor", "rating": "4.8"},
    {"name": "Dr. Kabir", "specialty": "Therapist", "rating": "4.7"},
    {"name": "Dr. Priya", "specialty": "Psychiatrist", "rating": "5.0"},
]

# Common medication advice
MEDICATIONS = {
    "paracetamol": {
        "dosage": "500mg-650mg every 4-6 hours as needed for pain or fever. Max 4000mg/day.",
        "side_effects": "Rare, but can include nausea, allergic reactions, or liver damage if overdosed.",
        "precautions": "Avoid alcohol. Do not take with other paracetamol-containing products."
    },
    "vitamin d": {
        "dosage": "Usually 1000-2000 IU daily, or 60,000 IU weekly if prescribed for deficiency.",
        "side_effects": "Constipation, nausea, or hypercalcemia if extremely overdosed.",
        "precautions": "Take with a fat-containing meal for better absorption."
    },
    "aspirin": {
        "dosage": "75mg-150mg daily (low-dose antiplatelet) or 325mg-650mg for pain/fever.",
        "side_effects": "Stomach irritation, bleeding, ringing in ears.",
        "precautions": "Do not give to children/teenagers due to Reye's syndrome risk. Consult doctor."
    },
    "ibuprofen": {
        "dosage": "200mg-400mg every 4-6 hours with food. Max 1200mg/day (over-the-counter).",
        "side_effects": "Stomach pain, heartburn, headache, dizziness.",
        "precautions": "Take with food or milk. Avoid if history of stomach ulcers or heart problems."
    }
}

# Advanced multilingual triage rules
SYMPTOMS = {
    "high_risk": {
        "keywords": [r"chest\s*pain", r"heart\s*attack", r"difficulty\s*breathing", r"breathless", r"suicide", r"self\s*harm", r"choking", r"drowning", r"unconscious", r"stroke", r"seizure"],
        "hindi_keywords": [r"seene\s*me\s*dard", r"chhati\s*me\s*dard", r"saans\s*lene\s*me\s*takleef", r"jaan\s*dena", r"marna", r"behosh"],
        "marathi_keywords": [r"छातीत\s*दुखणे", r"श्वास\s*घेण्यास\s*त्रास", r"जीव\s*देणे", r"बेहोष"],
        "reply": "⚠️ **CRITICAL EMERGENCY WARNING:** Your symptoms suggest a potential high-risk condition. Please seek immediate medical help or click the SOS/Ambulance button. Call **108** immediately.",
        "action": "trigger_sos"
    },
    "moderate_risk": {
        "keywords": [r"fever", r"stomach\s*pain", r"vomiting", r"diarrhea", r"migraine", r"infection", r"blood\s*pressure", r"bp", r"diabetes"],
        "hindi_keywords": [r"bukhar", r"pet\s*dard", r"ulti", r"dast", r"infection", r"bp", r"sugar"],
        "marathi_keywords": [r"ताप", r"पोटात\s*दुखणे", r"उलटी", r"जुलाब"],
        "reply": "ℹ️ **Moderate Risk Triage:** You are experiencing symptoms that require professional medical evaluation. We recommend booking an appointment with one of our specialists for a consult.",
        "action": "open_booking"
    },
    "low_risk": {
        "keywords": [r"mild\s*headache", r"fatigue", r"tired", r"sore\s*throat", r"cough", r"cold", r"stress", r"anxiety", r"sad", r"lonely"],
        "hindi_keywords": [r"sar\s*dard", r"thakan", r"khansi", r"jukhamb", r"chinta", r"udaas"],
        "marathi_keywords": [r"डोके\s*दुखी", r"खोकला", r"सर्दी", r"चिंता", r"उदासी"],
        "reply": "🧘 **Low Risk Triage / Wellness:** These symptoms are often manageable with rest, hydration, and relaxation. Let's open our Relax Audio library or help you practice deep breathing.",
        "action": "open_audio"
    }
}

FIRST_AID = {
    "burn": {
        "keywords": [r"burn", r"fire", r"scald", r"jalna", r"भाजणे"],
        "reply": "🔥 **First Aid for Burns:**\n1. Cool the burn immediately under cool running water for 10-20 minutes.\n2. Do NOT apply ice, butter, or toothpaste.\n3. Cover with a clean, non-stick dressing.\n4. Seek doctor review if blistered or large."
    },
    "bleeding": {
        "keywords": [r"bleed", r"cut", r"blood", r"chot", r"khoon", r"रक्तस्राव", r"कापणे"],
        "reply": "🩹 **First Aid for Bleeding & Cuts:**\n1. Apply firm direct pressure to the wound with a clean cloth/bandage.\n2. Elevate the injured area above the heart level if possible.\n3. Clean the area gently with water once bleeding slows.\n4. Apply an antiseptic and clean bandage."
    },
    "cpr": {
        "keywords": [r"cpr", r"heart\s*stopped", r"cardiac\s*arrest", r"dhadkan\s*band", r"सिपीआर"],
        "reply": "🫀 **CPR Instructions (Emergency):**\n1. Ensure the scene is safe.\n2. Tap the shoulders and shout: 'Are you okay?'. Check breathing.\n3. Call **108** immediately.\n4. Push hard and fast in the center of the chest (100-120 compressions per minute). Use the song 'Stayin Alive' for beat."
    }
}

def analyze_intent(text):
    text_lower = text.lower()
    
    # 1. First check high risk triage
    for level, details in SYMPTOMS.items():
        all_patterns = details["keywords"] + details.get("hindi_keywords", []) + details.get("marathi_keywords", [])
        for pattern in all_patterns:
            if re.search(pattern, text_lower):
                return {
                    "reply": details["reply"],
                    "action": details["action"],
                    "data": {"level": level}
                }
                
    # 2. First Aid checks
    for key, details in FIRST_AID.items():
        for pattern in details["keywords"]:
            if re.search(pattern, text_lower):
                return {
                    "reply": details["reply"],
                    "action": "open_first_aid",
                    "data": {"topic": key}
                }

    # 3. Appointment / Doctor related
    booking_keywords = ["book", "appointment", "doctor", "dr.", "specialist", "meet", "milna", "dikhana", "अपॉइंटमेंट", "डॉक्टर"]
    if any(k in text_lower for k in booking_keywords):
        # Detect if specific doctor name is mentioned
        selected_doc = ""
        for doc in DOCTORS:
            if doc["name"].lower() in text_lower:
                selected_doc = doc["name"]
                break
        
        reply = "I can help you book an appointment. Let me open the booking scheduler."
        if selected_doc:
            reply = f"Sure, opening the booking modal for **{selected_doc}** right away."
        else:
            # List doctors
            doc_list = ", ".join([f"{d['name']} ({d['specialty']})" for d in DOCTORS])
            reply = f"Here are our available specialists: {doc_list}. I am opening the scheduler for you."
            
        return {
            "reply": reply,
            "action": "open_booking",
            "data": {"doctor": selected_doc}
        }

    # 4. Medication Info
    for med_name, info in MEDICATIONS.items():
        if med_name in text_lower:
            reply = (f"💊 **{med_name.capitalize()} Info:**\n"
                     f"- **Dosage:** {info['dosage']}\n"
                     f"- **Side Effects:** {info['side_effects']}\n"
                     f"- **Precautions:** {info['precautions']}")
            return {
                "reply": reply,
                "action": "medication_info",
                "data": {"medicine": med_name}
            }

    # 5. Setting reminder request
    reminder_keywords = ["remind", "reminder", "alarm", "dose", "yad dilana", "रिमाइंडर"]
    if any(k in text_lower for k in reminder_keywords):
        # Look for medicine name in the text
        detected_med = "Medicine"
        for med_name in MEDICATIONS.keys():
            if med_name in text_lower:
                detected_med = med_name.capitalize()
                break
        return {
            "reply": f"⏰ I can help you set a medication reminder. I'll open the reminder scheduler to add your **{detected_med}** dose.",
            "action": "add_reminder",
            "data": {"medicine": detected_med}
        }

    # 6. Basic Greetings / General Conversational responses
    greetings = ["hello", "hi", "hey", "namaste", "hola", "sup", "helpline", "sahayak", "mind guardian"]
    if any(k in text_lower for k in greetings):
        return {
            "reply": ("Namaste! 🙏 I am your Medical Assistant.\n\n"
                      "How can I help you today? You can ask me to:\n"
                      "• Check symptoms (e.g., 'I have fever' or 'chest pain')\n"
                      "• Guide with First Aid (e.g., 'How to treat burns')\n"
                      "• Book an appointment (e.g., 'Book with Dr. Sharma')\n"
                      "• Check medicine info (e.g., 'dosage of Paracetamol')"),
            "action": None
        }

    # Default fallback
    return {
        "reply": ("I'm not completely sure about that. As an AI health assistant, I can help with:\n"
                  "1. Symptoms & Triage\n"
                  "2. First Aid Guides (burns, bleeding, CPR)\n"
                  "3. Appointment Booking with our doctors\n"
                  "4. Dosage guides (Paracetamol, Ibuprofen, Vitamin D)\n\n"
                  "Could you please rephrase your request?"),
        "action": None
    }

@app.route('/chat', methods=['POST'])
def chat():
    data = request.get_json() or {}
    message = data.get("message", "").strip()
    if not message:
        return jsonify({"reply": "Please send a valid message.", "action": None})
        
    response_data = analyze_intent(message)
    return jsonify(response_data)

if __name__ == '__main__':
    # Running on port 5005
    app.run(host='0.0.0.0', port=5005, debug=True)
