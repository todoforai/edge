#!/usr/bin/env python3
"""
Comprehensive Puppeteer MCP stress testing - multiple tool calls, navigations, and edge cases
"""

import asyncio
import json
import time
import sys
import subprocess
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from todoforai_edge.mcp_collector import MCPCollector
from todoforai_edge.edge_config import EdgeConfig

async def test_puppeteer_navigation_stress():
    """Test multiple rapid navigations to different sites"""
    
    print("🌐 Puppeteer Navigation Stress Test")
    print("=" * 50)
    
    edge_config = EdgeConfig()
    collector = MCPCollector(edge_config)
    
    try:
        await collector.load_from_file("mcp.json")
        
        # Test URLs - mix of fast and slow sites
        test_urls = [
            "https://example.com",
            "https://httpbin.org/html",
            "https://jsonplaceholder.typicode.com/",
            "https://httpbin.org/json",
            "https://www.google.com",
            "https://github.com",
        ]
        
        print(f"🧪 Testing navigation to {len(test_urls)} different sites...")
        
        for i, url in enumerate(test_urls):
            print(f"   Navigation {i+1}/{len(test_urls)}: {url}")
            start_time = time.time()
            
            try:
                result = await asyncio.wait_for(
                    collector.call_tool("puppeteer_navigate", {"url": url}),
                    timeout=8.0  # 8 second timeout for navigation
                )
                
                nav_time = time.time() - start_time
                
                if 'error' in str(result).lower():
                    print(f"   ❌ Navigation {i+1} failed: {str(result)[:100]}...")
                else:
                    print(f"   ✅ Navigation {i+1} in {nav_time:.2f}s")
                    
                # Quick screenshot after each navigation
                screenshot_start = time.time()
                screenshot_result = await asyncio.wait_for(
                    collector.call_tool("puppeteer_screenshot", {"filename": f"nav_{i}.png"}),
                    timeout=3.0
                )
                screenshot_time = time.time() - screenshot_start
                print(f"      📸 Screenshot in {screenshot_time:.2f}s")
                
            except asyncio.TimeoutError:
                print(f"   ❌ Navigation {i+1} TIMEOUT (>8s)")
            except Exception as e:
                print(f"   ❌ Navigation {i+1} error: {e}")
            
            # Small delay between navigations
            await asyncio.sleep(0.5)
        
    except Exception as e:
        print(f"❌ Navigation stress test failed: {e}")
    finally:
        collector.disconnect()

