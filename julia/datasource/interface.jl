# Abstract interface for data sources

# Required methods that need to be implemented by concrete data sources
# User operations
function get_user end
function update_user end

# User Settings operations
function get_user_settings end
function update_user_settings end

# Project operations
function list_projects end
function create_project end
function update_project end
function share_project end

# Project Settings operations
function update_project_settings end

# Todo operations
function list_todos end
function create_todo end
function update_todo_status end
function add_todo_message end
function get_todo end
function delete_todo end
function update_todo end

# Transaction operations
function list_transactions end
function get_balance end

# Session operations
function get_current_session end

# User-level datasource operations
function get_user_datasource end
function set_user_datasource end

# Project-level datasource operations
function get_project_datasource end
function set_project_datasource end

# Workflow operations
function get_workflow_state end

export ServerDataSource, MemoryDataSource, update_project_settings, update_user_settings

