import os
from google import genai
from google.genai import types

def test_text(client, model):
    print(f"\n--- Testing Text Model: {model} ---")
    try:
        response = client.models.generate_content(
            model=model,
            contents="Say 'Text API is working' in one sentence."
        )
        print(f"[SUCCESS] {model}: {response.text.strip()}")
        return True
    except Exception as e:
        print(f"[FAIL] {model}: {e}")
        return False

def test_image(client, model):
    print(f"\n--- Testing Image Model: {model} ---")
    try:
        # Note: image generation often uses generate_content with specific prompts or generate_image
        # Using a safe generic content generation attempt first if it's a Gemini model
        # If it's specifically an Imagen-style model, it might need different methods
        response = client.models.generate_content(
            model=model,
            contents="Generate a simple description of a cat."
        )
        print(f"[SUCCESS] {model} (Content Test): {response.text.strip()}")
        return True
    except Exception as e:
        print(f"[FAIL] {model}: {e}")
        return False

def test_audio(client, model):
    print(f"\n--- Testing Audio Model: {model} ---")
    try:
        # Testing if the model can generate a basic response
        response = client.models.generate_content(
            model=model,
            contents="Say 'Audio API is working' in one sentence."
        )
        print(f"[SUCCESS] {model} (Content Test): {response.text.strip()}")
        return True
    except Exception as e:
        print(f"[FAIL] {model}: {e}")
        return False

if __name__ == "__main__":
    print("Google API Diagnostic Script - Multi-Model Test")
    print("=============================================")
    
    api_key = input("Enter GENAI_KEY: ").strip()
    if not api_key:
        print("API Key is required.")
        exit(1)

    client = genai.Client(api_key=api_key)

    # Models to test
    models = {
        "TEXT": "gemini-2.0-flash",
        "IMAGE": "gemini-2.5-flash-image",
        "AUDIO": "gemini-2.5-flash-preview-tts"
    }

    test_text(client, models["TEXT"])
    test_image(client, models["IMAGE"])
    test_audio(client, models["AUDIO"])

    print("\nTests completed.")
