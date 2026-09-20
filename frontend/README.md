# GridPulse AI — Frontend

An enterprise Battery Energy Storage System (BESS) dispatch, digital twin, and economic arbitrage platform. Developed for the MaVionix Optimization Challenge (Problem 07).

## Architecture

* **Framework:** React 19 + TypeScript + Vite
* **Routing:** React Router v7
* **Charts & Telemetry:** Recharts (responsive SVG rendering for SoC trajectories, hourly price spreads, and dispatch profits)
* **Design System:** Custom dark industrial engineering theme (Inter, JetBrains Mono, Tailwind CSS v4)
* **Optimization Backend:** Communicates with FastAPI backend powering MILP (PuLP + HiGHS), LightGBM quantile forecasting, and receding-horizon Model Predictive Control (MPC).

## Available Scripts

* `npm run dev`: Launch local development server
* `npm run build`: Type-check and build production bundle
* `npm run preview`: Preview production build locally
* `npm run lint`: Run Oxlint static analysis
