import requests
import json
from config import OPENROUTER_API_KEY, OPENROUTER_BASE_URL

def test_connection():
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }

    data = {
        "model": "openai/gpt-4o-mini",  # modelo disponível no OpenRouter
        "messages": [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Hello, can you confirm if the Bukar project is connected?"},
        ],
    }

    response = requests.post(OPENROUTER_BASE_URL, headers=headers, data=json.dumps(data))

    if response.status_code == 200:
        result = response.json()
        print("✅ Conexão bem sucedida!")
        print("Resposta da IA:", result["choices"][0]["message"]["content"])
    else:
        print("❌ Erro:", response.status_code, response.text)


if __name__ == "__main__":
    test_connection()
