import asyncio
import os
import time
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
        
        agentname_query = "B / E"
        agentname_query = "edge"
        # Use simple condition function to find agent with 'edge' in name
        agent = findBy(agent_settings, lambda x: agentname_query in x['name'].lower()) or agent_settings[0]
        agentSettings = agent  # keep original variable name usage
        
        # List projects
        print("\nAvailable Projects:")
        projects = await edge.list_projects()
        for project in projects:
            print(f"  - {project['project']['name']} (ID: {project['project']['id']})")
        
        # Find project with 'email' in name (if any)
        email_project = findBy(projects, lambda x: 'email' in x['project']['name'].lower())
        if email_project:
            print(f"Found email project: {email_project['project']['name']} (ID: {email_project['project']['id']})")
        else:
            return
        
        project_id = email_project['project']['id']
        
        # Example 1: Create a new todo with auto-generated ID
        print(f"\nExample 1: Creating new todo with auto-generated ID...")
        custom_todo_id = "custom-todo-123"
        todo1 = await edge.add_message(
            project_id=project_id,
            todo_id=custom_todo_id,
            content="A new todo created from Edge with auto-generated ID, so just say 'hi'",
            agent_settings=agentSettings,  # Pass full object
        )
        print(f"Created todo: {todo1['id']}")
        
        time.sleep(5)
        # Example 2: Try adding message to existing todo (might be running)
        print(f"\nExample 2: Adding message to existing todo...")
        message_response = await edge.add_message(
            project_id=project_id,
            content="This is an additional message to the existing todo",
            agent_settings=agentSettings,
            todo_id=todo1['id'],
            allow_queue=True
        )
        print(f"Added message to todo: {todo1['id']}")
        
        # List todos in the project
        print(f"\nTodos in project {project_id}:")
        todos = await edge.list_todos(project_id)
        print('Length of todos:', len(todos))
        print("Exampmle todo fields:", todos[0])
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())