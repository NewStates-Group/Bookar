from ninja.errors import HttpError
from .models import MindMap
from .tasks import generate_mind_map_task


class MindMapService:

    def list_mind_maps(self, user):
        return MindMap.objects.filter(user=user).order_by("-created_at")

    def create_mind_map(self, user, topic: str, language: str = "pt"):
        mind_map = MindMap.objects.create(
            user=user,
            topic=topic,
            language=language,
            title="Gerando...",
            desc=(
                "Seu mapa mental está sendo gerado pela nossa inteligência"
                " artificial."
            ),
        )

        generate_mind_map_task.delay(user.pk, mind_map.pk)
        return mind_map

    def get_mind_map(self, uuid_str: str, user):
        try:
            return MindMap.objects.get(uuid=uuid_str, user=user)
        except MindMap.DoesNotExist:
            raise HttpError(
                404,
                "Mapa mental não encontrado ou você não tem acesso a ele.",
            )

    def delete_mind_map(self, uuid_str: str, user):
        mind_map = self.get_mind_map(uuid_str, user)
        mind_map.delete()
        return {"success": True, "message": "Mapa mental eliminado."}
