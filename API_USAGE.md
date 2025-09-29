# TODOforAI Edge - Todo Management

This example shows how to use the Edge for programmatic todo management.

## Basic Usage

```python
import asyncio
from todoforai_edge.edge import TODOforAIEdge

async def main():
    edge = TODOforAIEdge(config)
    await edge.ensure_api_key()
    
    # Get available agent settings
    agents = await edge.list_agent_settings()
    agent_id = agents[0]['id']
    
    # Get available projects
    projects = await edge.list_projects()
    project_id = projects[0]['project']['id']
    
    # Create new todo with auto-generated ID
    todo = await edge.add_message(
        project_id=project_id,
        content="Fix the login bug",
        agent_settings_id=agent_id,
        auto_create=True
    )
    
    # Add message to existing todo
    await edge.add_message(
        project_id=project_id,
        content="Additional context for the bug",
        agent_settings_id=agent_id,
        todo_id=todo['id'],
        auto_create=False
    )

asyncio.run(main())
```

## Available Methods

### Project Management
- `list_projects()` - List all accessible projects
- `create_project(name, description, is_public)` - Create a new project
- `delete_project(project_id)` - Delete a project by ID
- `get_todo(todo_id)` - Get a specific todo
- `list_todos(project_id)` - List todos in a project
- `update_todo_status(todo_id, status)` - Update todo status

### Agent Settings
- `list_agent_settings()` - List all available agent settings
- `get_agent_settings(agent_settings_id)` - Get specific agent settings

### Todo/Message Management
- `add_message(project_id, content, agent_settings_id, **options)` - Add message/create todo

#### add_message() Options:
- `todo_id` - Optional todo ID (auto-generated if not provided)
- `attachments` - List of file attachments
- `scheduled_timestamp` - Schedule the todo for later
- `auto_create` - Auto-create todo if it doesn't exist (default: True)

## Examples

### Create todo with custom ID
```python
todo = await edge.add_message(
    project_id="proj-123",
    content="Custom todo",
    agent_settings_id="agent-456",
    todo_id="my-custom-id",
    auto_create=True
)
```

### Schedule a todo
```python
import time
future_time = int(time.time() * 1000) + 3600000  # 1 hour from now

todo = await edge.add_message(
    project_id="proj-123",
    content="Scheduled task",
    agent_settings_id="agent-456",
    scheduled_timestamp=future_time,
    auto_create=True
)
```

### Add message with attachments
```python
attachments = [
    {
        "id": "file-123",
        "source": "document.pdf",
        "type": "application/pdf",
        "content": "base64-encoded-content",
        "status": "NEW"
    }
]

todo = await edge.add_message(
    project_id="proj-123",
    content="Review this document",
    agent_settings_id="agent-456",
    attachments=attachments,
    auto_create=True
)
```