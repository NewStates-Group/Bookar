import logging
import re
import urllib.parse

import httpx
from celery import shared_task
from core.utils import send_user_update
from courses.utils import extract_json, generate_text_with_fallback
from django.db import transaction

from .models import MindMap, MindMapStatus

logger = logging.getLogger(__name__)


def search_youtube_video(query: str):
    """
    Search YouTube for the given query and return a tuple: (watch_url, embed_url).
    Returns (None, None) on failure.
    """
    try:
        encoded_query = urllib.parse.quote(query)
        url = f"https://www.youtube.com/results?search_query={encoded_query}"
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                " (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            )
        }
        with httpx.Client(follow_redirects=True) as client:
            response = client.get(url, headers=headers, timeout=15)
            if response.status_code == 200:
                # Find occurrences of videoId: "xxxxxxxxxxx"
                video_ids = re.findall(
                    r'"videoId":"([a-zA-Z0-9_-]{11})"', response.text
                )
                if video_ids:
                    # Filter and take the first match
                    for v_id in video_ids:
                        if len(v_id) == 11:
                            return (
                                f"https://www.youtube.com/watch?v={v_id}",
                                f"https://www.youtube.com/embed/{v_id}",
                            )
    except Exception as e:
        logger.error(f"Error searching YouTube for '{query}': {e}")
    return None, None


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
    default_retry_delay=40,
)
def generate_mind_map_task(self, user_id: int, mind_map_id: int):
    try:
        mind_map = MindMap.objects.get(pk=mind_map_id)
    except MindMap.DoesNotExist:
        logger.error(f"MindMap with id {mind_map_id} not found")
        return

    mind_map.status = MindMapStatus.PROCESSING
    mind_map.save(update_fields=["status"])

    send_user_update(
        user_id,
        {
            "type": "mind_map_update",
            "id": str(mind_map.uuid),
            "status": "PROCESSING",
            "topic": mind_map.topic,
        },
    )

    try:
        # Validate the topic first to avoid wasting CPU / AI requests on invalid subjects
        stripped_topic = (mind_map.topic or "").strip()
        if not stripped_topic or len(stripped_topic) < 3:
            raise ValueError("O assunto deve ter pelo menos 3 caracteres.")
            
        if len(stripped_topic) > 100:
            raise ValueError("O assunto é demasiado longo (máximo 100 caracteres).")

        validation_prompt = f"""
        Analise se o assunto a seguir é um tema real, coerente, inteligível e educativo sobre o qual faz sentido criar um roteiro de estudos / mapa mental.
        Se for apenas caracteres aleatórios (ex: "asdfg"), números sem contexto (ex: "12345"), lixo, spam ou insultos, marque como inválido.

        Assunto: "{stripped_topic}"

        Retorne estritamente o seguinte JSON:
        {{
            "is_valid": true ou false,
            "reason": "Breve explicação da invalidade em Português (apenas se is_valid for false, senão string vazia)"
        }}
        """
        val_res = generate_text_with_fallback([{"role": "user", "content": validation_prompt}])
        val_data = extract_json(val_res)
        
        if val_data and not val_data.get("is_valid", True):
            reason = val_data.get("reason", "Assunto inválido ou não educativo.")
            raise ValueError(reason)

        # Determine target language configuration
        lang = getattr(mind_map, "language", "pt")
        if lang == "en":
            lang_instruction = (
                "Todos os valores de texto devem ser em Inglês (English)."
            )
            level1_ex = "Foundations of " + mind_map.topic
            level2_ex = "Core Syntax and Setup"
            level3_ex = "What is " + mind_map.topic + " and why use it"
            youtube_ex = f"{mind_map.topic} course for beginners"
            title_ex = f"Mastering {mind_map.topic}: The Complete Guide"
            search_lang = "english"
        elif lang == "es":
            lang_instruction = (
                "Todos os valores de texto devem ser em Espanhol (Spanish)."
            )
            level1_ex = "Fundamentos de " + mind_map.topic
            level2_ex = "Sintaxis y Primeros Pasos"
            level3_ex = "Qué es " + mind_map.topic + " y por qué usarlo"
            youtube_ex = f"que es {mind_map.topic} tutorial español completo"
            title_ex = f"Dominando {mind_map.topic}: La Guía Completa"
            search_lang = "espanol"
        else:  # pt
            lang_instruction = (
                "Todos os valores de texto devem ser em Português do Brasil."
            )
            level1_ex = "Fundamentos de " + mind_map.topic
            level2_ex = "Primeiro contato com a Sintaxe"
            level3_ex = "O que é e por que usar " + mind_map.topic
            youtube_ex = f"o que e {mind_map.topic} tutorial para iniciantes"
            title_ex = f"Dominando {mind_map.topic}: O Guia Completo"
            search_lang = "portugues"

        prompt = f"""
        Você é um especialista em educação e criação de trilhas de aprendizagem (roadmaps / mapas mentais).
        Sua tarefa é criar um mapa mental estruturado e progressivo com 3 NÍVEIS de profundidade para aprender sobre o assunto: "{mind_map.topic}".

        Regras Cruciais de Conteúdo:
        - Retorne APENAS um JSON válido.
        - NUNCA inclua markdown extra, texto fora do JSON ou explicações.
        - {lang_instruction}
        - As chaves do JSON devem permanecer em Inglês.
        - NUNCA inclua qualquer tipo de numeração, prefixo numérico ou enumeração nos títulos ("title") de qualquer nível (como "Módulo 1:", "Subtópico 1.1:", "Aula 1.1.1:", "1.", "1.1", etc.). Os títulos devem ser limpos, diretos e conter apenas o nome do assunto/tópico (ex: "Fundamentos de Python", e não "Módulo 1: Fundamentos de Python").
        
        Regras de Estrutura de 3 Níveis:
        1. O JSON deve conter "title" e "desc" gerais do mapa.
        2. Deve conter um array de "nodes" que representam o Nível 1: Módulos Principais (Gere exatamente de 2 a 3 Módulos de Nível 1).
        3. Cada Módulo (Nível 1) deve conter um array "children" (Subtópicos de Nível 2). Gere exatamente 2 Subtópicos por Módulo.
        4. Cada Subtópico (Nível 2) deve conter um array "children" (Aulas Práticas de Nível 3). Gere de 2 a 3 Aulas de Nível 3 por Subtópico.
        5. Apenas as Aulas (Nível 3) devem possuir a chave "youtube_query". Essa chave deve ser focada e descritiva para encontrar o melhor vídeo tutorial no YouTube no idioma selecionado ({search_lang}) (ex: "{youtube_ex}").

        Retorne estritamente o seguinte formato JSON:
        {{
            "title": "{title_ex}",
            "desc": "Descrição geral do que será aprendido neste mapa mental",
            "nodes": [
                {{
                    "id": "1",
                    "level": 1,
                    "title": "{level1_ex}",
                    "desc": "O que será abordado neste módulo principal",
                    "children": [
                        {{
                            "id": "1.1",
                            "level": 2,
                            "title": "{level2_ex}",
                            "desc": "Foco de estudo deste subtópico",
                            "children": [
                                {{
                                    "id": "1.1.1",
                                    "level": 3,
                                    "title": "{level3_ex}",
                                    "desc": "Explicação do que o aluno vai aprender de forma prática nesta aula",
                                    "youtube_query": "{youtube_ex}"
                                }}
                            ]
                        }}
                    ]
                }}
            ]
        }}
        """

        response = generate_text_with_fallback([{"role": "user", "content": prompt}])
        data = extract_json(response)

        if not data or "nodes" not in data:
            raise ValueError("Failed to extract valid JSON data for mind map")

        nodes = data.get("nodes", [])
        resolved_nodes = []

        for node1 in nodes:
            resolved_children1 = []
            children1 = node1.get("children", []) or []

            for node2 in children1:
                resolved_children2 = []
                children2 = node2.get("children", []) or []

                for node3 in children2:
                    query = node3.get("youtube_query")
                    if not query:
                        query = f"{node3.get('title')} {mind_map.topic} tutorial"

                    watch_url, embed_url = search_youtube_video(query)

                    resolved_children2.append(
                        {
                            "id": str(node3.get("id")),
                            "level": 3,
                            "title": node3.get("title", ""),
                            "desc": node3.get("desc", ""),
                            "youtube_query": query,
                            "youtube_url": watch_url,
                            "youtube_embed": embed_url,
                        }
                    )

                resolved_children1.append(
                    {
                        "id": str(node2.get("id")),
                        "level": 2,
                        "title": node2.get("title", ""),
                        "desc": node2.get("desc", ""),
                        "children": resolved_children2,
                    }
                )

            resolved_nodes.append(
                {
                    "id": str(node1.get("id")),
                    "level": 1,
                    "title": node1.get("title", ""),
                    "desc": node1.get("desc", ""),
                    "children": resolved_children1,
                }
            )

        with transaction.atomic():
            mind_map.title = data.get("title", f"Mapa Mental: {mind_map.topic}")
            mind_map.desc = data.get("desc", "")
            mind_map.nodes = resolved_nodes
            mind_map.status = MindMapStatus.READY
            mind_map.save()

            def _on_success():
                send_user_update(
                    user_id,
                    {
                        "type": "mind_map_update",
                        "id": str(mind_map.uuid),
                        "status": "READY",
                        "title": mind_map.title,
                    },
                )

            transaction.on_commit(_on_success)

        return True

    except ValueError as val_err:
        logger.warning(f"Validation failed for mind map {mind_map_id}: {val_err}")
        with transaction.atomic():
            mind_map.status = MindMapStatus.FAILED
            mind_map.desc = str(val_err)
            mind_map.save(update_fields=["status", "desc"])

            def _on_val_error():
                send_user_update(
                    user_id,
                    {
                        "type": "mind_map_update",
                        "id": str(mind_map.uuid),
                        "status": "FAILED",
                        "error_message": str(val_err),
                    },
                )

            transaction.on_commit(_on_val_error)
        return False

    except Exception as e:
        logger.error(f"Error generating mind map: {e}")
        with transaction.atomic():
            mind_map.status = MindMapStatus.FAILED
            mind_map.save(update_fields=["status"])

            def _on_error():
                send_user_update(
                    user_id,
                    {
                        "type": "mind_map_update",
                        "id": str(mind_map.uuid),
                        "status": "FAILED",
                    },
                )

            transaction.on_commit(_on_error)
        raise e
