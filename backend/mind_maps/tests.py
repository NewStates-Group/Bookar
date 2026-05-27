from django.test import TestCase
from django.contrib.auth import get_user_model
from unittest.mock import patch
from ninja.errors import HttpError
from .models import MindMap
from .services import MindMapService

User = get_user_model()

class MindMapInteractiveLearningTests(TestCase):

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser",
            email="testuser@example.com",
            password="Password123"
        )
        self.service = MindMapService()
        
        # Create a mock 3-level mind map
        self.mind_map = MindMap.objects.create(
            user=self.user,
            topic="Python programming",
            title="Python Roadmap",
            desc="Learn Python step-by-step",
            status="READY",
            language="pt",
            nodes=[
                {
                    "id": "module_1",
                    "level": 1,
                    "title": "Introdução",
                    "desc": "Básico do Python",
                    "children": [
                        {
                            "id": "subtopic_1",
                            "level": 2,
                            "title": "Variáveis",
                            "desc": "Conceito de variáveis",
                            "children": [
                                {
                                    "id": "lesson_1",
                                    "level": 3,
                                    "title": "Declaração de Variáveis",
                                    "desc": "Aprenda a declarar variáveis",
                                    "youtube_query": "python variaveis",
                                    "youtube_url": "https://youtube.com/watch?v=1"
                                },
                                {
                                    "id": "lesson_2",
                                    "level": 3,
                                    "title": "Tipos Primitivos",
                                    "desc": "Aprenda tipos primitivos",
                                    "youtube_query": "python tipos",
                                    "youtube_url": "https://youtube.com/watch?v=2"
                                }
                            ]
                        }
                    ]
                }
            ],
            completed_nodes=[],
            notes={},
            quizzes={}
        )

    def test_find_node_helper(self):
        """Verify that recursive _find_node finds Level 1, 2 and 3 nodes correctly."""
        node1 = self.service._find_node(self.mind_map.nodes, "module_1")
        self.assertIsNotNone(node1)
        self.assertEqual(node1["title"], "Introdução")

        node2 = self.service._find_node(self.mind_map.nodes, "subtopic_1")
        self.assertIsNotNone(node2)
        self.assertEqual(node2["title"], "Variáveis")

        node3 = self.service._find_node(self.mind_map.nodes, "lesson_1")
        self.assertIsNotNone(node3)
        self.assertEqual(node3["title"], "Declaração de Variáveis")

    @patch("courses.utils.generate_text_with_fallback")
    def test_get_node_content_on_demand_generation(self, mock_ai):
        """Verify that get_node_content correctly generates educational content on-demand."""
        # Setup mock AI JSON response
        mock_ai.return_value = '{"text_content": "# Declaração\\n\\nConteúdo teórico...", "additional_resources": [{"title": "MDN", "url": "https://mdn.org"}]}'
        
        result = self.service.get_node_content(str(self.mind_map.uuid), "lesson_1", self.user)
        
        self.assertIn("Conteúdo teórico", result["text_content"])
        self.assertEqual(len(result["additional_resources"]), 1)
        self.assertEqual(result["additional_resources"][0]["title"], "MDN")

        # Verify it cached it back in the database
        updated_map = MindMap.objects.get(uuid=self.mind_map.uuid)
        cached_node = self.service._find_node(updated_map.nodes, "lesson_1")
        self.assertIn("text_content", cached_node)
        self.assertEqual(cached_node["text_content"], result["text_content"])

    @patch("courses.utils.generate_text_with_fallback")
    def test_get_or_create_node_quiz_on_demand_generation(self, mock_ai):
        """Verify that quiz is generated dynamically and correctly sanitized of answers on return."""
        mock_ai.return_value = '{"questions": [{"id": 1, "type": "true_false", "question": "Python is dynamic?", "options": ["Verdadeiro", "Falso"], "correct_answer": "Verdadeiro"}]}'
        
        # Fetch the quiz
        result = self.service.get_or_create_node_quiz(str(self.mind_map.uuid), "lesson_1", self.user)
        
        # Correct answer must NOT be in the returned quiz context!
        self.assertEqual(len(result["questions"]), 1)
        self.assertEqual(result["questions"][0]["question"], "Python is dynamic?")
        self.assertNotIn("correct_answer", result["questions"][0])

        # But it MUST be saved inside the database model
        updated_map = MindMap.objects.get(uuid=self.mind_map.uuid)
        self.assertIn("lesson_1", updated_map.quizzes)
        self.assertEqual(updated_map.quizzes["lesson_1"]["questions"][0]["correct_answer"], "Verdadeiro")

    def test_submit_quiz_passing_and_progression_unlock(self):
        """Verify that passing a quiz >= 70% adds node to completed_nodes and unlocks progression."""
        # Set a pre-existing quiz with correct answer
        self.mind_map.quizzes = {
            "lesson_1": {
                "questions": [
                    {
                        "id": 1,
                        "type": "true_false",
                        "question": "O Python é compilado?",
                        "options": ["Verdadeiro", "Falso"],
                        "correct_answer": "Falso"
                    },
                    {
                        "id": 2,
                        "type": "multiple_choice",
                        "question": "Qual extensão do Python?",
                        "options": [".js", ".py"],
                        "correct_answer": ".py"
                    }
                ]
            }
        }
        self.mind_map.save()

        # Submit fully correct answers (100% score)
        submission = {"1": "Falso", "2": ".py"}
        res = self.service.submit_node_quiz(str(self.mind_map.uuid), "lesson_1", submission, self.user)
        
        self.assertTrue(res["passed"])
        self.assertEqual(res["score"], 100.0)
        self.assertIn("lesson_1", res["completed_nodes"])

        # Check database persistence
        updated_map = MindMap.objects.get(uuid=self.mind_map.uuid)
        self.assertIn("lesson_1", updated_map.completed_nodes)

    def test_submit_quiz_failing_keeps_progression_locked(self):
        """Verify that failing a quiz (< 70%) does not add the node to completed_nodes."""
        self.mind_map.quizzes = {
            "lesson_1": {
                "questions": [
                    {
                        "id": 1,
                        "type": "true_false",
                        "question": "Python é uma cobra?",
                        "options": ["Verdadeiro", "Falso"],
                        "correct_answer": "Verdadeiro"
                    },
                    {
                        "id": 2,
                        "type": "true_false",
                        "question": "Django é para JavaScript?",
                        "options": ["Verdadeiro", "Falso"],
                        "correct_answer": "Falso"
                    }
                ]
            }
        }
        self.mind_map.save()

        # Submit incorrect answers (0% score)
        submission = {"1": "Falso", "2": "Verdadeiro"}
        res = self.service.submit_node_quiz(str(self.mind_map.uuid), "lesson_1", submission, self.user)
        
        self.assertFalse(res["passed"])
        self.assertEqual(res["score"], 0.0)
        self.assertNotIn("lesson_1", res["completed_nodes"])

        # Check database persistence
        updated_map = MindMap.objects.get(uuid=self.mind_map.uuid)
        self.assertNotIn("lesson_1", updated_map.completed_nodes)

    def test_update_node_note_autosave(self):
        """Verify that personal notes are successfully updated/auto-saved."""
        note_content = "Minhas anotações da aula prática de Python!"
        result = self.service.update_node_note(str(self.mind_map.uuid), "lesson_1", note_content, self.user)
        
        self.assertTrue(result["success"])
        self.assertEqual(result["notes"]["lesson_1"], note_content)

        # Check database persistence
        updated_map = MindMap.objects.get(uuid=self.mind_map.uuid)
        self.assertEqual(updated_map.notes["lesson_1"], note_content)

    def test_robust_extract_json(self):
        """Verify that extract_json parses truncated or slightly invalid JSON from LLMs correctly."""
        from courses.utils import extract_json

        # Case 1: Standard valid JSON inside markdown block
        res = extract_json('```json\n{"text_content": "Valid Markdown content", "additional_resources": []}\n```')
        self.assertEqual(res["text_content"], "Valid Markdown content")

        # Case 2: Incomplete JSON with missing closing curly brace (needs auto-repair)
        res = extract_json('{"text_content": "Auto repaired content", "additional_resources": []')
        self.assertEqual(res["text_content"], "Auto repaired content")

        # Case 3: Incomplete JSON with unclosed double quotes and missing braces
        res = extract_json('{"text_content": "Truncated content without quote and brace')
        self.assertEqual(res["text_content"], "Truncated content without quote and brace")

        # Case 4: Completely truncated/mangled JSON starting from text_content
        res = extract_json('{"text_content": "Severely truncated content...')
        self.assertEqual(res["text_content"], "Severely truncated content...")