async def test_puppeteer_interaction_chain():
    """Test chained interactions: navigate -> screenshot -> interact -> screenshot"""
    
    print("\n🔗 Puppeteer Interaction Chain Test")
    print("=" * 50)
    
    edge_config = EdgeConfig()
    collector = MCPCollector(edge_config)
    
    try:
        await collector.load_from_file("mcp.json")
        
        # Chain 1: Navigate to example.com and interact
        print("🧪 Chain 1: Example.com interaction")
        
        # Step 1: Navigate
        print("   Step 1: Navigate to example.com...")
        start_time = time.time()
        nav_result = await collector.call_tool("puppeteer_navigate", {"url": "https://example.com"})
        nav_time = time.time() - start_time
        print(f"   ✅ Navigation in {nav_time:.2f}s")
        
        # Step 2: Screenshot
        print("   Step 2: Take screenshot...")
        start_time = time.time()
        screenshot_result = await collector.call_tool("puppeteer_screenshot", {"filename": "chain1_before.png"})
        screenshot_time = time.time() - start_time
        print(f"   ✅ Screenshot in {screenshot_time:.2f}s")
        
        # Step 3: Get interactable elements
        print("   Step 3: Get interactable elements...")
        start_time = time.time()
        elements_result = await collector.call_tool("puppeteer_interactable_elements", {})
        elements_time = time.time() - start_time
        print(f"   ✅ Elements scan in {elements_time:.2f}s")
        print(f"      Found elements: {str(elements_result)[:150]}...")
        
        # Step 4: Evaluate some JavaScript
        print("   Step 4: Evaluate JavaScript...")
        start_time = time.time()
        js_result = await collector.call_tool("puppeteer_evaluate", {
            "script": "document.title + ' - ' + window.location.href"
        })
        js_time = time.time() - start_time
        print(f"   ✅ JavaScript eval in {js_time:.2f}s")
        print(f"      Result: {str(js_result)[:100]}...")
        
        # Chain 2: Navigate to a form page and test interactions
        print("\n🧪 Chain 2: Form interaction test")
        
        # Step 1: Navigate to httpbin form
        print("   Step 1: Navigate to httpbin form...")
        start_time = time.time()
        nav_result = await collector.call_tool("puppeteer_navigate", {"url": "https://httpbin.org/forms/post"})
        nav_time = time.time() - start_time
        print(f"   ✅ Navigation in {nav_time:.2f}s")
        
        # Step 2: Screenshot before interaction
        screenshot_result = await collector.call_tool("puppeteer_screenshot", {"filename": "chain2_before.png"})
        
        # Step 3: Try to fill a form field (if it exists)
        print("   Step 3: Attempt form interaction...")
        try:
            fill_result = await asyncio.wait_for(
                collector.call_tool("puppeteer_fill", {
                    "selector": "input[name='custname']",
                    "value": "Test User"
                }),
                timeout=3.0
            )
            print(f"   ✅ Form fill: {str(fill_result)[:100]}...")
        except Exception as e:
            print(f"   ⚠️  Form fill failed (expected): {str(e)[:100]}...")
        
        # Step 4: Screenshot after interaction
        screenshot_result = await collector.call_tool("puppeteer_screenshot", {"filename": "chain2_after.png"})
        
    except Exception as e:
        print(f"❌ Interaction chain test failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        collector.disconnect()

async def test_puppeteer_rapid_fire_mixed():
    """Test rapid mixed operations to stress the system"""
    
    print("\n⚡ Puppeteer Rapid Fire Mixed Operations")
    print("=" * 50)
    
    edge_config = EdgeConfig()
    collector = MCPCollector(edge_config)
    
    try:
        await collector.load_from_file("mcp.json")
        
        # Navigate to a stable page first
        await collector.call_tool("puppeteer_navigate", {"url": "https://example.com"})
        await asyncio.sleep(1)  # Let it load
        
        print("🧪 Rapid fire test: 20 mixed operations in sequence")
        
        operations = [
            ("screenshot", {"filename": "rapid_{}.png"}),
            ("list_tabs", {}),
            ("evaluate", {"script": "document.title"}),
            ("interactable_elements", {}),
            ("evaluate", {"script": "window.location.href"}),
        ]
        
        total_start = time.time()
        
        for i in range(20):
            op_type, args = operations[i % len(operations)]
            if op_type == "screenshot":
                args = {"filename": f"rapid_{i}.png"}
            
            print(f"   Operation {i+1}/20: {op_type}...")
            start_time = time.time()
            
            try:
                result = await asyncio.wait_for(
                    collector.call_tool(f"puppeteer_{op_type}", args),
                    timeout=2.0  # Aggressive 2s timeout
                )
                
                op_time = time.time() - start_time
                print(f"   ✅ {op_type} in {op_time:.3f}s")
                
            except asyncio.TimeoutError:
                print(f"   ❌ {op_type} TIMEOUT (>2s)")
            except Exception as e:
                print(f"   ❌ {op_type} error: {str(e)[:50]}...")
        
        total_time = time.time() - total_start
        print(f"\n📊 Total time for 20 operations: {total_time:.2f}s")
        print(f"📊 Average time per operation: {total_time/20:.3f}s")
        
    except Exception as e:
        print(f"❌ Rapid fire test failed: {e}")
    finally:
        collector.disconnect()

async def test_puppeteer_tab_management():
    """Test tab creation, switching, and management"""
    
    print("\n🗂️  Puppeteer Tab Management Test")
    print("=" * 50)
    
    edge_config = EdgeConfig()
    collector = MCPCollector(edge_config)
    
    try:
        await collector.load_from_file("mcp.json")
        
        # Step 1: List initial tabs
        print("🧪 Step 1: List initial tabs")
        tabs_result = await collector.call_tool("puppeteer_list_tabs", {})
        print(f"   Initial tabs: {str(tabs_result)[:150]}...")
        
        # Step 2: Navigate to different sites in sequence (simulating new tabs)
        test_sites = [
            "https://example.com",
            "https://httpbin.org/html",
            "https://jsonplaceholder.typicode.com/"
        ]
        
        for i, site in enumerate(test_sites):
            print(f"🧪 Step {i+2}: Navigate to {site}")
            start_time = time.time()
            
            nav_result = await collector.call_tool("puppeteer_navigate", {"url": site})
            nav_time = time.time() - start_time
            print(f"   ✅ Navigation in {nav_time:.2f}s")
            
            # Take a screenshot of each site
            screenshot_result = await collector.call_tool("puppeteer_screenshot", {"filename": f"tab_{i}.png"})
            
            # List tabs after each navigation
            tabs_result = await collector.call_tool("puppeteer_list_tabs", {})
            print(f"   Tabs after navigation: {str(tabs_result)[:100]}...")
            
            await asyncio.sleep(0.5)  # Brief pause between navigations
        
    except Exception as e:
        print(f"❌ Tab management test failed: {e}")
    finally:
        collector.disconnect()

async def test_puppeteer_error_handling():
    """Test error handling with invalid operations"""
    
    print("\n🚨 Puppeteer Error Handling Test")
    print("=" * 50)
    
    edge_config = EdgeConfig()
    collector = MCPCollector(edge_config)
    
    try:
        await collector.load_from_file("mcp.json")
        
        error_tests = [
            ("Invalid URL", "puppeteer_navigate", {"url": "not-a-valid-url"}),
            ("Non-existent selector", "puppeteer_click", {"selector": "#non-existent-element"}),
            ("Invalid JavaScript", "puppeteer_evaluate", {"script": "invalid javascript syntax"}),
            ("Empty filename", "puppeteer_screenshot", {"filename": ""}),
        ]
        
        for i, (test_name, tool, args) in enumerate(error_tests):
            print(f"🧪 Error test {i+1}: {test_name}")
            start_time = time.time()
            
            try:
                result = await asyncio.wait_for(
                    collector.call_tool(tool, args),
                    timeout=5.0
                )
                
                test_time = time.time() - start_time
                
                if 'error' in str(result).lower():
                    print(f"   ✅ Properly handled error in {test_time:.2f}s: {str(result)[:100]}...")
                else:
                    print(f"   ⚠️  Unexpected success in {test_time:.2f}s: {str(result)[:100]}...")
                    
            except asyncio.TimeoutError:
                print(f"   ❌ Error test TIMEOUT (>5s)")
            except Exception as e:
                print(f"   ✅ Exception properly caught: {str(e)[:100]}...")
        
    except Exception as e:
        print(f"❌ Error handling test failed: {e}")
    finally:
        collector.disconnect()

async def main():
    """Run comprehensive Puppeteer tests"""
    print("🎭 Comprehensive Puppeteer MCP Test Suite")
    print("=" * 60)
    
    # Run all test suites
    await test_puppeteer_navigation_stress()
    await test_puppeteer_interaction_chain()
    await test_puppeteer_rapid_fire_mixed()
    await test_puppeteer_tab_management()
    await test_puppeteer_error_handling()
    
    print("\n🏁 All tests completed!")

if __name__ == "__main__":
    asyncio.run(main())