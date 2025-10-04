from .services import query_openrouter

class BoukarAgent:
    """
    Classe base para o agente de IA do Boukar.
    Pode ser estendido para: tutor, explicador, criador de cursos.
    """

    def __init__(self, model="openai/gpt-4o-mini"):
        self.model = model

    def chat(self, user_input: str):
        """
        Inicia uma conversa simples com o agente.
        """
        messages = [
            {"role": "system", "content": "You are Boukar AI Assistant."},
            {"role": "user", "content": user_input}
        ]
        return query_openrouter(messages, self.model)
