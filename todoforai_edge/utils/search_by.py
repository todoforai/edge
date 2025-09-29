from typing import List, Dict, Any, Optional, Callable

def findBy(items: List[Dict[str, Any]], condition: Callable[[Dict[str, Any]], bool]) -> Optional[Dict[str, Any]]:
    """
    Find first item matching the condition function.
    
    Usage:
        findBy(agents, lambda x: 'edge' in x['name'].lower())
        findBy(projects, lambda x: 'email' in x['project']['name'].lower())
        findBy(items, lambda x: x.get('status') == 'active')
    """
    return next((item for item in items if condition(item)), None)

