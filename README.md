# Painturillo_Game

A simple multiplayer drawing game inspired by Pinturillo, built with Node.js,
Express and Socket.io.

## What it demonstrates

- Real-time communication between a Node.js server and browser clients.
- A lobby flow and a game room with shared state.
- Running the same server locally or through a host so other players can join.

## Structure

```text
server.js          Express + Socket.io server
public/
├── index.html     entry page
├── lobby.html     lobby page
├── lobby.js       lobby client logic
├── game.html      game page
├── game.js        game client logic
└── style.css      shared styles
```

## Run locally

Requirements: Node.js and npm.

```sh
npm install
npm start
```

Then open the address printed by the server in a browser. To play with others,
share the host address instead of `localhost`.
