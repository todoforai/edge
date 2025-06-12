#!/usr/bin/env python3
"""
Example FastMCP server for TodoForAI - Task Management
"""

from fastmcp import FastMCP
from typing import List, Dict, Optional
import json
import os
from datetime import datetime

# Create server instance
mcp = FastMCP("todo-server")

# Simple in-memory storage (in production, use a database)
tasks_storage = {}
STORAGE_FILE = "tasks.json"

def load_tasks():
    """Load tasks from file"""
    global tasks_storage
    if os.path.exists(STORAGE_FILE):
        try:
            with open(STORAGE_FILE, 'r') as f:
                tasks_storage = json.load(f)
        except:
            tasks_storage = {}

def save_tasks():
    """Save tasks to file"""
    with open(STORAGE_FILE, 'w') as f:
        json.dump(tasks_storage, f, indent=2)

# Load tasks on startup
load_tasks()

@mcp.tool
def create_task(title: str, description: str = "", priority: str = "medium") -> dict:
    """Create a new task"""
    task_id = str(len(tasks_storage) + 1)
    task = {
        "id": task_id,
        "title": title,
        "description": description,
        "priority": priority,
        "status": "pending",
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat()
    }
    
    tasks_storage[task_id] = task
    save_tasks()
    
    return {"success": True, "task": task}

@mcp.tool
def list_tasks(status: str = "all") -> dict:
    """List tasks, optionally filtered by status"""
    if status == "all":
        filtered_tasks = list(tasks_storage.values())
    else:
        filtered_tasks = [task for task in tasks_storage.values() if task["status"] == status]
    
    return {
        "success": True,
        "tasks": filtered_tasks,
        "count": len(filtered_tasks)
    }

@mcp.tool
def update_task(task_id: str, title: str = None, description: str = None, 
                status: str = None, priority: str = None) -> dict:
    """Update an existing task"""
    if task_id not in tasks_storage:
        return {"success": False, "error": f"Task {task_id} not found"}
    
    task = tasks_storage[task_id]
    
    if title is not None:
        task["title"] = title
    if description is not None:
        task["description"] = description
    if status is not None:
        task["status"] = status
    if priority is not None:
        task["priority"] = priority
    
    task["updated_at"] = datetime.now().isoformat()
    save_tasks()
    
    return {"success": True, "task": task}

@mcp.tool
def delete_task(task_id: str) -> dict:
    """Delete a task"""
    if task_id not in tasks_storage:
        return {"success": False, "error": f"Task {task_id} not found"}
    
    deleted_task = tasks_storage.pop(task_id)
    save_tasks()
    
    return {"success": True, "deleted_task": deleted_task}

@mcp.tool
def get_task_stats() -> dict:
    """Get task statistics"""
    total = len(tasks_storage)
    pending = len([t for t in tasks_storage.values() if t["status"] == "pending"])
    completed = len([t for t in tasks_storage.values() if t["status"] == "completed"])
    in_progress = len([t for t in tasks_storage.values() if t["status"] == "in_progress"])
    
    return {
        "success": True,
        "stats": {
            "total": total,
            "pending": pending,
            "completed": completed,
            "in_progress": in_progress
        }
    }

@mcp.resource("tasks://all")
def all_tasks_resource() -> str:
    """Resource containing all tasks"""
    return json.dumps(list(tasks_storage.values()), indent=2)

@mcp.resource("tasks://stats")
def stats_resource() -> str:
    """Resource containing task statistics"""
    stats = get_task_stats()
    return json.dumps(stats["stats"], indent=2)

if __name__ == "__main__":
    mcp.run(transport="stdio")