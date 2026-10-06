import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter, createRootRoute, createRoute, Outlet } from '@tanstack/react-router'
import './styles.css'
import { Landing } from './routes/Landing'
import { Build } from './routes/Build'
import { Share } from './routes/Share'
import { ItPainters } from './routes/ItPainters'
import { NotFound } from './routes/NotFound'
import { Aperto } from './routes/Aperto'

const rootRoute = createRootRoute({
  component: Outlet,
  notFoundComponent: NotFound,
})
const routeTree = rootRoute.addChildren([
  createRoute({ getParentRoute: () => rootRoute, path: '/', component: Landing }),
  createRoute({
    getParentRoute: () => rootRoute, path: '/build', component: Build,
    validateSearch: (s: Record<string, unknown>) => ({ template: typeof s.template === 'string' ? s.template : undefined }),
  }),
  createRoute({ getParentRoute: () => rootRoute, path: '/q', component: Share }),
  createRoute({ getParentRoute: () => rootRoute, path: '/it/quanto-costa-imbiancare', component: ItPainters }),
  createRoute({ getParentRoute: () => rootRoute, path: '/aperto', component: Aperto }),
])

const router = createRouter({ routeTree, defaultPreload: 'intent', scrollRestoration: true })
declare module '@tanstack/react-router' { interface Register { router: typeof router } }

createRoot(document.getElementById('app')!).render(<StrictMode><RouterProvider router={router} /></StrictMode>)
