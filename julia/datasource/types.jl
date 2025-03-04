using Dates

abstract type AbstractDataSource end

@kwdef mutable struct Message
    id::String = ""
    originalContent::String = ""
    role::String = ""
    todoId::String = ""
    blockTypes::Vector{String} = String[]
    blocks::String = ""
    ctx::Union{Dict{String,Any},Nothing} = nothing
    createdAt::Union{String,Nothing} = nothing
end

@kwdef mutable struct UserDataSource
    id::String = ""
    name::String = ""
    data::String = ""
    ownerId::String = ""
    createdAt::Union{String,Nothing} = nothing
    updatedAt::Union{String,Nothing} = nothing
end

@kwdef mutable struct ProjectDataSource
    id::String = ""
    name::String = ""
    data::String = ""
    projectId::String = ""
    createdAt::Union{String,Nothing} = nothing
    updatedAt::Union{String,Nothing} = nothing
end

@kwdef mutable struct UserSettings
    id::String = ""
    userId::String = ""
    fullName::Union{String,Nothing} = nothing
    anthropicAPIkey::Union{String,Nothing} = nothing
    openAIAPIkey::Union{String,Nothing} = nothing
    theme::String = "dark"
    llmModel::Union{String,Nothing} = nothing
    toolCodeExecution::Bool = true
    toolFileSystem::Bool = true
    toolShellAccess::Bool = true
    toolWebAccess::Bool = false
    workspacePaths::Vector{String} = String[]
    diff::String = "AutoDiff"
    shellExecution::String = "wait_for_confirmation"
end

@kwdef mutable struct ProjectSettings
    id::String = ""
    projectId::String = ""
    llmModel::Union{String,Nothing} = nothing
    toolCodeExecution::Bool = true
    toolFileSystem::Bool = true
    toolShellAccess::Bool = true
    toolWebAccess::Bool = false
    workspacePaths::Vector{String} = String[]
    diff::String = "AutoDiff"
    shellExecution::String = "wait_for_confirmation"
end

@kwdef mutable struct TodoSettings
    id::String = ""
    todoId::String = ""
    llmModel::Union{String,Nothing} = nothing
    toolCodeExecution::Bool = true
    toolFileSystem::Bool = true
    toolShellAccess::Bool = true
    toolWebAccess::Bool = false
    workspacePaths::Vector{String} = String[]
    diff::String = "AutoDiff"
    shellExecution::String = "wait_for_confirmation"
end

@kwdef mutable struct Todo
    id::String = ""
    projectId::String = ""
    status::String = "TODO"
    messages::Vector{Message} = Message[]
    agentId::Union{String,Nothing} = nothing
    systemMessageId::Union{String,Nothing} = nothing
    workflowMeta::Union{String,Nothing} = nothing    # Add this field
    workflowVersion::Union{String,Nothing} = nothing # Add this field
    createdAt::Union{String,Nothing} = nothing
    lastActivityAt::Union{String,Nothing} = nothing
    archivedAt::Union{String,Nothing} = nothing
    deletedAt::Union{String,Nothing} = nothing
end

@kwdef mutable struct Project
    id::String = ""
    name::String = ""
    description::Union{String,Nothing} = nothing
    ownerId::String = ""
    isPublic::Bool = false
    configurations::Dict = Dict()
    workspacePaths::Vector{String} = String[]
    context::Union{String,Nothing} = nothing
    llmModel::String = ""
    tools::String = ""
    collaboratorIds::Vector{String} = String[]
    writeAccessIds::Vector{String} = String[]
    diff::Union{String,Nothing} = nothing
    status::String = "ACTIVE"
    defaultAgentId::Union{String,Nothing} = nothing
    isDefault::Bool = false
    archivedAt::Union{String,Nothing} = nothing
    deletedAt::Union{String,Nothing} = nothing
    agentId::Union{String,Nothing} = nothing
    agentName::Union{String,Nothing} = nothing
    agentUrl::Union{String,Nothing} = nothing
    createdAt::Union{String,Nothing} = nothing
end

@kwdef mutable struct User
    id::String = ""
    email::String = ""
    fullName::String = ""
    profilePicture::Union{String,Nothing} = nothing
    balance::Float64 = 0.0
    freeTrialTodosLeft::Int = 0
    isTemporary::Bool = false
    blocked::Bool = false
    lastFreeTrialReset::Union{String,Nothing} = nothing
    lastProjectId::Union{String,Nothing} = nothing
end

@kwdef mutable struct IDMapper
    project_map::Dict{String, String} = Dict{String, String}()  # short -> long
    todo_map::Dict{String, String} = Dict{String, String}()     # short -> long
    datasource_map::Dict{String, String} = Dict{String, String}()  # short -> long
    reverse_project_map::Dict{String, String} = Dict{String, String}()  # long -> short
    reverse_todo_map::Dict{String, String} = Dict{String, String}()     # long -> short
    reverse_datasource_map::Dict{String, String} = Dict{String, String}()  # long -> short
    next_project_id::Int = 1
    next_todo_id::Int = 1
    next_datasource_id::Int = 1
end

@kwdef mutable struct TODO4AICTX
    projects::Vector{Project} = Project[]
    todos::Dict{String, Vector{Todo}} = Dict{String, Vector{Todo}}()
    user_datasources::Vector{UserDataSource} = UserDataSource[]
    user_settings::UserSettings = UserSettings()
    project_datasources::Dict{String, Vector{ProjectDataSource}} = Dict{String, Vector{ProjectDataSource}}()
    project_settings::Dict{String, ProjectSettings} = Dict{String, ProjectSettings}()
    id_mapper::IDMapper = IDMapper()
end


# Helper function
EmptyTodo() = Todo()

@kwdef mutable struct TaskContent
    content::String = ""
    todoId::String = ""
end

@kwdef mutable struct AITask
    id::String = ""
    content::TaskContent = TaskContent()
    type::String = "new:tasks"
    createdAt::Union{String,Nothing} = nothing
end


function Base.merge(user::UserSettings, project::ProjectSettings)::TodoSettings
    TodoSettings(
        id = project.id,
        todoId = project.projectId,
        llmModel = project.llmModel === nothing ? user.llmModel : project.llmModel,
        toolCodeExecution = project.toolCodeExecution,
        toolFileSystem = project.toolFileSystem,
        toolShellAccess = project.toolShellAccess,
        toolWebAccess = project.toolWebAccess,
        workspacePaths = !isempty(project.workspacePaths) ? project.workspacePaths : user.workspacePaths,
        diff = project.diff,
        shellExecution = project.shellExecution
    )
end

export User, Project, Todo, EmptyTodo, TODO4AICTX, refresh!
export AbstractDataSource, encode_project_id!, encode_todo_id!, decode_project_id, decode_todo_id
export UserDataSource, ProjectDataSource, ProjectSettings, UserSettings, TodoSettings
export AITask, TaskContent

