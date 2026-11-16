import {defineConfig,devices} from '@playwright/test'
export default defineConfig({
 testDir:'./e2e',testMatch:'public-workspace.spec.ts',workers:1,
 use:{baseURL:'http://127.0.0.1:4174',...devices['Desktop Chrome']},
 webServer:{command:'npm run dev -- --host 127.0.0.1 --port 4174',url:'http://127.0.0.1:4174',reuseExistingServer:false,
 env:{VITE_PUBLIC_WORKSPACE_ENABLED:'true',VITE_SUPABASE_URL:'https://public-fixture.supabase.co',VITE_SUPABASE_ANON_KEY:'fixture-only'}},
})
