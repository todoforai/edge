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
    agent = agents[0]  # Use full agent object
    
    # Get available projects
    projects = await edge.list_projects()
    project_id = projects[0]['project']['id']
    
    # Create new todo with auto-generated ID
    todo = await edge.add_message(
        project_id=project_id,
        content="Fix the login bug",
        agent_settings=agent,  # Pass full agent object
        auto_create=True
    )
    
    # Add message to existing todo
    await edge.add_message(
        project_id=project_id,
        content="Additional context for the bug",
        agent_settings=agent,  # Pass full agent object
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
- `add_message(project_id, content, agent_settings, **options)` - Add message/create todo

#### add_message() Options:
- `todo_id` - Optional todo ID (auto-generated if not provided)
- `attachments` - List of file attachments
- `scheduled_timestamp` - Schedule the todo for later
- `allow_queue` - Allow queueing messages to running todos (default: False)

## Examples

### Create todo with custom ID
```python
# Get full agent settings object
agents = await edge.list_agent_settings()
agent = agents[0]

todo = await edge.add_message(
    project_id="proj-123",
    content="Custom todo",
    agent_settings=agent,  # Pass full agent object
    todo_id="my-custom-id"
)
```

### Schedule a todo
```python
import time
future_time = int(time.time() * 1000) + 3600000  # 1 hour from now

todo = await edge.add_message(
    project_id="proj-123",
    content="Scheduled task",
    agent_settings=agent,  # Pass full agent object
    scheduled_timestamp=future_time
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
    agent_settings=agent,  # Pass full agent object
    attachments=attachments
)
```

## Edge Functions

The edge exposes callable functions that can be invoked via function calls. These are available in the `FUNCTION_REGISTRY`.

### Download Chat
Download a todo with all its messages:

```python
from todoforai_edge.edge_functions import download_chat

result = await download_chat(todoId="todo-123", client_instance=edge)
if result["success"]:
    todo = result["todo"]
    print(f"Todo: {todo['title']}")
    for msg in todo.get("messages", []):
        print(f"  - {msg['content'][:50]}...")
```