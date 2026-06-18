from injector import inject
from ninja_extra import api_controller, route
from ninja.errors import HttpError

from .schemas import FeedbackCreateIn, FeedbackOut
from .services import FeedbackService


@api_controller("feedback", tags=["Feedback"], auth=None)
class FeedbackController:
    @inject
    def __init__(self, feedback_service: FeedbackService):
        self.feedback_service = feedback_service

    @route.post("", response=FeedbackOut)
    def submit_feedback(self, request, data: FeedbackCreateIn):
        try:
            return self.feedback_service.submit_feedback(
                name=data.name,
                email=data.email,
                message=data.message,
                token=data.token,
            )
        except ValueError as e:
            raise HttpError(400, str(e))
