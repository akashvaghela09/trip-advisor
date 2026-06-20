# Decision note

My three biggest decisions, why I made them, and what I left out.

**1. The model picks the steps, my code runs them**

- I split the work in two. One model call (I call it the planner) reads the request and decides which agents to run and in what order. Plain code (the executor) then runs those agents one by one and feeds each result into the next.
- I chose this over a free agent loop that keeps calling tools until it decides it is done. That style is harder to predict, test, and explain.
- I wanted to defend every line and show a clear, repeatable flow. A simple chain does that, and it still extends if a step needs to branch.

**2. Hard rules live in code, not in the prompt**

- Each agent has a strict rule, and I do not rely on the model to follow rules on its own.
- The budget agent only estimates costs. My code adds the items, compares the total to the budget, and decides if it is over. If it is over, I make one more call for a cheaper option and check that one too.
- This came from a real miss. An early version trusted the model: it invented a budget never asked for and set the currency to "day" (read from "day by day"). So I added guards that drop a made-up budget, a bad currency, or a city wrongly used as a region.

**3. One event stream does three jobs**

- The server sends a single stream of events. The same stream drives the live screen, the trace panel that shows what each agent did, and the saved audit log.
- The final answer is built from the real agent results. The model only rewrites it into friendly text and is told never to change a number.

**What I cut, and why**

- Multi-turn chat. Each request is its own run, with a retry button for re-runs. Chat memory adds a lot of work for little gain here.
- Postgres and real login. I used SQLite behind a small interface so swapping later is easy, and a browser id for history.
- Streaming raw agent output. It showed messy JSON in the cards, so I removed it and now only stream the final summary.
