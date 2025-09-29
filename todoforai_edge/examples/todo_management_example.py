import asyncio
import os
from todoforai_edge.edge import TODOforAIEdge
from todoforai_edge.config import Config
from todoforai_edge.utils import findBy

async def main():
    # Initialize edge with local development config
    api_key = os.getenv('TODOFORAI_API_KEY_LOCAL')
    if not api_key:
        print("Please set TODOFORAI_API_KEY_LOCAL environment variable")
        return
    
    config = Config()
    config.api_url, config.api_key = "http://localhost:4000", api_key
    
    edge = TODOforAIEdge(config)
    
    try:
        # List available agent settings
        print("Available Agent Settings:")
        agent_settings = await edge.list_agent_settings()
        print('agent_settings:', agent_settings)
        for agent in agent_settings:
            print(f"  - {agent['name']} (ID: {agent['id']})")
        
        if not agent_settings:
            print("No agent settings found!")
            return
        
        # Use simple condition function to find agent with 'edge' in name
        agent = findBy(agent_settings, lambda x: 'edge' in x['name'].lower()) or agent_settings[0]
        agentSettings = agent  # keep original variable name usage
        
        # List projects
        print("\nAvailable Projects:")
        projects = await edge.list_projects()
        for project in projects:
            print(f"  - {project['project']['name']} (ID: {project['project']['id']})")
        
        # Find project with 'email' in name (if any)
        email_project = findBy(projects, lambda x: 'email' in x['project']['name'].lower())
        if email_project:
            print(f"Found email project: {email_project['project']['name']}")
        
        if not projects:
            # Create a project if none exist
            print("No projects found, creating one...")
            project_response = await edge.create_project("Edge Test Project", "Created from Edge")
            project_id = project_response['project']['id']
            print(f"Created project: {project_id}")
        else:
            project_id = projects[0]['project']['id']
        
        # Example 1: Create a new todo with auto-generated ID
        print(f"\nExample 1: Creating new todo with auto-generated ID...")
        todo1 = await edge.add_message(
            project_id=project_id,
            content="This is a new todo created from Edge with auto-generated ID, so just say 'hi'",
            agent_settings_id=agentSettings['id'],
            auto_create=True
        )
        print(f"Created todo: {todo1['id']}")
        return
        
        # Example 2: Create a todo with custom ID
        print(f"\nExample 2: Creating new todo with custom ID...")
        custom_todo_id = "custom-todo-123"
        todo2 = await edge.add_message(
            project_id=project_id,
            content="This is a new todo with a custom ID",
            agent_settings_id=agent_id,
            todo_id=custom_todo_id,
            auto_create=True
        )
        print(f"Created todo with custom ID: {todo2['id']}")
        
        # Example 3: Add message to existing todo
        print(f"\nExample 3: Adding message to existing todo...")
        message_response = await edge.add_message(
            project_id=project_id,
            content="This is an additional message to the existing todo",
            agent_settings_id=agent_id,
            todo_id=todo1['id'],
            auto_create=False  # Don't create new todo, just add to existing
        )
        print(f"Added message to todo: {todo1['id']}")
        
        # Example 4: Scheduled message
        import time
        scheduled_time = int(time.time() * 1000) + 60000  # 1 minute from now
        print(f"\nExample 4: Creating scheduled todo...")
        scheduled_todo = await edge.add_message(
            project_id=project_id,
            content="This todo is scheduled for 1 minute from now",
            agent_settings_id=agent_id,
            scheduled_timestamp=scheduled_time,
            auto_create=True
        )
        print(f"Created scheduled todo: {scheduled_todo['id']}")
        
        # List todos in the project
        print(f"\nTodos in project {project_id}:")
        todos = await edge.list_todos(project_id)
        for todo in todos:
            print(f"  - {todo['id']}: {todo.get('content', 'No content')[:50]}... (Status: {todo['status']})")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())