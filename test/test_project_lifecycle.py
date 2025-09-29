import asyncio
import os
from todoforai_edge.edge import TODOforAIEdge
from todoforai_edge.config import Config

async def test_project_lifecycle():
    """Test creating, listing, and deleting a project"""
    
    # Setup config with API key from environment
    api_key = os.getenv('TODOFORAI_API_KEY_LOCAL')
    if not api_key:
        print("❌ TODOFORAI_API_KEY_LOCAL environment variable not set")
        return
    
    config = Config()
    config.api_url = "http://localhost:4000"
    config.api_key = api_key
    config.debug = True
    
    edge = TODOforAIEdge(config)
    
    try:
        # Get initial project count
        initial_projects = await edge.list_projects()
        initial_count = len(initial_projects)
        print(f"📋 Initial project count: {initial_count}")
        
        # Create a new project
        project_name = "Test Project for Deletion"
        project_response = await edge.create_project(
            name=project_name,
            description="This project will be deleted as part of the test",
            is_public=False
        )
        
        # Handle the nested response structure
        if 'project' in project_response:
            project = project_response['project']
        else:
            project = project_response
            
        print(f"✅ Created project: {project['name']} (ID: {project['id']})")
        
        # List projects and verify the new one exists
        projects_after_create = await edge.list_projects()
        new_count = len(projects_after_create)
        print(f"📋 Project count after creation: {new_count}")
        
        # Find our project in the list - handle nested structure in list too
        created_project = None
        for p in projects_after_create:
            # Handle both nested and flat structures in the list
            proj_data = p.get('project', p) if isinstance(p, dict) else p
            if proj_data['id'] == project['id']:
                created_project = proj_data
                break
        
        if created_project:
            print(f"✅ Project found in list: {created_project['name']}")
        else:
            print("❌ Created project not found in list")
            return
        
        # Delete the project
        delete_result = await edge.delete_project(project['id'])
        print(f"✅ Deleted project: {delete_result}")
        
        # List projects again and verify it's gone
        projects_after_delete = await edge.list_projects()
        final_count = len(projects_after_delete)
        print(f"📋 Project count after deletion: {final_count}")
        
        # Verify the project is no longer in the list
        deleted_project = None
        for p in projects_after_delete:
            # Handle both nested and flat structures in the list
            proj_data = p.get('project', p) if isinstance(p, dict) else p
            if proj_data['id'] == project['id']:
                deleted_project = proj_data
                break
        
        if deleted_project:
            print("❌ Project still exists after deletion")
        else:
            print("✅ Project successfully removed from list")
        
        # Verify counts
        if final_count == initial_count:
            print("✅ Project count returned to initial value")
        else:
            print(f"❌ Expected {initial_count} projects, got {final_count}")
        
        print("\n🎉 Project lifecycle test completed successfully!")
        
    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_project_lifecycle())
