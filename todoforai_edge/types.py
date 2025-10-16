from typing import TypedDict, Dict, Any, List, Optional


class Project(TypedDict, total=False):
    id: str
    name: str
    description: Optional[str]
    isPublic: bool
    ownerId: str
    ownerEmail: str
    todoIds: List[str]
    readAccessIds: List[str]
    writeAccessIds: List[str]
    readAccessEmails: List[str]
    writeAccessEmails: List[str]
    context: Optional[Any]
    projectSettingsId: str
    isDefault: bool
    status: str
    createdAt: int
    updatedAt: int
    archivedAt: Optional[int]
    deletedAt: Optional[int]
    dataSourceIds: List[str]


class ProjectSettings(TypedDict, total=False):
    id: str
    projectId: str
    createdAt: int
    updatedAt: int
    # Extend here if backend adds more project settings fields


class ProjectListItem(TypedDict, total=False):
    project: Project
    settings: ProjectSettings


class AgentSettings(TypedDict, total=False):
    id: str
    name: str
    ownerId: str
    createdAt: int
    systemMessage: Optional[str]
    mcpConfigs: Dict[str, Any]
    edgesMcpConfigs: Dict[str, Any]
    skills: Dict[str, Any]
    model: str
    plannerModel: Optional[str]
    automaticInstantDiff: bool
    automaticRunShell: bool


class TodoMessage(TypedDict, total=False):
    id: str
    createdAt: int
    blockTypes: List[Any]
    blocks: Any
    ctx: Dict[str, Any]
    runMeta: List[Any]
    stop_sequence: str
    scheduledTimestamp: int
    todoId: str
    role: str
    content: str
    agentSettingsId: str
    attachmentIds: List[str]
    attachments: List[Dict[str, Any]]


class Todo(TypedDict, total=False):
    id: str
    projectId: str
    status: str
    agentSettingsId: str
    content: str
    messageIds: List[str]
    messages: List[TodoMessage]
    createdAt: int
    lastActivityAt: int
    scheduledTimestamp: int
    isNewTodo: bool