import requests
from .config import OPENROUTER_API_KEY, OPENROUTER_BASE_URL

def query_openrouter(messages, model="openai/gpt-4o-mini"):
    """
    Envia uma requisição para o OpenRouter.
    messages: lista no formato [{"role": "user", "content": "texto"}]
    """
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": model,
        "messages": messages
    }

    response = requests.post(OPENROUTER_BASE_URL, headers=headers, json=payload)
    response.raise_for_status()
    return response.json()["choices"][0]["message"]["content"]
