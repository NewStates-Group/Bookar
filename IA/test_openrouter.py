import os
import requests
from dotenv import load_dotenv

# Carregar variáveis de ambiente
load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

if not OPENROUTER_API_KEY:
    print("❌ API key não encontrada. Verifica o arquivo .env.")
    exit()

# Endpoint do OpenRouter
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions"

headers = {
    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
    "Content-Type": "application/json",
    "HTTP-Referer": "http://localhost:3000",  # ou teu domínio futuramente
    "X-Title": "Bookar AI Base Test"
}

data = {
    "model": "gpt-3.5-turbo",
    "messages": [
        {"role": "user", "content": "Olá, estás a funcionar?"}
    ]
}

response = requests.post(OPENROUTER_BASE_URL, headers=headers, json=data)

print("Status:", response.status_code)
print("Resposta:", response.text)
