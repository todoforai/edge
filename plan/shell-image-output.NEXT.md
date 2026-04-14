# Shell Image Output — Next Steps

## Status
- ✅ Edge: `detectContentType()` in `functions.ts` — done, deployed v0.12.15
- ✅ Agent: `BashTool.get_result()` with `contentType` → image attachment — done
- ✅ EasyContext: `resultimg2base64` override added to `ShellBlockTool.jl`
- ✅ Test file created: `EasyContext.jl/test/agents/test_shell_image_output.jl`
- 🔧 Tests not passing yet — need fixes below

## Test issues to fix

### 1. Text-extraction tests (tests 1-3) don't work with NativeExtractor
`collect_execution_results()` expects old `CallExtractor`, not `NativeExtractor`.
**Fix:** Drop these tests. Use only the native tool call path (test 4) — that's the real path anyway.

### 2. Native tool call test: `image_data` is `nothing`
`resultimg2base64(tool::BashTool)` IS registered (confirmed via `methods()`), but the shell output in `run_results` may include extra formatting from `format_cmd_output()` (exit code, stderr) that breaks the regex match.
**Debug:** Print `tool.run_results` after execution to see exact content. The regex `^data:image/...` requires the ENTIRE output to be a data URL — any extra text breaks it.
**Likely fix:** `format_cmd_output` appends exit status. Either strip it before matching, or match within the output instead of requiring full match.

### 3. E2E test: `work()` doesn't accept `no_confirm` kwarg
`work()` passes it via `tool_kwargs=Dict(:no_confirm => true)`.
**Fix:** `work(agent, session; tool_kwargs=Dict(:no_confirm => true), quiet=true, io=devnull)`

## Simplified test plan

```julia
@testset "Shell Image Output" begin
    @testset "NativeExtractor produces ToolMessage with image_data" begin
        extractor = NativeExtractor([BashTool]; no_confirm=true)
        tool_calls = [Dict(
            "id" => "call_test",
            "type" => "function",
            "function" => Dict("name" => "bash", "arguments" => """{"cmd": "printf 'data:image/png;base64,iVBOR...'"}""")
        )]
        process_native_tool_calls!(extractor, tool_calls, devnull)
        msgs = collect_tool_messages(extractor)
        @test msgs[1].image_data !== nothing
    end

    @testset "E2E: LLM sees image" begin
        agent = create_FluidAgent("haiku"; tools=[BashTool], extractor_type=NativeExtractor)
        session = Session()
        push_message!(session, create_user_message("Run: printf 'data:image/png;base64,...' and describe the image"))
        response = work(agent, session; tool_kwargs=Dict(:no_confirm => true), quiet=true, io=devnull)
        @test any(w -> occursin(w, lowercase(response.content)), ["image", "red", "pixel", "png"])
    end
end
```

## Key debug step
Run this to see what `run_results` actually contains after shell execution:
```julia
julia -e '
using EasyContext; using EasyContext: NativeExtractor, process_native_tool_calls!
using ToolCallFormat: resultimg2base64
ext = NativeExtractor([BashTool]; no_confirm=true)
process_native_tool_calls!(ext, [Dict("id"=>"x","type"=>"function","function"=>Dict("name"=>"bash","arguments"=>"{\"cmd\":\"printf data:image/png;base64,abc\"}"))], devnull)
tool = fetch(first(values(ext.tool_tasks)))
println("run_results: ", repr(tool.run_results))
println("imgs: ", resultimg2base64(tool))
'
```

If `run_results` has extra text (exit code etc), adjust the regex in `ShellBlockTool.jl` to extract the data URL from within the output rather than requiring full match.

## Files modified
- `EasyContext.jl/src/tools/ShellBlockTool.jl` — added `resultimg2base64` override (6 lines)
- `EasyContext.jl/test/agents/test_shell_image_output.jl` — test file (needs fixes above)
