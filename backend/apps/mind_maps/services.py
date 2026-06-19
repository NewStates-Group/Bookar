from apps.subscriptions.services import SubscriptionService
from django.core.cache import cache
from django.db import models
from ninja.errors import HttpError

from .models import MindMap
from .tasks import generate_mind_map_task


def invalidate_mind_map_cache(mind_map_uuid: str, user_id=None):
    if mind_map_uuid:
        cache.delete(f"mind_map_detail_{mind_map_uuid}")
    if user_id:
        cache.delete(f"mind_maps_list_{user_id}")


class MindMapService:
    def list_mind_maps(self, user):
        cache_key = f"mind_maps_list_{user.id}"
        cached = cache.get(cache_key)
        if cached is not None:
            return cached

        maps = list(
            MindMap.objects.filter(user_id=user.id).values(
                "uuid", "desc", "topic", "title", "status", "is_shared", "created_at"
            )[:50]
        )
        cache.set(cache_key, maps, 300)  # 5 minutes
        return maps

    def create_mind_map(self, user, topic: str, language: str = "pt"):
        SubscriptionService().check_and_increment(user, "mindmap_generated")

        mind_map = MindMap.objects.create(
            user=user,
            topic=topic,
            language=language,
            title="Gerando...",
            desc=(
                "Seu mapa mental está sendo gerado pela nossa inteligência artificial."
            ),
        )

        generate_mind_map_task.delay(user.pk, mind_map.pk)
        invalidate_mind_map_cache("", user.id)
        mind_map.is_owner = True
        return mind_map

    def get_mind_map(self, uuid_str: str, user):
        cache_key = f"mind_map_detail_{uuid_str}"
        cached = cache.get(cache_key)
        if cached is not None:
            cached.is_owner = cached.user_id == user.id
            return cached

        try:
            mind_map = MindMap.objects.get(uuid=uuid_str, user=user)
            mind_map.is_owner = True
            cache.set(cache_key, mind_map, 600)  # 10 minutes
            return mind_map
        except MindMap.DoesNotExist:
            try:
                mind_map = MindMap.objects.get(uuid=uuid_str, is_shared=True)
                mind_map.is_owner = False
                cache.set(cache_key, mind_map, 600)
                return mind_map
            except MindMap.DoesNotExist:
                raise HttpError(
                    404,
                    "Mapa mental não encontrado ou você não tem acesso a ele.",
                )

    def delete_mind_map(self, uuid_str: str, user):
        mind_map = self.get_mind_map(uuid_str, user)
        if mind_map.user != user:
            raise HttpError(
                403, "Você não tem permissão para eliminar este mapa mental."
            )
        mind_map.delete()
        invalidate_mind_map_cache(uuid_str, user.id)
        return {"success": True, "message": "Mapa mental eliminado."}

    def _find_node(self, nodes, node_id):
        """Recursively find a node by ID in the 3-level hierarchy."""
        for n1 in nodes:
            if str(n1.get("id")) == str(node_id):
                return n1
            for n2 in n1.get("children", []):
                if str(n2.get("id")) == str(node_id):
                    return n2
                for n3 in n2.get("children", []):
                    if str(n3.get("id")) == str(node_id):
                        return n3
        return None

    def _count_nodes_with_content(self, mind_map):
        """Count how many nodes already have content generated."""
        count = 0
        for n1 in mind_map.nodes:
            if n1.get("text_content"):
                count += 1
            for n2 in n1.get("children", []):
                if n2.get("text_content"):
                    count += 1
                for n3 in n2.get("children", []):
                    if n3.get("text_content"):
                        count += 1
        return count

    def _count_nodes_with_quiz(self, mind_map):
        """Count how many nodes have quizzes generated."""
        if not mind_map.quizzes:
            return 0
        return len(mind_map.quizzes)

    def _check_mindmap_module_limit(self, mind_map):
        existing = self._count_nodes_with_content(mind_map)
        SubscriptionService().check_limit(mind_map.user, "mindmap_module", existing)

    def _check_mindmap_quiz_limit(self, mind_map):
        existing = self._count_nodes_with_quiz(mind_map)
        SubscriptionService().check_limit(mind_map.user, "mindmap_quiz", existing)

    def get_node_content(self, uuid_str: str, node_id: str, user):
        from apps.courses.utils import extract_json, generate_text_with_fallback

        mind_map = self.get_mind_map(uuid_str, user)
        if not mind_map.nodes:
            raise HttpError(
                400, "O mapa mental ainda está sendo gerado ou não possui nós."
            )

        node = self._find_node(mind_map.nodes, node_id)
        if not node:
            raise HttpError(404, f"Nó {node_id} não encontrado no mapa mental.")

        # If already generated, return from cache
        if "text_content" in node:
            return {
                "text_content": node["text_content"],
                "additional_resources": node.get("additional_resources", []),
            }

        # Check subscription limit for generating new module content
        self._check_mindmap_module_limit(mind_map)

        # Otherwise, generate dynamically on-demand using AI
        lang = getattr(mind_map, "language", "pt")
        if lang == "en":
            lang_instruction = (
                "Todos os valores de texto devem ser em Inglês (English)."
            )
        elif lang == "es":
            lang_instruction = (
                "Todos os valores de texto devem ser em Espanhol (Spanish)."
            )
        else:
            lang_instruction = (
                "Todos os valores de texto devem ser em Português do Brasil."
            )

        prompt = f"""
        Você é um educador especialista e autoridade máxima no assunto: "{mind_map.topic}".
        Sua tarefa é elaborar um MATERIAL DIDÁTICO COMPLETO, rico, extremamente aprofundado e didático em formato Markdown para a aula: "{node.get("title")}" (contexto e foco da aula: {node.get("desc")}).

        IMPORTANTE: Não escreva apenas uma descrição curta ou resumo rápido! Este texto deve ser um verdadeiro material de leitura para a aula, completo e abrangente, ideal para um estudante aprender o conceito do zero e se aprofundar de verdade. O texto deve ter de 800 a 1500 palavras de puro conteúdo educacional de alta qualidade, sem placeholders, pontas soltas ou evasões.

        Estrutura sugerida e obrigatória para o material de leitura (em `text_content`):
        1. **Título Principal**: Comece com o título da aula formatado como `# {node.get("title")}`.
        2. **Introdução Didática**: Uma contextualização instigante da aula, explicando por que este assunto é fundamental no contexto de "{mind_map.topic}" e quais problemas práticos ele resolve no mundo real.
        3. **Explicação Teórica Detalhada**: Explique os conceitos teóricos fundamentais de forma mastigada, usando analogias claras, definições precisas de termos técnicos e discussões aprofundadas sobre como o conceito funciona nos bastidores.
        4. **Conceitos-Chave e Terminologias**: Use tabelas Markdown, blockquotes ou listas com definições em negrito para destacar os termos mais importantes.
        5. **Exemplos Práticos ou Casos de Uso Reais**:
           - Se a matéria for técnica/programação, apresente múltiplos blocos de código práticos e reais (com realce de sintaxe Markdown), acompanhados de uma explicação detalhada linha por linha do que está acontecendo.
           - Se for de outra área, apresente estudos de caso reais, fluxos de trabalho passo a passo, ou cenários cotidianos detalhados que exemplifiquem a aplicação prática do conceito.
        6. **Dicas de Ouro e Boas Práticas**: Dicas práticas do que fazer na vida real, erros comuns que iniciantes devem evitar e conselhos valiosos de mercado.
        7. **Perguntas para Reflexão e Exercícios Mentais**: Proponha de 2 a 3 perguntas discursivas ou exercícios práticos para o aluno testar o próprio entendimento antes de realizar a avaliação (quiz) desta aula.
        8. **Resumo da Aula e Próximos Passos**: Um parágrafo consolidador revisando os pontos principais ensinados nesta aula e como eles preparam o terreno para os próximos tópicos.

        Regras Cruciais:
        - Retorne APENAS um JSON válido.
        - As chaves do JSON devem ser "text_content" e "additional_resources".
        - NUNCA inclua markdown extra ou qualquer texto fora da estrutura do JSON retornado.
        - {lang_instruction}
        - O texto de `text_content` deve usar Markdown rico e avançado (títulos, negritos, listas, tabelas, blockquotes, blocos de código com linguagem especificada, etc.) para garantir uma leitura agradável e profissional.
        - Na chave `additional_resources`, inclua de 2 a 3 sugestões de recursos ou documentações oficiais reais e gratuitas (como MDN, Wikipedia, documentações de bibliotecas/linguagens, etc.) que complementem esse aprendizado.

        Retorne estritamente o formato JSON a seguir, garantindo que o texto longo e completo da aula seja colocado inteiramente como string na chave `text_content` com as quebras de linha formatadas como \\n:
        {{
            "text_content": "# {node.get("title")}\\n\\n[Escreva aqui todo o conteúdo didático extenso, detalhado, aprofundado e altamente educativo da aula, estruturado com Introdução, Teoria, Conceitos-Chave, Exemplos Práticos, Dicas de Ouro, Exercícios de Reflexão e Resumo. Mínimo de 800 a 1500 palavras de texto real e didático...]",
            "additional_resources": [
                {{
                    "title": "Nome do Recurso / Plataforma Oficial",
                    "url": "https://..."
                }}
            ]
        }}
        """

        try:
            response = generate_text_with_fallback(
                [{"role": "user", "content": prompt}]
            )
            data = extract_json(response)
            if not data or "text_content" not in data:
                raise ValueError("AI response did not return valid text_content JSON.")

            text_content = data.get("text_content", "")
            resources = data.get("additional_resources", [])
        except Exception:
            # Fallback content if AI fails
            text_content = f"# {node.get('title')}\n\n{node.get('desc')}\n\n*Nota: Não foi possível gerar o conteúdo aprofundado no momento. Por favor, tente novamente mais tarde.*"
            resources = []

        # Save back into the JSON structure
        def _update_node_in_list(nodes_list):
            for n1 in nodes_list:
                if str(n1.get("id")) == str(node_id):
                    n1["text_content"] = text_content
                    n1["additional_resources"] = resources
                    return True
                for n2 in n1.get("children", []):
                    if str(n2.get("id")) == str(node_id):
                        n2["text_content"] = text_content
                        n2["additional_resources"] = resources
                        return True
                    for n3 in n2.get("children", []):
                        if str(n3.get("id")) == str(node_id):
                            n3["text_content"] = text_content
                            n3["additional_resources"] = resources
                            return True
            return False

        updated_nodes = list(mind_map.nodes)
        if _update_node_in_list(updated_nodes):
            mind_map.nodes = updated_nodes
            mind_map.save(update_fields=["nodes"])
            invalidate_mind_map_cache(uuid_str, user.id)

        return {
            "text_content": text_content,
            "additional_resources": resources,
        }

    def get_or_create_node_quiz(self, uuid_str: str, node_id: str, user):
        from apps.courses.utils import extract_json, generate_text_with_fallback

        mind_map = self.get_mind_map(uuid_str, user)
        if not mind_map.nodes:
            raise HttpError(
                400, "O mapa mental ainda está sendo gerado ou não possui nós."
            )

        node = self._find_node(mind_map.nodes, node_id)
        if not node:
            raise HttpError(404, f"Nó {node_id} não encontrado no mapa mental.")

        if not mind_map.quizzes:
            mind_map.quizzes = {}

        # Return cached quiz (excluding answers)
        if node_id in mind_map.quizzes:
            quiz_data = mind_map.quizzes[node_id]
            sanitized_questions = []
            for q in quiz_data.get("questions", []):
                sanitized_questions.append(
                    {
                        "id": q["id"],
                        "type": q["type"],
                        "question": q["question"],
                        "options": q.get("options"),
                    }
                )
            return {"questions": sanitized_questions}

        # Check subscription limit before generating new quiz
        self._check_mindmap_quiz_limit(mind_map)

        # Generate dynamically on-demand using AI
        lang = getattr(mind_map, "language", "pt")
        if lang == "en":
            lang_instruction = (
                "Todos os valores de texto devem ser em Inglês (English)."
            )
        elif lang == "es":
            lang_instruction = (
                "Todos os valores de texto devem ser em Espanhol (Spanish)."
            )
        else:
            lang_instruction = (
                "Todos os valores de texto devem ser em Português do Brasil."
            )

        prompt = f"""
        Você é um educador especialista e sua tarefa é gerar um teste de avaliação (quiz) dinâmico e interativo sobre o assunto "{node.get("title")}" (contexto do curso: "{mind_map.topic}").

        Regras:
        - Retorne APENAS um JSON válido.
        - NUNCA inclua markdown extra, texto fora do JSON ou explicações.
        - {lang_instruction}
        - O quiz deve conter exatamente de 3 a 4 perguntas de tipos variados:
          1. Múltipla Escolha ("multiple_choice"): 4 opções de resposta, com apenas 1 correta.
          2. Verdadeiro ou Falso ("true_false"): 2 opções ("Verdadeiro", "Falso" ou "True", "False").
          3. Pergunta Fechada ("short_answer"): Uma pergunta que requer uma palavra-chave direta ou resposta exata muito curta.
        - Cada pergunta deve ter um `id` numérico (1, 2, 3, etc.), `type`, `question`, `options` (para multipla escolha ou verdadeiro/falso), e a resposta correta em `correct_answer`.

        Retorne estritamente o seguinte formato JSON:
        {{
            "questions": [
                {{
                    "id": 1,
                    "type": "multiple_choice",
                    "question": "Pergunta exemplo 1?",
                    "options": ["Opção A", "Opção B", "Opção C", "Opção D"],
                    "correct_answer": "Opção A"
                }},
                {{
                    "id": 2,
                    "type": "true_false",
                    "question": "Afirmação exemplo 2?",
                    "options": ["Verdadeiro", "Falso"],
                    "correct_answer": "Verdadeiro"
                }},
                {{
                    "id": 3,
                    "type": "short_answer",
                    "question": "Pergunta exemplo de palavra única?",
                    "correct_answer": "palavra-chave"
                }}
            ]
        }}
        """

        try:
            response = generate_text_with_fallback(
                [{"role": "user", "content": prompt}]
            )
            data = extract_json(response)
            if not data or "questions" not in data:
                raise ValueError("AI response did not return valid questions list.")
            quiz_data = data
        except Exception:
            # Fallback quiz
            quiz_data = {
                "questions": [
                    {
                        "id": 1,
                        "type": "true_false",
                        "question": f"O tópico '{node.get('title')}' é relevante para o aprendizado de '{mind_map.topic}'?",
                        "options": ["Verdadeiro", "Falso"]
                        if lang == "pt"
                        else ["True", "False"],
                        "correct_answer": "Verdadeiro" if lang == "pt" else "True",
                    }
                ]
            }

        # Save to database
        updated_quizzes = dict(mind_map.quizzes)
        updated_quizzes[node_id] = quiz_data
        mind_map.quizzes = updated_quizzes
        mind_map.save(update_fields=["quizzes"])
        invalidate_mind_map_cache(uuid_str, user.id)

        # Return sanitized quiz questions (without the answers!)
        sanitized_questions = []
        for q in quiz_data.get("questions", []):
            sanitized_questions.append(
                {
                    "id": q["id"],
                    "type": q["type"],
                    "question": q["question"],
                    "options": q.get("options"),
                }
            )
        return {"questions": sanitized_questions}

    def submit_node_quiz(self, uuid_str: str, node_id: str, answers: dict, user):
        mind_map = self.get_mind_map(uuid_str, user)
        if mind_map.user != user:
            raise HttpError(
                403,
                "Você precisa importar este mapa mental para salvar progresso e fazer o teste.",
            )

        if not mind_map.quizzes or node_id not in mind_map.quizzes:
            raise HttpError(
                400, "O questionário para esta aula não existe ou ainda não foi gerado."
            )

        quiz_data = mind_map.quizzes[node_id]
        questions = quiz_data.get("questions", [])
        total_questions = len(questions)

        if total_questions == 0:
            raise HttpError(500, "Nenhuma pergunta encontrada neste quiz.")

        correct_count = 0
        for q in questions:
            q_id = str(q["id"])
            user_ans = str(answers.get(q_id, "")).strip().lower()
            corr_ans = str(q.get("correct_answer", "")).strip().lower()
            if user_ans == corr_ans:
                correct_count += 1

        percentage = (correct_count / total_questions) * 100
        passed = percentage >= 70.0  # 70% threshold to pass

        if passed:
            if not mind_map.completed_nodes:
                mind_map.completed_nodes = []

            updated_completed = list(mind_map.completed_nodes)
            if node_id not in updated_completed:
                updated_completed.append(node_id)
                mind_map.completed_nodes = updated_completed
                mind_map.save(update_fields=["completed_nodes"])
                invalidate_mind_map_cache(uuid_str, user.id)

        return {
            "passed": passed,
            "score": percentage,
            "correct_count": correct_count,
            "total_questions": total_questions,
            "completed_nodes": mind_map.completed_nodes or [],
        }

    def update_node_note(self, uuid_str: str, node_id: str, content: str, user):
        mind_map = self.get_mind_map(uuid_str, user)
        if mind_map.user != user:
            raise HttpError(
                403, "Você precisa importar este mapa mental para salvar anotações."
            )

        if not mind_map.notes:
            mind_map.notes = {}

        updated_notes = dict(mind_map.notes)
        updated_notes[node_id] = content
        mind_map.notes = updated_notes
        mind_map.save(update_fields=["notes"])
        invalidate_mind_map_cache(uuid_str, user.id)

        return {"success": True, "notes": mind_map.notes}

    def toggle_share(self, uuid_str: str, user):
        mind_map = self.get_mind_map(uuid_str, user)
        if mind_map.user != user:
            raise HttpError(
                403, "Apenas o proprietário pode partilhar este mapa mental."
            )

        mind_map.is_shared = not mind_map.is_shared
        mind_map.save(update_fields=["is_shared"])
        invalidate_mind_map_cache(uuid_str, user.id)
        return {"success": True, "is_shared": mind_map.is_shared}

    def duplicate_mind_map(self, uuid_str: str, user):
        try:
            original = MindMap.objects.get(uuid=uuid_str)
            # Ensure they own it or it's public
            if original.user != user and not original.is_shared:
                raise HttpError(
                    403, "Você não tem permissão para duplicar este mapa mental."
                )
        except MindMap.DoesNotExist:
            raise HttpError(404, "Mapa mental original não encontrado.")

        copy_mind_map = MindMap.objects.create(
            user=user,
            topic=original.topic,
            title=f"{original.title} (Cópia)"
            if not original.title.endswith("(Cópia)")
            else original.title,
            desc=original.desc,
            status=original.status,
            language=original.language,
            nodes=original.nodes,
            completed_nodes=[],
            notes={},
            quizzes=original.quizzes or {},
        )

        # Atomically increment the import counter on the original map
        MindMap.objects.filter(pk=original.pk).update(
            import_count=models.F("import_count") + 1
        )

        invalidate_mind_map_cache(uuid_str)
        invalidate_mind_map_cache("", user.id)

        copy_mind_map.is_owner = True
        return copy_mind_map

    def skip_node(self, uuid_str: str, node_id: str, user):
        mind_map = self.get_mind_map(uuid_str, user)
        if mind_map.user != user:
            raise HttpError(
                403, "Você precisa importar este mapa mental para alterar o progresso."
            )

        if not mind_map.completed_nodes:
            mind_map.completed_nodes = []

        updated_completed = list(mind_map.completed_nodes)
        if node_id not in updated_completed:
            updated_completed.append(node_id)
            mind_map.completed_nodes = updated_completed
            mind_map.save(update_fields=["completed_nodes"])
            invalidate_mind_map_cache(uuid_str, user.id)

        return {
            "success": True,
            "completed_nodes": mind_map.completed_nodes,
        }
