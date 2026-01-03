# Real-Time Leaderboard System

Backend service for a game that tracks players' scores in real-time and maintains a leaderboard.

## Tech Stack

- Node.js + Express
- Socket.io (WebSockets)
- Redis (real-time leaderboard, TTL for daily reset)

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Copy the example env file and adjust if needed:

```bash
cp .env.example .env
```

3. Start Redis locally (default: `redis://127.0.0.1:6379`).

4. Run the server in dev mode:

```bash
npm run dev
```

Or production mode:

```bash
npm start
```

The server will listen on `http://localhost:4000` by default.

## HTTP API

- `POST /api/leaderboard/score`

  Body JSON:

  ```json
  {
    "playerId": "p1",
    "username": "Alice",
    "region": "NA",
    "mode": "ranked",
    "delta": 50
  }
  ```

- `GET /api/leaderboard/top?mode=ranked&region=NA&limit=10`

  Query params:

  - `mode` (required)
  - `region` (optional)
  - `limit` (optional, default 10)

## Socket.io Events

- **Client → Server**

  - `leaderboard:join` – join rooms by region/mode

    ```js
    socket.emit('leaderboard:join', { region: 'NA', mode: 'ranked' });
    ```

  - `score:update` – update a player's score

    ```js
    socket.emit(
      'score:update',
      {
        playerId: 'p1',
        username: 'Alice',
        region: 'NA',
        mode: 'ranked',
        delta: 50
      },
      (ack) => {
        console.log('ack', ack);
      }
    );
    ```

  - `leaderboard:getTop` – fetch top N via WebSocket

    ```js
    socket.emit(
      'leaderboard:getTop',
      { region: 'NA', mode: 'ranked', limit: 10 },
      (response) => {
        console.log(response);
      }
    );
    ```

- **Server → Client**

  - `score:updated` – broadcast when any score changes in a joined room

    ```json
    {
      "playerId": "p1",
      "region": "NA",
      "mode": "ranked",
      "globalScore": 150,
      "regionScore": 150
    }
    ```

## Daily Reset Strategy

- Leaderboard keys are namespaced per UTC day, e.g. `lb:2026-01-03:mode:ranked`.
- Keys are given a TTL that expires at the next UTC midnight, so daily leaderboards reset automatically.
