from ninja import Schema


class FeedbackCreateIn(Schema):
    name: str
    email: str
    message: str
    token: str


class FeedbackOut(Schema):
    status: str
    message: str
